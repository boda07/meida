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
  // Ordem = preferência (a 1ª viva é a fonte default). Ordenado por velocidade e
  // fiabilidade medida (2026-08-02, filme Inception + série Luke Cage):
  //   vidapi 128ms, moviesapi 123ms, 111movies 171ms, vidlink 203ms,
  //   2embed 210ms, superembed 229ms, smashystream 290ms.
  // Removidos: megaembed (mgeb.top) — 2280ms no filme (~10x mais lento) e serve
  // áudio PT-BR via Superflix; vidfast — SPA que resolve o vídeo só no browser
  // (a health-check passa mas o stream falhava nos testes).
  {
    id: "vidapi",
    name: "VidAPI",
    movie: "https://vidapi.xyz/embed/movie/{tmdb}",
    tv: "https://vidapi.xyz/embed/tv/{tmdb}/{season}/{episode}",
  },
  {
    // moviesapi.club caiu (DNS morto) -> migrou para moviesapi.to.
    id: "moviesapi",
    name: "MoviesAPI",
    movie: "https://moviesapi.to/movie/{tmdb}",
    tv: "https://moviesapi.to/tv/{tmdb}-{season}-{episode}",
  },
  {
    // 111Movies redireciona para player.vidlove.cc (servidor dedicado de vídeo).
    id: "111movies",
    name: "111Movies",
    movie: "https://111movies.com/movie/{tmdb}",
    tv: "https://111movies.com/tv/{tmdb}/{season}/{episode}",
  },
  {
    id: "vidlink",
    name: "VidLink",
    movie: "https://vidlink.pro/movie/{tmdb}?autoplay=true",
    tv: "https://vidlink.pro/tv/{tmdb}/{season}/{episode}?autoplay=true",
  },
  {
    // VidCore: API de embed dedicada a developers (Next.js, docs oficiais),
    // player HLS multi-servidor com failover e subtitulos. Adicionado a
    // 2026-08-02 (probe: 145-420ms, sem Turnstile, sem XFO/COEP, formato TMDB).
    // Nota: o stream resolve-se via JS client-side (SPA), o health-check valida
    // só a página — o auto-fallback de 15s do player cobre falhas de stream.
    id: "vidcore",
    name: "VidCore",
    movie: "https://vidcore.org/embed/movie/{tmdb}?autoPlay=true",
    tv: "https://vidcore.org/embed/tv/{tmdb}/{season}/{episode}?autoPlay=true",
  },
  {
    id: "2embed",
    name: "2Embed",
    movie: "https://www.2embed.cc/embed/{tmdb}",
    tv: "https://www.2embed.cc/embedtv/{tmdb}&s={season}&e={episode}",
  },
  {
    // Removidos os providers da familia VidSrc (vidsrc.cc/.to/.su) e o embed.su:
    // davam "media unavailable" e/ou eram bloqueados por DNS em alguns ISPs (PT),
    // o que obrigava cada utilizador a trocar de DNS. Ficam so os que funcionam
    // sem mexer em nada.
    // Adicionado a 2026-07-31 (testado: responde com o player, formato TMDB).
    // SuperEmbed usa query string; os outros usam path igual aos restantes.
    id: "superembed",
    name: "SuperEmbed",
    movie: "https://multiembed.mov/?video_id={tmdb}&tmdb=1",
    tv: "https://multiembed.mov/?video_id={tmdb}&tmdb=1&s={season}&e={episode}",
  },
  {
    // SMASHYStream (embed.smashystream.com, player "AnyEmbed"): anuncia legendas
    // em multiplos idiomas. Adicionado a 2026-07-31 (responde 200 com player).
    // A familia VidSrc (vidsrc.fyi/.sbs -> vsembed.ru/.su) nao foi readicionada:
    // e o mesmo backend que ja foi removido por "media unavailable" e bloqueios
    // de DNS em alguns ISPs de Portugal.
    id: "smashystream",
    name: "SMASHYStream",
    movie: "https://embed.smashystream.com/playere.php?tmdb={tmdb}",
    tv: "https://embed.smashystream.com/playere.php?tmdb={tmdb}&season={season}&episode={episode}",
  },
];

/**
 * Providers DEDICADOS a anime, por id do MyAnimeList ({mal}) + episodio ({ep})
 * + audio ({audio} = "sub" ou "dub"). Permitem escolher legendado vs dobrado,
 * o que os providers normais (via TMDB) nao permitem.
 */
export const ANIME_PROVIDERS = [
  // MegaPlay (o mesmo backend do anisuge.tv) removido: os endpoints /stream/...
  // devolviam erro 410 para todos os titulos (megaplay.buzz a 2026-07-31).
  // VidPlus (player.vidplus.to) removido a 2026-07-31: devolvia 403 mesmo na raiz
  // e era redundante com o MegaVid (ambos usam ids do AniList).
  // VidLink (anime) removido a 2026-07-31: nao devolvia fontes (resolucao de
  // stream no cliente devolvia url=undefined). Fica so para filmes/series.
  {
    // MegaVid: player embed com formatos /mal/ e /ani/ (sub/dub). Testado a
    // 2026-07-31: responde 200 em contexto de iframe (bloqueia acesso direto sem
    // referer, por isso pede o header de origem ao embutir). Primeiro na lista
    // para ser a fonte default do anime.
    id: "megavid-mal",
    name: "MegaVid (anime)",
    idType: "mal",
    url: "https://megavid.buzz/mal/{mal}/{ep}/{audio}",
  },
  {
    id: "megavid-ani",
    name: "MegaVid 2 (anime)",
    idType: "anilist",
    url: "https://megavid.buzz/ani/{anilist}/{ep}/{audio}",
  },
  {
    // VidNest tambem usa AniList id.
    id: "vidnest-anime",
    name: "VidNest (anime)",
    idType: "anilist",
    url: "https://vidnest.fun/anime/{anilist}/{ep}/{audio}",
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
