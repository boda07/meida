// Catálogo: filas, pesquisa, detalhes, estações e o "escolhe por mim".
//
// A rota (`routes/catalog.js`) le os parametros e responde; aqui esta a regra:
// que fontes entram (TMDB + Jikan), como se juntam, e o que se faz quando uma
// delas falha.
import {
  getCatalog,
  getCategory,
  search,
  getDetails,
  getSeason,
  getSimilar,
  getGenres,
  getGenreVocab,
  pickRandom,
  discover,
} from "../services/tmdb.js";
import {
  getAnimeCatalog,
  getAnimeDetails,
  getAnimeEpisodes,
  getAnimeMovies,
  searchAnime,
  getAnimeGenres,
  getAnimeRecommendations,
  pickAnime,
  discoverAnime,
} from "../services/jikan.js";
import { getRating as getLetterboxdRating } from "../services/letterboxd.js";
import { getCatalogRow } from "../services/catalogRows.js";
import { log } from "../services/log.js";

// Le as preferencias de idioma (titulo/sinopse) dos parametros do pedido.
export function langOpts(query) {
  return {
    titleLang: query.titleLang,
    overviewLang: query.overviewLang,
    // Idioma dos generos: o escolhido ou, se nao houver, segue as sinopses.
    genreLang: query.genreLang || query.overviewLang,
    animeTitleLang: query.animeTitleLang,
    adult: query.adult === "1", // mostrar conteudo adulto (anime NSFW)
  };
}

export async function catalogo({ query }) {
  return { rows: await getCatalog(langOpts(query)) };
}

export async function categoria({ category, query }) {
  // Anime vem do Jikan (MyAnimeList), nao do TMDB.
  if (category === "anime") {
    return { rows: await getAnimeCatalog(langOpts(query)) };
  }
  const rows = await getCategory(category, langOpts(query));
  // Nos Filmes, junta tambem filmes de anime (vindos do MAL).
  if (category === "movies") {
    const animeMovies = await getAnimeMovies(langOpts(query));
    if (animeMovies.length) {
      rows.push({ id: "m-anime", title: "Filmes de anime", items: animeMovies });
    }
  }
  return { rows };
}

// Lista completa de uma row do catalogo ("Ver todos"), pagina a pagina.
export async function linha({ id, query }) {
  const page = Math.max(1, Number(query.page) || 1);
  const row = await getCatalogRow(id, { page, genres: query.genres }, langOpts(query));
  if (!row) return { erro: "linha desconhecida", status: 404 };
  return row;
}

// Grelha filtravel/ordenavel por tipo (Filmes/Series/Anime), com paginacao.
export async function descobrir({ query }) {
  const { type } = query;
  const genres = String(query.genres || "").split(",").filter(Boolean);
  const sort = query.sort || "popularity";
  const dir = query.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(query.page) || 1);
  if (type === "anime") {
    return discoverAnime({ genres, sort, dir, page }, langOpts(query));
  }
  if (type === "movie" || type === "tv") {
    return discover({ type, genres, sort, dir, page }, langOpts(query));
  }
  return { erro: "type tem de ser movie, tv ou anime", status: 400 };
}

export async function pesquisar({ query }) {
  const q = String(query.q || "").trim();
  if (!q) return { results: [] };
  // Filmes/series do TMDB (sem anime) + anime do MAL (Jikan). Se um provider
  // falhar temporariamente, a pesquisa devolve o que o outro conseguiu obter.
  const [mediaResult, animeResult] = await Promise.allSettled([
    search(q, langOpts(query)),
    searchAnime(q, langOpts(query)),
  ]);

  const media = mediaResult.status === "fulfilled" ? mediaResult.value : [];
  const anime = animeResult.status === "fulfilled" ? animeResult.value : [];
  if (mediaResult.status === "rejected") {
    log.warn("search", "TMDB falhou", { error: String(mediaResult.reason?.message || mediaResult.reason) });
  }
  if (animeResult.status === "rejected") {
    log.warn("search", "Jikan/Tenrai falhou", { error: String(animeResult.reason?.message || animeResult.reason) });
  }
  if (!media.length && !anime.length && mediaResult.status === "rejected" && animeResult.status === "rejected") {
    throw mediaResult.reason || animeResult.reason;
  }

  return { results: [...media, ...anime] };
}

export async function episodiosAnime({ query }) {
  const mal = String(query.mal || "");
  if (!mal) return { erro: "falta mal", status: 400 };
  return { seasons: await getAnimeEpisodes(mal) };
}

export async function recomendacoes({ query }) {
  const { type, id } = query;
  if (!type || !id) return { erro: "faltam parametros type e id", status: 400 };
  if (type === "anime") {
    return { items: await getAnimeRecommendations(String(id), langOpts(query)) };
  }
  return { items: await getSimilar(String(type), String(id), langOpts(query)) };
}

export async function detalhes({ query }) {
  const { type, id } = query;
  if (!type || !id) return { erro: "faltam parametros type e id", status: 400 };
  // Anime: detalhes 100% MyAnimeList (Jikan).
  if (type === "anime") {
    return getAnimeDetails(String(id), langOpts(query));
  }
  const details = await getDetails(String(type), String(id), langOpts(query));
  // Filmes: a nota da comunidade vem do Letterboxd (mais fiavel que o
  // vote_average do TMDB, sobretudo em estreias com poucos votos). Se o
  // Letterboxd nao tiver media, fica a do TMDB.
  if (type === "movie") {
    try {
      const lb = await getLetterboxdRating(Number(id));
      if (lb != null) details.rating = lb;
    } catch {
      /* fica com a nota do TMDB */
    }
  }
  return details;
}

// Lista de generos para o "Escolhe algo para mim", no idioma escolhido.
export async function generos({ query }) {
  const type = query.type;
  const lang = query.genreLang || query.overviewLang;
  if (type === "anime") {
    // Os nomes vem do Jikan em ingles -> traduz pelo vocabulario (TMDB + MAL).
    const list = await getAnimeGenres();
    const vocab = await getGenreVocab(lang);
    const genres = vocab
      ? list.map((g) => ({ id: g.id, name: vocab.get(String(g.name).toLowerCase()) || g.name }))
      : list;
    return { genres };
  }
  if (type === "movie" || type === "tv") {
    return { genres: await getGenres(type, lang) };
  }
  return { erro: "type tem de ser movie, tv ou anime", status: 400 };
}

// Escolhe um titulo aleatorio segundo generos a incluir/excluir.
export async function escolher({ query }) {
  const { type } = query;
  const genres = String(query.genres || "").split(",").filter(Boolean);
  const exclude = String(query.exclude || "").split(",").filter(Boolean);
  let item;
  if (type === "anime") {
    item = await pickAnime({ genres, exclude }, langOpts(query));
  } else if (type === "movie" || type === "tv") {
    item = await pickRandom({ type, genres, without: exclude }, langOpts(query));
  } else {
    return { erro: "type tem de ser movie, tv ou anime", status: 400 };
  }
  return { item };
}

export async function temporada({ query }) {
  const { id, season } = query;
  if (!id || season == null) return { erro: "faltam parametros id e season", status: 400 };
  return { episodes: await getSeason(String(id), Number(season), langOpts(query)) };
}