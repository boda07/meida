// Reproducao: extracao de streams, MegaPlay nativo, proxy HLS e legendas.
//
// Rota fina: le os parametros, chama o handler e responde. A regra esta em
// `handlers/play.js`; o proxy HLS e' o handler que ja existia em
// `services/proxy.js`.
import { Router } from "express";
import { handleProxy } from "../services/proxy.js";
import { rateLimiter } from "../services/rateLimit.js";
import {
  animeAtivo,
  extractAtivo,
  megaplay,
  extrairAnime,
  extrair,
  legendas,
  legendaVtt,
  legendaDoUrl,
} from "../handlers/play.js";

export const playRouter = Router();

// Os handlers devolvem `{ erro, status }` quando o pedido nao passa; o resto e'
// o corpo da resposta tal e qual.
function responder(res, r) {
  if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
  return res.json(r);
}

// Proxy HLS/CORS (m3u8 + segmentos). Limitado por IP para nao ser um proxy
// gratis para qualquer um; 300 pedidos/10s e' muito acima do que uma
// reproducao HLS precisa (playlist + segmentos esparcidos).
playRouter.get("/proxy", rateLimiter(300, 10_000), handleProxy);

playRouter.get("/anime/enabled", (_req, res) => {
  responder(res, animeAtivo());
});

playRouter.get("/extract/enabled", (_req, res) => {
  responder(res, extractAtivo());
});

// Reproducao nativa do MegaPlay (m3u8 + legendas em claro, sem iframe).
playRouter.get("/anime/megaplay", async (req, res, next) => {
  try {
    responder(res, await megaplay({ url: req.query.url, audio: req.query.audio }));
  } catch (err) {
    next(err);
  }
});

// Extrai stream + legendas de um episodio de anime (player proprio).
playRouter.get("/anime/extract", async (req, res, next) => {
  try {
    const { title, episode, audio } = req.query;
    responder(res, await extrairAnime({ title, episode, audio }));
  } catch (err) {
    next(err);
  }
});

// Extrai stream sem anuncios e devolve URLs ja encaminhadas pelo proxy.
playRouter.get("/extract", async (req, res, next) => {
  try {
    responder(res, await extrair({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Lista legendas do OpenSubtitles para um titulo.
playRouter.get("/subtitles", async (req, res, next) => {
  try {
    responder(res, await legendas({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Descarrega uma legenda do OpenSubtitles (devolve VTT, com cache/retry).
playRouter.get("/subtitles/download/:fileId", async (req, res) => {
  try {
    const { vtt } = await legendaVtt({ fileId: req.params.fileId });
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(vtt);
  } catch (err) {
    res.status(500).send(`WEBVTT\n\nNOTE erro: ${err.message}`);
  }
});

// Converte uma legenda de um URL externo (do extractor) para VTT.
// Limitado: legendas sao pedidas poucas vezes por episodio.
playRouter.get("/subtitles/vtt", rateLimiter(20, 60_000), async (req, res) => {
  try {
    const { url, ts, sig } = req.query;
    const r = await legendaDoUrl({ url, ts, sig });
    if (r.erro) return res.status(r.status || 403).json({ error: r.erro });
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(r.vtt);
  } catch (err) {
    res.status(500).send(`WEBVTT\n\nNOTE erro: ${err.message}`);
  }
});