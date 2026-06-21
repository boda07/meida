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

// Titulo de um resultado TMDB no idioma pedido, com fallback para ingles quando
// nao existe traducao nesse idioma. O TMDB devolve o titulo ORIGINAL (na lingua
// do filme) quando nao ha traducao; detetamos isso comparando com original_title.
function bestTitle(localized, enTitle) {
  if (!localized) return enTitle || "";
  const loc = localized.title || localized.name || "";
  const original = localized.original_title || localized.original_name || "";
  if (loc && loc !== original) return loc; // ha traducao real -> usa-a
  return enTitle || loc; // sem traducao -> ingles
}

/**
 * Devolve Map(id -> melhor titulo) para uma lista, no idioma `titleLang`, com
 * fallback PT->EN. `localizedResp` evita refazer o pedido quando ja o temos.
 */
async function resolveTitleMap(path, params, titleLang, localizedResp) {
  if (titleLang === "en-US") {
    const en = localizedResp || (await tmdbFetch(path, params, "en-US"));
    return new Map((en.results || []).map((it) => [it.id, it.title || it.name || ""]));
  }
  const [loc, en] = await Promise.all([
    localizedResp ? Promise.resolve(localizedResp) : tmdbFetch(path, params, titleLang),
    tmdbFetch(path, params, "en-US"),
  ]);
  const enMap = new Map((en.results || []).map((it) => [it.id, it.title || it.name || ""]));
  const map = new Map();
  for (const it of loc.results || []) map.set(it.id, bestTitle(it, enMap.get(it.id)));
  return map;
}

/**
 * Busca uma lista no idioma da sinopse e resolve os titulos no idioma escolhido,
 * com fallback para ingles quando nao ha traducao.
 */
async function tmdbList(path, params = {}, opts = {}) {
  const { overview, title } = langsFrom(opts);
  const base = await tmdbFetch(path, params, overview);
  const items = (base.results || []).map(normalizeMedia).filter(Boolean);
  const titles = await resolveTitleMap(path, params, title, overview === title ? base : null);
  return items.map((m) => (titles.has(m.id) ? { ...m, title: titles.get(m.id) } : m));
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

  const params = { query, include_adult: "false" };
  const base = await tmdbFetch("/search/multi", params, overview);
  const titles = await resolveTitleMap(
    "/search/multi",
    params,
    title,
    overview === title ? base : null
  );
  return (base.results || [])
    .filter((it) => !isAnimeResult(it))
    .map(normalizeMedia)
    .filter(Boolean)
    .map((m) => (titles.has(m.id) ? { ...m, title: titles.get(m.id) } : m));
}

