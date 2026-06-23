import { Router } from "express";
import {
  getCatalog,
  getCategory,
  search,
  getDetails,
  getSeason,
  getGenres,
  getGenreVocab,
  pickRandom,
  discover,
} from "../services/tmdb.js";
import {
  getAnimeCatalog,
  getAnimeDetails,
  getAnimeMovies,
  searchAnime,
  getAnimeGenres,
  pickAnime,
  discoverAnime,
} from "../services/jikan.js";

export const catalogRouter = Router();

// Le as preferencias de idioma (titulo/sinopse) dos parametros do pedido.
function langOpts(req) {
  return {
    titleLang: req.query.titleLang,
    overviewLang: req.query.overviewLang,
    animeTitleLang: req.query.animeTitleLang,
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
      return res.json({ rows: await getAnimeCatalog(langOpts(req)) });
    }
    const rows = await getCategory(req.params.category, langOpts(req));
    // Nos Filmes, junta tambem filmes de anime (vindos do MAL).
    if (req.params.category === "movies") {
      const animeMovies = await getAnimeMovies(langOpts(req));
      if (animeMovies.length) {
        rows.push({ id: "m-anime", title: "Filmes de anime", items: animeMovies });
      }
    }
    res.json({ rows });
  } catch (err) {
    next(err);
  }
});

// Grelha filtravel/ordenavel por tipo (Filmes/Series/Anime), com paginacao.
catalogRouter.get("/discover", async (req, res, next) => {
  try {
    const { type } = req.query;
    const genres = String(req.query.genres || "").split(",").filter(Boolean);
    const sort = req.query.sort || "popularity";
    const dir = req.query.dir === "asc" ? "asc" : "desc";
    const page = Math.max(1, Number(req.query.page) || 1);
    if (type === "anime") {
      return res.json(await discoverAnime({ genres, sort, dir, page }, langOpts(req)));
    }
    if (type === "movie" || type === "tv") {
      return res.json(await discover({ type, genres, sort, dir, page }, langOpts(req)));
    }
    res.status(400).json({ error: "type tem de ser movie, tv ou anime" });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ results: [] });
    // Filmes/series do TMDB (sem anime) + anime do MAL (Jikan), sem duplicados.
    const [media, anime] = await Promise.all([
      search(q, langOpts(req)),
      searchAnime(q, langOpts(req)),
    ]);
    res.json({ results: [...media, ...anime] });
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
    // Anime: detalhes 100% MyAnimeList (Jikan).
    if (type === "anime") {
      return res.json(await getAnimeDetails(String(id), langOpts(req)));
    }
    res.json(await getDetails(String(type), String(id), langOpts(req)));
  } catch (err) {
    next(err);
  }
});

// Lista de generos para o "Escolhe algo para mim", no idioma escolhido.
catalogRouter.get("/genres", async (req, res, next) => {
  try {
    const type = req.query.type;
    const lang = req.query.overviewLang;
    if (type === "anime") {
      // Os nomes vem do Jikan em ingles -> traduz pelo vocabulario (TMDB + MAL).
      const list = await getAnimeGenres();
      const vocab = await getGenreVocab(lang);
      const genres = vocab
        ? list.map((g) => ({ id: g.id, name: vocab.get(String(g.name).toLowerCase()) || g.name }))
        : list;
      return res.json({ genres });
    }
    if (type === "movie" || type === "tv") {
      return res.json({ genres: await getGenres(type, lang) });
    }
    res.status(400).json({ error: "type tem de ser movie, tv ou anime" });
  } catch (err) {
    next(err);
  }
});

// Escolhe um titulo aleatorio segundo generos a incluir/excluir.
catalogRouter.get("/pick", async (req, res, next) => {
  try {
    const { type } = req.query;
    const genres = String(req.query.genres || "").split(",").filter(Boolean);
    const exclude = String(req.query.exclude || "").split(",").filter(Boolean);
    let item = null;
    if (type === "anime") {
      item = await pickAnime({ genres, exclude }, langOpts(req));
    } else if (type === "movie" || type === "tv") {
      item = await pickRandom({ type, genres, without: exclude }, langOpts(req));
    } else {
      return res.status(400).json({ error: "type tem de ser movie, tv ou anime" });
    }
    res.json({ item });
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
