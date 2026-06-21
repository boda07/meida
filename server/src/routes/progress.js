import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import {
  listProgress,
  getProgress,
  startProgress,
  finishProgress,
  deleteProgress,
} from "../store.js";

export const progressRouter = Router();
progressRouter.use(requireAuth);

// Diario completo + base do "Continua a ver".
progressRouter.get("/progress", (req, res) => {
  res.json({ items: listProgress(req.user.id) });
});

// Posicao atual de um titulo (a pagina de detalhe usa para retomar).
progressRouter.get("/progress/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  res.json({ item: getProgress(req.user.id, type, Number(tmdb)) });
});

// Comecou a ver (arranque + posicao atual).
progressRouter.post("/progress/start", (req, res) => {
  const { type, tmdbId, title, poster, season, episode } = req.body || {};
  if (!type || !tmdbId) return res.status(400).json({ error: "faltam type e tmdbId" });
  res.json({
    item: startProgress({
      userId: req.user.id,
      type,
      tmdbId: Number(tmdbId),
      title,
      poster,
      season: season ?? null,
      episode: episode ?? null,
    }),
  });
});

// Acabou de ver (episodio/filme). nextSeason/nextEpisode avancam o "continua a ver".
progressRouter.post("/progress/finish", (req, res) => {
  const { type, tmdbId, title, poster, season, episode, nextSeason, nextEpisode } =
    req.body || {};
  if (!type || !tmdbId) return res.status(400).json({ error: "faltam type e tmdbId" });
  res.json({
    item: finishProgress({
      userId: req.user.id,
      type,
      tmdbId: Number(tmdbId),
      title,
      poster,
      season: season ?? null,
      episode: episode ?? null,
      nextSeason: nextSeason ?? null,
      nextEpisode: nextEpisode ?? null,
    }),
  });
});

// Remover do "continua a ver" / diario.
progressRouter.delete("/progress/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  deleteProgress(req.user.id, type, Number(tmdb));
  res.json({ ok: true });
});
