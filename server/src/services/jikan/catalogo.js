// Catalogo de anime (rows da Home/Categoria), grelha filtravel e paginas.
import { jikanFetch, sleep } from "./fetch.js";
import {
  fetchAnilistAnimeList,
  getAnimeBannersBatch,
  getAnimeCatalogFromAnilist,
} from "./anilist.js";
import { clean, comoFilme, dedupe, isRomaji } from "./normalizar.js";

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
    ["a-movies", "Filmes de anime", "/top/anime?type=movie&limit=24", true],
  ];

  // Sequencial (com pausa) para respeitar o rate limit do Jikan.
  const rows = [];
  for (const [id, title, path, filme] of defs) {
    let items;
    try {
      items = dedupe(clean(await jikanFetch(path), romaji));
      // "Filmes de anime" leva `isMovie` em cada item: e' o que faz o feed
      // dizer "viu o filme" quando alguem marca um destes cartazes como visto.
      if (filme) items = comoFilme(items);
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
    const items = comoFilme(
      dedupe(clean(await jikanFetch(`/top/anime?type=movie&limit=24`), romaji))
    );
    if (items.length) animeMoviesCache[key] = { at: Date.now(), items };
    return items;
  } catch {
    try {
      const items = comoFilme(
        await fetchAnilistAnimeList({ sort: "POPULARITY_DESC", format: "MOVIE" }, opts)
      );
      if (items.length) animeMoviesCache[key] = { at: Date.now(), items };
      return items;
    } catch {
      return [];
    }
  }
}

/**
 * Uma pagina de uma lista curada do Jikan (top anime, temporada, filmes).
 * O caminho ja' leva `limit=24`; aqui acrescenta-se so' a pagina. E' a mesma
 * lista que alimenta as rows de anime — o "Ver todos" continua a ser a mesma
 * coisa, so' que completa.
 */
export async function getAnimeListPage(path, page = 1, opts = {}, { isMovie = false } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const sep = path.includes("?") ? "&" : "?";
  const d = await jikanFetch(`${path}${sep}page=${p}`);
  const pag = d?.pagination || {};
  let items = dedupe(clean(d, isRomaji(opts)));
  // "Filmes de anime" tambem tem "Ver todos": os itens da pagina completa
  // precisam da mesma marca que os da row, senao metade da lista ficava sem
  // saber que e' um filme.
  if (isMovie) items = comoFilme(items);
  // O Tenrai nem sempre manda `pagination`. Sem ela, uma pagina cheia quer
  // dizer "ha' mais"; e' preferivel deixar ir uma pagina a mais (que pode vir
  // vazia) do que esconder titulos que existem.
  const totalPages =
    Number(pag.last_visible_page) ||
    (pag.has_next_page ? p + 1 : items.length >= 24 ? p + 1 : p);
  return {
    items,
    page: Number(pag.current_page) || p,
    totalPages: Math.max(1, totalPages),
  };
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