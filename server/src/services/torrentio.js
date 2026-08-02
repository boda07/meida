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
  const full = name + "\n" + title; // texto todo (nome da release + ficheiro + etiquetas)
  const qMatch = full.match(/\b(4K|2160p|1080p|720p|480p|360p)\b/i);
  const seedMatch = title.match(/👤\s*(\d+)/);
  const sizeMatch = title.match(/💾\s*([\d.]+\s*[KMGT]B)/i);
  const fileName = title.split("\n")[0].trim();

  // Normaliza 2160p -> 4K para o filtro ser consistente.
  let quality = qMatch ? qMatch[1].toUpperCase() : "?";
  if (quality === "2160P") quality = "4K";

  // Audio (anime): o Torrentio marca "Dubbed"/"Dual Audio" numa linha do titulo.
  // A etiqueta esta no titulo COMPLETO (release + linha de idiomas), nao so no
  // nome do ficheiro do episodio — por isso usamos `full` para detetar.
  const dual = /\b(dual|multi)[\s._-]?audio\b/i.test(full);
  const dub = dual || /\bdub(bed)?\b/i.test(full); // tem faixa dobrada presente

  // Nome real do ficheiro (o Torrentio coloca-o em behaviorHints.filename; cai
  // para a 1a linha do titulo se nao estiver la). Usado para detetar o container.
  const realFile = (s.behaviorHints?.filename || fileName || "").replace(/\.$/, "");
  const ext = (realFile.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();

  // Container reproduzivel nativamente no browser? (mp4/webm sim; mkv/avi etc nao)
  const playable = ext === "mp4" || ext === "webm" || ext === "m4v";
  const codec = /\bx?265\b|hevc/i.test(full) ? "x265" : /\bav1\b/i.test(full) ? "AV1" : /\bx?264\b|avc/i.test(full) ? "x264" : null;

  return {
    infoHash: s.infoHash,
    fileIdx: s.fileIdx ?? null,
    quality,
    seeders: seedMatch ? Number(seedMatch[1]) : null,
    size: sizeMatch ? sizeMatch[1].replace(/\s+/, " ") : null,
    title: fileName || name,
    dub, // inclui dual audio (tem dobragem disponivel)
    dual, // tem ambas as faixas (legendada + dobrada)
    ext, // .mkv, .mp4, ...
    codec, // x264 | x265 | AV1 | null
    playable, // true se o browser reproduz nativamente (mp4/webm)
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
