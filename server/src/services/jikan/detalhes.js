// Ficha de um anime: 100% MyAnimeList (poster, titulo, sinopse, episodios),
// com o AniList e o TMDB como reserva.
//
// A reproducao usa os providers de anime por id do MAL (ver providers.js).
import { findTmdbMatch, getExternalImdb, getGenreVocab } from "../tmdb.js";
import { jikanFetch, sleep } from "./fetch.js";
import { getAnilistMeta, getAnimeDetailsFromAnilist } from "./anilist.js";
import { isRomaji, normalizeAnime } from "./normalizar.js";

export async function getAnimeDetails(malId, opts = {}) {
  let full;
  try {
    full = (await jikanFetch(`/anime/${malId}/full`)).data;
  } catch {
    return getAnimeDetailsFromAnilist(malId, opts);
  }
  const base = normalizeAnime(full, isRomaji(opts));
  const isMovie = /movie|music/i.test(full?.type || "");

  let episodeCount = full?.episodes || 0;
  // Anime a passar/com numero desconhecido: tenta obter o total real do
  // endpoint de episodios (paginado, 100 por pagina).
  if (!isMovie && !episodeCount) {
    await sleep(400); // evita o rate limit logo a seguir ao /full
    try {
      const pag = (await jikanFetch(`/anime/${malId}/episodes`))?.pagination;
      episodeCount =
        pag?.items?.total ||
        (pag?.last_visible_page ? pag.last_visible_page * 100 : 0);
    } catch {
      /* ignora */
    }
  }
  if (isMovie) episodeCount = 1;
  if (!episodeCount) episodeCount = 24; // fallback razoavel

  // AniList: id (alguns providers usam) + bannerImage (fundo do anime).
  const { id: anilistId, banner: anilistBanner } = await getAnilistMeta(malId);

  // Match best-effort no TMDB para arranjar o IMDB id (torrents) E um backdrop
  // de reserva quando o AniList nao tem banner. O MAL so tem o poster, que
  // ficava feio e repetido atras do cabecalho. Nao afeta poster/titulo/sinopse.
  let imdbId = null;
  let tmdbType = isMovie ? "movie" : "tv";
  let tmdbBackdrop = null;
  try {
    const match = await findTmdbMatch(base.title, base.year, isMovie);
    if (match?.tmdbId) {
      tmdbType = match.mediaType;
      tmdbBackdrop = match.backdrop || null;
      imdbId = await getExternalImdb(match.mediaType, match.tmdbId);
    }
  } catch {
    /* sem match -> sem torrents nem backdrop do TMDB para este anime */
  }

  // Trailer (promo) do MAL/Jikan, best-effort (muitos animes nao tem).
  let trailer = null;
  try {
    const v = await jikanFetch(`/anime/${malId}/videos`);
    const promo = v?.data?.promo?.[0]?.trailer?.youtube_id;
    if (promo) trailer = `https://www.youtube.com/embed/${promo}?autoplay=1`;
  } catch {
    /* sem trailer */
  }

  // Generos no idioma escolhido (os nomes do MAL vem em ingles -> traduz).
  let genres = (full?.genres || []).map((g) => g.name);
  try {
    const vocab = await getGenreVocab(opts.genreLang || opts.overviewLang);
    if (vocab) genres = genres.map((n) => vocab.get(String(n).toLowerCase()) || n);
  } catch {
    /* fica com os nomes em ingles */
  }

  return {
    id: Number(malId),
    type: "anime",
    malId: Number(malId),
    anilistId,
    imdbId,
    tmdbType,
    trailer,
    isAnime: true,
    isMovie,
    title: base.title,
    overview: base.overview,
    poster: base.poster,
    // Fundo a serio: banner do AniList (preferido) -> backdrop do TMDB. null se
    // nenhum existir (o frontend nao mostra fundo, em vez de repetir o poster).
    backdrop: anilistBanner || tmdbBackdrop,
    year: base.year,
    rating: base.rating,
    genres,
    cast: [],
    runtime: full?.duration || null,
    episodeCount,
  };
}