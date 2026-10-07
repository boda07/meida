// Camada de dados (SQLite via node:sqlite, sem dependencias nativas).
//
// Este modulo expoe EXACTAMENTE as mesmas funcoes que a antiga versao em JSON,
// com os mesmos nomes e os mesmos argumentos. E' deliberado: as rotas e os
// servicos que importam daqui (auth, mal, anilist, letterboxd, debrid, progress,
// library, achievements, export) nao mudaram uma linha.
//
// A unica diferenca de fundo: antes cada `save()` reescrevia o `data.json`
// inteiro e a memoria era a fonte de verdade. Agora cada escrita e um INSERT ou
// UPDATE indexado, o que permite varios utilizadores a escrever ao mesmo tempo
// sem se sobrescreerem.
import { db, tx } from "./db/index.js";

const now = () => new Date().toISOString();

/* ===== Utilizadores ===== */
export function createUser(username, passwordHash) {
  const created = now();
  const r = db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(username, passwordHash, created);
  return {
    id: Number(r.lastInsertRowid),
    username,
    avatar: null,
    bio: null,
    isPublic: true,
    createdAt: created,
  };
}

// Devolve a linha crua (com password_hash) — e' o que o login usa para
// comparar o bcrypt. Nao usar fora do auth.
export function getUserByUsername(username) {
  const r = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  return r ? { ...r } : null;
}

// Perfil publico (sem password_hash): vai para o token, para /auth/me e para a
// area social. Inclui a privacidade porque e' o proprio utilizador que a define.
function toProfile(r) {
  return {
    id: r.id,
    username: r.username,
    avatar: r.avatar ?? null,
    bio: r.bio ?? null,
    isPublic: Boolean(r.is_public),
    createdAt: r.created_at,
  };
}

export function getUserById(id) {
  const r = db
    .prepare("SELECT id, username, avatar, bio, is_public, created_at FROM users WHERE id = ?")
    .get(id);
  return r ? toProfile(r) : null;
}

export function getProfileByUsername(username) {
  const r = db
    .prepare("SELECT id, username, avatar, bio, is_public, created_at FROM users WHERE username = ?")
    .get(username);
  return r ? toProfile(r) : null;
}

// Utilizador-stub local. Em modo "dados na nuvem" o servidor local guarda apenas
// dados locais (ex.: token do Real-Debrid) referenciando o id do utilizador
// remoto. Como user_tokens tem uma FK para users, criamos uma linha minima para
// esse id (sem password — nunca faz login por aqui).
export function ensureUserStub(id) {
  const existing = db
    .prepare("SELECT id, username, avatar, bio, is_public, created_at FROM users WHERE id = ?")
    .get(id);
  if (existing) return toProfile(existing);
  db.prepare(
    "INSERT OR IGNORE INTO users (id, username, password_hash, created_at) VALUES (?, ?, '!', ?)"
  ).run(id, `local:${id}`, now());
  const r = db
    .prepare("SELECT id, username, avatar, bio, is_public, created_at FROM users WHERE id = ?")
    .get(id);
  return r ? toProfile(r) : null;
}

export function setUserAvatar(id, avatar) {
  db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar ?? null, id);
  return getUserById(id);
}

// Actualiza o perfil. So mexe nos campos presentes (undefined = nao mexer);
// null limpa. `isPublic` decide se os outros podem ver a biblioteca.
export function setUserProfile(id, patch) {
  const cur = getUserById(id);
  if (!cur) return null;
  const avatar = patch.avatar !== undefined ? patch.avatar ?? null : cur.avatar;
  const bio =
    patch.bio !== undefined
      ? patch.bio == null
        ? null
        : String(patch.bio).trim().slice(0, 300) || null
      : cur.bio;
  const isPublic = patch.isPublic !== undefined ? (patch.isPublic ? 1 : 0) : cur.isPublic ? 1 : 0;
  db.prepare("UPDATE users SET avatar = ?, bio = ?, is_public = ? WHERE id = ?").run(
    avatar,
    bio,
    isPublic,
    id
  );
  return getUserById(id);
}

