// Grelhas filtraveis (discover) e paginas de listas curadas.
import { langsFrom, tmdbFetch } from "./base.js";
import { applyMeta, normalizeMedia } from "./normalizar.js";
import { resolveTitleMeta } from "./titulos.js";

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
    page: Math.min(500, Math.max(1, Number(page) || 1)),
  };
  if (genres.length) params.with_genres = genres.join(",");
  // Sem um minimo de votos, a ordenacao por nota enche-se de titulos obscuros.
  if (sort === "rating") params["vote_count.gte"] = kind === "tv" ? 50 : 100;

  const { overview, title } = langsFrom(opts);
  const base = await tmdbFetch(`/discover/${kind}`, params, overview);
  let items = (base.results || [])
    .map((r) => normalizeMedia({ ...r, media_type: kind }))
    .filter(Boolean);
  const meta = await resolveTitleMeta(
    `/discover/${kind}`,
    params,
    title,
    overview === title ? base : null
  );
  items = applyMeta(items, meta);
  return {
    items,
    page: base.page || 1,
    hasMore: (base.page || 1) < (base.total_pages || 1),
    totalPages: Math.min(Math.max(1, Number(base.total_pages) || 1), 500),
  };
}

/**
 * Uma pagina de uma lista curada do TMDB (popular, trending, top rated, ...).
 *
 * E' a MESMA lista que alimenta as rows da Home/Categoria — o "Ver todos" nao
 * pode mostrar outra coisa qualquer. So' que aqui vai pagina a pagina, em vez
 * dos 20 titulos que a row mostra.
 */
export async function getListPage(path, page = 1, opts = {}) {
  // O TMDB recusa (400) qualquer pagina acima de 500 — nao devolve vazio, da'
  // erro. Prende-se aqui para um URL escrito a mao nao parecer "lista partida".
  const p = Math.min(500, Math.max(1, Number(page) || 1));
  const params = { page: p };
  const { overview, title } = langsFrom(opts);
  const base = await tmdbFetch(path, params, overview);
  const items = (base.results || []).map(normalizeMedia).filter(Boolean);
  const meta = await resolveTitleMeta(path, params, title, overview === title ? base : null);
  return {
    items: applyMeta(items, meta),
    page: Number(base.page) || p,
    // O TMDB nao serve mais de 500 paginas, mesmo quando diz que sim.
    totalPages: Math.min(Math.max(1, Number(base.total_pages) || 1), 500),
  };
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