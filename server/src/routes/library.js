import { Router } from "express";
import {
  listLibrary,
  getLibraryItem,
  upsertLibrary,
  setLibraryRating,
  clearWatchlist,
  deleteLibrary,
} from "../store.js";
import { requireAuth } from "../services/auth.js";
import { getRating } from "../services/tmdb.js";
import { getAnimeRatingsBatch } from "../services/jikan.js";
import { status as malStatus, getMeanScores } from "../services/mal.js";
import { getRatings as getLetterboxdRatings } from "../services/letterboxd.js";

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

function normalizeRow(row) {
  if (!row) return null;
  return { ...row, watched: Boolean(row.watched), watchlist: Boolean(row.watchlist) };
}

// Guarda a nota e atualiza o item em memoria (para a resposta).
function applyRating(userId, item, rating) {
  if (rating == null) return;
  setLibraryRating(userId, item.tmdbId, item.type, rating);
  item.rating = rating;
}

// Lista completa da biblioteca do utilizador. Faz backfill (uma vez) da media da
// comunidade dos itens antigos que ainda nao a tenham guardada. Em lote, para
// aguentar listas grandes (centenas de animes) em poucos segundos.
libraryRouter.get("/library", async (req, res) => {
  const items = listLibrary(req.user.id).map(normalizeRow);
  const missing = items.filter((i) => i.rating == null);

  if (missing.length) {
    const animeMissing = missing.filter((i) => i.type === "anime");
    const movieMissing = missing.filter((i) => i.type === "movie");
    const tvMissing = missing.filter((i) => i.type === "tv");

    // Anime: 1) media EXATA do MAL (1 pedido pagina a lista do utilizador)...
    if (animeMissing.length && malStatus(req.user.id).linked) {
      try {
        const means = await getMeanScores(req.user.id);
        for (const i of animeMissing) applyRating(req.user.id, i, means.get(Number(i.tmdbId)));
      } catch {
        /* sem conta MAL valida -> cai no AniList */
      }
    }
    // ...2) resto via AniList em lote (50 por pedido).
    const stillAnime = animeMissing.filter((i) => i.rating == null);
    if (stillAnime.length) {
      const map = await getAnimeRatingsBatch(stillAnime.map((i) => i.tmdbId));
      for (const i of stillAnime) applyRating(req.user.id, i, map.get(Number(i.tmdbId)));
    }

    // Filmes: media da comunidade do Letterboxd (scraping, concorrencia limitada);
    // o que falhar cai no TMDB.
    if (movieMissing.length) {
      const lb = await getLetterboxdRatings(movieMissing.map((i) => i.tmdbId));
      for (const i of movieMissing) applyRating(req.user.id, i, lb.get(Number(i.tmdbId)));
      await Promise.all(
        movieMissing
          .filter((i) => i.rating == null)
          .map(async (i) => applyRating(req.user.id, i, await getRating("movie", i.tmdbId)))
      );
    }

    // Series: media do TMDB (em paralelo).
    await Promise.all(
      tvMissing.map(async (i) => applyRating(req.user.id, i, await getRating("tv", i.tmdbId)))
    );
  }

  res.json({ items });
});

// Estado de um titulo (para a pagina de detalhe saber visto/nota atuais).
libraryRouter.get("/library/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  res.json({ item: normalizeRow(getLibraryItem(req.user.id, Number(tmdb), type)) });
});

// Cria/atualiza visto e/ou nota. Faz merge com o estado existente.
libraryRouter.post("/library", (req, res) => {
  const { tmdbId, type, title, poster, watched, watchlist, score, genres, rating } =
    req.body || {};
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
    rating: rating != null ? Number(rating) : existing?.rating ?? null,
    watched: watched != null ? (watched ? 1 : 0) : existing?.watched ?? 0,
    watchlist: watchlist != null ? (watchlist ? 1 : 0) : existing?.watchlist ?? 0,
    score: score !== undefined ? score : existing?.score ?? null,
  });
  res.json({ item: normalizeRow(getLibraryItem(req.user.id, Number(tmdbId), type)) });
});

// Limpa a watchlist por tipo (movie|tv|anime|all).
libraryRouter.delete("/library/watchlist", (req, res) => {
  const type = req.query.type || "all";
  if (!["movie", "tv", "anime", "all"].includes(type)) {
    return res.status(400).json({ error: "type invalido" });
  }
  const cleared = clearWatchlist(req.user.id, type);
  res.json({ ok: true, cleared });
});

// Remove um titulo da biblioteca.
libraryRouter.delete("/library/item", (req, res) => {
  const { type, tmdb } = req.query;
  if (!type || !tmdb) return res.status(400).json({ error: "faltam type e tmdb" });
  deleteLibrary(req.user.id, Number(tmdb), type);
  res.json({ ok: true });
});
