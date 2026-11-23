// Ficha de um titulo, episodios de uma temporada e "Se gostaste disto".
import { cacheGet } from "../cache.js";
import { langsFrom, tmdbFetch } from "./base.js";
import { getGenres } from "./generos.js";
import { normalizeMedia, pickPoster } from "./normalizar.js";
import { bestTitle } from "./titulos.js";
import { tmdbList } from "./catalogo.js";

export async function getDetails(type, id, opts = {}) {
  if (type !== "movie" && type !== "tv") {
    throw new Error("type tem de ser 'movie' ou 'tv'");
  }
  const { overview, title } = langsFrom(opts);
  const titleShort = (title || "en-US").slice(0, 2); // "pt" | "en"
  // Em paralelo: sinopse (overview) + imagens localizadas, titulo localizado e ingles.
  let data, locData, enData, videosData;
  try {
    [data, locData, enData, videosData] = await Promise.all([
      tmdbFetch(
        `/${type}/${id}`,
        {
          append_to_response: "external_ids,credits,images",
          include_image_language: `${titleShort},en,null`,
        },
        overview
      ),
      title === overview ? Promise.resolve(null) : tmdbFetch(`/${type}/${id}`, {}, title),
      title !== "en-US" && overview !== "en-US"
        ? tmdbFetch(`/${type}/${id}`, {}, "en-US")
        : Promise.resolve(null),
      // Trailer em ingles (os trailers PT sao raros; o en-US cobre quase tudo).
      tmdbFetch(`/${type}/${id}/videos`, {}, "en-US").catch(() => ({ results: [] })),
    ]);
  } catch (err) {
    // TMDB em baixo e o pedido nao tinha cache: para series, detalhes via TVMaze
    // (procura por titulo+ano guardados no indice tvidx).
    if (type === "tv") {
      const idx = cacheGet(`tvidx:tv:${id}`);
      const { getTvDetailsByTitle } = await import("../tvmaze.js");
      const fb = await getTvDetailsByTitle(idx?.title, idx?.year);
      if (fb) return { ...fb, id: Number(id) };
    }
    throw err;
  }

  // Trailer (YouTube): prefere o trailer oficial; senao qualquer trailer.
  const trailerKey =
    (videosData.results || []).find(
      (v) => v.site === "YouTube" && v.type === "Trailer" && /official/i.test(v.name || "")
    )?.key ||
    (videosData.results || []).find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ||
    null;
  const trailer = trailerKey ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1` : null;

  const base = normalizeMedia({ ...data, media_type: type });
  // Cartaz no idioma escolhido (em PT prefere sem texto; ver pickPoster).
  const poster = pickPoster(data.images?.posters, titleShort);
  if (poster) base.poster = poster;
  // Titulo no idioma escolhido, com fallback para ingles quando nao ha traducao.
  const localized = locData || data;
  if (title === "en-US") {
    base.title = localized.title || localized.name || base.title;
  } else {
    const enTitle = enData
      ? enData.title || enData.name || ""
      : overview === "en-US"
      ? data.title || data.name || ""
      : "";
    base.title = bestTitle(localized, enTitle) || base.title;
  }
  const imdbId = data.external_ids?.imdb_id || null;
  // Generos no idioma escolhido para generos (pode diferir do das sinopses).
  // data.genres tem ids -> traduz pelo mapa do TMDB nesse idioma.
  const genreLang = opts.genreLang || opts.overviewLang;
  let genres = (data.genres || []).map((g) => g.name);
  try {
    const gl = await getGenres(type, genreLang);
    const byId = new Map(gl.map((g) => [g.id, g.name]));
    genres = (data.genres || []).map((g) => byId.get(g.id) || g.name);
  } catch {
    /* fica com os nomes do idioma das sinopses */
  }
  const cast = (data.credits?.cast || []).slice(0, 10).map((c) => ({
    name: c.name,
    character: c.character,
    profile: c.profile_path,
  }));

  let seasons = null;
  if (type === "tv") {
    seasons = (data.seasons || [])
      .filter((s) => s.season_number > 0)
      .map((s) => ({
        seasonNumber: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
      }));
  }

  return {
    ...base,
    imdbId,
    trailer,
    genres,
    cast,
    runtime: data.runtime || (data.episode_run_time?.[0] ?? null),
    seasons,
    totalSeasons: type === "tv" ? data.number_of_seasons : null,
  };
}

export async function getSeason(id, seasonNumber, opts = {}) {
  const { overview } = langsFrom(opts);
  let data;
  try {
    data = await tmdbFetch(`/tv/${id}/season/${seasonNumber}`, {}, overview);
  } catch (err) {
    // TMDB em baixo: episodios da temporada via TVMaze (mesmo titulo do indice).
    const idx = cacheGet(`tvidx:tv:${id}`);
    const { getTvEpisodesByTitle } = await import("../tvmaze.js");
    const fb = await getTvEpisodesByTitle(idx?.title, idx?.year, seasonNumber);
    if (fb) return fb;
    throw err;
  }
  return (data.episodes || []).map((e) => ({
    episodeNumber: e.episode_number,
    name: e.name,
    overview: e.overview,
    still: e.still_path,
    airDate: e.air_date,
    rating: e.vote_average ? Math.round(e.vote_average * 10) / 10 : null,
  }));
}

// "Se gostaste disto": titulos similares do TMDB (/movie/{id}/similar e
// /tv/{id}/similar), normalizados como os cards do catalogo.
export async function getSimilar(type, id, opts = {}) {
  if (type !== "movie" && type !== "tv") return [];
  const items = await tmdbList(`/${type}/${id}/similar`, {}, opts);
  return items.slice(0, 12);
}