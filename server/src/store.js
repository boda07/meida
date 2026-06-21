// Armazenamento simples em JSON (utilizadores + biblioteca). Sem dependencias
// nativas nem node:sqlite — funciona em qualquer Node (sistema ou Electron).
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// No app empacotado, DB_DIR aponta para uma pasta gravavel; em dev usa server/data.
const dataDir = process.env.DB_DIR
  ? resolve(process.env.DB_DIR)
  : resolve(__dirname, "../data");
mkdirSync(dataDir, { recursive: true });
const FILE = resolve(dataDir, "data.json");

let data = { users: [], library: [], progress: [], seq: { users: 0 } };
if (existsSync(FILE)) {
  try {
    data = { users: [], library: [], progress: [], seq: { users: 0 }, ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch {
    // ficheiro corrompido -> comeca limpo
  }
}

function save() {
  writeFileSync(FILE, JSON.stringify(data));
}

/* ===== Utilizadores ===== */
export function createUser(username, passwordHash) {
  const id = ++data.seq.users;
  data.users.push({
    id,
    username,
    password_hash: passwordHash,
    avatar: null,
    created_at: new Date().toISOString(),
  });
  save();
  return { id, username, avatar: null };
}

export function getUserByUsername(username) {
  return data.users.find((u) => u.username === username) || null;
}

export function getUserById(id) {
  const u = data.users.find((x) => x.id === id);
  return u ? { id: u.id, username: u.username, avatar: u.avatar ?? null } : null;
}

export function setUserAvatar(id, avatar) {
  const u = data.users.find((x) => x.id === id);
  if (u) {
    u.avatar = avatar;
    save();
  }
  return getUserById(id);
}

/* ===== Tokens do MyAnimeList (por utilizador) ===== */
export function setMalTokens(id, tokens) {
  const u = data.users.find((x) => x.id === id);
  if (u) {
    u.mal = tokens; // { accessToken, refreshToken, expiresAt, username } ou null
    save();
  }
}

export function getMalTokens(id) {
  const u = data.users.find((x) => x.id === id);
  return u?.mal || null;
}

/* ===== Letterboxd (por utilizador) ===== */
export function setLetterboxd(id, lb) {
  const u = data.users.find((x) => x.id === id);
  if (u) {
    u.letterboxd = lb; // { username } ou null
    save();
  }
}

export function getLetterboxd(id) {
  const u = data.users.find((x) => x.id === id);
  return u?.letterboxd || null;
}

/* ===== Biblioteca ===== */
function toApi(r) {
  return {
    tmdbId: r.tmdb_id,
    type: r.media_type,
    title: r.title,
    titleEn: r.title_en ?? null, // anime: titulo em ingles
    titleRomaji: r.title_romaji ?? null, // anime: titulo em romaji
    genres: r.genres ?? [], // generos/temas (para filtrar a lista)
    poster: r.poster,
    watched: r.watched,
    watchlist: r.watchlist,
    score: r.score, // nota pessoal (1-10)
    rating: r.rating ?? null, // media da comunidade (MAL/TMDB)
    updatedAt: r.updated_at,
  };
}

export function listLibrary(userId) {
  return data.library
    .filter((r) => r.user_id === userId)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .map(toApi);
}

export function getLibraryItem(userId, tmdbId, type) {
  const r = data.library.find(
    (x) => x.user_id === userId && x.tmdb_id === tmdbId && x.media_type === type
  );
  return r ? toApi(r) : null;
}

// entry: { userId, tmdbId, type, title, poster, watched, watchlist, score }
export function upsertLibrary(entry) {
  let r = data.library.find(
    (x) => x.user_id === entry.userId && x.tmdb_id === entry.tmdbId && x.media_type === entry.type
  );
  if (!r) {
    r = { user_id: entry.userId, tmdb_id: entry.tmdbId, media_type: entry.type };
    data.library.push(r);
  }
  r.title = entry.title;
  if (entry.titleEn !== undefined) r.title_en = entry.titleEn;
  if (entry.titleRomaji !== undefined) r.title_romaji = entry.titleRomaji;
  if (entry.genres !== undefined) r.genres = entry.genres;
  if (entry.rating !== undefined) r.rating = entry.rating;
  r.poster = entry.poster;
  r.watched = entry.watched;
  r.watchlist = entry.watchlist;
  r.score = entry.score;
  r.updated_at = new Date().toISOString();
  save();
}

// Atualiza so a media da comunidade, sem mexer no updated_at (preserva a ordem
// "adicionados recentemente"). Usado no backfill de itens antigos.
export function setLibraryRating(userId, tmdbId, type, rating) {
  const r = data.library.find(
    (x) => x.user_id === userId && x.tmdb_id === tmdbId && x.media_type === type
  );
  if (r) {
    r.rating = rating;
    save();
  }
}

export function deleteLibrary(userId, tmdbId, type) {
  data.library = data.library.filter(
    (x) => !(x.user_id === userId && x.tmdb_id === tmdbId && x.media_type === type)
  );
  save();
}

/* ===== Progresso / Diario =====
   Uma linha por titulo (movie/tv/anime). Guarda quando comecou e quando acabou
   de ver, e a posicao atual (temporada/episodio) para o "Continua a ver". */
function toApiProgress(r) {
  return {
    type: r.type,
    tmdbId: r.tmdb_id,
    title: r.title ?? null,
    poster: r.poster ?? null,
    season: r.season ?? null,
    episode: r.episode ?? null,
    startedAt: r.started_at ?? null,
    finishedAt: r.finished_at ?? null,
    status: r.status ?? "watching",
    updatedAt: r.updated_at,
  };
}

export function listProgress(userId) {
  return data.progress
    .filter((r) => r.user_id === userId)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .map(toApiProgress);
}

export function getProgress(userId, type, tmdbId) {
  const r = data.progress.find(
    (x) => x.user_id === userId && x.type === type && x.tmdb_id === tmdbId
  );
  return r ? toApiProgress(r) : null;
}

function findOrCreateProgress(userId, type, tmdbId) {
  let r = data.progress.find(
    (x) => x.user_id === userId && x.type === type && x.tmdb_id === tmdbId
  );
  if (!r) {
    r = { user_id: userId, type, tmdb_id: tmdbId };
    data.progress.push(r);
  }
  return r;
}

// Inicio: regista o arranque (so a 1a vez ou num recomeco) e a posicao atual.
export function startProgress(e) {
  const r = findOrCreateProgress(e.userId, e.type, e.tmdbId);
  if (e.title != null) r.title = e.title;
  if (e.poster != null) r.poster = e.poster;
  if (e.season != null) r.season = e.season;
  if (e.episode != null) r.episode = e.episode;
  if (!r.started_at || r.status === "finished") {
    r.started_at = new Date().toISOString();
    r.finished_at = null;
  }
  r.status = "watching";
  r.updated_at = new Date().toISOString();
  save();
  return toApiProgress(r);
}

// Fim: marca acabado. Para episodicos com proximo episodio, avanca a posicao e
// mantem "a ver" (para continuar no episodio seguinte).
export function finishProgress(e) {
  const r = findOrCreateProgress(e.userId, e.type, e.tmdbId);
  if (e.title != null) r.title = e.title;
  if (e.poster != null) r.poster = e.poster;
  if (!r.started_at) r.started_at = new Date().toISOString();
  r.finished_at = new Date().toISOString();
  if (e.nextSeason != null && e.nextEpisode != null) {
    r.season = e.nextSeason;
    r.episode = e.nextEpisode;
    r.status = "watching";
  } else {
    if (e.season != null) r.season = e.season;
    if (e.episode != null) r.episode = e.episode;
    r.status = "finished";
  }
  r.updated_at = new Date().toISOString();
  save();
  return toApiProgress(r);
}

export function deleteProgress(userId, type, tmdbId) {
  data.progress = data.progress.filter(
    (x) => !(x.user_id === userId && x.type === type && x.tmdb_id === tmdbId)
  );
  save();
}
