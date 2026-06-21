// Provider best-effort SEM dependencias externas (vidsrc.cc).
// Mesma estrategia generica do embedsu — tenta encontrar o m3u8 na pagina/API.
// Fragil por natureza; ajusta aqui se partir, ou usa EXTRACTOR_API_BASE.
import { scanEmbed } from "./util.js";

const HOST = "https://vidsrc.cc";

export const vidsrcccProvider = {
  name: "vidsrccc",
  async extract(ctx) {
    const embed =
      ctx.type === "movie"
        ? `${HOST}/v2/embed/movie/${ctx.tmdb}`
        : `${HOST}/v2/embed/tv/${ctx.tmdb}/${ctx.season}/${ctx.episode}`;

    const url = await scanEmbed(embed, HOST);
    if (!url) throw new Error("sem m3u8 (ofuscado)");

    return {
      sources: [{ url, quality: "auto", isM3U8: true }],
      subtitles: [],
      referer: HOST + "/",
    };
  },
};
