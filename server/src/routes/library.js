import { Router } from "express";
import {
  listLibrary,
  getLibraryItem,
  upsertLibrary,
  deleteLibrary,
} from "../store.js";
import { requireAuth } from "../services/auth.js";

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

function normalizeRow(row) {
  if (!row) return null;
  return { ...row, watched: Boolean(row.watched), watchlist: Boolean(row.watchlist) };
}

// Lista completa da biblioteca do utilizador.
libraryRouter.get("/library", (req, res) => {
  res.json({ items: listLibrary(req.user.id).map(normalizeRow) });
});

// Estado de um titulo (para a pagina de detalhe saber visto/nota atuais).
libraryRouter.get("/library/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  res.json({ item: normalizeRow(getLibraryItem(req.user.id, Number(tmdb), type)) });
});

// Cria/atualiza visto e/ou nota. Faz merge com o estado existente.
libraryRouter.post("/library", (req, res) => {
  const { tmdbId, type, title, poster, watched, watchlist, score, genres } = req.body || {};
  if (!tmdbId || (type !== "movie" && type !== "tv" && type !== "anime")) {
    return res.status(400).json({ error: "tmdbId e type (movie|tv|anime) sao obrigatorios" });
  }
  if (score != null && (score < 1 || score > 10)) {
    return res.status(400).json({ error: "score tem de estar entre 1 e 10" });
  }

  const existing = getLibraryItem(req.user.id, Number(tmdbId), type);
  upsertLibrary({
    userId: req.user.id,
    tmdbId: Number(tmdbId),
    type,
    title: title ?? existing?.title ?? null,
    poster: poster ?? existing?.poster ?? null,
    genres: Array.isArray(genres) ? genres : existing?.genres ?? [],
    watched: watched != null ? (watched ? 1 : 0) : existing?.watched ?? 0,
    watchlist: watchlist != null ? (watchlist ? 1 : 0) : existing?.watchlist ?? 0,
    score: score !== undefined ? score : existing?.score ?? null,
  });
  res.json({ item: normalizeRow(getLibraryItem(req.user.id, Number(tmdbId), type)) });
});

// Remove um titulo da biblioteca.
libraryRouter.delete("/library/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  deleteLibrary(req.user.id, Number(tmdb), type);
  res.json({ ok: true });
});
