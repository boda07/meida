// Pesquisa de anime e "Se gostaste disto".
//
// A pesquisa tem cache curta para nao martelar o rate limit do Jikan durante a
// pesquisa instantanea.
import { jikanFetch } from "./fetch.js";
import { searchAnimeAnilist } from "./anilist.js";
import { clean, dedupe, isRomaji, normalizeAnime } from "./normalizar.js";

const searchCache = new Map(); // q -> { at, items }
const SEARCH_TTL = 5 * 60 * 1000;
const SEARCH_FETCH_OPTS = { retries: 1, timeoutMs: 3500 };

// "Se gostaste disto": recomendacoes do MAL para um anime (votos dos utilizadores).
export async function getAnimeRecommendations(malId, opts = {}) {
  const d = await jikanFetch(`/anime/${malId}/recommendations`);
  return (d.data || [])
    .map((r) => normalizeAnime(r?.entry, isRomaji(opts)))
    .filter(Boolean)
    .slice(0, 12);
}

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