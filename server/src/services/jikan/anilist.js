// AniList (GraphQL): o fallback do Jikan e a fonte do banner e do id que os
// providers de anime usam.
//
// **O id do AniList de um anime NAO MUDA.** Por isso vai para o cache em DISCO:
// antes so' vivia em memoria, e perdia-se a cada reinicio do servidor. Medido em
// 2026-10-21, com a AniList globalmente desligada (HTTP 403, "temporarily
// disabled due to severe stability issues"): o `anilistId` vinha `null`, e como
// **todos** os providers de anime precisam desse id, o anime ficava sem fontes
// nenhuma — nem com o cache em memoria, porque um servidor recem-arrancado nao
// tem nada.
import { getGenreVocab } from "../tmdb.js";
import { cacheGet, cacheGetTtl, cacheSet } from "../cache.js";
import { netFetch } from "../net.js";
import { log } from "../log.js";
import { sleep } from "./fetch.js";
import { dedupe, isRomaji, normalizeAnilistAnime } from "./normalizar.js";

const ANILIST_URL = "https://graphql.anilist.co";

async function anilistQuery(query, variables) {
  const res = await netFetch(ANILIST_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  return res.json();
}

export async function searchAnimeAnilist(query, opts = {}) {
  const romaji = isRomaji(opts);
  const adultFilter = opts.adult ? "" : ",isAdult:false";
  const queryText = `query($q:String){Page(page:1,perPage:10){media(search:$q,type:ANIME,sort:POPULARITY_DESC${adultFilter}){idMal format title{romaji english native} description(asHtml:false) coverImage{extraLarge large} bannerImage startDate{year} averageScore meanScore}}}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await netFetch(ANILIST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: queryText, variables: { q: query } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const data = await res.json();
    return dedupe(
      (data?.data?.Page?.media || []).map((a) => normalizeAnilistAnime(a, romaji)).filter(Boolean)
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getAnimeDetailsFromAnilist(malId, opts = {}) {
  const id = Number(malId);
  const query = `query($id:Int){Media(idMal:$id,type:ANIME){id idMal title{romaji english native} description(asHtml:false) coverImage{extraLarge large} bannerImage startDate{year} averageScore meanScore genres episodes duration format}}`;
  const data = await anilistQuery(query, { id });
  const full = data?.data?.Media;
  const base = normalizeAnilistAnime(full, isRomaji(opts));
  if (!base) throw new Error("Anime nao encontrado no AniList");

  const isMovie = full?.format === "MOVIE";
  let genres = full?.genres || [];
  try {
    const vocab = await getGenreVocab(opts.genreLang || opts.overviewLang);
    if (vocab) genres = genres.map((n) => vocab.get(String(n).toLowerCase()) || n);
  } catch {
    /* fica com os nomes em ingles */
  }

  return {
    id,
    type: "anime",
    malId: id,
    anilistId: full?.id || null,
    imdbId: null,
    tmdbType: isMovie ? "movie" : "tv",
    isAnime: true,
    isMovie,
    title: base.title,
    overview: base.overview,
    poster: base.poster,
    backdrop: base.backdrop,
    year: base.year,
    rating: base.rating,
    genres,
    cast: [],
    runtime: full?.duration ? `${full.duration} min` : null,
    episodeCount: isMovie ? 1 : full?.episodes || 24,
  };
}

export function currentAnilistSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m <= 3) return "WINTER";
  if (m <= 6) return "SPRING";
  if (m <= 9) return "SUMMER";
  return "FALL";
}

export async function fetchAnilistAnimeList(
  { sort, format = null, status = null, season = null, seasonYear = null },
  opts = {}
) {
  const romaji = isRomaji(opts);
  const query = `query($sort:[MediaSort],$format:MediaFormat,$status:MediaStatus,$season:MediaSeason,$seasonYear:Int,$isAdult:Boolean){Page(page:1,perPage:24){media(type:ANIME,sort:$sort,format:$format,status:$status,season:$season,seasonYear:$seasonYear,isAdult:$isAdult){idMal format title{romaji english native} description(asHtml:false) coverImage{extraLarge large} bannerImage startDate{year} averageScore meanScore}}}`;
  const variables = {
    sort: [sort],
    isAdult: opts.adult ? null : false,
  };
  if (format) variables.format = format;
  if (status) variables.status = status;
  if (season) variables.season = season;
  if (seasonYear) variables.seasonYear = seasonYear;

  const data = await anilistQuery(query, variables);
  return dedupe(
    (data?.data?.Page?.media || []).map((a) => normalizeAnilistAnime(a, romaji)).filter(Boolean)
  );
}

export async function getAnimeCatalogFromAnilist(opts = {}) {
  const year = new Date().getFullYear();
  const season = currentAnilistSeason();
  const defs = [
    ["a-top", "Anime popular", { sort: "POPULARITY_DESC" }],
    ["a-season", "Esta epoca", { sort: "POPULARITY_DESC", season, seasonYear: year }],
    ["a-airing", "A passar agora", { sort: "POPULARITY_DESC", status: "RELEASING" }],
    ["a-movies", "Filmes de anime", { sort: "POPULARITY_DESC", format: "MOVIE" }],
  ];

  const rows = [];
  for (const [id, title, params] of defs) {
    try {
      rows.push({ id, title, items: await fetchAnilistAnimeList(params, opts) });
    } catch {
      rows.push({ id, title, items: [] });
    }
  }
  return rows;
}

// Media da comunidade para varios anime de uma vez, via AniList (filtra por
// idMal_in, 50 por pedido). Devolve Map(malId -> nota 0-10). Best-effort.
// Usado como fallback do backfill quando a conta MAL nao esta ligada.
export async function getAnimeRatingsBatch(malIds) {
  const out = new Map();
  const ids = [...new Set(malIds.map(Number).filter(Boolean))];
  const query = `query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){idMal averageScore meanScore}}}`;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await netFetch(ANILIST_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query, variables: { ids: chunk } }),
      });
      const j = await res.json();
      for (const m of j?.data?.Page?.media || []) {
        const s = m.averageScore ?? m.meanScore;
        if (m.idMal && s != null) out.set(Number(m.idMal), Math.round(s) / 10);
      }
    } catch {
      /* ignora este lote; fica para a proxima carga */
    }
    await sleep(700); // respeita o rate limit do AniList
  }
  return out;
}

// AniList por id do MyAnimeList: id (alguns providers usam) + bannerImage (fundo
// widescreen do anime, muito melhor que o poster para o fundo dos detalhes).
//
// O banner pode mudar, por isso esse tem prazo; o id, nao.
const anilistMetaCache = new Map();
const ANILIST_META_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export async function getAnilistMeta(malId) {
  const key = Number(malId);
  if (anilistMetaCache.has(key)) return anilistMetaCache.get(key);
  let out = { id: null, banner: null };
  try {
    const res = await netFetch(ANILIST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: "query($m:Int){Media(idMal:$m,type:ANIME){id bannerImage}}",
        variables: { m: key },
      }),
    });
    const j = await res.json();
    out = {
      id: j?.data?.Media?.id || null,
      banner: j?.data?.Media?.bannerImage || null,
    };
  } catch {
    /* sem AniList -> sem banner */
  }
  if (out.id) {
    // O id: para sempre. O banner: 30 dias.
    cacheSet("anilistid:" + key, out.id);
    cacheSet("anilistmeta:" + key, out);
  } else {
    // A AniList nao respondeu. O id do disco serve na mesma (e' imutavel); o
    // banner e' uma decoracao e pode perder-se.
    const emDisco = cacheGetTtl("anilistmeta:" + key, ANILIST_META_TTL_MS);
    if (emDisco.found && emDisco.value?.id) {
      out = emDisco.value;
    } else {
      const soId = cacheGet("anilistid:" + key);
      if (soId) out = { id: soId, banner: null };
    }
  }
  anilistMetaCache.set(key, out);
  return out;
}

// Banners (imagem widescreen) do AniList para varios anime de uma vez, por idMal
// (50 por pedido). Devolve Map(malId -> URL). Usado para o slideshow do catalogo
// de anime, ja que o Jikan so da poster (sem backdrop). Best-effort.
export async function getAnimeBannersBatch(malIds) {
  const out = new Map();
  const ids = [...new Set(malIds.map(Number).filter(Boolean))];
  const query = `query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){idMal bannerImage}}}`;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await netFetch(ANILIST_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query, variables: { ids: chunk } }),
      });
      const j = await res.json();
      for (const m of j?.data?.Page?.media || []) {
        if (m.idMal && m.bannerImage) out.set(Number(m.idMal), m.bannerImage);
      }
    } catch {
      /* ignora este lote */
    }
    await sleep(700);
  }
  return out;
}

// Converte um id do MyAnimeList no id do AniList (alguns providers de anime
// usam AniList).
//
// Duas coisas importantes aqui, ambas corrigidas a 2026-10-09 depois de um
// utilizador relatar que um anime ficava sem fontes:
//
// 1. **Uma falha NAO pode ficar em cache para sempre.** A versao anterior fazia
//    `anilistCache.set(key, id)` mesmo quando `id` era `null`, e o `Map` nao tem
//    prazo. Uma falha da AniList — timeout, 500, ou um `{"errors":[...]}` com
//    HTTP 200 — deixava aquele titulo sem fontes ate o servidor reiniciar, mesmo
//    com a rede ja boa. Por isso so se guarda o id quando existe; a falha fica
//    uns 30 segundos e depois tenta de novo.
//
// 2. **A falha tem de aparecer no log.** O `catch` era mudo, e o unico sintoma
//    era um 400 "falta o parametro tmdb" na pagina — que nao diz nada sobre o
//    AniList e levou a uma investigacao inteira sem pistas.
const anilistCache = new Map();
// Quanto tempo uma falha fica guardada antes de se tentar de novo. Curto o
// suficiente para que a rede volte a ser notada, longo o suficiente para nao
// martelar a AniList com pedidos iguais enquanto ela esta a cair.
const FALHA_TTL_MS = 30000;
const agora = () => Date.now();

export async function malToAnilist(malId) {
  const key = Number(malId);
  if (!Number.isFinite(key) || key <= 0) return null;

  const guardado = anilistCache.get(key);
  if (guardado) {
    // `{ id }` para sempre, ou `{ id: null, ate }` para as falhas.
    if (guardado.id != null) return guardado.id;
    if (guardado.ate > agora()) return null;
    anilistCache.delete(key);
  }

  // **O id do AniList de um anime nao muda.** O cache em memoria perdia-se a
  // cada reinicio, e com a AniList em baixo o anime ficava sem fontes (e sao
  // **todos** os providers de anime que precisam deste id). O disco resolve.
  const emDisco = cacheGet("anilistid:" + key);
  if (emDisco) {
    anilistCache.set(key, { id: emDisco, ate: Infinity });
    return emDisco;
  }

  try {
    const res = await netFetch(ANILIST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: "query($m:Int){Media(idMal:$m,type:ANIME){id}}",
        variables: { m: key },
      }),
    });
    if (!res.ok) throw new Error(`AniList respondeu HTTP ${res.status}`);
    const j = await res.json();
    // A AniList pode responder 200 com `errors` e `data: null`. Antes isso era
    // guardado como "sem id" para sempre.
    if (j?.errors?.length) throw new Error(j.errors[0]?.message || "erro da AniList");
    const id = j?.data?.Media?.id ?? null;
    if (id != null) {
      anilistCache.set(key, { id, ate: Infinity });
      cacheSet("anilistid:" + key, id);
      return id;
    }
    // Nem erro nem id: pode ser um id que a AniList nao conhece. Nao vale a pena
    // guardar — e mais barato voltar a perguntar do que guardar um "nao existe".
    log.warn("anilist", "AniList nao devolveu id para um anime do MyAnimeList", { malId: key });
    anilistCache.set(key, { id: null, ate: agora() + FALHA_TTL_MS });
    return null;
  } catch (e) {
    // Guarda a falha por pouco tempo, para a proxima pagina tentar de novo, e
    // deixa rasto. Sem este log o sintoma e' um 400 sem pistas.
    log.warn("anilist", "malToAnilist falhou", { malId: key, error: String(e?.message || e) });
    anilistCache.set(key, { id: null, ate: agora() + FALHA_TTL_MS });
    return null;
  }
}