// Catalogo, filtros e recomendacoes de manga/manhwa/manhua via Jikan (API publica
// do MyAnimeList, sem chave). Tal como o anime, o manga e 100% MAL: poster,
// titulo, sinopse e generos vem do MAL. A app nao tem leitor — os cartoes abrem a
// pagina do MAL (para ler/adicionar a lista).
import { jikanFetch, sleep } from "./jikan.js";
import { getGenreVocab } from "./tmdb.js";

function mangaYear(m) {
  if (m.published?.prop?.from?.year) return m.published.prop.from.year;
  if (m.published?.from) return new Date(m.published.from).getFullYear();
  return "";
}

// Normaliza um manga para o formato dos cartoes (poster e URL completo).
export function normalizeManga(m) {
  if (!m?.mal_id) return null;
  const title = m.title_english || m.title || m.title_japanese || "";
  const genres = [
    ...(m.genres || []),
    ...(m.themes || []),
    ...(m.demographics || []),
  ].map((g) => g.name);
  return {
    id: m.mal_id,
    type: "manga",
    title,
    overview: m.synopsis || "",
    poster: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || null,
    year: String(mangaYear(m) || ""),
    rating: m.score ? Math.round(m.score * 10) / 10 : null,
    chapters: m.chapters || null,
    status: m.status || "", // "Finished" | "Publishing" | "On Hiatus" | ...
    mediaType: m.type || "", // "Manga" | "Manhwa" | "Manhua" | "Novel" | ...
    url: m.url || null, // pagina do MAL (a app abre no browser)
    members: m.members || 0, // para reordenar quando juntamos varios tipos
    genres,
  };
}

// Tipos do MAL (na lista do utilizador vem em snake_case) -> rotulo bonito.
const MAL_TYPE_LABEL = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
  novel: "Novel",
  light_novel: "Light Novel",
  one_shot: "One-shot",
  doujinshi: "Doujinshi",
};

// Normaliza um no da lista do MAL (formato diferente do Jikan) para cartao. Sem
// sinopse/ano (a lista nao os traz); o URL aponta para a pagina do manga no MAL.
export function normalizeMalManga(node) {
  if (!node?.id) return null;
  return {
    id: node.id,
    type: "manga",
    title: node.alternative_titles?.en || node.title || "",
    overview: "",
    poster: node.main_picture?.large || node.main_picture?.medium || null,
    year: "",
    rating: node.mean ? Math.round(node.mean * 10) / 10 : null,
    chapters: node.num_chapters || null,
    status: "",
    mediaType: MAL_TYPE_LABEL[node.media_type] || node.media_type || "",
    url: `https://myanimelist.net/manga/${node.id}`,
    members: 0,
    genres: (node.genres || []).map((g) => g.name),
  };
}

// O mediaType (texto do Jikan) corresponde a algum dos tipos pedidos? "novel"
// abrange "Novel" e "Light Novel".
function typeMatches(mediaType, types) {
  if (!types.length) return true;
  const mt = String(mediaType || "").toLowerCase();
  return types.some((t) => (t === "novel" ? mt.includes("novel") : mt === t || mt.includes(t)));
}

// Remove duplicados por id.
function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
}

// --- Traducao de generos (reaproveita o vocabulario do TMDB+MAL) ---
async function genreVocab(opts) {
  try {
    return await getGenreVocab(opts.genreLang || opts.overviewLang);
  } catch {
    return null;
  }
}
const tr = (vocab, name) => (vocab ? vocab.get(String(name).toLowerCase()) || name : name);

export async function withTranslatedGenres(items, opts) {
  const vocab = await genreVocab(opts);
  if (!vocab) return items;
  return items.map((it) => ({ ...it, genres: (it.genres || []).map((n) => tr(vocab, n)) }));
}

async function translateNames(names, opts) {
  const vocab = await genreVocab(opts);
  return names.map((n) => tr(vocab, n));
}

