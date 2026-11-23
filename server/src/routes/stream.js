// Torrents: pesquisa, estado, remoção e transmissão do video.
//
// Rota fina: le os parametros, chama o handler e responde. A regra esta em
// `handlers/stream.js`.
//
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
import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import {
  buscarTorrents,
  estadoDoTorrent,
  torrentsAtivos,
  removerTorrent,
  servirVideo,
} from "../handlers/stream.js";

export const streamRouter = Router();

// Os handlers devolvem `{ erro, status }` quando o pedido nao passa; o resto e'
// o corpo da resposta tal e qual.
function responder(res, r) {
  if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
  return res.json(r);
}

streamRouter.get("/torrents", requireAuth, async (req, res, next) => {
  try {
    responder(res, await buscarTorrents({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Estado de download de um torrent (para a barra de progresso).
streamRouter.get("/stream/:infoHash/status", (req, res) => {
  responder(res, estadoDoTorrent({ infoHash: req.params.infoHash }));
});

// Lista de torrents ativos (a descarregar/reproduzir agora).
streamRouter.get("/stream/active", requireAuth, (_req, res) => {
  responder(res, torrentsAtivos());
});

// Para de descarregar e remove um torrent (libera disco e ligacoes).
streamRouter.delete("/stream/:infoHash", requireAuth, async (req, res, next) => {
  try {
    responder(res, await removerTorrent({ infoHash: req.params.infoHash }));
  } catch (err) {
    next(err);
  }
});

// Transmite o ficheiro de video com suporte a HTTP Range (seek/play progressivo).
streamRouter.get("/stream/:infoHash", async (req, res, next) => {
  try {
    const r = await servirVideo({
      req,
      res,
      infoHash: req.params.infoHash,
      fileIdx: req.query.fileIdx,
    });
    if (r?.erro) res.status(r.status || 400).json({ error: r.erro });
  } catch (err) {
    next(err);
  }
});