// As listas completas que as rows do catalogo mostram.
//
// Cada row da Home / Filmes / Series / Anime tem um id proprio. E' esse id que
// liga o botao "Ver todos" a' lista certa: em vez de repetir aqui o criterio de
// cada linha (que vive nos servicos), mapeia-se o id para a MESMA fonte que
// alimenta a row. Se um dia a row mudar de fonte, muda-se aqui e o "Ver todos"
// acompanha — nao ha' duas verdades sobre o que e' "Filmes populares".
import { discover, getListPage } from "./tmdb.js";
import { getAnimeListPage } from "./jikan.js";

export const ROWS_TMDB = {
  // Home
  trending: { path: "/trending/all/week", title: "Em tendencia" },
  "popular-movies": { path: "/movie/popular", title: "Filmes populares" },
  "popular-tv": { path: "/tv/popular", title: "Series populares" },
  "top-rated": { path: "/movie/top_rated", title: "Filmes mais bem avaliados" },
  // Filmes
  "m-trending": { path: "/trending/movie/week", title: "Em tendencia" },
  "m-popular": { path: "/movie/popular", title: "Filmes populares" },
  "m-top": { path: "/movie/top_rated", title: "Mais bem avaliados" },
  "m-now": { path: "/movie/now_playing", title: "Agora nos cinemas" },
  // Series
  "t-trending": { path: "/trending/tv/week", title: "Em tendencia" },
  "t-popular": { path: "/tv/popular", title: "Series populares" },
  "t-top": { path: "/tv/top_rated", title: "Mais bem avaliadas" },
  "t-air": { path: "/tv/on_the_air", title: "A passar agora" },
};

export const ROWS_ANIME = {
  "a-top": { path: "/top/anime?filter=bypopularity&limit=24", title: "Anime popular" },
  "a-season": { path: "/seasons/now?limit=24", title: "Esta epoca" },
  "a-airing": { path: "/top/anime?filter=airing&limit=24", title: "A passar agora" },
  "a-movies": { path: "/top/anime?type=movie&limit=24", title: "Filmes de anime" },
  // A row "Filmes de anime" da pagina de Filmes usa a mesma lista do MAL.
  "m-anime": { path: "/top/anime?type=movie&limit=24", title: "Filmes de anime" },
};

/**
 * Uma pagina da lista completa de uma row.
 *
 * Devolve `null` quando o id nao existe — a rota responde 404 em vez de fingir
 * uma lista vazia (uma lista vazia parece "nao ha' nada", que e' outra coisa).
 *
 * @param {string} rowId  id da row (ex.: "popular-movies")
 * @param {{page?:number, genres?:string}} p  `genres` so' serve o "ob-generos"
 *   (a row dos generos escolhidos no onboarding), que nao e' uma lista fixa.
 * @param {object} opts  idiomas (o mesmo `langOpts(req)` do resto do catalogo).
 */
export async function getCatalogRow(rowId, { page = 1, genres = "" } = {}, opts = {}) {
  const tmdb = ROWS_TMDB[rowId];
  if (tmdb) {
    const r = await getListPage(tmdb.path, page, opts);
    return { id: rowId, title: tmdb.title, ...r };
  }

  const anime = ROWS_ANIME[rowId];
  if (anime) {
    const r = await getAnimeListPage(anime.path, page, opts);
    return { id: rowId, title: anime.title, ...r };
  }

  if (rowId === "ob-generos") {
    const lista = String(genres || "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const r = await discover(
      { type: "movie", genres: lista, sort: "popularity", dir: "desc", page },
      opts
    );
    return {
      id: rowId,
      title: "Porque escolheste estes",
      items: r.items,
      page: r.page,
      totalPages: r.totalPages,
    };
  }

  return null;
}
