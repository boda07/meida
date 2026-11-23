// As linhas do catalogo (Home e Categoria).
//
// Todas passam por `tmdbList`, que busca no idioma da sinopse e resolve titulos
// e cartazes no idioma dos titulos (com fallback para ingles quando nao ha
// traducao).
import { langsFrom, tmdbFetch } from "./base.js";
import { applyMeta, normalizeMedia } from "./normalizar.js";
import { resolveTitleMeta } from "./titulos.js";

/**
 * Busca uma lista no idioma da sinopse e resolve titulos + cartazes no idioma
 * dos titulos (com fallback de titulo para ingles quando nao ha traducao).
 */
export async function tmdbList(path, params = {}, opts = {}) {
  const { overview, title } = langsFrom(opts);
  const base = await tmdbFetch(path, params, overview);
  const items = (base.results || []).map(normalizeMedia).filter(Boolean);
  const meta = await resolveTitleMeta(path, params, title, overview === title ? base : null);
  return applyMeta(items, meta);
}

// Filmes "mais bem avaliados" pela COMUNIDADE DO LETTERBOXD, nao pelo vote_average
// do TMDB (que deixa entrar estreias com poucos votos a 9, tipo o "Swapped"). Usa
// o top_rated do TMDB (2 paginas, ~40) so como conjunto de candidatos e reordena/
// filtra pela nota real do Letterboxd. Falha em silencio para o top_rated do TMDB.
async function topRatedMovies(opts = {}) {
  const [p1, p2] = await Promise.all([
    tmdbList("/movie/top_rated", { page: 1 }, opts),
    tmdbList("/movie/top_rated", { page: 2 }, opts),
  ]);
  const pool = [...p1, ...p2];
  try {
    const { getRatings } = await import("../letterboxd.js");
    const lb = await getRatings(pool.map((i) => i.id));
    const ranked = pool
      .map((i) => ({ ...i, rating: lb.get(Number(i.id)) }))
      .filter((i) => i.rating != null && i.rating >= 7) // nota fiavel e mesmo alta
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 20);
    if (ranked.length >= 10) return ranked;
  } catch {
    /* sem Letterboxd -> fica o top_rated do TMDB */
  }
  return p1;
}

export async function getCatalog(opts = {}) {
  const [trending, popularMovies, popularTv, topRated] = await Promise.all([
    tmdbList("/trending/all/week", {}, opts),
    tmdbList("/movie/popular", {}, opts),
    tmdbList("/tv/popular", {}, opts),
    topRatedMovies(opts),
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
      topRatedMovies(opts),
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