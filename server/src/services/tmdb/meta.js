// Media da comunidade e generos de um filme/serie, numa so chamada. Best-effort.
// Cache em disco (30 dias): alem de poupar pedidos, e' o que permite a "A minha
// lista" abrir sem internet com os dados que ja tinham sido carregados.
import { cacheGetTtl, cacheSet } from "../cache.js";
import { tmdbFetch } from "./base.js";

const META_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const metaCache = new Map();

export async function getMeta(type, id) {
  if (type !== "movie" && type !== "tv") return { rating: null, genres: [] };
  const key = `meta:${type}:${id}`;
  if (metaCache.has(key)) return metaCache.get(key);
  const hit = cacheGetTtl(key, META_CACHE_TTL);
  if (hit.found) {
    metaCache.set(key, hit.value);
    return hit.value;
  }
  try {
    const d = await tmdbFetch(`/${type}/${id}`, {}, "en-US");
    const out = {
      rating: d?.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      genres: (d?.genres || []).map((g) => g.name),
    };
    metaCache.set(key, out);
    cacheSet(key, out);
    return out;
  } catch {
    return { rating: null, genres: [] };
  }
}

// Media da comunidade (vote_average) de um filme/serie. Best-effort: null se falhar.
export async function getRating(type, id) {
  return (await getMeta(type, id)).rating;
}

// IMDB id de um filme/serie do TMDB (para torrents). Best-effort: null se falhar.
export async function getExternalImdb(type, id) {
  if (type !== "movie" && type !== "tv") return null;
  try {
    const d = await tmdbFetch(`/${type}/${id}/external_ids`, {}, "en-US");
    return d?.imdb_id || null;
  } catch {
    return null;
  }
}