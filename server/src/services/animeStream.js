// Cliente do nosso extrator de anime (meida-anime-extractor, alojado no Render).
// Expoe um unico endpoint /extract. Configurado por ANIME_EXTRACTOR_BASE.
// O scraping acontece no host (datacenter), contornando o bloqueio dos ISPs.
import { config } from "../config.js";

const base = () => config.animeExtractorBase;

export function animeExtractorEnabled() {
  return Boolean(base());
}

// Extrai stream + legendas de um episodio de anime.
// { title, episode, audio: "sub"|"dub" } -> { sources, subtitles, referer, intro, outro }
export async function extractAnime({ title, episode, audio }) {
  if (!base()) {
    const e = new Error("ANIME_EXTRACTOR_BASE nao definido");
    e.status = 400;
    throw e;
  }
  const category = audio === "dub" ? "dub" : "sub";
  const url =
    `${base()}/extract?title=${encodeURIComponent(title)}` +
    `&episode=${encodeURIComponent(episode)}&category=${category}`;

  // O Render free "adormece": a 1a chamada pode demorar ~30s a acordar.
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`extrator ${res.status}`);
  const data = await res.json();

  return {
    provider: "hianime",
    sources: data.sources || [],
    subtitles: (data.subtitles || []).map((t) => ({
      url: t.url,
      lang: t.lang,
      label: t.label || t.lang,
    })),
    referer: data.referer || "",
    intro: data.intro || null,
    outro: data.outro || null,
  };
}
