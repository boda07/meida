import { Router } from "express";
import { requireAuth, userFromToken } from "../services/auth.js";
import { getGenreVocab } from "../services/tmdb.js";
import { getMangaList, status as malStatus } from "../services/mal.js";
import {
  getMangaGenresRaw,
  discoverManga,
  recommendManga,
  normalizeMalManga,
  withTranslatedGenres,
} from "../services/manga.js";

export const mangaRouter = Router();

function langOpts(req) {
  return {
    overviewLang: req.query.overviewLang,
    genreLang: req.query.genreLang || req.query.overviewLang,
    adult: req.query.adult === "1",
  };
}

// Utilizador opcional (rotas publicas que beneficiam do login, ex.: esconder o
// que ja esta na lista). Nunca falha — devolve null se nao houver token valido.
function optionalUser(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  return token ? userFromToken(token) : null;
}

// "manhwa,manhua" -> ["manhwa","manhua"]. Aceita `types` (novo) ou `type` (antigo).
const typesOf = (req) =>
  String(req.query.types || req.query.type || "").split(",").filter(Boolean);
// "complete,publishing" -> [...]. Aceita `statuses` (novo) ou `status` (antigo).
const statusesOf = (req) =>
  String(req.query.statuses || req.query.status || "").split(",").filter(Boolean);

// Cache curta da lista do MAL por utilizador (evita re-puxar a cada toggle).
const listCache = new Map(); // userId -> { at, list }
const LIST_TTL = 3 * 60 * 1000;
async function userMangaList(userId) {
  const c = listCache.get(userId);
  if (c && Date.now() - c.at < LIST_TTL) return c.list;
  const list = await getMangaList(userId);
  listCache.set(userId, { at: Date.now(), list });
  return list;
}

// Generos + temas de manga, no idioma escolhido.
mangaRouter.get("/manga/genres", async (req, res, next) => {
  try {
    const list = await getMangaGenresRaw();
    const vocab = await getGenreVocab(req.query.genreLang || req.query.overviewLang);
    const genres = vocab
      ? list.map((g) => ({ id: g.id, name: vocab.get(String(g.name).toLowerCase()) || g.name }))
      : list;
    res.json({ genres });
  } catch (err) {
    next(err);
  }
});

// Procura por filtros (varios tipos, generos, estado, ordenacao). notInList=1
// esconde o que ja esta na lista do MAL (precisa de login + MAL ligado).
mangaRouter.get("/manga/discover", async (req, res, next) => {
  try {
    const types = typesOf(req);
    const statuses = statusesOf(req);
    const genres = String(req.query.genres || "").split(",").filter(Boolean);
    const exclude = String(req.query.exclude || "").split(",").filter(Boolean);
    const sort = req.query.sort || "popularity";
    const dir = req.query.dir === "asc" ? "asc" : "desc";
    const page = Math.max(1, Number(req.query.page) || 1);

    let excludeIds = null;
    if (req.query.notInList === "1") {
      const user = optionalUser(req);
      if (user && malStatus(user.id).linked) {
        const raw = await userMangaList(user.id);
        excludeIds = new Set(raw.map((it) => Number(it.node?.id)).filter(Boolean));
      }
    }

    res.json(
      await discoverManga(
        { types, statuses, genres, exclude, sort, dir, page, excludeIds },
        langOpts(req)
      )
    );
  } catch (err) {
    next(err);
  }
});

// Recomendacoes com base na lista do MAL (tags mais lidas). Nunca recomenda o que
// ja esta na lista do utilizador.
mangaRouter.get("/manga/recommend", requireAuth, async (req, res, next) => {
  try {
    if (!malStatus(req.user.id).linked) {
      return res.json({ linked: false, items: [], topGenres: [], read: 0 });
    }
    const types = typesOf(req);
    const statuses = statusesOf(req);
    // Ids ja mostrados (para "Mais recomendacoes" trazer titulos novos).
    const seen = String(req.query.seen || "").split(",").map(Number).filter(Boolean);
    const raw = await userMangaList(req.user.id);
    const allIds = new Set([
      ...raw.map((it) => Number(it.node?.id)).filter(Boolean),
      ...seen,
    ]);
    // So conta o que reflete o gosto: a ler, terminado ou em pausa.
    const readList = raw
      .map((it) => {
        const node = it.node || {};
        const ls = it.list_status || {};
        return {
          id: node.id,
          status: ls.status,
          genres: (node.genres || []).map((g) => g.name),
        };
      })
      .filter(
        (x) =>
          x.id && (x.status === "reading" || x.status === "completed" || x.status === "on_hold")
      );
    const rec = await recommendManga(
      readList,
      { types, statuses, excludeIds: allIds, seenCount: seen.length },
      langOpts(req)
    );
    res.json({ linked: true, read: readList.length, ...rec });
  } catch (err) {
    next(err);
  }
});

// "Para ler": a lista plan_to_read do MAL (estilo watchlist).
mangaRouter.get("/manga/to-read", requireAuth, async (req, res, next) => {
  try {
    if (!malStatus(req.user.id).linked) return res.json({ linked: false, items: [] });
    const raw = await userMangaList(req.user.id);
    let items = raw
      .filter((it) => (it.list_status || {}).status === "plan_to_read")
      .map((it) => normalizeMalManga(it.node))
      .filter(Boolean);
    items = await withTranslatedGenres(items, langOpts(req));
    res.json({ linked: true, items });
  } catch (err) {
    next(err);
  }
});
