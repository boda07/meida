// Regras da biblioteca e das listas pessoais.
//
// A rota (`routes/library.js`) valida o pedido e responde; o que e' regra de
// negocio vive aqui: o backfill em segundo plano, a fusao com o estado que ja
// estava guardado, o registo no feed e a validacao dos generos.
//
// As funcoes recebem argumentos simples (userId, body, query) e devolvem
// `{ erro, status }` quando o pedido nao passa — a rota so traduz isso em HTTP.
import {
  listLibrary,
  getLibraryItem,
  upsertLibrary,
  setLibraryRating,
  setLibraryGenres,
  setLibraryYear,
  clearWatchlist,
  deleteLibrary,
  listLists,
  getList,
  createList,
  renameList,
  deleteList,
  addListTitle,
  removeListTitle,
  recordActivity,
  eFilme,
} from "../store.js";
import {
  getMeta,
  getGenreVocab,
  getLocalizedMetaCached,
  localizarTitulos,
  preencherTitulosLocalizados,
} from "../services/tmdb.js";
import { getAnimeRatingsBatch } from "../services/jikan.js";
import {
  status as malStatus,
  getMeanScores,
  shouldAutoSync,
  markAutoSync,
  unmarkAutoSync,
  importMalList,
} from "../services/mal.js";
import {
  status as anilistStatus,
  shouldAutoSync as shouldAutoSyncAni,
  markAutoSync as markAutoSyncAni,
  unmarkAutoSync as unmarkAutoSyncAni,
  importAnilistList,
  syncCrossWithMal,
  shouldAutoSyncCross,
  markAutoSyncCross,
  unmarkAutoSyncCross,
} from "../services/anilist.js";
import {
  getCachedRating,
  getCachedRatings,
  getRatings as getLetterboxdRatings,
} from "../services/letterboxd.js";
import { isOnline, pMap } from "../services/net.js";
import { cacheGet, cacheSet } from "../services/cache.js";

// Estados que um item pode ter na coluna `status` da biblioteca. NULL = usa as
// flags watched/watchlist (ver estadoDe() em server/src/store.js).
const ESTADOS_OK = new Set(["paused", "dropped"]);

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

// Lista completa da biblioteca do utilizador. Faz backfill (uma vez) da media da
// comunidade E dos generos dos itens antigos que ainda nao os tenham (ex.: filmes
// importados do Letterboxd vieram sem generos). Em lote, para aguentar listas
// grandes (centenas de titulos) em poucos segundos.
//
// A resposta usa o que ja esta em cache (memoria/disco) e dispara o que falta
// (scraping do Letterboxd, TMDB por item) em background — assim a lista abre
// sempre imediatamente e as notas aparecem no pedido seguinte (`pending` diz ao
// frontend para voltar a pedir daqui a pouco).
export async function listarBiblioteca({ userId, titleLang, genreLang, overviewLang }) {
  const items = listLibrary(userId).map(normalizeRow);
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
  if (online && animeMissing.length && malStatus(userId).linked) {
    try {
      const means = await getMeanScores(userId);
      for (const i of animeMissing) applyRating(userId, i, means.get(Number(i.tmdbId)));
    } catch {
      /* sem conta MAL valida -> cai no AniList */
    }
  }
  const stillAnime = animeMissing.filter((i) => i.rating == null);
  if (online && stillAnime.length) {
    const map = await getAnimeRatingsBatch(stillAnime.map((i) => i.tmdbId));
    for (const i of stillAnime) applyRating(userId, i, map.get(Number(i.tmdbId)));
  }

  // MAL ligado: sincroniza a lista (estado preciso: visto/ver, nota pessoal,
  // progresso, diario) no maximo de 6 em 6 horas. Em background — a resposta
  // nao espera; a proxima abertura ja vem com o estado do MAL aplicado.
  if (online && malStatus(userId).linked && shouldAutoSync(userId)) {
    markAutoSync(userId);
    importMalList(userId).catch(() => {
      // Sem sucesso (rede/MAL em baixo, conta invalida): desmarca para a
      // proxima abertura voltar a tentar, em vez de esperar as 6h.
      unmarkAutoSync(userId);
    });
  } else if (online && !malStatus(userId).linked && anilistStatus(userId).linked && shouldAutoSyncAni(userId)) {
    // Sem MAL mas com AniList ligado: usa o AniList como fonte de verdade da lista.
    markAutoSyncAni(userId);
    importAnilistList(userId).catch(() => {
      unmarkAutoSyncAni(userId);
    });
  }

  // Cross-sync MAL <-> AniList: se as duas estiverem ligadas, empurra o maior
  // progresso para a conta atrasada (background, sem bloquear a resposta).
  if (online && malStatus(userId).linked && anilistStatus(userId).linked && shouldAutoSyncCross(userId)) {
    markAutoSyncCross(userId);
    syncCrossWithMal(userId).catch(() => {
      unmarkAutoSyncCross(userId);
    });
  }

  // Filmes: aplica ja as notas Letterboxd conhecidas (memoria/disco, sem scraping).
  const movies = items.filter((i) => i.type === "movie");
  const lbKnown = getCachedRatings(movies.map((i) => i.tmdbId));
  for (const i of movies) applyRating(userId, i, lbKnown.get(Number(i.tmdbId)));

  // Titulos E cartazes de filmes/series no idioma escolhido (ex.: watchlist
  // importada do Letterboxd vinha em ingles) — os ja conhecidos, sem pedidos.
  const localizable = items.filter((i) => i.type === "movie" || i.type === "tv");
  const semTituloLocalizado = localizarTitulos(items, titleLang);

  // Valida + traduz os generos: so mostra generos conhecidos (TMDB + MAL), corrige
  // maiusculas, traduz para o idioma escolhido e remove duplicados. Assim some o
  // lixo que ficou guardado em listas antigas (ex.: titulos parados nos generos).
  // Offline: salta (faria pedidos ao TMDB); os generos ja validados ficam como estao.
  const vocab = online ? await getGenreVocab(genreLang || overviewLang) : null;
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
    runBackfill(userId, items, titleLang, semTituloLocalizado);
  }

  return { items, pending, online };
}