/* ===== Tokens de servicos externos ===== */
// Antes cada um era uma funcao a parte repetida quatro vezes. Agora e' uma
// tabela so; as funcoes ContinuAM separadas para os importadores nao mudarem.
function setToken(id, provider, payload) {
  db.prepare(
    `INSERT INTO user_tokens (user_id, provider, payload, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET
       payload = excluded.payload, updated_at = excluded.updated_at`
  ).run(id, provider, payload == null ? null : JSON.stringify(payload), now());
}

function getToken(id, provider) {
  const r = db
    .prepare("SELECT payload FROM user_tokens WHERE user_id = ? AND provider = ?")
    .get(id, provider);
  if (!r?.payload) return null;
  try {
    return JSON.parse(r.payload);
  } catch {
    return null;
  }
}

/* ===== Tokens do MyAnimeList (por utilizador) ===== */
// { accessToken, refreshToken, expiresAt, username }
export function setMalTokens(id, tokens) {
  setToken(id, "mal", tokens);
}
export function getMalTokens(id) {
  return getToken(id, "mal");
}

/* ===== Tokens do AniList (por utilizador) ===== */
export function setAnilistTokens(id, tokens) {
  setToken(id, "anilist", tokens);
}
export function getAnilistTokens(id) {
  return getToken(id, "anilist");
}

/* ===== Letterboxd (por utilizador) ===== */
// { username }
export function setLetterboxd(id, lb) {
  setToken(id, "letterboxd", lb);
}
export function getLetterboxd(id) {
  return getToken(id, "letterboxd");
}

/* ===== Real-Debrid (por utilizador) ===== */
// { token }
export function setDebrid(id, debrid) {
  setToken(id, "debrid", debrid);
}
export function getDebrid(id) {
  return getToken(id, "debrid");
}