export async function getDetails(type, id, opts = {}) {
  if (type !== "movie" && type !== "tv") {
    throw new Error("type tem de ser 'movie' ou 'tv'");
  }
  const { overview, title } = langsFrom(opts);
  // Em paralelo: sinopse (overview), titulo localizado e ingles (fallback).
  const [data, locData, enData] = await Promise.all([
    tmdbFetch(`/${type}/${id}`, { append_to_response: "external_ids,credits" }, overview),
    title === overview ? Promise.resolve(null) : tmdbFetch(`/${type}/${id}`, {}, title),
    title !== "en-US" && overview !== "en-US"
      ? tmdbFetch(`/${type}/${id}`, {}, "en-US")
      : Promise.resolve(null),
  ]);

  const base = normalizeMedia({ ...data, media_type: type });
  // Titulo no idioma escolhido, com fallback para ingles quando nao ha traducao.
  const localized = locData || data;
  if (title === "en-US") {
    base.title = localized.title || localized.name || base.title;
  } else {
    const enTitle = enData
      ? enData.title || enData.name || ""
      : overview === "en-US"
      ? data.title || data.name || ""
      : "";
    base.title = bestTitle(localized, enTitle) || base.title;
  }
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
  const titles = await resolveTitleMap(
    `/discover/${kind}`,
    params,
    title,
    overview === title ? base : null
  );
  items = items.map((m) => (titles.has(m.id) ? { ...m, title: titles.get(m.id) } : m));
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

// Titulo de um filme/serie no idioma pedido (com fallback PT->EN), em cache por
// (tipo, id, idioma) para nao repetir pedidos a cada abertura da lista.
const titleCache = new Map();
export async function getLocalizedTitle(type, id, titleLang) {
  if (type !== "movie" && type !== "tv") return null;
  const target =
    LANG_MAP[titleLang] || (String(titleLang || "").includes("-") ? titleLang : "en-US");
  const key = `${type}:${id}:${target}`;
  if (titleCache.has(key)) return titleCache.get(key);
  try {
    let t;
    if (target === "en-US") {
      const en = await tmdbFetch(`/${type}/${id}`, {}, "en-US");
      t = en.title || en.name || null;
    } else {
      const [loc, en] = await Promise.all([
        tmdbFetch(`/${type}/${id}`, {}, target),
        tmdbFetch(`/${type}/${id}`, {}, "en-US"),
      ]);
      t = bestTitle(loc, en.title || en.name || "") || null;
    }
    titleCache.set(key, t);
    return t;
  } catch {
    return null;
  }
}

// Media da comunidade + generos de um filme/serie, numa so chamada. Best-effort.
export async function getMeta(type, id) {
  if (type !== "movie" && type !== "tv") return { rating: null, genres: [] };
  try {
    const d = await tmdbFetch(`/${type}/${id}`, {}, "en-US");
    return {
      rating: d?.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      genres: (d?.genres || []).map((g) => g.name),
    };
  } catch {
    return { rating: null, genres: [] };
  }
}

// Media da comunidade (vote_average) de um filme/serie. Best-effort: null se falhar.
export async function getRating(type, id) {
  return (await getMeta(type, id)).rating;
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

// Generos/temas de anime (MAL/Jikan) que o TMDB nao tem (ou nomeia diferente).
// Traducao manual para PT; os generos normais sao traduzidos pelo TMDB.
const ANIME_GENRES_PT = {
  "Sci-Fi": "Ficção científica",
  "Slice of Life": "Quotidiano",
  Supernatural: "Sobrenatural",
  Sports: "Desporto",
  Suspense: "Suspense",
  "Award Winning": "Premiado",
  "Avant Garde": "Vanguarda",
  Gourmet: "Gastronomia",
  Ecchi: "Ecchi",
  "Martial Arts": "Artes marciais",
  Military: "Militar",
  Mythology: "Mitologia",
  Psychological: "Psicológico",
  School: "Escolar",
  Space: "Espaço",
  "Super Power": "Superpoderes",
  Survival: "Sobrevivência",
  "Time Travel": "Viagem no tempo",
  Vampire: "Vampiros",
  Historical: "Histórico",
  Harem: "Harém",
  Mecha: "Mecha",
  Isekai: "Isekai",
  Parody: "Paródia",
  Samurai: "Samurai",
  Detective: "Detetive",
  Gore: "Gore",
  Reincarnation: "Reencarnação",
  Music: "Música",
};

// Cache do mapa de traducao de generos (en -> idioma alvo), por idioma.
const genreMapCache = {};

/**
 * Devolve Map(nomeEN -> nome localizado) juntando os generos de filme e serie do
 * TMDB (+ traducao manual dos de anime). null se o idioma alvo for ingles.
 */
export async function getGenreMap(lang) {
  const target = LANG_MAP[lang] || (String(lang || "").includes("-") ? lang : null);
  if (!target || target === "en-US") return null;
  if (genreMapCache[target]) return genreMapCache[target];
  try {
    const [me, mt, le, lt] = await Promise.all([
      tmdbFetch("/genre/movie/list", {}, "en-US"),
      tmdbFetch("/genre/tv/list", {}, "en-US"),
      tmdbFetch("/genre/movie/list", {}, target),
      tmdbFetch("/genre/tv/list", {}, target),
    ]);
    const map = new Map();
    const pair = (enList, locList) => {
      const loc = new Map((locList.genres || []).map((g) => [g.id, g.name]));
      for (const g of enList.genres || []) {
        const l = loc.get(g.id);
        if (l) map.set(g.name, l);
      }
    };
    pair(me, le);
    pair(mt, lt);
    if (target.startsWith("pt")) for (const [en, pt] of Object.entries(ANIME_GENRES_PT)) map.set(en, pt);
    genreMapCache[target] = map;
    return map;
  } catch {
    return null;
  }
}

// Traduz uma lista de nomes de genero usando o mapa (mantem o original se faltar).
export function translateGenres(names, map) {
  if (!map || !Array.isArray(names)) return names || [];
  return names.map((n) => map.get(n) || n);
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
