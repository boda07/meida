// Listas personalizadas.
//
// Uma lista por utilizador. Os itens guardam titulo/cartaz no momento em que
// foram adicionados (nao precisa de re-pedir ao TMDB para mostrar a lista).
import { db } from "../db/index.js";
import { now } from "./util.js";

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