/* ===== Biblioteca ===== */
// `external_id` = id do TMDB para movie/tv, id do MAL para anime. A API
// continua a expor isto como `tmdbId` (nome historico, usado em todo o lado).
// `genres` e' um array guardado como JSON — o driver inclui a extensao json1,
// por isso dava para indexar cada genero se um dia fizermos "titulos de acao".
function parseGenres(g) {
  if (!g) return [];
  try {
    const v = JSON.parse(g);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function toApi(r) {
  return {
    tmdbId: r.external_id,
    type: r.media_type,
    title: r.title,
    titleEn: r.title_en ?? null, // anime: titulo em ingles
    titleRomaji: r.title_romaji ?? null, // anime: titulo em romaji
    genres: parseGenres(r.genres), // generos/temas (para filtrar a lista)
    poster: r.poster,
    watched: r.watched,
    watchlist: r.watchlist,
    status: r.status ?? null, // "paused" | "dropped" | null (ver estadoDe)
    score: r.score, // nota pessoal (0-100)
    rating: r.rating ?? null, // media da comunidade (MAL/TMDB)
    updatedAt: r.updated_at,
  };
}

export function listLibrary(userId) {
  return db
    .prepare("SELECT * FROM library WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId)
    .map((r) => toApi(r));
}

export function getLibraryItem(userId, tmdbId, type) {
  const r = db
    .prepare("SELECT * FROM library WHERE user_id = ? AND external_id = ? AND media_type = ?")
    .get(userId, tmdbId, type);
  return r ? toApi(r) : null;
}

// entry: { userId, tmdbId, type, title, poster, watched, watchlist, score }
// Os campos opcionais so mexem quando vem um valor: sem o COALESCE, gravar so
// a nota apagava o genero que ja la estava.
// Todos os `?? null` sao obrigatorios: o driver do SQLite recusa `undefined`
// (so aceita null, numero, string, bigint e Uint8Array), e o `poster`/`title`
// podem nao vir em chamadas que so actualizam a nota.
export function upsertLibrary(entry) {
  db.prepare(
    `INSERT INTO library
       (user_id, media_type, external_id, title, title_en, title_romaji, poster,
        genres, watched, watchlist, status, score, rating, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, media_type, external_id) DO UPDATE SET
       title        = excluded.title,
       title_en     = COALESCE(excluded.title_en, library.title_en),
       title_romaji = COALESCE(excluded.title_romaji, library.title_romaji),
       poster       = excluded.poster,
       genres       = COALESCE(excluded.genres, library.genres),
       watched      = excluded.watched,
       watchlist    = excluded.watchlist,
       status       = excluded.status,
       score        = excluded.score,
       rating       = COALESCE(excluded.rating, library.rating),
       updated_at   = excluded.updated_at`
  ).run(
    entry.userId,
    entry.type,
    entry.tmdbId,
    entry.title ?? null,
    entry.titleEn ?? null,
    entry.titleRomaji ?? null,
    entry.poster ?? null,
    entry.genres === undefined ? null : JSON.stringify(entry.genres),
    (entry.watched ? 1 : 0),
    (entry.watchlist ? 1 : 0),
    entry.status === undefined || entry.status === null ? null : String(entry.status),
    entry.score ?? null,
    entry.rating ?? null,
    now()
  );
}

/**
 * Estado final de um item da biblioteca. E' a UNICA funcao que decide, para nao
 * cada consumidor inventar a sua regra (foi exactamente isso que deu no "a ver"
 * do perfil a contar a watchlist toda).
 *
 *   paused  -> "paused"     (em pausa)
 *   dropped -> "dropped"    (abandonado)
 *   watched -> "completed"  (visto)
 *   watchlist -> "plan"     (para ver)
 *   nada    -> "none"
 *
 * O `status` sobrepoe-se as flags porque os estados sao mutuamente exclusivos.
 */
export function estadoDe(e) {
  if (!e) return "none";
  if (e.status === "paused") return "paused";
  if (e.status === "dropped") return "dropped";
  if (e.watched) return "completed";
  if (e.watchlist) return "plan";
  return "none";
}

// Versão "safe" de upsert para imports: só actualiza campos explicitamente
// fornecidos (não apaga notas/visto que o ficheiro de export não traz). Preserva
// a data de atualização do ficheiro (se houver) para manter a ordem original.
export function upsertLibrarySafe(entry) {
  // watched/watchlist sao NOT NULL e o SQLite valida isso ANTES de resolver o
  // conflito do ON CONFLICT, portanto nao se pode mandar NULL aqui. Quando o
  // import nao traz a flag, escreve-se o valor que ja estava em vez de null
  // (num item novo e 0). O mesmo vale para o updated_at de um item que ja
  // existe: fica o antigo, para a ordem do import nao se desfazer.
  const ex = db
    .prepare("SELECT watched, watchlist, updated_at FROM library WHERE user_id = ? AND media_type = ? AND external_id = ?")
    .get(entry.userId, entry.type, entry.tmdbId);
  const flag = (v, atual) => (v != null ? (v ? 1 : 0) : atual ?? 0);
  const updatedAt = entry.updatedAt != null ? entry.updatedAt : ex?.updated_at ?? now();

  db.prepare(
    `INSERT INTO library
       (user_id, media_type, external_id, title, title_en, title_romaji, poster,
        genres, watched, watchlist, score, rating, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, media_type, external_id) DO UPDATE SET
       title        = COALESCE(excluded.title, library.title),
       title_en     = COALESCE(excluded.title_en, library.title_en),
       title_romaji = COALESCE(excluded.title_romaji, library.title_romaji),
       poster       = COALESCE(excluded.poster, library.poster),
       genres       = COALESCE(excluded.genres, library.genres),
       watched      = excluded.watched,
       watchlist    = excluded.watchlist,
       score        = COALESCE(excluded.score, library.score),
       rating       = COALESCE(excluded.rating, library.rating),
       updated_at   = excluded.updated_at`
  ).run(
    entry.userId,
    entry.type,
    entry.tmdbId,
    entry.title ?? null,
    entry.titleEn ?? null,
    entry.titleRomaji ?? null,
    entry.poster ?? null,
    Array.isArray(entry.genres) ? JSON.stringify(entry.genres) : null,
    flag(entry.watched, ex?.watched),
    flag(entry.watchlist, ex?.watchlist),
    entry.score != null ? Number(entry.score) : null,
    entry.rating != null ? Number(entry.rating) : null,
    updatedAt
  );
  return true;
}

// Atualiza so a media da comunidade, sem mexer no updated_at. Usado no
// backfill de itens antigos.
export function setLibraryRating(userId, tmdbId, type, rating) {
  db.prepare(
    "UPDATE library SET rating = ? WHERE user_id = ? AND external_id = ? AND media_type = ?"
  ).run(rating ?? null, userId, tmdbId, type);
}

// Atualiza so os generos, sem mexer no updated_at. Usado no backfill de itens
// antigos (ex.: filmes importados do Letterboxd que vieram sem generos).
export function setLibraryGenres(userId, tmdbId, type, genres) {
  if (!Array.isArray(genres) || !genres.length) return;
  db.prepare(
    "UPDATE library SET genres = ? WHERE user_id = ? AND external_id = ? AND media_type = ?"
  ).run(JSON.stringify(genres), userId, tmdbId, type);
}

export function deleteLibrary(userId, tmdbId, type) {
  db.prepare(
    "DELETE FROM library WHERE user_id = ? AND external_id = ? AND media_type = ?"
  ).run(userId, tmdbId, type);
}

// Limpa a watchlist (flag) por tipo ("movie"|"tv"|"anime"|"all"). Itens que
// fiquem sem nada (sem visto/nota) sao removidos; os vistos/avaliados ficam.
export function clearWatchlist(userId, type) {
  return tx(() => {
    const where = type === "all" ? "user_id = ?" : "user_id = ? AND media_type = ?";
    const params = type === "all" ? [userId] : [userId, type];
    const cleared = db
      .prepare(`UPDATE library SET watchlist = 0 WHERE ${where} AND watchlist = 1`)
      .run(...params).changes;
    db.prepare(
      `DELETE FROM library
       WHERE user_id = ? AND watched = 0 AND watchlist = 0 AND score IS NULL`
    ).run(userId);
    return cleared;
  });
}

/* ===== Progresso / Diario ===== */
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
    updatedAt: r.updated_at,
  };
}

export function listProgress(userId) {
  return db
    .prepare("SELECT * FROM progress WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId)
    .map((r) => toApiProgress(r));
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
    });
    return readProgress(userId, type, tmdbId);
  });
}

