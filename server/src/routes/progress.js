import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import {
  localizarTitulos,
  preencherTitulosLocalizados,
} from "../services/tmdb.js";
import {
  listProgress,
  getProgress,
  startProgress,
  finishProgress,
  updateProgress,
  deleteProgress,
  setProgressPosition,
} from "../store.js";

export const progressRouter = Router();
progressRouter.use(requireAuth);

// Diario completo + base do "Continua a ver".
//
// O `title` guardado e' o titulo no momento em que se comecou a ver — que num
// PC com a interface em portugues e' em portugues, mas numa watchlist importada
// vem em ingles. Como a preferencia de idioma se cumpre no catalogo, tem de se
// cumprir aqui tambem: sao os mesmos titulos, so que guardado noutro idioma.
progressRouter.get("/progress", (req, res) => {
  const items = listProgress(req.user.id);
  const titleLang = req.query.titleLang;
  const emFalta = localizarTitulos(items, titleLang);
  res.json({ items });
  // Em segundo plano: a proxima abertura ja vem completa.
  preencherTitulosLocalizados(emFalta, titleLang);
});

// Posicao atual de um titulo (a pagina de detalhe usa para retomar).
progressRouter.get("/progress/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  res.json({ item: getProgress(req.user.id, type, Number(tmdb)) });
});

// Comecou a ver (arranque + posicao atual).
progressRouter.post("/progress/start", (req, res) => {
  const { type, tmdbId, title, poster, season, episode, provider } = req.body || {};
  if (!type || !tmdbId) return res.status(400).json({ error: "faltam type e tmdbId" });
  res.json({
    item: startProgress({
      userId: req.user.id,
      type,
      tmdbId: Number(tmdbId),
      title,
      poster,
      provider: provider ?? null,
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

// Edicao manual de uma entrada do diario.
progressRouter.patch("/progress/item", (req, res) => {
  const { type, tmdbId } = req.body || {};
  if (!type || !tmdbId) return res.status(400).json({ error: "faltam type e tmdbId" });
  const item = updateProgress(req.user.id, type, Number(tmdbId), req.body);
  if (!item) return res.status(404).json({ error: "entrada nao encontrada" });
  res.json({ item });
});

// Guarda a posicao atual (para retomar a meio de um episodio). Chamado com
// frequencia pelo player; cria a entrada se ainda nao existir.
progressRouter.post("/progress/position", (req, res) => {
  const { type, tmdbId, position, duration, season, episode, provider } = req.body || {};
  if (!type || !tmdbId || position == null) {
    return res.status(400).json({ error: "faltam type, tmdbId e position" });
  }
  res.json({
    item: setProgressPosition(req.user.id, type, Number(tmdbId), {
      position: Number(position),
      duration: duration != null ? Number(duration) : null,
      season: season != null ? Number(season) : null,
      episode: episode != null ? Number(episode) : null,
      provider: provider ?? null,
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
