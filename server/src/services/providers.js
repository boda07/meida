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
    id: "vidsrc-cc",
    name: "VidSrc.cc",
    movie: "https://vidsrc.cc/v3/embed/movie/{tmdb}?autoPlay=true",
    tv: "https://vidsrc.cc/v3/embed/tv/{tmdb}/{season}/{episode}?autoPlay=true",
  },
  {
    // A familia vidsrc.xyz/.net/.in/.me caiu (redireciona para o .xyz morto).
    // O vidsrc.to e um servico independente que continua a funcionar.
    id: "vidsrc-to",
    name: "VidSrc",
    movie: "https://vidsrc.to/embed/movie/{tmdb}",
    tv: "https://vidsrc.to/embed/tv/{tmdb}/{season}/{episode}",
  },
  {
    id: "autoembed",
    name: "AutoEmbed",
    movie: "https://player.autoembed.cc/embed/movie/{tmdb}",
    tv: "https://player.autoembed.cc/embed/tv/{tmdb}/{season}/{episode}",
  },
  {
    id: "embedsu",
    name: "Embed.su",
    movie: "https://embed.su/embed/movie/{tmdb}",
    tv: "https://embed.su/embed/tv/{tmdb}/{season}/{episode}",
  },
  {
    id: "vidsrc-vip",
    name: "VidSrc.vip",
    movie: "https://vidsrc.vip/embed/movie/{tmdb}",
    tv: "https://vidsrc.vip/embed/tv/{tmdb}/{season}/{episode}",
  },
  {
    id: "moviesapi",
    name: "MoviesAPI",
    movie: "https://moviesapi.club/movie/{tmdb}",
    tv: "https://moviesapi.club/tv/{tmdb}-{season}-{episode}",
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
    // E o mais fiavel para anime sub/dub neste momento.
    id: "megaplay-anime",
    name: "MegaPlay (anime)",
    url: "https://megaplay.buzz/stream/mal/{mal}/{ep}/{audio}",
  },
  {
    id: "vidlink-anime",
    name: "VidLink (anime)",
    url: "https://vidlink.pro/anime/{mal}/{ep}/{audio}",
  },
  {
    id: "vidsrccc-anime",
    name: "VidSrc.cc (anime)",
    url: "https://vidsrc.cc/v2/embed/anime/{mal}/{ep}/{audio}",
  },
];

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ""
  );
}

/**
 * Fontes de anime (sub/dub) por id do MAL. `episode` default 1 (filmes de anime).
 */
export function buildAnimeEmbedSources({ mal, episode, audio }) {
  if (!mal) return [];
  const vars = { mal, ep: episode || 1, audio: audio === "dub" ? "dub" : "sub" };
  return ANIME_PROVIDERS.map((p) => ({
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
