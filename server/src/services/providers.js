/**
 * Templates de URL de embed dos providers.
 *
 * IMPORTANTE: estes sites mudam de dominio/formato com frequencia. Quando um
 * deixar de funcionar, ajusta SO aqui. Placeholders disponiveis:
 *   {tmdb} {imdb} {season} {episode}
 *
 * Cada provider define `movie` e `tv`. Se nao suportar series, deixa `tv: null`.
 */
export const PROVIDERS = [
  {
    id: "vidfast",
    name: "VidFast",
    movie: "https://vidfast.pro/movie/{tmdb}?autoPlay=true",
    tv: "https://vidfast.pro/tv/{tmdb}/{season}/{episode}?autoPlay=true",
  },
  {
    id: "vidlink",
    name: "VidLink",
    movie: "https://vidlink.pro/movie/{tmdb}?autoplay=true",
    tv: "https://vidlink.pro/tv/{tmdb}/{season}/{episode}?autoplay=true",
  },
  {
    // Removidos os providers da familia VidSrc (vidsrc.cc/.to/.su) e o embed.su:
    // davam "media unavailable" e/ou eram bloqueados por DNS em alguns ISPs (PT),
    // o que obrigava cada utilizador a trocar de DNS. Ficam so os que funcionam
    // sem mexer em nada.
    // moviesapi.club caiu (DNS morto) -> migrou para moviesapi.to.
    id: "moviesapi",
    name: "MoviesAPI",
    movie: "https://moviesapi.to/movie/{tmdb}",
    tv: "https://moviesapi.to/tv/{tmdb}-{season}-{episode}",
  },
  {
    id: "2embed",
    name: "2Embed",
    movie: "https://www.2embed.cc/embed/{tmdb}",
    tv: "https://www.2embed.cc/embedtv/{tmdb}&s={season}&e={episode}",
  },
  {
    id: "111movies",
    name: "111Movies",
    movie: "https://111movies.com/movie/{tmdb}",
    tv: "https://111movies.com/tv/{tmdb}/{season}/{episode}",
  },
];

/**
 * Providers DEDICADOS a anime, por id do MyAnimeList ({mal}) + episodio ({ep})
 * + audio ({audio} = "sub" ou "dub"). Permitem escolher legendado vs dobrado,
 * o que os providers normais (via TMDB) nao permitem.
 */
export const ANIME_PROVIDERS = [
  {
    // MegaPlay (o mesmo backend do anisuge.tv) aceita o id do MAL diretamente.
    id: "megaplay-anime",
    name: "MegaPlay (anime)",
    idType: "mal",
    url: "https://megaplay.buzz/stream/mal/{mal}/{ep}/{audio}",
  },
  {
    // Mesma fonte, mapeamento por AniList — util quando a por MAL engasga (520).
    id: "megaplay-ani",
    name: "MegaPlay 2 (anime)",
    idType: "anilist",
    url: "https://megaplay.buzz/stream/ani/{anilist}/{ep}/{audio}",
  },
  {
    // VidPlus usa AniList id — cobertura diferente, bom quando o MegaPlay falha.
    id: "vidplus-anime",
    name: "VidPlus (anime)",
    idType: "anilist",
    url: "https://player.vidplus.to/embed/anime/{anilist}/{ep}?dub={dubBool}&autoplay=true",
  },
  {
    // VidNest tambem usa AniList id.
    id: "vidnest-anime",
    name: "VidNest (anime)",
    idType: "anilist",
    url: "https://vidnest.fun/anime/{anilist}/{ep}/{audio}",
  },
  {
    id: "vidlink-anime",
    name: "VidLink (anime)",
    idType: "mal",
    url: "https://vidlink.pro/anime/{mal}/{ep}/{audio}",
  },
  // VidSrc.cc (anime) removido junto com a familia VidSrc (ver PROVIDERS acima).
];

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ""
  );
}

/**
 * Fontes de anime (sub/dub) por id do MAL. `episode` default 1 (filmes de anime).
 */
export function buildAnimeEmbedSources({ mal, anilist, episode, audio }) {
  if (!mal && !anilist) return [];
  const dub = audio === "dub";
  const vars = {
    mal,
    anilist,
    ep: episode || 1,
    audio: dub ? "dub" : "sub",
    dubBool: dub ? "true" : "false",
  };
  return ANIME_PROVIDERS
    // So inclui um provider se tivermos o id que ele precisa.
    .filter((p) => (p.idType === "anilist" ? anilist : mal))
    .map((p) => ({
      provider: p.id,
      name: p.name,
      embedUrl: fill(p.url, vars),
    }));
}

/**
 * Constroi a lista de fontes de embed para um titulo.
 * @param {{type:"movie"|"tv", tmdb:string|number, imdb?:string, season?:number, episode?:number}} opts
 */
export function buildEmbedSources({ type, tmdb, imdb, season, episode }) {
  const vars = { tmdb, imdb, season, episode };
  const sources = [];
  for (const p of PROVIDERS) {
    const template = type === "movie" ? p.movie : p.tv;
    if (!template) continue;
    if (type === "tv" && (season == null || episode == null)) continue;
    sources.push({
      provider: p.id,
      name: p.name,
      embedUrl: fill(template, vars),
    });
  }
  return sources;
}