// Preenchimento em background do que a lista ainda nao tinha em cache.
// `semTituloLocalizado` vem do `localizarTitulos` desta mesma resposta: sao os
// itens que ficaram sem titulo no idioma pedido.
async function runBackfill(userId, items, titleLang, semTituloLocalizado) {
  try {
    // Filmes: scraping do Letterboxd so para os que nao tem nota conhecida.
    const movies = items.filter((i) => i.type === "movie");
    const missingLb = movies.filter((i) => !getCachedRating(Number(i.tmdbId)).known);
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
      await pMap(needMeta, 12, async (i) => applyMeta(userId, i, await getMeta(i.type, i.tmdbId)));
    }

    // Titulo/cartaz localizados em falta. A lista ja foi calculada no pedido
    // anterior (`semTituloLocalizado`); recalcular aqui cobre o caso de o
    // pedido ter respondido sem cache nenhum.
    const needLoc = semTituloLocalizado?.length
      ? semTituloLocalizado
      : items.filter(
          (i) =>
            (i.type === "movie" || i.type === "tv") &&
            !getLocalizedMetaCached(i.type, i.tmdbId, titleLang)
        );
    if (needLoc.length) {
      await preencherTitulosLocalizados(needLoc, titleLang);
    }
  } catch {
    /* best-effort: a proxima abertura tenta outra vez */
  }
}

// Estado de um titulo (para a pagina de detalhe saber visto/nota atuais).
export function obterItem({ userId, type, tmdb }) {
  if (!type || !tmdb) return { erro: "faltam type e tmdb", status: 400 };
  return { item: normalizeRow(getLibraryItem(userId, Number(tmdb), type)) };
}

// Cria/atualiza visto e/ou nota. Faz merge com o estado existente.
export function guardarItem({ userId, body }) {
  const { tmdbId, type, title, poster, watched, watchlist, score, genres, rating, year, isMovie } =
    body || {};
  const { status } = body || {};
  if (!tmdbId || (type !== "movie" && type !== "tv" && type !== "anime")) {
    return { erro: "tmdbId e type (movie|tv|anime) sao obrigatorios", status: 400 };
  }
  if (score != null && (score < 1 || score > 100)) {
    return { erro: "score tem de estar entre 1 e 100", status: 400 };
  }
  // "paused" / "dropped" / null. Qualquer outro valor e' erro de corpo, nao um
  // estado desconhecido guardado em silencio.
  if (status !== undefined && status !== null && !ESTADOS_OK.has(status)) {
    return { erro: "status invalido (paused|dropped|null)", status: 400 };
  }

  const existing = getLibraryItem(userId, Number(tmdbId), type);

  // Um item "em pausa" ou "abandonado" nao pode continuar a contar como "para
  // ver" — era isso que fazia o perfil dizer 389 quando a pessoa via 2. Por isso
  // marcar um destes estados limpa as flags; o estado passa a ser o `status`.
  // Tirar o `status` (voltar a null) NAO repõe a watchlist: quem despausa um
  // titulo decide de novo o que quer com ele, em vez de o app adivinhar.
  const estadoNovo = status === undefined ? (existing?.status ?? null) : status;
  const temEstado = estadoNovo === "paused" || estadoNovo === "dropped";

  upsertLibrary({
    userId,
    tmdbId: Number(tmdbId),
    type,
    title: title ?? existing?.title ?? null,
    poster: poster ?? existing?.poster ?? null,
    genres: Array.isArray(genres) ? genres : existing?.genres ?? [],
    // O ano, quando vem. Sem isto, marcar um titulo como visto perderia o ano que
    // a ficha tinha gravado — o `COALESCE` no store protege o valor guardado, mas
    // sem o campo a chegar aqui nunca se escrevia pela primeira vez.
    year: year ?? existing?.year ?? null,
    rating: rating != null ? Number(rating) : existing?.rating ?? null,
    watched: temEstado ? 0 : watched != null ? (watched ? 1 : 0) : existing?.watched ?? 0,
    watchlist: temEstado ? 0 : watchlist != null ? (watchlist ? 1 : 0) : existing?.watchlist ?? 0,
    status: estadoNovo,
    score: score !== undefined ? score : existing?.score ?? null,
  });
  const item = normalizeRow(getLibraryItem(userId, Number(tmdbId), type));
  // O feed regista o filme marcado como visto pela biblioteca. So filmes: uma
  // serie marcada como vista nao diz QUAL episodio, e o feed existe para dizer
  // o episodio. As series entram pelo `finishProgress`. O `!existing.watched`
  // evita repetir no feed um filme que ja estava visto.
  //
  // `isMovie` e' o caso do anime: la' o `type` e' "anime" para filmes e
  // series (o id e' o do MAL), e o cliente e' que sabe qual e'. Sem este
  // campo, um filme de anime marcado pela grelha nunca entrava no feed.
  const ehFilme = eFilme(type, isMovie);
  if (ehFilme && item?.watched && !existing?.watched) {
    recordActivity({
      userId,
      type,
      tmdbId: Number(tmdbId),
      title: item.title,
      poster: item.poster,
      kind: "movie",
    });
  }
  return { item };
}

