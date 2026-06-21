import { Router } from "express";
import {
  getCatalog,
  getCategory,
  search,
  getDetails,
  getSeason,
} from "../services/tmdb.js";
import { getAnimeCatalog, getAnimeDetails } from "../services/jikan.js";

export const catalogRouter = Router();

// Le as preferencias de idioma (titulo/sinopse) dos parametros do pedido.
function langOpts(req) {
  return {
    titleLang: req.query.titleLang,
    overviewLang: req.query.overviewLang,
  };
}

catalogRouter.get("/catalog", async (req, res, next) => {
  try {
    res.json({ rows: await getCatalog(langOpts(req)) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/catalog/:category", async (req, res, next) => {
  try {
    // Anime vem do Jikan (MyAnimeList), nao do TMDB.
    if (req.params.category === "anime") {
      return res.json({ rows: await getAnimeCatalog() });
    }
    res.json({ rows: await getCategory(req.params.category, langOpts(req)) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    res.json({ results: await search(q, langOpts(req)) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/details", async (req, res, next) => {
  try {
    const { type, id } = req.query;
    if (!type || !id) {
      return res.status(400).json({ error: "faltam parametros type e id" });
    }
    // Anime: detalhes do Jikan com match para o TMDB (para as fontes).
    if (type === "anime") {
      return res.json(await getAnimeDetails(String(id), langOpts(req)));
    }
    res.json(await getDetails(String(type), String(id), langOpts(req)));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/season", async (req, res, next) => {
  try {
    const { id, season } = req.query;
    if (!id || season == null) {
      return res.status(400).json({ error: "faltam parametros id e season" });
    }
    res.json({ episodes: await getSeason(String(id), Number(season), langOpts(req)) });
  } catch (err) {
    next(err);
  }
});
