// Utilizadores: criar, perfil público, avatar e metadados.
//
// O perfil público (`toProfile`) é privado de propósito: é a forma canónica de
// tirar a password da resposta, e não faz parte da superfície do store.
import { db } from "../db/index.js";
import { leMeta } from "../metas.js";
import { now } from "./util.js";

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
export function getMeta(userId) {
  const r = db.prepare("SELECT meta FROM users WHERE id = ?").get(userId);
  return leMeta(r && r.meta);
}

// Junta `patch` ao que ja la esta. Nao substitui o objeto inteiro, porque a
// proxima preferencia a aparecer tem de poder entrar sem que esta se perca.
export function setMeta(userId, patch) {
  const atual = getMeta(userId);
  const novo = { ...atual, ...(patch && typeof patch === "object" ? patch : {}) };
  db.prepare("UPDATE users SET meta = ? WHERE id = ?").run(JSON.stringify(novo), userId);
  return novo;
}

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

// Devolve so' o avatar de um utilizador (para servir por /api/users/:id/avatar).
// O perfil completo (/users/:username) continua a incluir o avatar inline porque
// e' uma pagina individual, nao uma lista.
export function getUserAvatar(userId) {
  const r = db
    .prepare("SELECT avatar FROM users WHERE id = ?")
    .get(userId);
  return r ? r.avatar ?? null : null;
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