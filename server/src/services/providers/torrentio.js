// Provider: Torrentio (Stremio addon público).
// Funciona para filmes E séries, usa IMDB id.
const TORRENTIO = "https://torrentio.strem.fun";

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.tracker.cl:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "udp://explodie.org:6969/announce",
];

function buildMagnet(infoHash, sources = []) {
  const trackers = new Set(TRACKERS);
  for (const s of sources) {
    if (typeof s === "string" && s.startsWith("tracker:")) {
      trackers.add(s.slice("tracker:".length));
    }
  }
  const tr = [...trackers].map((t) => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

function parseStream(s) {
  if (!s.infoHash) return null;
  const name = s.name || "";
  const title = s.title || "";
  const full = name + "\n" + title;
  const qMatch = full.match(/\b(4K|2160p|1080p|720p|480p|360p)\b/i);
  const seedMatch = title.match(/👤\s*(\d+)/);
  const sizeMatch = title.match(/💾\s*([\d.]+\s*[KMGT]B)/i);
  const fileName = title.split("\n")[0].trim();

  let quality = qMatch ? qMatch[1].toUpperCase() : "?";
  if (quality === "2160P") quality = "4K";

  const dual = /\b(dual|multi)[\s._-]?audio\b/i.test(full);
  const dub = dual || /\bdub(bed)?\b/i.test(full);

  const realFile = (s.behaviorHints?.filename || fileName || "").replace(/\.$/, "");
  const ext = (realFile.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();

  const playable = ext === "mp4" || ext === "webm" || ext === "m4v";
  const codec = /\bx?265\b|hevc/i.test(full) ? "x265" : /\bav1\b/i.test(full) ? "AV1" : /\bx?264\b|avc/i.test(full) ? "x264" : null;

  return {
    infoHash: s.infoHash,
    fileIdx: s.fileIdx ?? null,
    quality,
    seeders: seedMatch ? Number(seedMatch[1]) : null,
    size: sizeMatch ? sizeMatch[1].replace(/\s+/, " ") : null,
    title: fileName || name,
    dub,
    dual,
    ext,
    codec,
    playable,
    magnet: buildMagnet(s.infoHash, s.sources),
    provider: "torrentio",
  };
}

export const torrentio = {
  id: "torrentio",
  name: "Torrentio",
  movies: true,
  tv: true,

  async search({ type, imdb, season, episode }) {
    const path =
      type === "movie"
        ? `/stream/movie/${imdb}.json`
        : `/stream/series/${imdb}:${season}:${episode}.json`;

    const res = await fetch(TORRENTIO + path);
    if (!res.ok) throw new Error(`Torrentio respondeu ${res.status}`);
    const data = await res.json();
    return (data.streams || []).map(parseStream).filter(Boolean);
  },
};
