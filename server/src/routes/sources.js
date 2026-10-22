import { Router } from "express";
import {
  buildEmbedSources,
  buildAnimeEmbedSources,
  PROVIDERS,
} from "../services/providers.js";
import { malToAnilist } from "../services/jikan.js";
import { fontesAnikoto, estadoAnikoto } from "../services/anikoto.js";
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
    const { type: tipoCru, tmdb, imdb, season, episode, mal, anilist, audio } = req.query;

    // **Um anime nao leva `type` no pedido** — o frontend so' manda `mal`/`anilist`.
    // Sem isto, um anime sem fontes caia na mensagem de filme ("falta o parametro
    // tmdb"), que manda quem investiga para o lado errado: o problema nao e' o
    // TMDB, e' a AniList. A mensagem certa (a de anime) existia desde 2026-10-08
    // para este caso exacto, mas **nunca era mostrada** — porque o `type` nunca
    // chegava. Medido: `?mal=21` dava "falta o parametro tmdb" e
    // `?type=anime&mal=21` dava a mensagem de anime.
    const type = tipoCru === "anime" || (!tipoCru && (mal || anilist)) ? "anime" : tipoCru;

    // Os providers de anime usam id do AniList. O catalogo e do MyAnimeList, por
    // isso o anilistId pode vir a null (falha do Jikan/AniList ao carregar os
    // detalhes) e o titulo ficava sem fonte nenhuma. Resolve-se aqui uma unica
    // vez via GraphQL do AniList (com cache em memoria no jikan.js) para nunca
    // devolver zero fontes so por faltar o id.
    let anilistId = anilist;
    if (!anilistId && mal) anilistId = await malToAnilist(mal);

    // Anime: fontes dedicadas (sub/dub) por id do MAL/AniList. Nao precisa de TMDB.
    const ep = episode != null ? Number(episode) : 1;
    const animeSources =
      mal || anilistId
        ? buildAnimeEmbedSources({
            mal,
            anilist: anilistId,
            episode: ep,
            audio,
          })
        : [];

    // O Anikoto como FALLBACK: o mesmo MegaPlay, mas pela rota `/stream/s-2/`,
    // que resolve titulos que a `/ani/` nao resolve. Vem DEPOIS das outras
    // (para a fonte principal continuar a ser a primeira) e nunca as substitui.
    //
    // `fontesAnikoto` devolve `[]` quando o catalogo ainda nao sabe o titulo,
    // e nesse caso dispara um rasteio em segundo plano semesperar por ele — a
    // proxima vez que o utilizador abrir o episodio ja' resolve. E' o que
    // mantem os tempos de resposta iguais aos de antes.
    const anikotoSources = mal || anilistId ? await fontesAnikoto({ mal, anilist: anilistId, episode: ep, audio }) : [];

    // Sem TMDB so faz sentido para anime. Devolve essas fontes.
    if (!tmdb) {
      const juntos = [...animeSources, ...anikotoSources];
      if (juntos.length) return res.json({ embeds: juntos });
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

    res.json({ embeds: [...animeSources, ...anikotoSources, ...sources] });
  } catch (err) {
    next(err);
  }
});

// Estado do catalogo do Anikoto (util para ver se o rasteio esta' a avancar).
sourcesRouter.get("/providers/anikoto", (_req, res) => {
  res.json({ status: estadoAnikoto() });
});
