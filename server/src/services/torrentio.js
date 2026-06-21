// Consulta o addon publico Torrentio para obter torrents por IMDB id.
// Movie:  /stream/movie/{imdb}.json
// Series: /stream/series/{imdb}:{season}:{episode}.json
const TORRENTIO = "https://torrentio.strem.fun";

// Trackers publicos para enriquecer os magnets (mais peers, liga mais rapido).
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

// Extrai qualidade/seeders/tamanho dos campos de texto do Torrentio.
function parseStream(s) {
  if (!s.infoHash) return null;
  const name = s.name || "";
  const title = s.title || "";
  const qMatch = (name + " " + title).match(/\b(4K|2160p|1080p|720p|480p|360p)\b/i);
  const seedMatch = title.match(/👤\s*(\d+)/);
  const sizeMatch = title.match(/💾\s*([\d.]+\s*[KMGT]B)/i);
  const fileName = title.split("\n")[0].trim();

  // Normaliza 2160p -> 4K para o filtro ser consistente.
  let quality = qMatch ? qMatch[1].toUpperCase() : "?";
  if (quality === "2160P") quality = "4K";

  return {
    infoHash: s.infoHash,
    fileIdx: s.fileIdx ?? null,
    quality,
    seeders: seedMatch ? Number(seedMatch[1]) : null,
    size: sizeMatch ? sizeMatch[1].replace(/\s+/, " ") : null,
    title: fileName || name,
    magnet: buildMagnet(s.infoHash, s.sources),
  };
}

export async function getTorrents({ type, imdb, season, episode }) {
  if (!imdb) return [];
  const path =
    type === "movie"
      ? `/stream/movie/${imdb}.json`
      : `/stream/series/${imdb}:${season}:${episode}.json`;

  const res = await fetch(TORRENTIO + path);
  if (!res.ok) throw new Error(`Torrentio respondeu ${res.status}`);
  const data = await res.json();
  return (data.streams || []).map(parseStream).filter(Boolean);
}
