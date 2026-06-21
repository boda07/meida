import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../services/auth.js";

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

const listStmt = db.prepare(
  "SELECT tmdb_id AS tmdbId, media_type AS type, title, poster, watched, watchlist, score, updated_at AS updatedAt FROM library WHERE user_id = ? ORDER BY updated_at DESC"
);
const getStmt = db.prepare(
  "SELECT tmdb_id AS tmdbId, media_type AS type, title, poster, watched, watchlist, score FROM library WHERE user_id = ? AND tmdb_id = ? AND media_type = ?"
);
const deleteStmt = db.prepare(
  "DELETE FROM library WHERE user_id = ? AND tmdb_id = ? AND media_type = ?"
);
// Upsert: cria ou atualiza, mantendo valores antigos quando o campo nao vem.
const upsertStmt = db.prepare(`
  INSERT INTO library (user_id, tmdb_id, media_type, title, poster, watched, watchlist, score, updated_at)
  VALUES (@userId, @tmdbId, @type, @title, @poster, @watched, @watchlist, @score, datetime('now'))
  ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET
    title = excluded.title,
    poster = excluded.poster,
    watched = excluded.watched,
    watchlist = excluded.watchlist,
    score = excluded.score,
    updated_at = datetime('now')
`);

function normalizeRow(row) {
  if (!row) return null;
  return { ...row, watched: Boolean(row.watched), watchlist: Boolean(row.watchlist) };
}

// Lista completa da biblioteca do utilizador.
libraryRouter.get("/library", (req, res) => {
  const rows = listStmt.all(req.user.id).map(normalizeRow);
  res.json({ items: rows });
});

// Estado de um titulo (para a pagina de detalhe saber visto/nota atuais).
libraryRouter.get("/library/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  res.json({ item: normalizeRow(getStmt.get(req.user.id, Number(tmdb), type)) });
});

// Cria/atualiza visto e/ou nota. Faz merge com o estado existente.
libraryRouter.post("/library", (req, res) => {
  const { tmdbId, type, title, poster, watched, watchlist, score } = req.body || {};
  if (!tmdbId || (type !== "movie" && type !== "tv")) {
    return res.status(400).json({ error: "tmdbId e type (movie|tv) sao obrigatorios" });
  }
  if (score != null && (score < 1 || score > 10)) {
    return res.status(400).json({ error: "score tem de estar entre 1 e 10" });
  }

  const existing = getStmt.get(req.user.id, Number(tmdbId), type);
  const merged = {
    userId: req.user.id,
    tmdbId: Number(tmdbId),
    type,
    title: title ?? existing?.title ?? null,
    poster: poster ?? existing?.poster ?? null,
    watched: watched != null ? (watched ? 1 : 0) : existing?.watched ?? 0,
    watchlist: watchlist != null ? (watchlist ? 1 : 0) : existing?.watchlist ?? 0,
    score: score !== undefined ? score : existing?.score ?? null,
  };
  upsertStmt.run(merged);
  res.json({ item: normalizeRow(getStmt.get(req.user.id, Number(tmdbId), type)) });
});

// Remove um titulo da biblioteca.
libraryRouter.delete("/library/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  deleteStmt.run(req.user.id, Number(tmdb), type);
  res.json({ ok: true });
});
