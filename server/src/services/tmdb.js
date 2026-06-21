import { config, assertTmdbConfigured } from "../config.js";

const { baseUrl, language, titleLanguage } = config.tmdb;

// Mapeia os codigos curtos das definicoes ("pt"/"en") para os do TMDB.
const LANG_MAP = { pt: "pt-PT", en: "en-US" };
function resolveLang(short, fallback) {
  if (!short) return fallback;
  return LANG_MAP[short] || (String(short).includes("-") ? short : fallback);
}

// A partir das opcoes do pedido decide o idioma da sinopse e dos titulos.
function langsFrom(opts = {}) {
  return {
    overview: resolveLang(opts.overviewLang, language),
    title: resolveLang(opts.titleLang, titleLanguage),
  };
}

/**
 * Chamada generica ao TMDB. Usa o token v4 (Bearer) se existir, senao a chave v3.
 * `lang` permite forcar um idioma diferente do default (ex.: para titulos em ingles).
 */
async function tmdbFetch(path, params = {}, lang = language) {
  assertTmdbConfigured();

  const url = new URL(baseUrl + path);
  url.searchParams.set("language", lang);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  const headers = { accept: "application/json" };
  if (config.tmdb.accessToken) {
    headers.authorization = `Bearer ${config.tmdb.accessToken}`;
  } else {
    url.searchParams.set("api_key", config.tmdb.apiKey);
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} em ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Busca uma lista usando o idioma da sinopse e, se o idioma dos titulos for
 * diferente, busca a mesma lista nesse idioma so para os titulos (merge por id).
 */
async function tmdbList(path, params = {}, opts = {}) {
  const { overview, title } = langsFrom(opts);

  if (title === overview) {
    const base = await tmdbFetch(path, params, overview);
    return (base.results || []).map(normalizeMedia).filter(Boolean);
  }

  const [base, titled] = await Promise.all([
    tmdbFetch(path, params, overview),
    tmdbFetch(path, params, title),
  ]);
  const titles = new Map();
  for (const it of titled.results || []) {
    titles.set(it.id, it.title || it.name || "");
  }
  return (base.results || [])
    .map(normalizeMedia)
    .filter(Boolean)
    .map((m) => ({ ...m, title: titles.get(m.id) || m.title }));
}

/** Normaliza um item de filme/serie para o formato que o frontend usa. */
export function normalizeMedia(item) {
  if (!item) return null;
  const type = item.media_type || (item.title ? "movie" : "tv");
  if (type !== "movie" && type !== "tv") return null;
  return {
    id: item.id,
    type,
    title: item.title || item.name || "",
    overview: item.overview || "",
    poster: item.poster_path || null,
    backdrop: item.backdrop_path || null,
    year: (item.release_date || item.first_air_date || "").slice(0, 4),
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
  };
}

export async function getCatalog(opts = {}) {
  const [trending, popularMovies, popularTv, topRated] = await Promise.all([
    tmdbList("/trending/all/week", {}, opts),
    tmdbList("/movie/popular", {}, opts),
    tmdbList("/tv/popular", {}, opts),
    tmdbList("/movie/top_rated", {}, opts),
  ]);

  return [
    { id: "trending", title: "Em tendencia", items: trending },
    { id: "popular-movies", title: "Filmes populares", items: popularMovies },
    { id: "popular-tv", title: "Series populares", items: popularTv },
    { id: "top-rated", title: "Filmes mais bem avaliados", items: topRated },
  ];
}

// Linhas de uma categoria: "movies", "tv" (series) ou "anime".
export async function getCategory(category, opts = {}) {
  if (category === "movies") {
    const [trending, popular, top, now] = await Promise.all([
      tmdbList("/trending/movie/week", {}, opts),
      tmdbList("/movie/popular", {}, opts),
      tmdbList("/movie/top_rated", {}, opts),
      tmdbList("/movie/now_playing", {}, opts),
    ]);
    return [
      { id: "m-trending", title: "Em tendencia", items: trending },
      { id: "m-popular", title: "Filmes populares", items: popular },
      { id: "m-top", title: "Mais bem avaliados", items: top },
      { id: "m-now", title: "Agora nos cinemas", items: now },
    ];
  }

  if (category === "tv") {
    const [trending, popular, top, air] = await Promise.all([
      tmdbList("/trending/tv/week", {}, opts),
      tmdbList("/tv/popular", {}, opts),
      tmdbList("/tv/top_rated", {}, opts),
      tmdbList("/tv/on_the_air", {}, opts),
    ]);
    return [
      { id: "t-trending", title: "Em tendencia", items: trending },
      { id: "t-popular", title: "Series populares", items: popular },
      { id: "t-top", title: "Mais bem avaliadas", items: top },
      { id: "t-air", title: "A passar agora", items: air },
    ];
  }

  if (category === "anime") {
    // Anime = animacao (genero 16) com idioma original japones.
    const ja = { with_genres: 16, with_original_language: "ja" };
    const [popTv, topTv, popMovie] = await Promise.all([
      tmdbList("/discover/tv", { ...ja, sort_by: "popularity.desc" }, opts),
      tmdbList("/discover/tv", { ...ja, sort_by: "vote_average.desc", "vote_count.gte": 200 }, opts),
      tmdbList("/discover/movie", { ...ja, sort_by: "popularity.desc" }, opts),
    ]);
    return [
      { id: "a-pop", title: "Anime popular", items: popTv },
      { id: "a-top", title: "Anime mais bem avaliado", items: topTv },
      { id: "a-movies", title: "Filmes de anime", items: popMovie },
    ];
  }

  throw new Error("categoria invalida (usa movies, tv ou anime)");
}

export async function search(query, opts = {}) {
  if (!query) return [];
  return tmdbList("/search/multi", { query, include_adult: "false" }, opts);
}

export async function getDetails(type, id, opts = {}) {
  if (type !== "movie" && type !== "tv") {
    throw new Error("type tem de ser 'movie' ou 'tv'");
  }
  const { overview, title } = langsFrom(opts);
  const requests = [
    tmdbFetch(`/${type}/${id}`, { append_to_response: "external_ids,credits" }, overview),
  ];
  // So precisamos de uma 2a chamada se o idioma dos titulos for diferente.
  if (title !== overview) {
    requests.push(tmdbFetch(`/${type}/${id}`, {}, title));
  }
  const [data, titled] = await Promise.all(requests);

  const base = normalizeMedia({ ...data, media_type: type });
  // Titulo no idioma escolhido, mantendo a sinopse no seu idioma.
  if (titled) base.title = titled.title || titled.name || base.title;
  const imdbId = data.external_ids?.imdb_id || null;
  const genres = (data.genres || []).map((g) => g.name);
  const cast = (data.credits?.cast || []).slice(0, 10).map((c) => ({
    name: c.name,
    character: c.character,
    profile: c.profile_path,
  }));

  let seasons = null;
  if (type === "tv") {
    seasons = (data.seasons || [])
      .filter((s) => s.season_number > 0)
      .map((s) => ({
        seasonNumber: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
      }));
  }

  return {
    ...base,
    imdbId,
    genres,
    cast,
    runtime: data.runtime || (data.episode_run_time?.[0] ?? null),
    seasons,
    totalSeasons: type === "tv" ? data.number_of_seasons : null,
  };
}

// Tenta encontrar no TMDB o id correspondente a um titulo (para reproducao de
// anime). Procura em ingles, no tipo provavel e, se falhar, no outro tipo.
export async function findTmdbMatch(title, year, isMovie) {
  if (!title) return null;

  async function search(kind, withYear) {
    const params = { query: title, include_adult: "false" };
    if (withYear && year) {
      params[kind === "movie" ? "year" : "first_air_date_year"] = year;
    }
    const data = await tmdbFetch(`/search/${kind}`, params, "en-US");
    return (data.results || [])[0] || null;
  }

  const primary = isMovie ? "movie" : "tv";
  const secondary = isMovie ? "tv" : "movie";

  let r = (await search(primary, true)) || (await search(primary, false));
  if (r) return { tmdbId: r.id, mediaType: primary };

  r = (await search(secondary, false));
  if (r) return { tmdbId: r.id, mediaType: secondary };

  return null;
}

export async function getSeason(id, seasonNumber, opts = {}) {
  const { overview } = langsFrom(opts);
  const data = await tmdbFetch(`/tv/${id}/season/${seasonNumber}`, {}, overview);
  return (data.episodes || []).map((e) => ({
    episodeNumber: e.episode_number,
    name: e.name,
    overview: e.overview,
    still: e.still_path,
    airDate: e.air_date,
    rating: e.vote_average ? Math.round(e.vote_average * 10) / 10 : null,
  }));
}