export function deleteProgress(userId, type, tmdbId) {
  db.prepare(
    "DELETE FROM progress WHERE user_id = ? AND media_type = ? AND external_id = ?"
  ).run(userId, type, tmdbId);
}

/* ===== Listas personalizadas =====
   Uma lista por utilizador. Os itens guardam titulo/cartaz no momento em que
   foram adicionados (nao precisa de re-pedir ao TMDB para mostrar a lista). */
function toApiList(l, count) {
  return { id: l.id, name: l.name, createdAt: l.created_at, count };
}

export function listLists(userId) {
  return db
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM list_items WHERE list_id = l.id) AS n
       FROM lists l WHERE l.user_id = ? ORDER BY l.created_at DESC`
    )
    .all(userId)
    .map((l) => toApiList(l, l.n));
}

export function getList(userId, id) {
  const l = db.prepare("SELECT * FROM lists WHERE user_id = ? AND id = ?").get(userId, id);
  if (!l) return null;
  const items = db
    .prepare("SELECT * FROM list_items WHERE list_id = ? ORDER BY added_at DESC")
    .all(id)
    .map((i) => ({
      tmdbId: i.external_id,
      type: i.media_type,
      title: i.title ?? null,
      poster: i.poster ?? null,
      addedAt: i.added_at ?? null,
    }));
  return { id: l.id, name: l.name, createdAt: l.created_at, items };
}

export function createList(userId, name) {
  const r = db
    .prepare("INSERT INTO lists (user_id, name, created_at) VALUES (?, ?, ?)")
    .run(userId, name, now());
  return toApiList({ id: Number(r.lastInsertRowid), name, created_at: now() }, 0);
}

export function renameList(userId, id, name) {
  const l = db.prepare("SELECT * FROM lists WHERE user_id = ? AND id = ?").get(userId, id);
  if (!l) return null;
  db.prepare("UPDATE lists SET name = ? WHERE id = ?").run(name, id);
  const n = db.prepare("SELECT COUNT(*) c FROM list_items WHERE list_id = ?").get(id).c;
  return toApiList({ ...l, name }, n);
}

export function deleteList(userId, id) {
  const r = db.prepare("DELETE FROM lists WHERE user_id = ? AND id = ?").run(userId, id);
  return r.changes > 0;
}

export function addListTitle(userId, listId, { tmdbId, type, title, poster }) {
  const l = db.prepare("SELECT id FROM lists WHERE user_id = ? AND id = ?").get(userId, listId);
  if (!l) return null;
  db.prepare(
    `INSERT INTO list_items (list_id, media_type, external_id, title, poster, added_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(list_id, media_type, external_id) DO NOTHING`
  ).run(listId, type, tmdbId, title ?? null, poster ?? null, now());
  return getList(userId, listId);
}

export function removeListTitle(userId, listId, tmdbId, type) {
  const l = db.prepare("SELECT id FROM lists WHERE user_id = ? AND id = ?").get(userId, listId);
  if (!l) return false;
  const r = db
    .prepare("DELETE FROM list_items WHERE list_id = ? AND external_id = ? AND media_type = ?")
    .run(listId, tmdbId, type);
  return r.changes > 0;
}

/* ===== Seguir utilizadores / perfis =====
   Cada linha de `follows` e' uma ligacao. O CHECK da tabela impede seguir-se a
   si proprio; aqui voltamos a validar para devolver um erro claro em vez de
   deixar o SQLite explodir. */

function toUserCard(u) {
  return { id: u.id, username: u.username, avatar: u.avatar ?? null };
}

export function followUser(followerId, followeeId) {
  if (Number(followerId) === Number(followeeId)) return { ok: false, error: "self" };
  if (!getUserById(followeeId)) return { ok: false, error: "notfound" };
  const r = db
    .prepare(
      `INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(follower_id, followee_id) DO NOTHING`
    )
    .run(followerId, followeeId, now());

  // So' se for mesmo um follow novo (o mesmo botao carregado outra vez nao notifica).
  if (r.changes > 0) {
    try {
      // kind "follow": nao ha comentario de referencia, por isso o store avisa
      // quem e' o seguido e guarda o id dele em ref_id, para o link ir ao perfil.
      criarNotificacao({ userId: followeeId, kind: "follow", actorId: followerId, refId: null });
    } catch {
      /* nunca rebata o follow */
    }
  }
  return { ok: true };
}

export function unfollowUser(followerId, followeeId) {
  const r = db
    .prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?")
    .run(followerId, followeeId);
  return { ok: true, removed: r.changes > 0 };
}

export function isFollowing(followerId, followeeId) {
  if (!followerId) return false;
  const r = db
    .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?")
    .get(followerId, followeeId);
  return Boolean(r);
}

export function followCounts(userId) {
  return {
    followers: db.prepare("SELECT COUNT(*) c FROM follows WHERE followee_id = ?").get(userId).c,
    following: db.prepare("SELECT COUNT(*) c FROM follows WHERE follower_id = ?").get(userId).c,
  };
}

export function listFollowers(userId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.avatar FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = ? ORDER BY f.created_at DESC`
    )
    .all(userId)
    .map(toUserCard);
}

