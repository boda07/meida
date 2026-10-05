import os from "node:os";
import { resolve } from "node:path";

import { log } from "./log.js";

// Onde os pedacos descarregados sao guardados (temporario do sistema).
const DOWNLOAD_DIR = resolve(os.tmpdir(), "streamapp-torrents");

// O WebTorrent e' opcional. Depende do node-datachannel, que tem um binario
// nativo (.node) especifico da arquitectura; em Windows, se o binario for de
// outra arquitectura, o Node morre com
//
//   Error: node_datachannel.node is not a valid Win32 application
//
// O import era ESTATICO, por isso o servidor morria ao arrancar e a janela da
// app ficava preta. Agora carrega em silencio: se falhar, o resto da app
// funciona e so as funcionalidades de torrent ficam indisponiveis.
let client = null;
let motivo = "";
let tentativaFeita = false;

async function carregar() {
  if (client || tentativaFeita) return client;
  tentativaFeita = true;
  try {
    const mod = await import("webtorrent");
    const WebTorrent = mod.default || mod;
    client = new WebTorrent();
    client.on("error", (e) => log.error("webtorrent", e.message));
    log.info("webtorrent", "torrents disponiveis.");
  } catch (e) {
    motivo = e?.message || String(e);
    log.warn(
      "webtorrent",
      `Torrents indisponiveis neste PC (${motivo}). O resto da app funciona.`
    );
  }
  return client;
}

export function torrentsDisponiveis() {
  return !!client;
}

export function motivoIndisponivel() {
  return motivo;
}

// infoHash -> magnet completo (com trackers), preenchido quando listamos torrents.
const magnetCache = new Map();
const VIDEO_RE = /\.(mp4|m4v|mkv|webm|avi|mov|ts|mpg|mpeg|wmv|flv)$/i;

export function rememberMagnet(infoHash, magnet) {
  magnetCache.set(infoHash.toLowerCase(), magnet);
}

export function getMagnet(infoHash) {
  const m = magnetCache.get(infoHash.toLowerCase());
  return m || `magnet:?xt=urn:btih:${infoHash}`;
}

function findTorrent(key) {
  if (!client) return null;
  return client.torrents.find((t) => t.infoHash?.toLowerCase() === key);
}

// Adiciona (ou reutiliza) um torrent e resolve quando estiver pronto.
async function addTorrent(infoHash) {
  const c = await carregar();
  if (!c) throw new Error(`Torrents indisponiveis: ${motivo}`);
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
    const t = c.add(torrentId, { path: DOWNLOAD_DIR }, (torrent) => res(torrent));
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
  if (!client) return null;
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

// Torrents ativos (a descarregar/reproduzir), para a lista "a gerir".
export function listActive() {
  if (!client) return [];
  return client.torrents.map((t) => {
    const name =
      t.files.find((f) => VIDEO_RE.test(f.name))?.name || t.name || "?";
    return {
      infoHash: t.infoHash,
      name,
      progress: Math.round(t.progress * 1000) / 10,
      downloadSpeed: t.downloadSpeed,
      peers: t.numPeers,
    };
  });
}

// Para de descarregar e remove o torrent (limpa ficheiros do disco).
export function removeTorrent(infoHash) {
  if (!client) return false;
  const t = findTorrent(infoHash.toLowerCase());
  if (!t) return false;
  return new Promise((res) => {
    t.destroy({ destroyStore: true }, () => res(true));
  });
}
