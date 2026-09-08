// Provider: YTS (filmes, 720p/1080p/4K, sem séries). Usa a API pública v2.
// O domínio principal muda com frequência, por isso tenta vários espelhos até
// um responder. Busca por título.
const MIRRORS = [
  "https://yts.lt",
  "https://yts.mx",
  "https://yts.rs",
  "https://yify.top",
];

function parseQuality(label) {
  const q = (label || "").toUpperCase();
  if (q.includes("2160")) return "4K";
  if (q.includes("1080")) return "1080P";
  if (q.includes("720")) return "720P";
  if (q.includes("480")) return "480P";
  if (q.includes("360")) return "360P";
  return "?";
}

export const yts = {
  id: "yts",
  name: "YTS",
  movies: true,
  tv: false,

  async search({ type, title }) {
    if (type !== "movie" || !title) return [];

    let lastErr = null;
    for (const mirror of MIRRORS) {
      try {
        const url = new URL("/api/v2/list_movies.json", mirror);
        url.searchParams.set("query_term", title);
        url.searchParams.set("limit", "20");
        url.searchParams.set("sort_by", "seeds");
        url.searchParams.set("order_by", "desc");

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`YTS (${mirror}) respondeu ${res.status}`);
        const data = await res.json();
        const movies = data?.data?.movies || [];

        return movies.flatMap((m) => {
          const torrents = (m.torrents || []).filter((t) => t && t.hash);
          return torrents.map((t) => {
            const quality = parseQuality(t.quality);
            const bytes = Number(t.size_bytes) || 0;
            const gb = bytes / 1e9;
            const size = gb >= 1 ? `${gb.toFixed(2).replace(".", ",")} GB` : `${Math.round(bytes / 1e6)} MB`;
            const infoHash = t.hash.toLowerCase();
            return {
              infoHash,
              fileIdx: null,
              quality,
              seeders: t.seeds ?? null,
              size: (t.size && t.size !== "0 B") ? t.size : size,
              title: `${m.title} (${m.year})`,
              dub: false,
              dual: false,
              ext: "mp4",
              codec: "x264",
              playable: true, // YTS é sempre mp4 -> reproduz no browser
              magnet: `magnet:?xt=urn:btih:${infoHash}`,
              provider: "yts",
            };
          });
        });
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("Todos os mirrors do YTS falharam");
  },
};
