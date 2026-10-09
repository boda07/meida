import { Router } from "express";
import {
  buildEmbedSources,
  buildAnimeEmbedSources,
  PROVIDERS,
} from "../services/providers.js";
import { malToAnilist } from "../services/jikan.js";
import { getProviderHealth, refreshProviderHealth } from "../services/providerHealth.js";

export const sourcesRouter = Router();

// Lista de providers disponiveis (para o frontend mostrar no seletor).
sourcesRouter.get("/providers", (req, res) => {
  res.json({ providers: PROVIDERS.map((p) => ({ id: p.id, name: p.name })) });
});

// Estado (vivo/morto) dos providers: health-check automatico 1x/dia.
// ?refresh=1 força o check agora (usado pelo botao "Rever agora").
sourcesRouter.get("/providers/health", async (req, res, next) => {
  try {
    if (req.query.refresh) {
      return res.json(await refreshProviderHealth());
    }
    res.json(getProviderHealth());
  } catch (err) {
    next(err);
  }
});

// Fontes de embed para um titulo especifico.
// /api/sources?type=movie&tmdb=123
// /api/sources?type=tv&tmdb=123&season=1&episode=2
sourcesRouter.get("/sources", async (req, res, next) => {
  try {
    const { type, tmdb, imdb, season, episode, mal, anilist, audio } = req.query;

    // Os providers de anime usam id do AniList. O catalogo e do MyAnimeList, por
    // isso o anilistId pode vir a null (falha do Jikan/AniList ao carregar os
    // detalhes) e o titulo ficava sem fonte nenhuma. Resolve-se aqui uma unica
    // vez via GraphQL do AniList (com cache em memoria no jikan.js) para nunca
    // devolver zero fontes so por faltar o id.
    let anilistId = anilist;
    if (!anilistId && mal) anilistId = await malToAnilist(mal);

    // Anime: fontes dedicadas (sub/dub) por id do MAL/AniList. Nao precisa de TMDB.
    const animeSources =
      mal || anilistId
        ? buildAnimeEmbedSources({
            mal,
            anilist: anilistId,
            episode: episode != null ? Number(episode) : 1,
            audio,
          })
        : [];

    // Sem TMDB so faz sentido para anime. Devolve essas fontes.
    if (!tmdb) {
      if (animeSources.length) return res.json({ embeds: animeSources });
      // A mensagem anterior era "falta o parametro tmdb" para tudo. Num anime o
      // tmdb e' irrelevante — o que falta e' o id do AniList, e dizer "tmdb"
      // mandava quem investigasse para o lado errado (foi o que aconteceu a
      // 2026-10-08 com o Dragon Ball, que fica sem fontes quando a AniList nao
      // responde).
      if (type === "anime") {
        return res.status(400).json({
          error:
            "Nao consegui obter as fontes deste anime agora. Tenta outra vez daqui a pouco — a AniList pode estar a responder mal.",
        });
      }
      return res.status(400).json({ error: "falta o parametro tmdb" });
    }

    if (type !== "movie" && type !== "tv") {
      return res.status(400).json({ error: "type tem de ser 'movie' ou 'tv'" });
    }
    if (type === "tv" && (season == null || episode == null)) {
      return res.status(400).json({ error: "series precisam de season e episode" });
    }

    const sources = buildEmbedSources({
      type,
      tmdb,
      imdb: imdb || undefined,
      season: season != null ? Number(season) : undefined,
      episode: episode != null ? Number(episode) : undefined,
    });

    res.json({ embeds: [...animeSources, ...sources] });
  } catch (err) {
    next(err);
  }
});
