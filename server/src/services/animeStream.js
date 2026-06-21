// Extrator de anime via aniwatch-api (HiAnime) alojado. Devolve stream m3u8 +
// legendas (soft, VTT) para tocar no nosso player. Configurado por
// ANIME_EXTRACTOR_BASE (ver config.js). Contorna o bloqueio dos ISPs porque o
// scraping acontece no host (datacenter), nao no PC do utilizador.
import { config } from "../config.js";

const base = () => config.animeExtractorBase;

export function animeExtractorEnabled() {
  return Boolean(base());
}

async function j(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`extrator ${res.status}`);
  return res.json();
}

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Encontra o id do anime no HiAnime a partir do titulo (melhor correspondencia).
async function findAnimeId(title) {
  const d = await j(`${base()}/api/v2/hianime/search?q=${encodeURIComponent(title)}`);
  const animes = d?.data?.animes || [];
  if (!animes.length) return null;
  const nt = norm(title);
  const exact = animes.find((a) => norm(a.name) === nt || norm(a.jname) === nt);
  return (exact || animes[0]).id;
}

// Extrai o stream + legendas de um episodio de anime.
// { title, episode, audio: "sub"|"dub" } -> { sources, subtitles, referer, intro, outro }
export async function extractAnime({ title, episode, audio }) {
  if (!base()) {
    const e = new Error("ANIME_EXTRACTOR_BASE nao definido");
    e.status = 400;
    throw e;
  }
  const animeId = await findAnimeId(title);
  if (!animeId) throw new Error("anime nao encontrado no extrator");

  const epData = await j(`${base()}/api/v2/hianime/anime/${animeId}/episodes`);
  const eps = epData?.data?.episodes || [];
  const ep =
    eps.find((e) => Number(e.number) === Number(episode)) ||
    eps[Number(episode) - 1] ||
    eps[0];
  if (!ep) throw new Error("episodio nao encontrado no extrator");

  const category = audio === "dub" ? "dub" : "sub";
  const epId = ep.episodeId;

  // Escolhe o 1o servidor disponivel para a categoria (fallback hd-1).
  let server;
  try {
    const sv = await j(
      `${base()}/api/v2/hianime/episode/servers?animeEpisodeId=${encodeURIComponent(epId)}`
    );
    server = (sv?.data?.[category] || [])[0]?.serverName;
  } catch {
    /* usa default */
  }

  const srcUrl =
    `${base()}/api/v2/hianime/episode/sources?animeEpisodeId=${encodeURIComponent(epId)}` +
    (server ? `&server=${encodeURIComponent(server)}` : "") +
    `&category=${category}`;
  const src = await j(srcUrl);
  const data = src?.data || {};

  const sources = (data.sources || []).map((s) => ({
    url: s.url,
    isM3U8: s.type === "hls" || /\.m3u8/i.test(s.url),
  }));
  const subtitles = (data.tracks || [])
    .filter((t) => t.url && t.lang && !/thumbnail/i.test(t.lang))
    .map((t) => ({ url: t.url, lang: t.lang, label: t.lang, default: Boolean(t.default) }));

  return {
    provider: "hianime",
    sources,
    subtitles,
    referer: data.headers?.Referer || "",
    intro: data.intro || null,
    outro: data.outro || null,
  };
}
