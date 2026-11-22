// Progresso / diário e o feed de atividade.
//
// O progresso guarda o estado ACTUAL de um título; a `activity` guarda o que
// ACABOU (ver a nota em `recordActivity`). São duas perguntas diferentes, e é
// por isso que o feed não lê a `progress`.
import { db, tx } from "../db/index.js";
import { now } from "./util.js";

function toApiProgress(r) {
  return {
    type: r.media_type,
    tmdbId: r.external_id,
    title: r.title ?? null,
    poster: r.poster ?? null,
    season: r.season ?? null,
    episode: r.episode ?? null,
    position: r.position ?? null, // segundos a meio (para retomar)
    duration: r.duration ?? null, // duracao total em segundos
    provider: r.provider ?? null, // fonte (provider) que o user usava
    startedAt: r.started_at ?? null,
    finishedAt: r.finished_at ?? null,
    status: r.status ?? "watching",
    // Tempo visto acumulado. 0 nos progressos que ja existiam antes da migracao
    // 6 — a UI esconde a figura quando o total e' 0, em vez de mostrar "0 horas".
    secondsWatched: r.seconds_watched ?? 0,
    updatedAt: r.updated_at,
  };
}

export function listProgress(userId) {
  return db
    .prepare("SELECT * FROM progress WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId)
    .map((r) => toApiProgress(r));
}

/* ===== Atividade (feed) ===== */

// O `kind` diz a frase que a interface mostra. Um filme de anime (type
// "anime", sem episodio) e' um FILME, nao um episodio 0; uma serie sem numero
// de episodio e' uma serie, nao um filme. So' ha tres frases, e a decisao tem de
// ser a mesma na migracao (ver db/schema.js, migracao 10) e no codigo novo.
function tipoDeAtividade(type, season, episode) {
  if (type === "movie") return "movie";
  if (season != null || episode != null) return "episode";
  return type === "anime" ? "movie" : "series";
}

/**
 * Um titulo marcado como visto na biblioteca conta como FILME para o feed?
 *
 * `movie` e' trivial. O caso dificil e' o anime: na biblioteca o `type` e'
 * "anime" tanto para um filme como para uma serie (o id e' o do MAL), e o
 * cliente e' o unico que sabe qual e' — manda `isMovie` (as listas de filmes
 * de anime levam a marca). Sem isto, um filme de anime visto pela grelha
 * ficava de fora, porque o servidor ve "anime" e nao pode adivinhar.
 */
export function eFilme(type, isMovie) {
  if (type === "movie") return true;
  return type === "anime" && isMovie === true;
}

function toApiActivity(r) {
  return {
    id: r.id,
    user: {
      id: r.user_id,
      username: r.username ?? null,
      avatar: r.avatar ?? null,
    },
    type: r.media_type,
    tmdbId: r.external_id,
    title: r.title ?? null,
    poster: r.poster ?? null,
    // 0 e' o "nao se aplica" do indice unico (ver db/schema.js, migracao 10).
    season: r.season || null,
    episode: r.episode || null,
    kind: r.kind,
    watchedAt: r.watched_at,
  };
}

// Um titulo de feed nao precisa de mais do que isto, e o texto vem do corpo do
// pedido: sem tecto, uma linha do feed podia trazer dezenas de kB para quem te
// segue.
const TITULO_MAX = 300;

// Cartazes que se aceitam mostrar no feed. O `poster` tambem vem do cliente e
// aparece no browser de OUTRAS pessoas: um URL qualquer era um pixel de
// rastreio a carregar para quem te segue. Aceita-se o caminho do TMDB (que o
// cliente junta a `image.tmdb.org`) e os CDN que a app ja' usa para anime.
const CARTAZ_HOSTS = new Set(["image.tmdb.org", "cdn.myanimelist.net", "s4.anilist.co"]);

function tituloDoFeed(titulo) {
  if (titulo == null) return null;
  const t = String(titulo).trim();
  return t ? t.slice(0, TITULO_MAX) : null;
}

function cartazDoFeed(poster) {
  if (poster == null) return null;
  const p = String(poster).trim();
  if (!p) return null;
  if (p.startsWith("/")) return p; // caminho do TMDB
  try {
    const u = new URL(p);
    if (u.protocol !== "https:") return null;
    return CARTAZ_HOSTS.has(u.hostname.toLowerCase()) ? p : null;
  } catch {
    return null;
  }
}

/**
 * Regista um episodio/filme concluido. Chamado no fim, ANTES de o progresso
 * avancar para o episodio seguinte.
 *
 * O `ON CONFLICT` e' o que impede o feed de encher com o mesmo episodio quando
 * a pessoa carrega duas vezes em "terminei": a segunda vez sobe a data, em vez
 * de criar outra linha.
 */
export function recordActivity(e) {
  const quando = e.watchedAt || now();
  db.prepare(
    `INSERT INTO activity
       (user_id, media_type, external_id, title, poster, season, episode,
        kind, watched_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, media_type, external_id, season, episode) DO UPDATE SET
       title      = COALESCE(excluded.title, activity.title),
       poster     = COALESCE(excluded.poster, activity.poster),
       kind       = excluded.kind,
       watched_at = excluded.watched_at`
  ).run(
    e.userId,
    e.type,
    Number(e.tmdbId),
    tituloDoFeed(e.title),
    cartazDoFeed(e.poster),
    e.season ?? 0,
    e.episode ?? 0,
    e.kind === "episode" ? "episode" : e.kind === "series" ? "series" : "movie",
    quando,
    quando
  );
}

// Feed de quem o utilizador segue + ele proprio.
//
// Privacidade: so entram perfis publicos. Seguir um perfil privado NAO da'
// acesso ao diario — a regra e' a mesma de `canViewProfile`: publico -> todos,
// privado -> so o dono. O proprio utilizador entra sempre, mesmo que tenha o
// perfil privado.
export function listFeedActivity(viewerId, { limit = 20, offset = 0 } = {}) {
  const rows = db
    .prepare(
      `SELECT a.*, u.username, u.avatar
       FROM activity a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ?
          OR (
            u.is_public = 1
            AND a.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)
          )
       ORDER BY a.watched_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(viewerId, viewerId, limit + 1, offset);
  return {
    items: rows.slice(0, limit).map(toApiActivity),
    hasMore: rows.length > limit,
  };
}

export function listUserActivity(userId, { limit = 20, offset = 0 } = {}) {
  const rows = db
    .prepare(
      `SELECT a.*, u.username, u.avatar
       FROM activity a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ?
       ORDER BY a.watched_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId, limit + 1, offset);
  return {
    items: rows.slice(0, limit).map(toApiActivity),
    hasMore: rows.length > limit,
  };
}

export function getProgress(userId, type, tmdbId) {
  const r = db
    .prepare("SELECT * FROM progress WHERE user_id = ? AND media_type = ? AND external_id = ?")
    .get(userId, type, tmdbId);
  return r ? toApiProgress(r) : null;
}

// Garante que a linha existe. Chamar dentro de uma transaccao.
function ensureProgressRow(userId, type, tmdbId) {
  db.prepare(
    `INSERT INTO progress (user_id, media_type, external_id, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, media_type, external_id) DO NOTHING`
  ).run(userId, type, tmdbId, now());
}

function readProgress(userId, type, tmdbId) {
  const r = db
    .prepare("SELECT * FROM progress WHERE user_id = ? AND media_type = ? AND external_id = ?")
    .get(userId, type, tmdbId);
  return toApiProgress(r);
}

// Monta um UPDATE com as colunas que o patch traz, saltando valores undefined.
// E' o que permite distinguir as tres situations:
//   campo ausente / undefined -> nao mexe
//   campo a null              -> limpa
//   campo com valor           -> escreve
function patchProgress(userId, type, tmdbId, patch) {
  const COLS = [
    ["title", "title"],
    ["poster", "poster"],
    ["provider", "provider"],
    ["season", "season"],
    ["episode", "episode"],
    ["position", "position"],
    ["duration", "duration"],
    ["startedAt", "started_at"],
    ["finishedAt", "finished_at"],
    ["status", "status"],
  ];
  const cols = [];
  const params = [];
  for (const [key, col] of COLS) {
    if (patch[key] !== undefined) {
      cols.push(`${col} = ?`);
      params.push(patch[key]);
    }
  }
  // O tempo visto e' um ACUMULO, por isso nao se escreve como as outras colunas:
  // `seconds_watched = seconds_watched + ?`. Escrever `seconds_watched = ?`
  // substituiria o total por um intervalo e o "tempo total" seria sempre o do
  // ultimo save.
  if (patch.secondsWatched !== undefined) {
    cols.push("seconds_watched = COALESCE(seconds_watched, 0) + ?");
    params.push(patch.secondsWatched);
  }
  if (!cols.length) return;
  cols.push("updated_at = ?");
  params.push(now(), userId, type, tmdbId);
  db.prepare(
    `UPDATE progress SET ${cols.join(", ")}
     WHERE user_id = ? AND media_type = ? AND external_id = ?`
  ).run(...params);
}

// Inicio: regista o arranque (so a 1a vez ou num recomeco) e a posicao atual.
// Ao mudar de episodio, limpa a posicao guardada (para nao retomar no meio do
// episodio anterior); se for o mesmo episodio, mantem-na (retoma a meio).
export function startProgress(e) {
  return tx(() => {
    // Garante a linha ANTES de ler: o ON CONFLICT DO NOTHING nao sobrescreve
    // nada, por isso o estado antigo (season/episode/position) fica intacto.
    ensureProgressRow(e.userId, e.type, e.tmdbId);
    const cur = readProgress(e.userId, e.type, e.tmdbId);
    const sameEpisode = cur.season === (e.season ?? null) && cur.episode === (e.episode ?? null);
    const startedAt = !cur.startedAt || cur.status === "finished" ? now() : cur.startedAt;

    patchProgress(e.userId, e.type, e.tmdbId, {
      title: e.title,
      poster: e.poster,
      provider: e.provider,
      season: e.season,
      episode: e.episode,
      // A posicao so se mantem se continuamos no mesmo episodio.
      position: sameEpisode ? cur.position : null,
      startedAt,
      finishedAt: null,
      status: "watching",
    });
    return readProgress(e.userId, e.type, e.tmdbId);
  });
}

// Fim: marca acabado. Para episodicos com proximo episodio, avanca a posicao e
// mantem "a ver" (para continuar no episodio seguinte).
export function finishProgress(e) {
  return tx(() => {
    ensureProgressRow(e.userId, e.type, e.tmdbId);
    const cur = readProgress(e.userId, e.type, e.tmdbId);
    // So o `nextEpisode` e' obrigatorio. A TEMPORADA e' opcional, porque no anime
    // os episodios sao globais (1..N) e nao ha temporada: o cliente manda
    // `nextSeason: null` e antes isto era tratado como "nao ha proximo", o que
    // marcava o anime como acabado ao fim de cada episodio e o tirava do
    // "continua a ver" (medido a 2026-10-06, no Dragon Ball).
    const hasNext = e.nextEpisode != null;
    // O feed regista o episodio que acabou AGORA, antes de o progresso apontar
    // para o seguinte. Os valores vem do `e` (o cliente diz o que acabou de
    // ver), mas manter isto antes do `patchProgress` deixa a ordem do codigo a
    // contar a mesma historia que a ordem dos factos: primeiro o que se viu,
    // depois o que fica por ver.
    recordActivity({
      userId: e.userId,
      type: e.type,
      tmdbId: e.tmdbId,
      title: e.title ?? cur.title,
      poster: e.poster ?? cur.poster,
      season: e.season ?? null,
      episode: e.episode ?? null,
      kind: tipoDeAtividade(e.type, e.season, e.episode),
    });
    patchProgress(e.userId, e.type, e.tmdbId, {
      title: e.title,
      poster: e.poster,
      startedAt: cur.startedAt ?? now(),
      finishedAt: now(),
      // `position: null` apaga a posicao a meio: o proximo episodio comeca do
      // principio, e o "continua a ver" deixa de mostrar uma barra quase cheia.
      position: null,
      season: hasNext ? e.nextSeason ?? cur.season ?? null : e.season,
      episode: hasNext ? e.nextEpisode : e.episode,
      status: hasNext ? "watching" : "finished",
    });
    return readProgress(e.userId, e.type, e.tmdbId);
  });
}

// Importa uma entrada do diario com datas explicitas (MAL / Letterboxd). Usa a
// data de fim (ou inicio) como updated_at para o diario ficar por ordem de visto.
export function importProgress(e) {
  return tx(() => {
    ensureProgressRow(e.userId, e.type, e.tmdbId);
    // startedAt/finishedAt so entram se vierem no import. Passar null limpa a
    // data (ex.: reimportar do MAL um fim sem dia exato corrige o dia 1 que
    // antes ficou inventado). O Letterboxd nunca passa startedAt: fica intacto.
    patchProgress(e.userId, e.type, e.tmdbId, {
      title: e.title,
      poster: e.poster,
      season: e.season,
      episode: e.episode,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt,
      status: e.status || (e.finishedAt ? "finished" : "watching"),
    });
    db.prepare(
      `UPDATE progress SET updated_at = ?
       WHERE user_id = ? AND media_type = ? AND external_id = ?`
    ).run(e.finishedAt || e.startedAt || now(), e.userId, e.type, e.tmdbId);
    return readProgress(e.userId, e.type, e.tmdbId);
  });
}

// Edicao manual de uma entrada do diario (estado, datas, posicao).
export function updateProgress(userId, type, tmdbId, patch) {
  return tx(() => {
    ensureProgressRow(userId, type, tmdbId);
    patchProgress(userId, type, tmdbId, patch);
    return readProgress(userId, type, tmdbId);
  });
}

// Guarda a posicao atual (segundos) para retomar a meio. Cria a entrada se nao
// existir (ex.: utilizador saiu antes dos 5 min que o diario exige).
export function setProgressPosition(userId, type, tmdbId, { position, duration, season, episode, provider }) {
  return tx(() => {
    ensureProgressRow(userId, type, tmdbId);
    const cur = readProgress(userId, type, tmdbId);
    patchProgress(userId, type, tmdbId, {
      season,
      episode,
      provider,
      // `position`/`duration` so mexem quando vem valor (como no JSON antigo,
      // onde um undefined nao apagava nada).
      position: position != null ? Math.max(0, Math.floor(position)) : undefined,
      duration: duration != null ? Math.floor(duration) : undefined,
      startedAt: cur.startedAt ?? now(),
      status: !cur.status || cur.status === "finished" ? "watching" : cur.status,
      // Quanto tempo viu desde a ultima gravacao (ver `avancoVisto`). VAZIO quando
      // nao da para afirmar nada — que e' o caso normal quando o player so grava a
      // cada 10-20 s e o utilizador recuou.
      secondsWatched: avancoVisto(cur, position),
    });
    return readProgress(userId, type, tmdbId);
  });
}

/**
 * Quantos segundos a contar, dado o que se sabia antes e a posicao de agora.
 *
 * Regra, e o que ela deixa de fora esta' escrito de proposito:
 *
 *   - sem posicao anterior, ou sem `duration`: 0. Nao se sabe o intervalo entre
 *     duas gravacoes se nao se sabe onde estavam.
 *   - delta <= 0: 0. Voltar atras para ver de novo NAO conta. E' a decisao que
 *     evita contar a mesma cena tres vezes so' porque a pessoa saltou para tras.
 *   - delta > `TETO`: 0. Salto para a frente. Ninguem viu os 10 minutos que
 *     saltou, e somar o salto e' pior do que nao contar nada — distorca o total
 *     para cima todas as vezes que alguem usa a barra de procura.
 *   - delta normal: conta.
 *
 * O TETO e' a largura de um intervalo de gravacao com folga. O player grava a
 * cada 10-20 s, mas um `save` perdido ou um separador de rede atrasado pode
 * passar 30 s sem gravar nada, e nesse intervalo assiste-se legitimamente a mais
 * do que o tecto. Por isso o tecto e' bem acima do intervalo normal: e' preferivel
 * perder um intervalo de verdade a contar um salto.
 */
const TETO_AVANCO = 120; // segundos

function avancoVisto(cur, position) {
  if (position == null) return undefined;
  const nova = Math.max(0, Math.floor(position));
  // `cur.duration` e' o comprimento do episodio. Sem ele nao se sabe se um salto
  // de 400 s era para a frente (o resto) ou para tras (a rever).
  if (cur.position == null || !cur.duration) return 0;
  const delta = nova - cur.position;
  if (delta <= 0) return 0;
  if (delta > TETO_AVANCO) return 0;
  return delta;
}

export function deleteProgress(userId, type, tmdbId) {
  db.prepare(
    "DELETE FROM progress WHERE user_id = ? AND media_type = ? AND external_id = ?"
  ).run(userId, type, tmdbId);
}