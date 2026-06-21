import { Router } from "express";
import {
  buildEmbedSources,
  buildAnimeEmbedSources,
  PROVIDERS,
} from "../services/providers.js";

export const sourcesRouter = Router();

// Lista de providers disponiveis (para o frontend mostrar no seletor).
sourcesRouter.get("/providers", (req, res) => {
  res.json({ providers: PROVIDERS.map((p) => ({ id: p.id, name: p.name })) });
});

// Fontes de embed para um titulo especifico.
// /api/sources?type=movie&tmdb=123
// /api/sources?type=tv&tmdb=123&season=1&episode=2
sourcesRouter.get("/sources", (req, res) => {
  const { type, tmdb, imdb, season, episode, mal, audio } = req.query;
  if (type !== "movie" && type !== "tv") {
    return res.status(400).json({ error: "type tem de ser 'movie' ou 'tv'" });
  }
  if (!tmdb) {
    return res.status(400).json({ error: "falta o parametro tmdb" });
  }
  if (type === "tv" && (season == null || episode == null)) {
    return res.status(400).json({ error: "series precisam de season e episode" });
  }

  // Anime: fontes dedicadas (sub/dub) por id do MAL, em PRIMEIRO lugar.
  const animeSources = mal
    ? buildAnimeEmbedSources({
        mal,
        episode: episode != null ? Number(episode) : 1,
        audio,
      })
    : [];

  const sources = buildEmbedSources({
    type,
    tmdb,
    imdb: imdb || undefined,
    season: season != null ? Number(season) : undefined,
    episode: episode != null ? Number(episode) : undefined,
  });

  res.json({ embeds: [...animeSources, ...sources] });
});
