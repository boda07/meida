import { Router } from "express";
import {
  listLibrary,
  getLibraryItem,
  upsertLibrary,
  setLibraryRating,
  setLibraryGenres,
  clearWatchlist,
  deleteLibrary,
  listLists,
  getList,
  createList,
  renameList,
  deleteList,
  addListTitle,
  removeListTitle,
} from "../store.js";
import { requireAuth } from "../services/auth.js";
import { getMeta, getGenreVocab, getLocalizedMeta, getLocalizedMetaCached } from "../services/tmdb.js";
import { getAnimeRatingsBatch } from "../services/jikan.js";
import { status as malStatus, getMeanScores, shouldAutoSync, markAutoSync, unmarkAutoSync, importMalList } from "../services/mal.js";
import { getCachedRating, getCachedRatings, getRatings as getLetterboxdRatings } from "../services/letterboxd.js";
import { isOnline } from "../services/net.js";
import { cacheGet, cacheSet } from "../services/cache.js";

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
//
// A resposta usa o que ja esta em cache (memoria/disco) e dispara o que falta
// (scraping do Letterboxd, TMDB por item) em background — assim a lista abre
// sempre imediatamente e as notas aparecem no pedido seguinte (`pending` diz ao
// frontend para voltar a pedir daqui a pouco).
libraryRouter.get("/library", async (req, res) => {
  const items = listLibrary(req.user.id).map(normalizeRow);
  // Sem internet: serve só o que já está em cache (sem pedidos externos, sem
  // esperas de timeout) — a lista abre na mesma, com os dados guardados.
  const online = isOnline();

  // Indice titulo -> id para o fallback TVMaze (series cujo detalhe nunca foi
  // aberto nao passaram pelo catalogo; a library tem o titulo guardado).
  for (const i of items) {
    if ((i.type === "movie" || i.type === "tv") && i.title) {
      const idxKey = `tvidx:${i.type}:${i.tmdbId}`;
      if (!cacheGet(idxKey)) cacheSet(idxKey, { title: i.title, year: "" });
    }
  }

  // Anime: media EXATA do MAL (1 pedido) e o resto via AniList em lote.
  const animeMissing = items.filter((i) => i.type === "anime" && i.rating == null);
  if (online && animeMissing.length && malStatus(req.user.id).linked) {
    try {
      const means = await getMeanScores(req.user.id);
      for (const i of animeMissing) applyRating(req.user.id, i, means.get(Number(i.tmdbId)));
    } catch {
      /* sem conta MAL valida -> cai no AniList */
    }
  }
  const stillAnime = animeMissing.filter((i) => i.rating == null);
  if (online && stillAnime.length) {
    const map = await getAnimeRatingsBatch(stillAnime.map((i) => i.tmdbId));
    for (const i of stillAnime) applyRating(req.user.id, i, map.get(Number(i.tmdbId)));
  }

  // MAL ligado: sincroniza a lista (estado preciso: visto/ver, nota pessoal,
  // progresso, diario) no maximo de 6 em 6 horas. Em background — a resposta
  // nao espera; a proxima abertura ja vem com o estado do MAL aplicado.
  if (online && malStatus(req.user.id).linked && shouldAutoSync(req.user.id)) {
    markAutoSync(req.user.id);
    importMalList(req.user.id).catch(() => {
      // Sem sucesso (rede/MAL em baixo, conta invalida): desmarca para a
      // proxima abertura voltar a tentar, em vez de esperar as 6h.
      unmarkAutoSync(req.user.id);
    });
  }

  // Filmes: aplica ja as notas Letterboxd conhecidas (memoria/disco, sem scraping).
  const movies = items.filter((i) => i.type === "movie");
  const lbKnown = getCachedRatings(movies.map((i) => i.tmdbId));
  for (const i of movies) applyRating(req.user.id, i, lbKnown.get(Number(i.tmdbId)));

  // Titulos E cartazes de filmes/series no idioma escolhido (ex.: watchlist
  // importada do Letterboxd vinha em ingles) — os ja conhecidos, sem pedidos.
  const localizable = items.filter((i) => i.type === "movie" || i.type === "tv");
  const titleLang = req.query.titleLang;
  for (const i of localizable) {
    const m = getLocalizedMetaCached(i.type, i.tmdbId, titleLang);
    if (m?.title) i.title = m.title;
    if (m?.poster) i.poster = m.poster;
  }

  // Valida + traduz os generos: so mostra generos conhecidos (TMDB + MAL), corrige
  // maiusculas, traduz para o idioma escolhido e remove duplicados. Assim some o
  // lixo que ficou guardado em listas antigas (ex.: titulos parados nos generos).
  // Offline: salta (faria pedidos ao TMDB); os generos ja validados ficam como estao.
  const vocab = online ? await getGenreVocab(req.query.genreLang || req.query.overviewLang) : null;
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

  // O que falta preencher vai para background (não bloqueia a resposta):
  //  - notas Letterboxd dos filmes ainda não conhecidas;
  //  - generos do TMDB dos itens em falta (a nota em falta eterna — filme sem
  //    nota em lado nenhum — não mantém `pending` para sempre);
  //  - titulo/cartaz localizados em falta.
  const pending = Boolean(
    movies.some((i) => !getCachedRating(Number(i.tmdbId)).known) ||
    items.some(
      (i) =>
        (i.type === "movie" || i.type === "tv") &&
        (!i.genres || !i.genres.length)
    ) ||
    localizable.some((i) => !getLocalizedMetaCached(i.type, i.tmdbId, titleLang))
  );
  if (pending && online) {
    // Sem await: corre em paralelo e a proxima abertura ja vem completa.
    runBackfill(req.user.id, items, titleLang);
  }

  res.json({ items, pending, online });
});

