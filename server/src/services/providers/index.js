import { torrentio } from "./torrentio.js";
import { yts } from "./yts.js";

// Todos os providers de torrents registados. Cada um:
//   { id, name, movies: bool, tv: bool, search: (ctx) => Promise<torrent[]> }
// `ctx` = { type, imdb, season, episode, title }.
export const torrentProviders = [torrentio, yts];

// Pede torrents de todos os providers que suportam o tipo pedido e junta tudo.
// Providers que falham são ignorados (log de aviso) para um ponto não partir tudo.
export async function searchAllTorrents(ctx, log = console.warn) {
  const results = [];
  const jobs = torrentProviders
    .filter((p) => (ctx.type === "movie" ? p.movies : p.tv))
    .map(async (p) => {
      try {
        const list = await p.search(ctx);
        return list;
      } catch (err) {
        log(`[torrents] provider ${p.id} falhou: ${err?.message || err}`);
        return [];
      }
    });

  const settled = await Promise.all(jobs);
  for (const list of settled) results.push(...list);

  // Remove duplicados por infoHash (fica com o primeiro — normalmente o que já
  // tem mais metadata). Mantém a ordem: providers de cima têm prioridade.
  const seen = new Set();
  return results.filter((t) => {
    const k = t.infoHash;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