// Lista de generos + temas de manga (Jikan), em ingles (a rota traduz).
let mangaGenresCache = null;
export async function getMangaGenresRaw() {
  if (mangaGenresCache) return mangaGenresCache;
  const [g, t] = await Promise.all([
    jikanFetch(`/genres/manga`),
    jikanFetch(`/genres/manga?filter=themes`),
  ]);
  const seen = new Set();
  const list = [...(g.data || []), ...(t.data || [])]
    .map((x) => ({ id: x.mal_id, name: x.name }))
    .filter((x) => (seen.has(x.id) ? false : seen.add(x.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
  mangaGenresCache = list;
  return list;
}

// Mapa nome(ingles, minusculas) -> id do genero (para recomendar a partir dos
// nomes de genero que vem na lista do MAL).
async function mangaGenreNameToId() {
  const list = await getMangaGenresRaw();
  const map = new Map();
  for (const g of list) map.set(g.name.toLowerCase(), g.id);
  return map;
}

// Grelha filtravel de manga. types: lista (manhwa|manhua|manga|novel|...); vazio =
// todos. status: complete|publishing|hiatus|... Generos a incluir = AND (igual ao
// MAL), excluir via genres_exclude. excludeIds: Set de ids a esconder (ex.: o que
// ja esta na lista do utilizador). O Jikan so aceita 1 tipo por pedido, por isso
// com varios tipos fazemos um pedido por tipo e juntamos (reordenando).
export async function discoverManga(
  {
    types = [],
    genres = [],
    exclude = [],
    status = "",
    sort = "popularity",
    dir = "desc",
    page = 1,
    excludeIds = null,
  },
  opts = {}
) {
  const order =
    { popularity: "members", rating: "score", recent: "start_date", chapters: "chapters" }[sort] ||
    "members";
  const buildParams = (type) => {
    const params = new URLSearchParams({
      page: String(Math.max(1, Number(page) || 1)),
      limit: "24",
      order_by: order,
      sort: dir === "asc" ? "asc" : "desc",
    });
    if (!opts.adult) params.set("sfw", "true");
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (genres.length) params.set("genres", genres.join(","));
    if (exclude.length) params.set("genres_exclude", exclude.join(","));
    return params;
  };

  const typeList = types.length ? types : [""];
  let all = [];
  let hasMore = false;
  for (let i = 0; i < typeList.length; i++) {
    if (i > 0) await sleep(400); // respeita o rate limit do Jikan
    try {
      const d = await jikanFetch(`/manga?${buildParams(typeList[i])}`);
      all.push(...(d.data || []).map(normalizeManga).filter(Boolean));
      if (d?.pagination?.has_next_page) hasMore = true;
    } catch {
      /* ignora este tipo */
    }
  }

  let items = dedupe(all);
  if (excludeIds && excludeIds.size) items = items.filter((it) => !excludeIds.has(Number(it.id)));

  // Com varios tipos a juncao quebra a ordem global -> reordena pelo criterio.
  if (typeList.length > 1) {
    const cmp =
      {
        members: (a, b) => (b.members || 0) - (a.members || 0),
        score: (a, b) => (b.rating || 0) - (a.rating || 0),
        start_date: (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0),
      }[order] || ((a, b) => (b.members || 0) - (a.members || 0));
    items.sort(cmp);
    if (dir === "asc") items.reverse();
  }

  items = await withTranslatedGenres(items, opts);
  return { items, page: Number(page) || 1, hasMore };
}

// Recomenda manga com base nas tags mais lidas do utilizador. `readList` sao as
// entradas que refletem o gosto ({ id, status, genres:[nomes] }). Conta a
// frequencia dos generos (terminados contam a dobrar), procura no Jikan pelos
// generos mais lidos e ordena pela sobreposicao com o gosto. excludeIds esconde o
// que ja esta na lista; types (varios) filtra o tipo localmente.
export async function recommendManga(
  readList,
  { types = [], status = "", excludeIds = null, limit = 24 },
  opts = {}
) {
  const counts = new Map();
  for (const it of readList) {
    const weight = it.status === "completed" ? 2 : 1;
    for (const name of it.genres || []) {
      const k = String(name).toLowerCase();
      counts.set(k, (counts.get(k) || 0) + weight);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const nameToId = await mangaGenreNameToId();
  const topIds = [];
  const topNames = [];
  for (const name of ranked) {
    const id = nameToId.get(name);
    if (id && !topIds.includes(id)) {
      topIds.push(id);
      topNames.push(name);
    }
    if (topIds.length >= 4) break;
  }
  if (!topIds.length) return { topGenres: [], items: [] };

  // Um pedido por genero do topo (mais variedade que cruzar tudo num so). Sem
  // filtro de tipo no Jikan (filtramos localmente, para suportar varios tipos).
  const pool = new Map();
  for (const gid of topIds.slice(0, 3)) {
    const params = new URLSearchParams({
      limit: "25",
      order_by: "members",
      sort: "desc",
      genres: String(gid),
    });
    if (!opts.adult) params.set("sfw", "true");
    if (status) params.set("status", status);
    try {
      const d = await jikanFetch(`/manga?${params}`);
      for (const m of d.data || []) {
        const n = normalizeManga(m);
        if (!n) continue;
        const id = Number(n.id);
        if (excludeIds && excludeIds.has(id)) continue;
        if (!typeMatches(n.mediaType, types)) continue;
        if (!pool.has(id)) pool.set(id, n);
      }
    } catch {
      /* ignora este genero */
    }
    await sleep(400); // respeita o rate limit do Jikan
  }

  const topSet = new Set(topNames);
  let items = [...pool.values()]
    .map((n) => ({
      n,
      overlap: (n.genres || []).filter((g) => topSet.has(String(g).toLowerCase())).length,
      score: n.rating || 0,
    }))
    .sort((a, b) => b.overlap - a.overlap || b.score - a.score)
    .slice(0, limit)
    .map((x) => x.n);

  items = await withTranslatedGenres(items, opts);
  const topGenres = await translateNames(topNames, opts);
  return { topGenres, items };
}
