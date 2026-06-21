// Provider best-effort SEM dependencias externas (embed.su).
//
// AVISO: extrair o m3u8 directamente dos sites de embed e MUITO fragil — eles
// mudam o HTML/ofuscacao com frequencia. Para algo fiavel, define
// EXTRACTOR_API_BASE (Consumet) no .env.
import { scanEmbed } from "./util.js";

const HOST = "https://embed.su";

export const embedsuProvider = {
  name: "embedsu",
  async extract(ctx) {
    const embed =
      ctx.type === "movie"
        ? `${HOST}/embed/movie/${ctx.tmdb}`
        : `${HOST}/embed/tv/${ctx.tmdb}/${ctx.season}/${ctx.episode}`;

    const url = await scanEmbed(embed, HOST);
    if (!url) throw new Error("sem m3u8 (ofuscado)");

    return {
      sources: [{ url, quality: "auto", isM3U8: true }],
      subtitles: [],
      referer: HOST + "/",
    };
  },
};
