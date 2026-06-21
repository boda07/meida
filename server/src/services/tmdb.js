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

// Um resultado e "anime" se for animacao (genero 16) em japones — esses vem do
// MAL (separador Anime / pesquisa do Jikan), por isso filtramos do TMDB para nao
// duplicarem.
function isAnimeResult(it) {
  return (it.genre_ids || []).includes(16) && it.original_language === "ja";
}

export async function search(query, opts = {}) {
  if (!query) return [];
  const { overview, title } = langsFrom(opts);

  const base = await tmdbFetch("/search/multi", { query, include_adult: "false" }, overview);
  let titles = null;
  if (title !== overview) {
    const t = await tmdbFetch("/search/multi", { query, include_adult: "false" }, title);
    titles = new Map((t.results || []).map((it) => [it.id, it.title || it.name || ""]));
  }
  return (base.results || [])
    .filter((it) => !isAnimeResult(it))
    .map(normalizeMedia)
    .filter(Boolean)
    .map((m) => (titles ? { ...m, title: titles.get(m.id) || m.title } : m));
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

// Grelha filtravel/ordenavel (pagina de Filmes/Series). Usa /discover do TMDB.
// sort: "popularity" | "rating" | "recent"; dir: "asc" | "desc".
export async function discover(
  { type, genres = [], sort = "popularity", dir = "desc", page = 1 },
  opts = {}
) {
  const kind = type === "tv" ? "tv" : "movie";
  const field =
    { popularity: "popularity", rating: "vote_average", recent: kind === "tv" ? "first_air_date" : "primary_release_date" }[
      sort
    ] || "popularity";
  const params = {
    sort_by: `${field}.${dir === "asc" ? "asc" : "desc"}`,
    include_adult: "false",
    page: Math.max(1, Number(page) || 1),
  };
  if (genres.length) params.with_genres = genres.join(",");
  // Sem um minimo de votos, a ordenacao por nota enche-se de titulos obscuros.
  if (sort === "rating") params["vote_count.gte"] = kind === "tv" ? 50 : 100;

  const { overview, title } = langsFrom(opts);
  const base = await tmdbFetch(`/discover/${kind}`, params, overview);
  let items = (base.results || [])
    .map((r) => normalizeMedia({ ...r, media_type: kind }))
    .filter(Boolean);
  if (title !== overview) {
    const t = await tmdbFetch(`/discover/${kind}`, params, title);
    const titles = new Map((t.results || []).map((it) => [it.id, it.title || it.name || ""]));
    items = items.map((m) => ({ ...m, title: titles.get(m.id) || m.title }));
  }
  return {
    items,
    page: base.page || 1,
    hasMore: (base.page || 1) < (base.total_pages || 1),
  };
}

// Encontra um filme no TMDB por titulo (+ ano). Devolve {tmdbId, title, poster}
// ou null. Usado para resolver a watchlist do Letterboxd (que so da titulo/ano).
export async function findMovieByTitle(title, year) {
  if (!title) return null;
  try {
    let data = await tmdbFetch(
      "/search/movie",
      { query: title, year: year || undefined, include_adult: "false" },
      "en-US"
    );
    let r = (data.results || [])[0];
    if (!r && year) {
      data = await tmdbFetch("/search/movie", { query: title, include_adult: "false" }, "en-US");
      r = (data.results || [])[0];
    }
    if (!r) return null;
    return { tmdbId: r.id, title: r.title || title, poster: r.poster_path || null };
  } catch {
    return null;
  }
}

// Media da comunidade (vote_average) de um filme/serie. Best-effort: null se falhar.
export async function getRating(type, id) {
  if (type !== "movie" && type !== "tv") return null;
  try {
    const d = await tmdbFetch(`/${type}/${id}`, {}, "en-US");
    return d?.vote_average ? Math.round(d.vote_average * 10) / 10 : null;
  } catch {
    return null;
  }
}

// Lista de generos (TMDB) por tipo, para o "Escolhe algo para mim".
const genreCache = {};
export async function getGenres(type) {
  if (type !== "movie" && type !== "tv") throw new Error("type invalido");
  if (genreCache[type]) return genreCache[type];
  const data = await tmdbFetch(`/genre/${type}/list`, {}, "en-US");
  const list = (data.genres || []).map((g) => ({ id: g.id, name: g.name }));
  genreCache[type] = list;
  return list;
}

// Escolhe um titulo aleatorio (discover) com generos a incluir/excluir.
export async function pickRandom({ type, genres = [], without = [] }, opts = {}) {
  const { title } = langsFrom(opts);
  const params = {
    sort_by: "popularity.desc",
    "vote_count.gte": 40,
    include_adult: "false",
  };
  if (genres.length) params.with_genres = genres.join(",");
  if (without.length) params.without_genres = without.join(",");

  const first = await tmdbFetch(`/discover/${type}`, params, title);
  const totalPages = Math.min(first.total_pages || 1, 30);
  let results = first.results || [];
  if (totalPages > 1) {
    const page = 1 + Math.floor(Math.random() * totalPages);
    try {
      const d = await tmdbFetch(`/discover/${type}`, { ...params, page }, title);
      if (d.results?.length) results = d.results;
    } catch {
      /* fica com a 1a pagina */
    }
  }
  if (!results.length) return null;
  const pick = results[Math.floor(Math.random() * results.length)];
  return normalizeMedia({ ...pick, media_type: type });
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
