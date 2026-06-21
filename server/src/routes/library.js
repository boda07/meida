import { Router } from "express";
import {
  listLibrary,
  getLibraryItem,
  upsertLibrary,
  setLibraryRating,
  setLibraryGenres,
  clearWatchlist,
  deleteLibrary,
} from "../store.js";
import { requireAuth } from "../services/auth.js";
import { getMeta, getGenreVocab, getLocalizedMeta } from "../services/tmdb.js";
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

// Guarda nota e/ou generos vindos do TMDB (so o que estiver em falta no item).
function applyMeta(userId, item, meta) {
  if (!meta) return;
  if (item.rating == null) applyRating(userId, item, meta.rating);
  if ((!item.genres || !item.genres.length) && meta.genres?.length) {
    setLibraryGenres(userId, item.tmdbId, item.type, meta.genres);
    item.genres = meta.genres;
  }
}

// Corre `fn` sobre `arr` com concorrencia limitada (para listas grandes).
async function pMap(arr, concurrency, fn) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, arr.length) }, async () => {
    while (idx < arr.length) {
      const cur = idx++;
      await fn(arr[cur]);
    }
  });
  await Promise.all(workers);
}

// Lista completa da biblioteca do utilizador. Faz backfill (uma vez) da media da
// comunidade E dos generos dos itens antigos que ainda nao os tenham (ex.: filmes
// importados do Letterboxd vieram sem generos). Em lote, para aguentar listas
// grandes (centenas de titulos) em poucos segundos.
libraryRouter.get("/library", async (req, res) => {
  const items = listLibrary(req.user.id).map(normalizeRow);

  // Anime: media EXATA do MAL (1 pedido) e o resto via AniList em lote.
  const animeMissing = items.filter((i) => i.type === "anime" && i.rating == null);
  if (animeMissing.length && malStatus(req.user.id).linked) {
    try {
      const means = await getMeanScores(req.user.id);
      for (const i of animeMissing) applyRating(req.user.id, i, means.get(Number(i.tmdbId)));
    } catch {
      /* sem conta MAL valida -> cai no AniList */
    }
  }
  const stillAnime = animeMissing.filter((i) => i.rating == null);
  if (stillAnime.length) {
    const map = await getAnimeRatingsBatch(stillAnime.map((i) => i.tmdbId));
    for (const i of stillAnime) applyRating(req.user.id, i, map.get(Number(i.tmdbId)));
  }

  // Filmes: nota da comunidade do Letterboxd (so para os que faltam).
  const movieRatingMissing = items.filter((i) => i.type === "movie" && i.rating == null);
  if (movieRatingMissing.length) {
    const lb = await getLetterboxdRatings(movieRatingMissing.map((i) => i.tmdbId));
    for (const i of movieRatingMissing) applyRating(req.user.id, i, lb.get(Number(i.tmdbId)));
  }

  // Filmes/series: TMDB preenche nota em falta E/OU generos em falta, numa so
  // chamada por item (concorrencia limitada).
  const needMeta = items.filter(
    (i) =>
      (i.type === "movie" || i.type === "tv") &&
      (i.rating == null || !i.genres || !i.genres.length)
  );
  if (needMeta.length) {
    await pMap(needMeta, 12, async (i) =>
      applyMeta(req.user.id, i, await getMeta(i.type, i.tmdbId))
    );
  }

  // Valida + traduz os generos: so mostra generos conhecidos (TMDB + MAL), corrige
  // maiusculas, traduz para o idioma escolhido e remove duplicados. Assim some o
  // lixo que ficou guardado em listas antigas (ex.: titulos parados nos generos).
  const vocab = await getGenreVocab(req.query.overviewLang);
  if (vocab) {
    for (const i of items) {
      const seen = new Set();
      const out = [];
      for (const g of i.genres || []) {
        const canon = vocab.get(String(g).toLowerCase());
        if (canon && !seen.has(canon)) {
          seen.add(canon);
          out.push(canon);
        }
      }
      i.genres = out;
    }
  }

  // Titulos E cartazes de filmes/series no idioma escolhido (ex.: watchlist
  // importada do Letterboxd vinha em ingles). Em cache, por isso so a 1a vez e
  // mais lento.
  const localizable = items.filter((i) => i.type === "movie" || i.type === "tv");
  if (localizable.length) {
    await pMap(localizable, 12, async (i) => {
      const m = await getLocalizedMeta(i.type, i.tmdbId, req.query.titleLang);
      if (m?.title) i.title = m.title;
      if (m?.poster) i.poster = m.poster;
    });
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
