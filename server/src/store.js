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

let data = { users: [], library: [], seq: { users: 0 } };
if (existsSync(FILE)) {
  try {
    data = { users: [], library: [], seq: { users: 0 }, ...JSON.parse(readFileSync(FILE, "utf8")) };
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

/* ===== Biblioteca ===== */
function toApi(r) {
  return {
    tmdbId: r.tmdb_id,
    type: r.media_type,
    title: r.title,
    poster: r.poster,
    watched: r.watched,
    watchlist: r.watchlist,
    score: r.score,
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
  r.poster = entry.poster;
  r.watched = entry.watched;
  r.watchlist = entry.watchlist;
  r.score = entry.score;
  r.updated_at = new Date().toISOString();
  save();
}

export function deleteLibrary(userId, tmdbId, type) {
  data.library = data.library.filter(
    (x) => !(x.user_id === userId && x.tmdb_id === tmdbId && x.media_type === type)
  );
  save();
}
