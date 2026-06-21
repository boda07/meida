import { Router } from "express";
import { getTorrents } from "../services/torrentio.js";
import {
  getTorrentFile,
  getStatus,
  rememberMagnet,
} from "../services/torrentEngine.js";

export const streamRouter = Router();

// Lista de torrents para um titulo (via Torrentio).
streamRouter.get("/torrents", async (req, res, next) => {
  try {
    const { type, imdb, season, episode } = req.query;
    if (type !== "movie" && type !== "tv") {
      return res.status(400).json({ error: "type tem de ser 'movie' ou 'tv'" });
    }
    if (!imdb) {
      return res.status(400).json({ error: "este titulo nao tem IMDB id" });
    }
    if (type === "tv" && (season == null || episode == null)) {
      return res.status(400).json({ error: "series precisam de season e episode" });
    }

    const list = await getTorrents({
      type,
      imdb,
      season: Number(season),
      episode: Number(episode),
    });
    // Guardamos o magnet completo no servidor; ao frontend so vao os metadados.
    for (const t of list) rememberMagnet(t.infoHash, t.magnet);
    res.json({ torrents: list.map(({ magnet, ...rest }) => rest) });
  } catch (err) {
    next(err);
  }
});

// Estado de download de um torrent (para a barra de progresso).
streamRouter.get("/stream/:infoHash/status", (req, res) => {
  res.json({ status: getStatus(req.params.infoHash) });
});

// Transmite o ficheiro de video com suporte a HTTP Range (seek/play progressivo).
streamRouter.get("/stream/:infoHash", async (req, res, next) => {
  try {
    const { infoHash } = req.params;
    const { file } = await getTorrentFile(infoHash, req.query.fileIdx);
    const total = file.length;
    const type = contentType(file.name);
    const range = req.headers.range;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
      if (start >= total || end >= total || start > end) {
        res.writeHead(416, { "Content-Range": `bytes */${total}` });
        return res.end();
      }
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": type,
      });
      pipe(file.createReadStream({ start, end }), req, res);
    } else {
      res.writeHead(200, {
        "Content-Length": total,
        "Accept-Ranges": "bytes",
        "Content-Type": type,
      });
      pipe(file.createReadStream(), req, res);
    }
  } catch (err) {
    next(err);
  }
});

function pipe(stream, req, res) {
  stream.on("error", () => res.destroy());
  req.on("close", () => stream.destroy());
  stream.pipe(res);
}

function contentType(name) {
  if (/\.(mp4|m4v)$/i.test(name)) return "video/mp4";
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.mkv$/i.test(name)) return "video/x-matroska";
  if (/\.avi$/i.test(name)) return "video/x-msvideo";
  if (/\.(mov)$/i.test(name)) return "video/quicktime";
  return "application/octet-stream";
}
