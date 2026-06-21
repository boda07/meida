// Catalogo e detalhes de anime via Jikan (API publica do MyAnimeList, sem chave).
// O TMDB tem listas de anime fracas; o Jikan e muito melhor para isto.
// Para a REPRODUCAO fazemos match para o TMDB (que e o que os providers/torrents
// usam), via findTmdbMatch + getDetails.
import { findTmdbMatch, getDetails } from "./tmdb.js";

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

// Detalhes de um anime: metadados ricos do Jikan + match no TMDB para fontes.
export async function getAnimeDetails(malId, langOpts = {}) {
  const full = (await jikanFetch(`/anime/${malId}/full`)).data;
  const base = normalizeAnime(full);
  const isMovie = /movie/i.test(full?.type || "");

  let match = null;
  try {
    match = await findTmdbMatch(base.title, base.year, isMovie);
  } catch {
    match = null;
  }

  if (match) {
    // Usa os detalhes do TMDB (id/imdb/temporadas) para a reproducao funcionar,
    // mas a SINOPSE vem do MAL (melhor para anime). So cai no TMDB se o MAL nao
    // tiver sinopse.
    const details = await getDetails(match.mediaType, match.tmdbId, langOpts);
    if (base.overview) details.overview = base.overview;
    details.malId = malId;
    details.isAnime = true;
    details.matched = true;
    return details;
  }

  // Sem correspondencia no TMDB: mostra os metadados do Jikan, sem fontes.
  return {
    id: malId,
    type: isMovie ? "movie" : "tv",
    title: base.title,
    overview: base.overview,
    poster: base.poster,
    backdrop: null,
    year: base.year,
    rating: base.rating,
    genres: (full?.genres || []).map((g) => g.name),
    cast: [],
    runtime: null,
    seasons: null,
    imdbId: null,
    isAnime: true,
    matched: false,
  };
}
