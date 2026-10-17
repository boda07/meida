import { Router } from "express";
import { searchAllTorrents } from "../services/providers/index.js";
import { requireAuth } from "../services/auth.js";
import {
  getTorrentFile,
  getStatus,
  infoHashValido,
  listActive,
  priorizarPecas,
  removeTorrent,
  rememberMagnet,
} from "../services/torrentEngine.js";

export const streamRouter = Router();

// ---------------------------------------------------------------------------
// QUEM PODE PEDIR O QUE
// ---------------------------------------------------------------------------
// Estas rotas custam dinheiro ao dono do servidor: cada `/stream/:infoHash` e'
// uma descarga a sério (largura de banda, disco, CPU) num alojamento gratis. E
// ate aqui `/api/stream/<o-que-quisesse>` era publico e sem validacao nenhuma —
// um portal de torrents aberto, com o `/stream/active` a listar o que toda a
// gente estava a ver e o `DELETE` a matar-lhe as descargas.
//
// A regra que ficou:
//   - o que se PROCURA (`/torrents`) e o que se GERE (o `DELETE`) exigem login;
//   - o que se REPRODUZ (`/stream/:infoHash`) nao pode exigir login, porque o
//     `<video src>` nao leva cabecalhos. A garantia ai e' outra: o hash tem de ter
//     a forma certa e ter vindo da busca (ver `addTorrent` no motor).
streamRouter.get("/torrents", requireAuth, async (req, res, next) => {
  try {
    const { type, imdb, title, season, episode } = req.query;
    if (type !== "movie" && type !== "tv") {
      return res.status(400).json({ error: "type tem de ser 'movie' ou 'tv'" });
    }
    if (!imdb) {
      return res.status(400).json({ error: "este titulo nao tem IMDB id" });
    }
    if (type === "tv" && (season == null || episode == null)) {
      return res.status(400).json({ error: "series precisam de season e episode" });
    }

    const list = await searchAllTorrents({
      type,
      imdb,
      title: typeof title === "string" ? title : undefined,
      season: Number(season),
      episode: Number(episode),
    });
    // Guardamos o magnet completo no servidor; ao frontend so vao os metadados.
    for (const t of list) rememberMagnet(t.infoHash, t.magnet);
    res.json({ torrents: list.map(({ magnet: _magnet, ...rest }) => rest) });
  } catch (err) {
    next(err);
  }
});

// O hash tem a forma certa? 40 hexadecimais e' um `infoHash`; mais do que isso
// ou caracteres esquisitos nao sao. A razao de estar aqui e' o magnet: o valor
// vai parar a `magnet:?xt=urn:btih:<isto>`, e um parametro com `&tr=` dentro
// entrava como tracker (ou `&ws=` como servidor WebSocket).
function hashMalFormado(res, infoHash) {
  if (infoHashValido(infoHash)) return false;
  res.status(400).json({ error: "infoHash invalido" });
  return true;
}

// Estado de download de um torrent (para a barra de progresso).
streamRouter.get("/stream/:infoHash/status", (req, res) => {
  if (hashMalFormado(res, req.params.infoHash)) return;
  res.json({ status: getStatus(req.params.infoHash) });
});

// Lista de torrents ativos (a descarregar/reproduzir agora).
// Exige login: sem ele, qualquer pessoa sabia o que toda a gente estava a ver.
streamRouter.get("/stream/active", requireAuth, (_req, res) => {
  res.json({ torrents: listActive() });
});

// Para de descarregar e remove um torrent (libera disco e ligacoes).
// Exige login: sem ele, dava para matar as descargas dos outros.
streamRouter.delete("/stream/:infoHash", requireAuth, async (req, res, next) => {
  try {
    if (hashMalFormado(res, req.params.infoHash)) return;
    const removed = await removeTorrent(req.params.infoHash);
    if (!removed) return res.status(404).json({ error: "torrent nao ativo" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Transmite o ficheiro de video com suporte a HTTP Range (seek/play progressivo).
//
// **NAO PODE EXIGIR LOGIN, PORQUEM:** um `<video src>` nao manda cabecalhos
// `Authorization`, e exigir login aqui era o mesmo que dizer "o video nao
// reproduz". O que o impede de ser um portal e' o motor: `addTorrent` so aceita
// um hash que o `/torrents` devolveu (`magnetConhecido`), e um hash com a forma
// errada nem chega la.
streamRouter.get("/stream/:infoHash", async (req, res, next) => {
  try {
    const { infoHash } = req.params;
    if (hashMalFormado(res, infoHash)) return;
    const { torrent, file } = await getTorrentFile(infoHash, req.query.fileIdx);
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
      // As pecas que este pedido vai ler entram na fila como prioritarias.
      priorizarPecas(torrent, file, start, end);
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": type,
      });
      pipe(file.createReadStream({ start, end }), req, res);
    } else {
      // Sem `Range` e' o "tocar do inicio": marca o comeco do ficheiro, que e'
      // o que decide se o video arranca depressa ou aos soluancos.
      priorizarPecas(torrent, file, 0, null);
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
