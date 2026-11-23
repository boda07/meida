// Pesquisa por titulo e as resolucoes de id (TMDB <- titulo/ano).
import { langsFrom, tmdbFetch } from "./base.js";
import { applyMeta, normalizeMedia } from "./normalizar.js";
import { resolveTitleMeta } from "./titulos.js";

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
  const meta = await resolveTitleMeta(
    "/search/multi",
    params,
    title,
    overview === title ? base : null
  );
  const items = (base.results || [])
    .filter((it) => !isAnimeResult(it))
    .map(normalizeMedia)
    .filter(Boolean);
  return applyMeta(items, meta);
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
  if (r) return { tmdbId: r.id, mediaType: primary, backdrop: r.backdrop_path || null };

  r = (await search(secondary, false));
  if (r) return { tmdbId: r.id, mediaType: secondary, backdrop: r.backdrop_path || null };

  return null;
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