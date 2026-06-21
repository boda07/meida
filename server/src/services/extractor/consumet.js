// Provider que usa um extractor externo compativel com a API do Consumet
// (provider FlixHQ). Ativa-se definindo EXTRACTOR_API_BASE no .env.
// Docs: https://docs.consumet.org/  (rotas /movies/flixhq)
import { config } from "../../config.js";

const base = () => config.extractorApiBase;

async function j(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`consumet ${res.status}`);
  return res.json();
}

function matches(result, ctx) {
  const wantTv = ctx.type === "tv";
  const isTv = /tv/i.test(result.type || "");
  if (wantTv !== isTv) return false;
  if (ctx.year && result.releaseDate) {
    return String(result.releaseDate).includes(String(ctx.year));
  }
  return true;
}

export const consumetProvider = {
  name: "consumet",
  async extract(ctx) {
    if (!base()) throw new Error("EXTRACTOR_API_BASE nao definido");
    const query = encodeURIComponent(ctx.title);
    const search = await j(`${base()}/movies/flixhq/${query}`);
    const result =
      (search.results || []).find((r) => matches(r, ctx)) ||
      (search.results || [])[0];
    if (!result) throw new Error("titulo nao encontrado");

    const info = await j(`${base()}/movies/flixhq/info?id=${encodeURIComponent(result.id)}`);
    const eps = info.episodes || [];
    let ep;
    if (ctx.type === "tv") {
      ep = eps.find(
        (e) => Number(e.season) === Number(ctx.season) && Number(e.number) === Number(ctx.episode)
      );
    } else {
      ep = eps[0];
    }
    if (!ep) throw new Error("episodio/fonte nao encontrado");

    const watch = await j(
      `${base()}/movies/flixhq/watch?episodeId=${encodeURIComponent(ep.id)}&mediaId=${encodeURIComponent(result.id)}`
    );

    const sources = (watch.sources || []).map((s) => ({
      url: s.url,
      quality: s.quality || "auto",
      isM3U8: s.isM3U8 ?? /\.m3u8/i.test(s.url),
    }));
    const subtitles = (watch.subtitles || [])
      .filter((s) => s.url && !/thumbnail/i.test(s.lang || ""))
      .map((s) => ({ url: s.url, lang: s.lang, label: s.lang }));

    return { sources, subtitles, referer: watch.headers?.Referer || "" };
  },
};
