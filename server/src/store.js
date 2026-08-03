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

let data = { users: [], library: [], progress: [], lists: [], seq: { users: 0 } };
if (existsSync(FILE)) {
  try {
    data = { users: [], library: [], progress: [], lists: [], seq: { users: 0 }, ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch {
    // ficheiro corrompido -> comeca limpo
  }
}

// Migracao 0.9.9: a nota pessoal passou de 0-10 para 0-100. Multiplica os scores
// antigos por 10 uma so vez (marcado em data.meta.scoreScale para nao repetir).
if (data.meta?.scoreScale !== 100) {
  for (const r of data.library) {
    if (r.score != null) r.score = Math.round(Number(r.score) * 10);
  }
  data.meta = { ...(data.meta || {}), scoreScale: 100 };
  save();
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

/* ===== Tokens do AniList (por utilizador) ===== */
export function setAnilistTokens(id, tokens) {
  const u = data.users.find((x) => x.id === id);
  if (u) {
    u.anilist = tokens; // { accessToken, refreshToken, expiresAt, username } ou null
    save();
  }
}

export function getAnilistTokens(id) {
  const u = data.users.find((x) => x.id === id);
  return u?.anilist || null;
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
    score: r.score, // nota pessoal (1-100)
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

// Versão "safe" de upsert para imports: só actualiza campos explicitamente
// fornecidos (não apaga notas/visto que o ficheiro de export não traz). Usa a
// data de atualização do ficheiro (se houver) para preservar a ordem original.
export function upsertLibrarySafe(entry) {
  let r = data.library.find(
    (x) => x.user_id === entry.userId && x.tmdb_id === entry.tmdbId && x.media_type === entry.type
  );
  const existed = !!r;
  if (!r) {
    r = { user_id: entry.userId, tmdb_id: entry.tmdbId, media_type: entry.type };
    data.library.push(r);
  }
  if (entry.title != null) r.title = entry.title;
  if (entry.titleEn !== undefined && entry.titleEn != null) r.title_en = entry.titleEn;
  if (entry.titleRomaji !== undefined && entry.titleRomaji != null) r.title_romaji = entry.titleRomaji;
  if (Array.isArray(entry.genres)) r.genres = entry.genres;
  if (entry.poster != null) r.poster = entry.poster;
  // watched / watchlist: só actualiza se explicitamente boolean ou número.
  if (entry.watched != null) r.watched = entry.watched ? 1 : 0;
  if (entry.watchlist != null) r.watchlist = entry.watchlist ? 1 : 0;
  // score: só actualiza se houver valor (não apaga a nota existente por import vazio).
  if (entry.score != null) r.score = Number(entry.score);
  if (entry.rating != null) r.rating = Number(entry.rating);
  // Preserva updated_at do ficheiro (ordem original); se novo item, usa agora.
  if (entry.updatedAt != null) r.updated_at = entry.updatedAt;
  else if (!existed) r.updated_at = new Date().toISOString();
  save();
  return r;
}
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

// Atualiza so os generos, sem mexer no updated_at. Usado no backfill de itens
// antigos (ex.: filmes importados do Letterboxd que vieram sem generos).
export function setLibraryGenres(userId, tmdbId, type, genres) {
  const r = data.library.find(
    (x) => x.user_id === userId && x.tmdb_id === tmdbId && x.media_type === type
  );
  if (r && Array.isArray(genres) && genres.length) {
    r.genres = genres;
    save();
  }
}

export function deleteLibrary(userId, tmdbId, type) {
  data.library = data.library.filter(
    (x) => !(x.user_id === userId && x.tmdb_id === tmdbId && x.media_type === type)
  );
  save();
}

// Limpa a watchlist (flag) por tipo ("movie"|"tv"|"anime"|"all"). Itens que
// fiquem sem nada (sem visto/nota) sao removidos; os vistos/avaliados ficam.
export function clearWatchlist(userId, type) {
  let cleared = 0;
  for (const r of data.library) {
    if (r.user_id !== userId) continue;
    if (type !== "all" && r.media_type !== type) continue;
    if (!r.watchlist) continue;
    r.watchlist = 0;
    cleared++;
  }
  data.library = data.library.filter(
    (r) => !(r.user_id === userId && !r.watched && !r.watchlist && r.score == null)
  );
  save();
  return cleared;
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
    position: r.position ?? null, // segundos a meio (para retomar)
    duration: r.duration ?? null, // duracao total em segundos
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
// Ao mudar de episodio, limpa a posicao guardada (para nao retomar no meio do
// episodio anterior); se for o mesmo episodio, mantem-na (retoma a meio).
export function startProgress(e) {
  const r = findOrCreateProgress(e.userId, e.type, e.tmdbId);
  if (e.title != null) r.title = e.title;
  if (e.poster != null) r.poster = e.poster;
  const sameEpisode = r.season === (e.season ?? null) && r.episode === (e.episode ?? null);
  if (e.season != null) r.season = e.season;
  if (e.episode != null) r.episode = e.episode;
  if (!sameEpisode) r.position = null;
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
  r.position = null; // episodio acabado: nada para retomar
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

// Importa uma entrada do diario com datas explicitas (MAL / Letterboxd). Usa a
// data de fim (ou inicio) como updated_at para o diario ficar por ordem de visto.
export function importProgress(e) {
  const r = findOrCreateProgress(e.userId, e.type, e.tmdbId);
  if (e.title != null) r.title = e.title;
  if (e.poster != null) r.poster = e.poster;
  if (e.season != null) r.season = e.season;
  if (e.episode != null) r.episode = e.episode;
  // `!== undefined` (em vez de truthy): permite limpar uma data passando null
  // explicito — ex.: reimportar do MAL um fim sem dia exato corrige o que antes
  // ficou com o dia 1 inventado. (O Letterboxd nunca passa startedAt, fica intacto.)
  if (e.startedAt !== undefined) r.started_at = e.startedAt;
  if (e.finishedAt !== undefined) r.finished_at = e.finishedAt;
  r.status = e.status || (e.finishedAt ? "finished" : "watching");
  r.updated_at = e.finishedAt || e.startedAt || r.updated_at || new Date().toISOString();
  save();
  return toApiProgress(r);
}

// Edicao manual de uma entrada do diario (estado, datas, posicao).
export function updateProgress(userId, type, tmdbId, patch) {
  const r = data.progress.find(
    (x) => x.user_id === userId && x.type === type && x.tmdb_id === tmdbId
  );
  if (!r) return null;
  if (patch.status !== undefined) r.status = patch.status;
  if (patch.startedAt !== undefined) r.started_at = patch.startedAt;
  if (patch.finishedAt !== undefined) r.finished_at = patch.finishedAt;
  if (patch.season !== undefined) r.season = patch.season;
  if (patch.episode !== undefined) r.episode = patch.episode;
  r.updated_at = new Date().toISOString();
  save();
  return toApiProgress(r);
}

// Guarda a posicao atual (segundos) para retomar a meio. Cria a entrada se nao
// existir (ex.: utilizador saiu antes dos 5 min que o diario exige).
export function setProgressPosition(userId, type, tmdbId, { position, duration, season, episode }) {
  const r = findOrCreateProgress(userId, type, tmdbId);
  if (position != null) r.position = Math.max(0, Math.floor(position));
  if (duration != null) r.duration = Math.floor(duration);
  if (season != null) r.season = season;
  if (episode != null) r.episode = episode;
  if (!r.started_at) r.started_at = new Date().toISOString();
  if (!r.status || r.status === "finished") r.status = "watching";
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

/* ===== Listas personalizadas =====
   Uma lista por utilizador: { id, name, items: [{ tmdbId, type, title, poster,
   addedAt }] }. As listas guardam titulo/cartaz no momento em que o titulo foi
   adicionado (nao precisa de re-pedir ao TMDB para mostrar a lista). */
function toApiList(l) {
  return {
    id: l.id,
    name: l.name,
    createdAt: l.created_at,
    count: (l.items || []).length,
  };
}

export function listLists(userId) {
  return data.lists
    .filter((l) => l.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map(toApiList);
}

export function getList(userId, id) {
  const l = data.lists.find((x) => x.user_id === userId && x.id === id);
  if (!l) return null;
  return {
    id: l.id,
    name: l.name,
    createdAt: l.created_at,
    items: (l.items || [])
      .map((i) => ({
        tmdbId: i.tmdb_id,
        type: i.type,
        title: i.title ?? null,
        poster: i.poster ?? null,
        addedAt: i.added_at ?? null,
      }))
      .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1)),
  };
}

export function createList(userId, name) {
  data.seq.lists = (data.seq.lists || 0) + 1;
  const id = data.seq.lists;
  const l = { id, user_id: userId, name, created_at: new Date().toISOString(), items: [] };
  data.lists.push(l);
  save();
  return toApiList(l);
}

export function renameList(userId, id, name) {
  const l = data.lists.find((x) => x.user_id === userId && x.id === id);
  if (!l) return null;
  l.name = name;
  save();
  return toApiList(l);
}

export function deleteList(userId, id) {
  const before = data.lists.length;
  data.lists = data.lists.filter((x) => !(x.user_id === userId && x.id === id));
  save();
  return data.lists.length < before;
}

export function addListTitle(userId, listId, { tmdbId, type, title, poster }) {
  const l = data.lists.find((x) => x.user_id === userId && x.id === listId);
  if (!l) return null;
  l.items = l.items || [];
  if (!l.items.some((i) => i.tmdb_id === tmdbId && i.type === type)) {
    l.items.push({
      tmdb_id: tmdbId,
      type,
      title: title ?? null,
      poster: poster ?? null,
      added_at: new Date().toISOString(),
    });
    save();
  }
  return getList(userId, listId);
}

export function removeListTitle(userId, listId, tmdbId, type) {
  const l = data.lists.find((x) => x.user_id === userId && x.id === listId);
  if (!l) return false;
  const before = (l.items || []).length;
  l.items = (l.items || []).filter(
    (i) => !(i.tmdb_id === tmdbId && i.type === type)
  );
  save();
  return (l.items || []).length < before;
}
