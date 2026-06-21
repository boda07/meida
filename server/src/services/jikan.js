// Catalogo, pesquisa e detalhes de anime via Jikan (API publica do MyAnimeList,
// sem chave). O anime e SEMPRE focado no MAL: catalogo, poster, sinopse, titulo
// e episodios vem todos do MAL. A reproducao usa os providers de anime por id do
// MAL (MegaPlay/VidLink/VidSrc.cc). O TMDB so serve para filmes e series.

const JIKAN = "https://api.jikan.moe/v4";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// O Jikan limita a ~3 req/s (429 quando excede) e por vezes da 5xx.
// Tentamos de novo com backoff antes de desistir.
async function jikanFetch(path, tries = 0) {
  const res = await fetch(`${JIKAN}${path}`, { headers: { accept: "application/json" } });
  if ((res.status === 429 || res.status >= 500) && tries < 3) {
    await sleep(700 * (tries + 1));
    return jikanFetch(path, tries + 1);
  }
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
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
export function normalizeAnime(a) {
  if (!a?.mal_id) return null;
  return {
    id: a.mal_id,
    type: "anime",
    title: a.title_english || a.title || a.title_japanese || "",
    overview: a.synopsis || "",
    poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
    backdrop: null,
    year: String(yearOf(a) || ""),
    rating: a.score ? Math.round(a.score * 10) / 10 : null,
  };
}

const clean = (d) => (d.data || []).map(normalizeAnime).filter(Boolean);

// Remove duplicados por id (o Jikan repete entradas entre listas as vezes).
function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
}

// Cache em memoria: evita martelar o Jikan a cada visita/refresh.
let catalogCache = null; // { at, rows }
const CATALOG_TTL = 10 * 60 * 1000;

export async function getAnimeCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) {
    return catalogCache.rows;
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
      items = dedupe(clean(await jikanFetch(path)));
    } catch {
      items = [];
    }
    rows.push({ id, title, items });
    await sleep(400);
  }

  // So guarda em cache se a maioria das linhas veio com conteudo.
  if (rows.filter((r) => r.items.length).length >= 2) {
    catalogCache = { at: Date.now(), rows };
  }
  return rows;
}

// Detalhes de um anime: 100% MyAnimeList (poster, titulo, sinopse, episodios).
// A reproducao usa os providers de anime por id do MAL (ver providers.js).
export async function getAnimeDetails(malId) {
  const full = (await jikanFetch(`/anime/${malId}/full`)).data;
  const base = normalizeAnime(full);
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

  return {
    id: Number(malId),
    type: "anime",
    malId: Number(malId),
    isAnime: true,
    isMovie,
    title: base.title,
    overview: base.overview,
    poster: base.poster,
    backdrop: full?.images?.jpg?.large_image_url || null,
    year: base.year,
    rating: base.rating,
    genres: (full?.genres || []).map((g) => g.name),
    cast: [],
    runtime: full?.duration || null,
    episodeCount,
  };
}

// Pesquisa de anime no MAL (Jikan). Cache curta para nao martelar o rate limit
// durante a pesquisa instantanea.
const searchCache = new Map(); // q -> { at, items }
const SEARCH_TTL = 5 * 60 * 1000;

export async function searchAnime(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const cached = searchCache.get(q);
  if (cached && Date.now() - cached.at < SEARCH_TTL) return cached.items;
  try {
    const d = await jikanFetch(
      `/anime?q=${encodeURIComponent(q)}&limit=10&sfw=true&order_by=members&sort=desc`
    );
    const items = dedupe(clean(d));
    searchCache.set(q, { at: Date.now(), items });
    return items;
  } catch {
    return [];
  }
}