export function listFollowing(userId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.avatar FROM follows f
       JOIN users u ON u.id = f.followee_id
       WHERE f.follower_id = ? ORDER BY f.created_at DESC`
    )
    .all(userId)
    .map(toUserCard);
}

export function searchUsers(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  return db
    .prepare("SELECT id, username, avatar FROM users WHERE username LIKE ? ORDER BY username LIMIT ?")
    .all(`%${q}%`, Math.max(1, Math.min(50, Number(limit) || 20)))
    .map(toUserCard);
}

// Regra de privacidade: perfil publico -> todos veem; privado -> so o proprio.
// (Seguir nao da' acesso; quem quer partilhar poem o perfil publico.)
export function canViewProfile(viewerId, profile) {
  if (!profile) return false;
  return Boolean(profile.isPublic) || Number(viewerId) === Number(profile.id);
}

/* ===== Comentarios por episodio =====
   Chave: (media_type, external_id, season, episode). Para filmes e comentarios
   do titulo inteiro, season e episode sao NULL. As respostas (parent_id) ficam
   a um so' nivel: responder a uma resposta pendura no comentario raiz. */

function commentLikes(id) {
  return db.prepare("SELECT COUNT(*) c FROM comment_likes WHERE comment_id = ?").get(id).c;
}

function toApiComment(r, viewerId) {
  return {
    id: r.id,
    tmdbId: r.external_id,
    type: r.media_type,
    season: r.season ?? null,
    episode: r.episode ?? null,
    parentId: r.parent_id ?? null,
    body: r.deleted_at ? null : r.body,
    atSeconds: r.at_seconds ?? null,
    deleted: Boolean(r.deleted_at),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
    author: { id: r.user_id, username: r.username, avatar: r.avatar ?? null },
    likes: commentLikes(r.id),
    likedByMe: Boolean(
      viewerId &&
        db
          .prepare("SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?")
          .get(r.id, viewerId)
    ),
    replies: [],
  };
}

// entry: { userId, type, tmdbId, season, episode, parentId, body, atSeconds }
// Devolve o comentario criado, ou { error } quando o corpo e' vazio / o parent
// nao existe.
/* ===== Notificacoes =====
 *
 * Tres eventos: resposta a um comentario, gosto num comentario, e
 * "comecou a seguir-te". Nao ha mais — notificacoes que se podem desligar e
 * notificacoes de coisas que ninguem pediu sao as que fazem as pessoas
 * silenciar tudo.
 *
 * Duas regras que o store garante e que a UI nao pode:
 *
 * 1. Nunca notificar a pessoa de si propria. Nao interessa "gostaste do teu
 *    proprio comentario" — e notificar faz o sino mexer sozinho, que e'
 *    exactamente o que faz a pessoa deixar de olhar para ele.
 *
 * 2. Nunca duplicar. O indice unico (user, kind, ref, actor) faz o INSERT
 *    falhar em duplicado e a notificação nao e' criada outra vez. Sem isto,
 *    carregar no like varias vezes enche o sino de ruido.
 */

/**
 * Cria uma notificacao, se fizer sentido. Devolve sempre { ok } — falhar em
 * silencioso e' aceitavel porque uma notificacao perdida nao pode estragar o
 * que a pessoa estava a fazer (um comentario, um like).
 */
export function criarNotificacao({
  userId,
  kind,
  actorId,
  refId = null,
  type = null,
  tmdbId = null,
  season = null,
  episode = null,
  preview = null,
}) {
  if (!userId || !kind) return { ok: false, error: "faltam userId/kind" };
  // Regra 1: nada de notificar-se a si proprio.
  if (actorId != null && Number(actorId) === Number(userId)) return { ok: false, skipped: "proprio" };

  // O comentario tem de existir e estar visivel. Sem isto, uma resposta a um
  // comentario apagado criava uma notificacao para nada.
  if (refId != null) {
    const ref = db
      .prepare(
        `SELECT id, user_id, media_type, external_id, season, episode, body
         FROM comments WHERE id = ? AND deleted_at IS NULL`
      )
      .get(Number(refId));
    if (!ref) return { ok: false, skipped: "alvo inexistente" };
    // Nao se compara `ref.user_id` com `userId`: o destinatario e' de facto o
    // autor do comentario, e' esse o objectivo. O unico caso a evitar — o actor
    // a mexer no comentario dele — ja fellou na regra 1 acima, porque nesse caso
    // actor == userId.
    type = type ?? ref.media_type;
    tmdbId = tmdbId ?? ref.external_id;
    season = season ?? ref.season;
    episode = episode ?? ref.episode;
    if (!preview) preview = String(ref.body || "").slice(0, 120);
  }

  try {
    db.prepare(
      `INSERT INTO notifications
         (user_id, kind, actor_id, ref_id, media_type, external_id, season, episode, preview, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      kind,
      actorId ?? null,
      refId ?? null,
      type ?? null,
      tmdbId ?? null,
      season ?? null,
      episode ?? null,
      preview ? String(preview).slice(0, 120) : null,
      now()
    );
    return { ok: true };
  } catch (e) {
    // A unica falha esperada e' o indice unico (duplicado). Qualquer outra e'
    // um bug de verdade, mas nao vale a pena rebentar o pedido do utilizador.
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

/** As notificacoes de uma pessoa, mais recentes primeiro. */
export function listNotifications(userId, limite = 40) {
  return db
    .prepare(
      `SELECT n.*, u.username AS actor_username, u.avatar AS actor_avatar
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ?`
    )
    .all(userId, limite)
    .map(toApiNotification);
}

function toApiNotification(r) {
  return {
    id: r.id,
    kind: r.kind,
    refId: r.ref_id,
    preview: r.preview,
    read: Boolean(r.read),
    createdAt: r.created_at,
    at: r.at,
    type: r.media_type,
    tmdbId: r.external_id,
    season: r.season,
    episode: r.episode,
    actor: r.actor_id
      ? { id: r.actor_id, username: r.actor_username || "?", avatar: r.actor_avatar || null }
      : null,
  };
}

/** Quantas nao lidas. E' o numero do sino. */
export function countUnread(userId) {
  return db
    .prepare("SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId).c;
}

/** Marca uma como lida (ou varias). */
export function markNotificationRead(userId, id) {
  const r = db
    .prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?")
    .run(userId, Number(id));
  return { ok: true, changed: r.changes > 0, unread: countUnread(userId) };
}

/** Marca todas como lidas. E' o que acontece ao abrir o painel. */
export function markAllNotificationsRead(userId) {
  const r = db
    .prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0")
    .run(userId);
  return { ok: true, changed: r.changes, unread: 0 };
}

/** Apaga as notificacoes com mais de N dias. Para a base nao crescer sem fim. */
export function pruneNotifications(userId, dias = 60) {
  const r = db
    .prepare(
      `DELETE FROM notifications
       WHERE user_id = ? AND read = 1 AND created_at < datetime('now', ?)`
    )
    .run(userId, "-" + dias + " days");
  return r.changes;
}

export function addComment(entry) {
  const body = String(entry.body || "").trim();
  if (!body) return { error: "empty" };
  if (body.length > 2000) return { error: "long" };

  let parentId = null;
  if (entry.parentId != null) {
    const p = db
      .prepare("SELECT id, parent_id FROM comments WHERE id = ? AND deleted_at IS NULL")
      .get(entry.parentId);
    if (!p) return { error: "parent" };
    // Aninhamento a um nivel: responder a uma resposta cola na raiz.
    parentId = p.parent_id ?? p.id;
  }

  const r = db
    .prepare(
      `INSERT INTO comments
         (user_id, media_type, external_id, season, episode, parent_id, body, at_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.userId,
      entry.type,
      entry.tmdbId,
      entry.season ?? null,
      entry.episode ?? null,
      parentId,
      body,
      entry.atSeconds != null ? Math.max(0, Math.floor(entry.atSeconds)) : null,
      now()
    );

  const novoId = Number(r.lastInsertRowid);

  // Se e' uma resposta, avisar quem escreveu o comentario pai — mas so' se o
  // pai ainda for de outra pessoa (e se fosse nosso, a regra do store corta).
  if (parentId != null) {
    try {
      const pai = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(parentId);
      if (pai) {
        criarNotificacao({
          userId: pai.user_id,
          kind: "reply",
          actorId: entry.userId,
          refId: parentId,
          preview: body,
        });
      }
    } catch {
      /* a notificacao nunca pode impedir o comentario */
    }
  }

  const row = db
    .prepare(
      `SELECT c.*, u.username, u.avatar FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(novoId);
  return toApiComment(row, entry.userId);
}

// Lista a thread: comentarios raiz por ordem cronologica, cada um com as suas
// respostas. Uma so' consulta; a arvore e' montada em memoria.
export function listComments({ type, tmdbId, season, episode, viewerId }) {
  const rows = db
    .prepare(
      `SELECT c.*, u.username, u.avatar FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.media_type = ? AND c.external_id = ? AND c.season IS ? AND c.episode IS ?
       ORDER BY c.created_at ASC`
    )
    .all(type, tmdbId, season ?? null, episode ?? null);

  const byId = new Map();
  for (const r of rows) byId.set(r.id, toApiComment(r, viewerId));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).replies.push(c);
    else roots.push(c);
  }
  return roots;
}

export function getComment(id, viewerId) {
  const r = db
    .prepare(
      `SELECT c.*, u.username, u.avatar FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(id);
  return r ? toApiComment(r, viewerId) : null;
}

// So o autor apaga. Se tiver respostas, apaga-se o texto mas a linha fica
// (para a thread nao perder as respostas); se nao tiver, sai de vez.
export function deleteComment(userId, id) {
  const r = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(id);
  if (!r) return { ok: false, error: "notfound" };
  if (Number(r.user_id) !== Number(userId)) return { ok: false, error: "forbidden" };
  const replies = db.prepare("SELECT COUNT(*) c FROM comments WHERE parent_id = ?").get(id).c;
  if (replies === 0) {
    db.prepare("DELETE FROM comments WHERE id = ?").run(id);
  } else {
    db.prepare("UPDATE comments SET deleted_at = ?, updated_at = ?, body = '' WHERE id = ?").run(
      now(),
      now(),
      id
    );
  }
  return { ok: true };
}

export function likeComment(userId, id) {
  const r = db
    .prepare("SELECT id, user_id FROM comments WHERE id = ? AND deleted_at IS NULL")
    .get(id);
  if (!r) return { ok: false, error: "notfound" };
  const guard = db
    .prepare(
      `INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(comment_id, user_id) DO NOTHING`
    )
    .run(id, userId, now());

  // Só notifica se o like foi MESMO novo. Carregar outra vez no mesmo like nao
  // e' novidade nenhuma — e notificar ai era o caminho mais curto para a pessoa
  // silenciar o sino.
  if (guard.changes > 0) {
    try {
      criarNotificacao({ userId: r.user_id, kind: "like", actorId: userId, refId: id });
    } catch {
      /* nunca rebenta o like por causa de uma notificacao */
    }
  }
  return { ok: true, likes: commentLikes(id) };
}

export function unlikeComment(userId, id) {
  db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(id, userId);
  return { ok: true, likes: commentLikes(id) };
}