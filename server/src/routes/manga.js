import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { getGenreVocab } from "../services/tmdb.js";
import { getMangaList, status as malStatus } from "../services/mal.js";
import { getMangaGenresRaw, discoverManga, recommendManga } from "../services/manga.js";

export const mangaRouter = Router();

function langOpts(req) {
  return {
    overviewLang: req.query.overviewLang,
    genreLang: req.query.genreLang || req.query.overviewLang,
    adult: req.query.adult === "1",
  };
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

// Procura por filtros (tipo manhwa/manhua, generos, estado, ordenacao).
mangaRouter.get("/manga/discover", async (req, res, next) => {
  try {
    const type = String(req.query.type || "");
    const status = String(req.query.status || "");
    const genres = String(req.query.genres || "").split(",").filter(Boolean);
    const exclude = String(req.query.exclude || "").split(",").filter(Boolean);
    const sort = req.query.sort || "popularity";
    const dir = req.query.dir === "asc" ? "asc" : "desc";
    const page = Math.max(1, Number(req.query.page) || 1);
    res.json(await discoverManga({ type, status, genres, exclude, sort, dir, page }, langOpts(req)));
  } catch (err) {
    next(err);
  }
});

// Recomendacoes com base na lista do MAL do utilizador (tags mais lidas).
mangaRouter.get("/manga/recommend", requireAuth, async (req, res, next) => {
  try {
    if (!malStatus(req.user.id).linked) {
      return res.json({ linked: false, items: [], topGenres: [], read: 0 });
    }
    const type = String(req.query.type || "");
    const status = String(req.query.status || "");
    const raw = await getMangaList(req.user.id);
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
    const rec = await recommendManga(readList, { type, status }, langOpts(req));
    res.json({ linked: true, read: readList.length, ...rec });
  } catch (err) {
    next(err);
  }
});
