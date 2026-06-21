import WebTorrent from "webtorrent";
import os from "node:os";
import { resolve } from "node:path";

// Onde os pedacos descarregados sao guardados (temporario do sistema).
const DOWNLOAD_DIR = resolve(os.tmpdir(), "streamapp-torrents");

const client = new WebTorrent();
client.on("error", (e) => console.error("[webtorrent]", e.message));

// infoHash -> magnet completo (com trackers), preenchido quando listamos torrents.
const magnetCache = new Map();
const VIDEO_RE = /\.(mp4|m4v|mkv|webm|avi|mov|ts|mpg|mpeg|wmv|flv)$/i;

export function rememberMagnet(infoHash, magnet) {
  magnetCache.set(infoHash.toLowerCase(), magnet);
}

function findTorrent(key) {
  return client.torrents.find((t) => t.infoHash?.toLowerCase() === key);
}

// Adiciona (ou reutiliza) um torrent e resolve quando estiver pronto.
function addTorrent(infoHash) {
  const key = infoHash.toLowerCase();
  const existing = findTorrent(key);
  if (existing) {
    return existing.ready
      ? Promise.resolve(existing)
      : new Promise((res, rej) => {
          existing.once("ready", () => res(existing));
          existing.once("error", rej);
        });
  }
  const torrentId = magnetCache.get(key) || `magnet:?xt=urn:btih:${infoHash}`;
  return new Promise((res, rej) => {
    const t = client.add(torrentId, { path: DOWNLOAD_DIR }, (torrent) => res(torrent));
    t.once("error", rej);
  });
}

function pickFile(torrent, fileIdx) {
  const idx = fileIdx != null && fileIdx !== "" ? Number(fileIdx) : null;
  if (idx != null && torrent.files[idx]) return torrent.files[idx];
  const vids = torrent.files.filter((f) => VIDEO_RE.test(f.name));
  const pool = vids.length ? vids : torrent.files;
  return pool.reduce((a, b) => (b.length > a.length ? b : a), pool[0]);
}

// Resolve o ficheiro de video a transmitir, descarregando SO esse ficheiro
// (importante nos packs/batches de anime: nao puxa a serie inteira).
export async function getTorrentFile(infoHash, fileIdx) {
  const torrent = await addTorrent(infoHash);
  const file = pickFile(torrent, fileIdx);
  // Limpa a selecao global que o WebTorrent cria ao adicionar o torrent...
  try {
    torrent.deselect(0, torrent.pieces.length - 1, false);
  } catch {
    /* versoes antigas: ignora */
  }
  // ...e deixa selecionado apenas o ficheiro do episodio escolhido.
  for (const f of torrent.files) if (f !== file) f.deselect?.();
  file.select?.();
  return { torrent, file };
}

export function getStatus(infoHash) {
  const t = findTorrent(infoHash.toLowerCase());
  if (!t) return null;
  return {
    progress: Math.round(t.progress * 1000) / 10,
    downloadSpeed: t.downloadSpeed,
    peers: t.numPeers,
    downloaded: t.downloaded,
    length: t.length,
    ready: t.ready,
  };
}
