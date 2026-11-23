// Torrents: pesquisa, estado, remocao e transmissão do ficheiro de video.
//
// A rota (`routes/stream.js`) le os parametros e responde; aqui esta a regra:
// o que exige login (quem PROCURA e quem GERE), a forma obrigatoria do
// `infoHash` (vai para dentro de um magnet), e o `Range` que faz o video
// arrancar depressa.
import { searchAllTorrents } from "../services/providers/index.js";
import {
  getTorrentFile,
  getStatus,
  infoHashValido,
  listActive,
  priorizarPecas,
  removeTorrent,
  rememberMagnet,
} from "../services/torrentEngine.js";

// O hash tem a forma certa? 40 hexadecimais e' um `infoHash`; mais do que isso
// ou caracteres esquisitos nao sao. A razao de estar aqui e' o magnet: o valor
// vai parar a `magnet:?xt=urn:btih:<isto>`, e um parametro com `&tr=` dentro
// entrava como tracker (ou `&ws=` como servidor WebSocket).
export function hashValido(infoHash) {
  return infoHashValido(infoHash);
}

export async function buscarTorrents({ query }) {
  const { type, imdb, title, season, episode } = query;
  if (type !== "movie" && type !== "tv") {
    return { erro: "type tem de ser 'movie' ou 'tv'", status: 400 };
  }
  if (!imdb) {
    return { erro: "este titulo nao tem IMDB id", status: 400 };
  }
  if (type === "tv" && (season == null || episode == null)) {
    return { erro: "series precisam de season e episode", status: 400 };
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
  return { torrents: list.map(({ magnet: _magnet, ...rest }) => rest) };
}

// Estado de download de um torrent (para a barra de progresso).
export function estadoDoTorrent({ infoHash }) {
  if (!hashValido(infoHash)) return { erro: "infoHash invalido", status: 400 };
  return { status: getStatus(infoHash) };
}

// Lista de torrents ativos (a descarregar/reproduzir agora).
export function torrentsAtivos() {
  return { torrents: listActive() };
}

// Para de descarregar e remove um torrent (libera disco e ligacoes).
export async function removerTorrent({ infoHash }) {
  if (!hashValido(infoHash)) return { erro: "infoHash invalido", status: 400 };
  const removed = await removeTorrent(infoHash);
  if (!removed) return { erro: "torrent nao ativo", status: 404 };
  return { ok: true };
}

// Transmite o ficheiro de video com suporte a HTTP Range (seek/play progressivo).
//
// **NAO PODE EXIGIR LOGIN, PORQUEM:** um `<video src>` nao manda cabecalhos
// `Authorization`, e exigir login aqui era o mesmo que dizer "o video nao
// reproduz". O que o impede de ser um portal e' o motor: `addTorrent` so aceita
// um hash que o `/torrents` devolveu (`magnetConhecido`), e um hash com a forma
// errada nem chega la.
export async function servirVideo({ req, res, infoHash, fileIdx }) {
  if (!hashValido(infoHash)) return { erro: "infoHash invalido", status: 400 };

  const { torrent, file } = await getTorrentFile(infoHash, fileIdx);
  const total = file.length;
  const type = contentType(file.name);
  const range = req.headers.range;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    if (start >= total || end >= total || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      res.end();
      return null;
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
    return null;
  }

  // Sem `Range` e' o "tocar do inicio": marca o comeco do ficheiro, que e'
  // o que decide se o video arranca depressa ou aos soluancos.
  priorizarPecas(torrent, file, 0, null);
  res.writeHead(200, {
    "Content-Length": total,
    "Accept-Ranges": "bytes",
    "Content-Type": type,
  });
  pipe(file.createReadStream(), req, res);
  return null;
}

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