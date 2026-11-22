// Biblioteca pessoal (visto / watchlist / nota / ano / estado).
//
// `external_id` = id do TMDB para movie/tv, id do MAL para anime. A API
// continua a expor isto como `tmdbId` (nome historico, usado em todo o lado).
// `genres` e' um array guardado como JSON — o driver inclui a extensao json1,
// por isso dava para indexar cada genero se um dia fizermos "titulos de acao".
import { db, tx } from "../db/index.js";
import { now } from "./util.js";

function parseGenres(g) {
  if (!g) return [];
  try {
    const v = JSON.parse(g);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function toApi(r) {
  return {
    tmdbId: r.external_id,
    type: r.media_type,
    title: r.title,
    titleEn: r.title_en ?? null, // anime: titulo em ingles
    titleRomaji: r.title_romaji ?? null, // anime: titulo em romaji
    genres: parseGenres(r.genres), // generos/temas (para filtrar a lista)
    poster: r.poster,
    // Ano do titulo. NULL nos titulos que ja estavam na biblioteca antes da
    // migracao 6 — por isso qualquer consumidor tem de tratar o null como
    // "desconhecido" e nao como 0.
    year: r.year ?? null,
    watched: r.watched,
    watchlist: r.watchlist,
    status: r.status ?? null, // "paused" | "dropped" | null (ver estadoDe)
    score: r.score, // nota pessoal (0-100)
    rating: r.rating ?? null, // media da comunidade (MAL/TMDB)
    updatedAt: r.updated_at,
      // A data em que a pessoa MARCOU o titulo como visto. NULL para tudo o que
      // ja estava visto antes da migracao 9: nao se sabe, e a interface diz
      // isso em vez de fingir que sim (ver db/schema.js, migracao 9).
      watchedAt: r.watched_at ?? null,
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
  // Um unico instante para a `updated_at` e para a `watched_at`. Sao gravadas na
  // mesma frase e hAO de bater certo: com dois `now()` a data de visionamento
  // ficava uns microssegundos atras da linha, e o que aparecia dependia de qual
  // das duas o SQLite lesse primeiro.
  const quando = now();
  db.prepare(
    `INSERT INTO library
       (user_id, media_type, external_id, title, title_en, title_romaji, poster,
        genres, year, watched, watchlist, status, score, rating, updated_at, watched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, media_type, external_id) DO UPDATE SET
       title        = excluded.title,
       title_en     = COALESCE(excluded.title_en, library.title_en),
       title_romaji = COALESCE(excluded.title_romaji, library.title_romaji),
       poster       = excluded.poster,
       genres       = COALESCE(excluded.genres, library.genres),
       -- O ano so' se escreve quando vem. Um excluded.year = NULL apagaria o
       -- ano de um titulo que ja o tinha, porque qualquer chamada que nao mande
       -- year (marcar como visto, por exemplo) gravaria NULL por cima. O
       -- COALESCE e' o que impede a "decada favorita" de perder metade da
       -- biblioteca a cada clique.
       year         = COALESCE(excluded.year, library.year),
       watched      = excluded.watched,
       watchlist    = excluded.watchlist,
       status       = excluded.status,
       score        = excluded.score,
       rating       = COALESCE(excluded.rating, library.rating),
         -- A data de visionamento tem tres casos, e o do meio importa:
         --
         --   - marca como NAO visto -> apaga a data. Deixar data num titulo
         --     que a pessoa reverteu e' pior que nao ter: a timeline
         --     mostraria "visto em Marco" para um titulo que ja nao conta.
         --
         --   - marca como visto pela PRIMEIRA vez -> fica a data de agora.
         --     E' a condicao sobre a linha antiga que faz a distincao; sem
         --     ela, cada clique em "dar nota" reescrevia a data e a timeline
         --     saltava para o mes em que a pessoa mexeu.
         --
         --   - ja estava visto -> FICA a data antiga, mesmo que venha NULL.
         --     Este ultimo caso e' o que torna a coluna util, e e' o erro
         --     mais facil de cometer: um COALESCE simples trataria "marcar
         --     como visto" e "dar nota a um filme visto" do mesmo jeito, e a
         --     segunda escreveria NULL por cima, apagando a data.
         watched_at   = CASE
           WHEN excluded.watched = 0 THEN NULL
           WHEN library.watched = 0 THEN excluded.updated_at
           ELSE library.watched_at
         END`
  ).run(
    entry.userId,
    entry.type,
    entry.tmdbId,
    entry.title ?? null,
    entry.titleEn ?? null,
    entry.titleRomaji ?? null,
    entry.poster ?? null,
    entry.genres === undefined ? null : JSON.stringify(entry.genres),
    // `year` pode vir como "2005" (string do catalogo) ou 2005 (numero). Aceita
    // os dois e rejeita o que nao e' um ano: um `""` viraria 0 e o titulo
    // contaria para a decada 0.
    anoDe(entry.year),
    (entry.watched ? 1 : 0),
    (entry.watchlist ? 1 : 0),
    entry.status === undefined || entry.status === null ? null : String(entry.status),
    entry.score ?? null,
    entry.rating ?? null,
      // Um unico instante para os dois: com dois now() a data de
      // visionamento ficava uns microssegundos atras da updated_at, e o
      // resultado dependia de qual das duas o SQLite lesse primeiro.
      quando,
      // Numa linha NOVA, marcar como visto grava a data. Numa linha que ja
      // existe isto nao decide nada — quem decide e' o CASE de cima.
      entry.watchedAt ?? (entry.watched ? quando : null)
  );
}

/** Normaliza um ano para numero, ou null se nao der. */
function anoDe(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  // 1870 e 2100 sao limites folgados de proposito: um anime antigo e' mais antigo
  // que isso e para a frente nao interessa. O que se quer e' rejeitar "" e lixo,
  // nao ser um validador de datas.
  return Number.isFinite(n) && n >= 1870 && n <= 2100 ? Math.trunc(n) : null;
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
        genres, watched, watchlist, score, rating, updated_at, watched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       updated_at   = excluded.updated_at,
       -- O import nao marca "visto agora": restaura o que o ficheiro tem.
       -- Um COALESCE simples e' o que se quer aqui, ao contrario do
       -- upsertLibrary acima: sem data no ficheiro fica a que ja existia, e
       -- sem data em lado nenhum fica NULL — "nao se sabe", que e' o que a
       -- timeline diz. Numa linha nova marcada como vista e sem data no
       -- ficheiro, usar a data do import seria inventar um mes que ninguem
       -- affirme, e e' por isso que o parametro vai sem o fallback.
       watched_at   = COALESCE(excluded.watched_at, library.watched_at)`
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
    updatedAt,
    // O ultimo: a data de visionamento. Sem o fallback de propósito — um import
    // que nao a traz NAO pode fabricar uma, e o COALESCE de cima preserva a que
    // ja existia.
    entry.watchedAt ?? null
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

/**
 * Guarda o ano do titulo, e so' este campo.
 *
 * Existe uma funcao propria em vez de reutilizar `upsertLibrary` porque o ano
 * chega de um sitio diferente (a ficha do titulo) e sem os outros campos. Passar
 * pelo `upsertLibrary` apagaria `watched` e `watchlist`: aquele faz
 * `watched = excluded.watched`, e um `undefined` aqui viraria 0 — ou seja, abrir
 * a ficha de um filme visto desmarca-lo como visto. Foi por isso que nao se
 * reaproveitou.
 *
 * Devolve `true` so' se escreveu alguma coisa. Nao escreve quando o ano ja estava
 * la (evita o `updated_at` mexer a cada visita) nem quando nao vem nada.
 */
export function setLibraryYear(userId, tmdbId, type, year) {
  const ano = anoDe(year);
  if (ano === null) return false;
  const r = db
    .prepare(
      `UPDATE library SET year = ?
        WHERE user_id = ? AND external_id = ? AND media_type = ? AND year IS NOT ?`
    )
    .run(ano, userId, tmdbId, type, ano);
  // `IS NOT` (e nao `<>`) porque o `year` pode ser NULL, e em SQLite `NULL <> 5`
  // devolve NULL em vez de verdadeiro — o UPDATE nao correria na primeira vez.
  return r.changes > 0;
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