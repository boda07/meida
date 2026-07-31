// Catalogo, pesquisa e detalhes de anime via Jikan (API publica do MyAnimeList,
// sem chave). O anime e SEMPRE focado no MAL: catalogo, poster, sinopse, titulo
// e episodios vem todos do MAL. A reproducao usa os providers de anime por id do
// MAL (MegaPlay/VidLink/VidSrc.cc). O TMDB so serve para filmes e series — e para
// arranjar o IMDB id que os torrents precisam (match best-effort).
import { findTmdbMatch, getExternalImdb, getGenreVocab } from "./tmdb.js";

const JIKAN = "https://api.jikan.moe/v4";
const JIKAN_COOLDOWN_MS = 30 * 1000;
let jikanBlockedUntil = 0;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function coolDownJikan() {
  jikanBlockedUntil = Math.max(jikanBlockedUntil, Date.now() + JIKAN_COOLDOWN_MS);
}

// O Jikan limita a ~3 req/s (429 quando excede) e por vezes da 5xx.
// Tentamos de novo com backoff antes de desistir.
export async function jikanFetch(path, options = {}) {
  const opts = typeof options === "number" ? { tries: options } : options;
  const { tries = 0, retries = 3, timeoutMs = 9000 } = opts;
  if (tries === 0 && Date.now() < jikanBlockedUntil) {
    throw new Error("Jikan temporariamente indisponivel");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${JIKAN}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (tries < retries) {
      await sleep(700 * (tries + 1));
      return jikanFetch(path, { ...opts, tries: tries + 1 });
    }
    coolDownJikan();
    if (err?.name === "AbortError") throw new Error("Jikan timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if ((res.status === 429 || res.status >= 500) && tries < retries) {
    await sleep(700 * (tries + 1));
    return jikanFetch(path, { ...opts, tries: tries + 1 });
  }
  if (!res.ok) {
    if (res.status === 429 || res.status >= 500) coolDownJikan();
    throw new Error(`Jikan ${res.status}`);
  }
  return res.json();
}

function yearOf(a) {
  if (a.year) return a.year;
  if (a.aired?.prop?.from?.year) return a.aired.prop.from.year;
  if (a.aired?.from) return new Date(a.aired.from).getFullYear();
  return "";
}

// Normaliza um anime para o formato dos cartoes. O poster e um URL COMPLETO
// (o imageUrl no frontend deixa passar URLs completos).
export function normalizeAnime(a, romaji = false) {
  if (!a?.mal_id) return null;
  // a.title = romaji/default; a.title_english = ingles. Ingles por default.
  const title = romaji
    ? a.title || a.title_english || a.title_japanese || ""
    : a.title_english || a.title || a.title_japanese || "";
  return {
    id: a.mal_id,
    type: "anime",
    title,
    overview: a.synopsis || "",
    poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
    backdrop: null,
    year: String(yearOf(a) || ""),
    rating: a.score ? Math.round(a.score * 10) / 10 : null,
  };
}

const clean = (d, romaji) =>
  (d.data || []).map((a) => normalizeAnime(a, romaji)).filter(Boolean);

const isRomaji = (opts) => opts?.animeTitleLang === "romaji";

function stripHtml(s) {
  return String(s || "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

function normalizeAnilistAnime(a, romaji = false) {
  if (!a?.idMal) return null;
  const title = romaji
    ? a.title?.romaji || a.title?.english || a.title?.native || ""
    : a.title?.english || a.title?.romaji || a.title?.native || "";
  return {
    id: a.idMal,
    type: "anime",
    title,
    overview: stripHtml(a.description),
    poster: a.coverImage?.extraLarge || a.coverImage?.large || null,
    backdrop: a.bannerImage || null,
    year: String(a.startDate?.year || ""),
    rating: a.averageScore || a.meanScore ? Math.round((a.averageScore || a.meanScore) / 10) : null,
  };
}

async function searchAnimeAnilist(query, opts = {}) {
  const romaji = isRomaji(opts);
  const adultFilter = opts.adult ? "" : ",isAdult:false";
  const queryText = `query($q:String){Page(page:1,perPage:10){media(search:$q,type:ANIME,sort:POPULARITY_DESC${adultFilter}){idMal title{romaji english native} description(asHtml:false) coverImage{extraLarge large} bannerImage startDate{year} averageScore meanScore}}}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: queryText, variables: { q: query } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const data = await res.json();
    return dedupe(
      (data?.data?.Page?.media || []).map((a) => normalizeAnilistAnime(a, romaji)).filter(Boolean)
    );
  } finally {
    clearTimeout(timer);
  }
}

async function getAnimeDetailsFromAnilist(malId, opts = {}) {
  const id = Number(malId);
  const query = `query($id:Int){Media(idMal:$id,type:ANIME){id idMal title{romaji english native} description(asHtml:false) coverImage{extraLarge large} bannerImage startDate{year} averageScore meanScore genres episodes duration format}}`;
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables: { id } }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const data = await res.json();
  const full = data?.data?.Media;
  const base = normalizeAnilistAnime(full, isRomaji(opts));
  if (!base) throw new Error("Anime nao encontrado no AniList");

  const isMovie = full?.format === "MOVIE";
  let genres = full?.genres || [];
  try {
    const vocab = await getGenreVocab(opts.genreLang || opts.overviewLang);
    if (vocab) genres = genres.map((n) => vocab.get(String(n).toLowerCase()) || n);
  } catch {
    /* fica com os nomes em ingles */
  }

  return {
    id,
    type: "anime",
    malId: id,
    anilistId: full?.id || null,
    imdbId: null,
    tmdbType: isMovie ? "movie" : "tv",
    isAnime: true,
    isMovie,
    title: base.title,
    overview: base.overview,
    poster: base.poster,
    backdrop: base.backdrop,
    year: base.year,
    rating: base.rating,
    genres,
    cast: [],
    runtime: full?.duration ? `${full.duration} min` : null,
    episodeCount: isMovie ? 1 : full?.episodes || 24,
  };
}

// Remove duplicados por id (o Jikan repete entradas entre listas as vezes).
function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
}

function currentAnilistSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m <= 3) return "WINTER";
  if (m <= 6) return "SPRING";
  if (m <= 9) return "SUMMER";
  return "FALL";
}

async function fetchAnilistAnimeList({ sort, format = null, status = null, season = null, seasonYear = null }, opts = {}) {
  const romaji = isRomaji(opts);
  const query = `query($sort:[MediaSort],$format:MediaFormat,$status:MediaStatus,$season:MediaSeason,$seasonYear:Int,$isAdult:Boolean){Page(page:1,perPage:24){media(type:ANIME,sort:$sort,format:$format,status:$status,season:$season,seasonYear:$seasonYear,isAdult:$isAdult){idMal title{romaji english native} description(asHtml:false) coverImage{extraLarge large} bannerImage startDate{year} averageScore meanScore}}}`;
  const variables = {
    sort: [sort],
    isAdult: opts.adult ? null : false,
  };
  if (format) variables.format = format;
  if (status) variables.status = status;
  if (season) variables.season = season;
  if (seasonYear) variables.seasonYear = seasonYear;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const data = await res.json();
  return dedupe(
    (data?.data?.Page?.media || []).map((a) => normalizeAnilistAnime(a, romaji)).filter(Boolean)
  );
}
async function getAnimeCatalogFromAnilist(opts = {}) {
  const year = new Date().getFullYear();
  const season = currentAnilistSeason();
  const defs = [
    ["a-top", "Anime popular", { sort: "POPULARITY_DESC" }],
    ["a-season", "Esta epoca", { sort: "POPULARITY_DESC", season, seasonYear: year }],
    ["a-airing", "A passar agora", { sort: "POPULARITY_DESC", status: "RELEASING" }],
    ["a-movies", "Filmes de anime", { sort: "POPULARITY_DESC", format: "MOVIE" }],
  ];

  const rows = [];
  for (const [id, title, params] of defs) {
    try {
      rows.push({ id, title, items: await fetchAnilistAnimeList(params, opts) });
    } catch {
      rows.push({ id, title, items: [] });
    }
  }
  return rows;
}

// Cache em memoria: evita martelar o Jikan a cada visita/refresh.
// Chaveada por idioma de titulo (en/romaji).
const catalogCache = {}; // { [key]: { at, rows } }
const CATALOG_TTL = 10 * 60 * 1000;

export async function getAnimeCatalog(opts = {}) {
  const romaji = isRomaji(opts);
  const key = romaji ? "romaji" : "en";
  const cached = catalogCache[key];
  if (cached && Date.now() - cached.at < CATALOG_TTL) {
    return cached.rows;
  }

  const defs = [
    ["a-top", "Anime popular", "/top/anime?filter=bypopularity&limit=24"],
    ["a-season", "Esta epoca", "/seasons/now?limit=24"],
    ["a-airing", "A passar agora", "/top/anime?filter=airing&limit=24"],
    ["a-movies", "Filmes de anime", "/top/anime?type=movie&limit=24"],
  ];

  // Sequencial (com pausa) para respeitar o rate limit do Jikan.
  const rows = [];
  for (const [id, title, path] of defs) {
    let items = [];
    try {
      items = dedupe(clean(await jikanFetch(path), romaji));
    } catch {
      items = [];
    }
    rows.push({ id, title, items });
    await sleep(400);
  }

  // Enriquece os destaques com banners do AniList para o slideshow do banner
  // (o Jikan so da poster). So os primeiros itens, que sao os candidatos a hero.
  try {
    const top = rows.flatMap((r) => r.items).slice(0, 40);
    const banners = await getAnimeBannersBatch(top.map((i) => i.id));
    if (banners.size) {
      for (const r of rows)
        for (const it of r.items) {
          const b = banners.get(Number(it.id));
          if (b) it.backdrop = b;
        }
    }
  } catch {
    /* sem banners -> o slideshow de anime usa o que houver */
  }

  let out = rows;
  if (rows.filter((r) => r.items.length).length < 2) {
    try {
      const fallbackRows = await getAnimeCatalogFromAnilist(opts);
      if (fallbackRows.filter((r) => r.items.length).length >= 2) out = fallbackRows;
    } catch {
      /* fica com o que o Jikan conseguiu devolver */
    }
  }

  // So guarda em cache se a maioria das linhas veio com conteudo.
  if (out.filter((r) => r.items.length).length >= 2) {
    catalogCache[key] = { at: Date.now(), rows: out };
  }
  return out;
}

// Filmes de anime (MAL), para mostrar tambem na pagina de Filmes.
// Cache em memoria, chaveada por idioma do titulo.
const animeMoviesCache = {}; // { [key]: { at, items } }
export async function getAnimeMovies(opts = {}) {
  const romaji = isRomaji(opts);
  const key = romaji ? "romaji" : "en";
  const cached = animeMoviesCache[key];
  if (cached && Date.now() - cached.at < CATALOG_TTL) return cached.items;
  try {
    const items = dedupe(
      clean(await jikanFetch(`/top/anime?type=movie&limit=24`), romaji)
    );
    if (items.length) animeMoviesCache[key] = { at: Date.now(), items };
    return items;
  } catch {
    try {
      const items = await fetchAnilistAnimeList({ sort: "POPULARITY_DESC", format: "MOVIE" }, opts);
      if (items.length) animeMoviesCache[key] = { at: Date.now(), items };
      return items;
    } catch {
      return [];
    }
  }
}

// Grelha filtravel/ordenavel de anime (pagina de Anime). Usa /anime do Jikan.
// sort: "popularity" | "rating" | "recent"; dir: "asc" | "desc".
export async function discoverAnime(
  { genres = [], sort = "popularity", dir = "desc", page = 1 },
  opts = {}
) {
  const romaji = isRomaji(opts);
  // "members" desc = mais popular (intuitivo); "popularity" do Jikan e um rank invertido.
  const order =
    { popularity: "members", rating: "score", recent: "start_date" }[sort] || "members";
  const params = new URLSearchParams({
    page: String(Math.max(1, Number(page) || 1)),
    limit: "24",
    order_by: order,
    sort: dir === "asc" ? "asc" : "desc",
  });
  if (!opts.adult) params.set("sfw", "true"); // sem conteudo adulto, salvo opt-in
  if (genres.length) params.set("genres", genres.join(","));
  try {
    const d = await jikanFetch(`/anime?${params}`);
    return {
      items: dedupe(clean(d, romaji)),
      page: d?.pagination?.current_page || Number(page) || 1,
      hasMore: Boolean(d?.pagination?.has_next_page),
    };
  } catch {
    if (genres.length) return { items: [], page: Number(page) || 1, hasMore: false };
    try {
      const sortMap = {
        popularity: "POPULARITY_DESC",
        rating: "SCORE_DESC",
        recent: "START_DATE_DESC",
      };
      const items = await fetchAnilistAnimeList({ sort: sortMap[sort] || "POPULARITY_DESC" }, opts);
      return { items, page: Number(page) || 1, hasMore: false };
    } catch {
      return { items: [], page: Number(page) || 1, hasMore: false };
    }
  }
}

// Lista de generos + temas de anime (Jikan), para o "Escolhe algo para mim".
// Junta generos (ex.: Slice of Life) e temas (ex.: Gore), que partilham o mesmo
// espaco de ids no filtro do Jikan.
let animeGenresCache = null;
export async function getAnimeGenres() {
  if (animeGenresCache) return animeGenresCache;
  try {
    const [g, t] = await Promise.all([
      jikanFetch(`/genres/anime`),
      jikanFetch(`/genres/anime?filter=themes`),
    ]);
    const seen = new Set();
    const list = [...(g.data || []), ...(t.data || [])]
      .map((x) => ({ id: x.mal_id, name: x.name }))
      .filter((x) => (seen.has(x.id) ? false : seen.add(x.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
    animeGenresCache = list;
    return list;
  } catch {
    return animeGenresCache || [];
  }
}

// Escolhe um anime aleatorio com generos a incluir/excluir.
export async function pickAnime({ genres = [], exclude = [] }, opts = {}) {
  const romaji = isRomaji(opts);
  let q = `/anime?order_by=popularity&sort=asc&limit=25${opts.adult ? "" : "&sfw=true"}`;
  if (genres.length) q += `&genres=${genres.join(",")}`;
  if (exclude.length) q += `&genres_exclude=${exclude.join(",")}`;

  let first;
  try {
    first = await jikanFetch(q);
  } catch {
    return null;
  }
  const totalPages = Math.min(first?.pagination?.last_visible_page || 1, 20);
  let items = first.data || [];
  if (totalPages > 1) {
    const page = 1 + Math.floor(Math.random() * totalPages);
    try {
      const d = await jikanFetch(`${q}&page=${page}`);
      if (d.data?.length) items = d.data;
    } catch {
      /* fica com a 1a pagina */
    }
  }
  const list = items.map((a) => normalizeAnime(a, romaji)).filter(Boolean);
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// Media da comunidade para varios anime de uma vez, via AniList (filtra por
// idMal_in, 50 por pedido). Devolve Map(malId -> nota 0-10). Best-effort.
// Usado como fallback do backfill quando a conta MAL nao esta ligada.
export async function getAnimeRatingsBatch(malIds) {
  const out = new Map();
  const ids = [...new Set(malIds.map(Number).filter(Boolean))];
  const query = `query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){idMal averageScore meanScore}}}`;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query, variables: { ids: chunk } }),
      });
      const j = await res.json();
      for (const m of j?.data?.Page?.media || []) {
        const s = m.averageScore ?? m.meanScore;
        if (m.idMal && s != null) out.set(Number(m.idMal), Math.round(s) / 10);
      }
    } catch {
      /* ignora este lote; fica para a proxima carga */
    }
    await sleep(700); // respeita o rate limit do AniList
  }
  return out;
}

// AniList por id do MyAnimeList: id (alguns providers usam) + bannerImage (fundo
// widescreen do anime, muito melhor que o poster para o fundo dos detalhes).
// Cache em memoria; falha em silencio.
const anilistMetaCache = new Map();
export async function getAnilistMeta(malId) {
  const key = Number(malId);
  if (anilistMetaCache.has(key)) return anilistMetaCache.get(key);
  let out = { id: null, banner: null };
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: "query($m:Int){Media(idMal:$m,type:ANIME){id bannerImage}}",
        variables: { m: key },
      }),
    });
    const j = await res.json();
    out = {
      id: j?.data?.Media?.id || null,
      banner: j?.data?.Media?.bannerImage || null,
    };
  } catch {
    /* sem AniList -> sem banner */
  }
  anilistMetaCache.set(key, out);
  return out;
}

// Banners (imagem widescreen) do AniList para varios anime de uma vez, por idMal
// (50 por pedido). Devolve Map(malId -> URL). Usado para o slideshow do catalogo
// de anime, ja que o Jikan so da poster (sem backdrop). Best-effort.
export async function getAnimeBannersBatch(malIds) {
  const out = new Map();
  const ids = [...new Set(malIds.map(Number).filter(Boolean))];
  const query = `query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){idMal bannerImage}}}`;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query, variables: { ids: chunk } }),
      });
      const j = await res.json();
      for (const m of j?.data?.Page?.media || []) {
        if (m.idMal && m.bannerImage) out.set(Number(m.idMal), m.bannerImage);
      }
    } catch {
      /* ignora este lote */
    }
    await sleep(700);
  }
  return out;
}

// Converte um id do MyAnimeList no id do AniList (alguns providers de anime
// usam AniList). Cache em memoria; falha em silencio (devolve null).
const anilistCache = new Map();
export async function malToAnilist(malId) {
  const key = Number(malId);
  if (anilistCache.has(key)) return anilistCache.get(key);
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: "query($m:Int){Media(idMal:$m,type:ANIME){id}}",
        variables: { m: key },
      }),
    });
    const j = await res.json();
    const id = j?.data?.Media?.id || null;
    anilistCache.set(key, id);
    return id;
  } catch {
    return null;
  }
}

// Detalhes de um anime: 100% MyAnimeList (poster, titulo, sinopse, episodios).
// A reproducao usa os providers de anime por id do MAL (ver providers.js).
export async function getAnimeDetails(malId, opts = {}) {
  let full;
  try {
    full = (await jikanFetch(`/anime/${malId}/full`)).data;
  } catch {
    return getAnimeDetailsFromAnilist(malId, opts);
  }
  const base = normalizeAnime(full, isRomaji(opts));
  const isMovie = /movie|music/i.test(full?.type || "");

  let episodeCount = full?.episodes || 0;
  // Anime a passar/com numero desconhecido: tenta obter o total real do
  // endpoint de episodios (paginado, 100 por pagina).
  if (!isMovie && !episodeCount) {
    await sleep(400); // evita o rate limit logo a seguir ao /full
    try {
      const pag = (await jikanFetch(`/anime/${malId}/episodes`))?.pagination;
      episodeCount =
        pag?.items?.total ||
        (pag?.last_visible_page ? pag.last_visible_page * 100 : 0);
    } catch {
      /* ignora */
    }
  }
  if (isMovie) episodeCount = 1;
  if (!episodeCount) episodeCount = 24; // fallback razoavel

  // AniList: id (alguns providers usam) + bannerImage (fundo do anime).
  const { id: anilistId, banner: anilistBanner } = await getAnilistMeta(malId);

  // Match best-effort no TMDB para arranjar o IMDB id (torrents) E um backdrop
  // de reserva quando o AniList nao tem banner. O MAL so tem o poster, que
  // ficava feio e repetido atras do cabecalho. Nao afeta poster/titulo/sinopse.
  let imdbId = null;
  let tmdbType = isMovie ? "movie" : "tv";
  let tmdbBackdrop = null;
  try {
    const match = await findTmdbMatch(base.title, base.year, isMovie);
    if (match?.tmdbId) {
      tmdbType = match.mediaType;
      tmdbBackdrop = match.backdrop || null;
      imdbId = await getExternalImdb(match.mediaType, match.tmdbId);
    }
  } catch {
    /* sem match -> sem torrents nem backdrop do TMDB para este anime */
  }

  // Generos no idioma escolhido (os nomes do MAL vem em ingles -> traduz).
  let genres = (full?.genres || []).map((g) => g.name);
  try {
    const vocab = await getGenreVocab(opts.genreLang || opts.overviewLang);
    if (vocab) genres = genres.map((n) => vocab.get(String(n).toLowerCase()) || n);
  } catch {
    /* fica com os nomes em ingles */
  }

  return {
    id: Number(malId),
    type: "anime",
    malId: Number(malId),
    anilistId,
    imdbId,
    tmdbType,
    isAnime: true,
    isMovie,
    title: base.title,
    overview: base.overview,
    poster: base.poster,
    // Fundo a serio: banner do AniList (preferido) -> backdrop do TMDB. null se
    // nenhum existir (o frontend nao mostra fundo, em vez de repetir o poster).
    backdrop: anilistBanner || tmdbBackdrop,
    year: base.year,
    rating: base.rating,
    genres,
    cast: [],
    runtime: full?.duration || null,
    episodeCount,
  };
}

// Pesquisa de anime no MAL (Jikan). Cache curta para nao martelar o rate limit
// durante a pesquisa instantanea.
const searchCache = new Map(); // q -> { at, items }
const SEARCH_TTL = 5 * 60 * 1000;
const SEARCH_FETCH_OPTS = { retries: 1, timeoutMs: 3500 };

export async function searchAnime(query, opts = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const romaji = isRomaji(opts);
  const key = `${romaji ? "r" : "e"}${opts.adult ? "+x" : ""}:${q}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < SEARCH_TTL) return cached.items;
  try {
    const d = await jikanFetch(
      `/anime?q=${encodeURIComponent(q)}&limit=10${opts.adult ? "" : "&sfw=true"}&order_by=members&sort=desc`,
      SEARCH_FETCH_OPTS
    );
    const items = dedupe(clean(d, romaji));
    searchCache.set(key, { at: Date.now(), items });
    return items;
  } catch {
    if (cached) return cached.items;
    try {
      const items = await searchAnimeAnilist(q, opts);
      if (items.length) searchCache.set(key, { at: Date.now(), items });
      return items;
    } catch {
      return [];
    }
  }
}