// Preenchimento em background do que a lista ainda nao tinha em cache.
async function runBackfill(userId, items, titleLang) {
  try {
    // Filmes: scraping do Letterboxd so para os que nao tem nota conhecida.
    const movies = items.filter((i) => i.type === "movie");
    const missingLb = movies.filter(
      (i) => !getCachedRating(Number(i.tmdbId)).known
    );
    if (missingLb.length) {
      const lb = await getLetterboxdRatings(missingLb.map((i) => i.tmdbId));
      for (const i of missingLb) applyRating(userId, i, lb.get(Number(i.tmdbId)));
    }

    // Filmes/series: TMDB preenche nota em falta E/OU generos em falta.
    const needMeta = items.filter(
      (i) =>
        (i.type === "movie" || i.type === "tv") &&
        (i.rating == null || !i.genres || !i.genres.length)
    );
    if (needMeta.length) {
      await pMap(needMeta, 12, async (i) =>
        applyMeta(userId, i, await getMeta(i.type, i.tmdbId))
      );
    }

    // Titulo/cartaz localizados em falta.
    const localizable = items.filter((i) => i.type === "movie" || i.type === "tv");
    const needLoc = localizable.filter(
      (i) => !getLocalizedMetaCached(i.type, i.tmdbId, titleLang)
    );
    if (needLoc.length) {
      await pMap(needLoc, 12, async (i) => {
        const m = await getLocalizedMeta(i.type, i.tmdbId, titleLang);
        if (m?.title) i.title = m.title;
        if (m?.poster) i.poster = m.poster;
      });
    }
  } catch {
    /* best-effort: a proxima abertura tenta outra vez */
  }
}

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

/* ===== Listas personalizadas ===== */

// Lista das listas do utilizador (com contagem de titulos).
libraryRouter.get("/lists", (req, res) => {
  res.json({ lists: listLists(req.user.id) });
});

// Cria uma lista.
libraryRouter.post("/lists", (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "a lista precisa de um nome" });
  res.json({ list: createList(req.user.id, name) });
});

// Conteudo de uma lista.
libraryRouter.get("/lists/:id", (req, res) => {
  const list = getList(req.user.id, Number(req.params.id));
  if (!list) return res.status(404).json({ error: "lista nao encontrada" });
  res.json({ list });
});

// Renomeia uma lista.
libraryRouter.patch("/lists/:id", (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "a lista precisa de um nome" });
  const list = renameList(req.user.id, Number(req.params.id), name);
  if (!list) return res.status(404).json({ error: "lista nao encontrada" });
  res.json({ list });
});

// Apaga uma lista (e os titulos dela).
libraryRouter.delete("/lists/:id", (req, res) => {
  const ok = deleteList(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "lista nao encontrada" });
  res.json({ ok: true });
});

// Adiciona um titulo a uma lista.
libraryRouter.post("/lists/:id/titles", (req, res) => {
  const { tmdbId, type, title, poster } = req.body || {};
  if (!tmdbId || (type !== "movie" && type !== "tv" && type !== "anime")) {
    return res.status(400).json({ error: "tmdbId e type (movie|tv|anime) sao obrigatorios" });
  }
  const list = addListTitle(req.user.id, Number(req.params.id), {
    tmdbId: Number(tmdbId),
    type,
    title,
    poster,
  });
  if (!list) return res.status(404).json({ error: "lista nao encontrada" });
  res.json({ list });
});

// Remove um titulo de uma lista.
libraryRouter.delete("/lists/:id/titles", (req, res) => {
  const { tmdbId, type } = req.query;
  if (!tmdbId || !type) return res.status(400).json({ error: "faltam tmdbId e type" });
  removeListTitle(req.user.id, Number(req.params.id), Number(tmdbId), type);
  res.json({ ok: true });
});