// Guarda so' o ano de um titulo que ja esta' na biblioteca.
//
// Rota separada do POST /library de proposito: aquele faz
// `watched = excluded.watched`, portanto um pedido so' para gravar o ano
// desmarcaria o titulo como visto. Aqui so' o ano e' tocado.
export function guardarAno({ userId, body }) {
  const { tmdbId, type, year } = body || {};
  if (!tmdbId || (type !== "movie" && type !== "tv" && type !== "anime")) {
    return { erro: "tmdbId e type (movie|tv|anime) sao obrigatorios", status: 400 };
  }
  const written = setLibraryYear(userId, Number(tmdbId), type, year);
  return { ok: true, written };
}

// Limpa a watchlist por tipo (movie|tv|anime|all).
export function limparWatchlist({ userId, type }) {
  if (!["movie", "tv", "anime", "all"].includes(type)) {
    return { erro: "type invalido", status: 400 };
  }
  return { ok: true, cleared: clearWatchlist(userId, type) };
}

// Remove um titulo da biblioteca.
export function removerItem({ userId, type, tmdb }) {
  if (!type || !tmdb) return { erro: "faltam type e tmdb", status: 400 };
  deleteLibrary(userId, Number(tmdb), type);
  return { ok: true };
}

/* ===== Listas personalizadas ===== */

// Lista das listas do utilizador (com contagem de titulos).
export function listarListas({ userId }) {
  return { lists: listLists(userId) };
}

// Cria uma lista.
export function criarLista({ userId, body }) {
  const name = String(body?.name || "").trim().slice(0, 60);
  if (!name) return { erro: "a lista precisa de um nome", status: 400 };
  return { list: createList(userId, name) };
}

// Conteudo de uma lista. Os titulos localizam-se ao sair, como na biblioteca: a
// lista guarda o titulo do momento em que o titulo foi acrescentado.
export function obterLista({ userId, id, titleLang }) {
  const list = getList(userId, Number(id));
  if (!list) return { erro: "lista nao encontrada", status: 404 };
  const emFalta = localizarTitulos(list.items, titleLang);
  // Em segundo plano: a proxima abertura ja vem completa.
  preencherTitulosLocalizados(emFalta, titleLang);
  return { list };
}

// Renomeia uma lista.
export function renomearLista({ userId, id, body }) {
  const name = String(body?.name || "").trim().slice(0, 60);
  if (!name) return { erro: "a lista precisa de um nome", status: 400 };
  const list = renameList(userId, Number(id), name);
  if (!list) return { erro: "lista nao encontrada", status: 404 };
  return { list };
}

// Apaga uma lista (e os titulos dela).
export function apagarLista({ userId, id }) {
  const ok = deleteList(userId, Number(id));
  if (!ok) return { erro: "lista nao encontrada", status: 404 };
  return { ok: true };
}

// Acrescenta um titulo a uma lista.
export function acrescentarTitulo({ userId, id, body }) {
  const { tmdbId, type, title, poster } = body || {};
  if (!tmdbId || (type !== "movie" && type !== "tv" && type !== "anime")) {
    return { erro: "tmdbId e type (movie|tv|anime) sao obrigatorios", status: 400 };
  }
  const list = addListTitle(userId, Number(id), {
    tmdbId: Number(tmdbId),
    type,
    title,
    poster,
  });
  if (!list) return { erro: "lista nao encontrada", status: 404 };
  return { list };
}

// Tira um titulo de uma lista.
export function removerTitulo({ userId, id, tmdbId, type }) {
  if (!tmdbId || !type) return { erro: "faltam tmdbId e type", status: 400 };
  removeListTitle(userId, Number(id), Number(tmdbId), type);
  return { ok: true };
}