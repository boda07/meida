import { Router } from "express";
import { extractStream, extractEnabled } from "../services/extractor/index.js";
import { extractAnime, animeExtractorEnabled } from "../services/animeStream.js";
import {
  extrairMegaPlayNativo,
  embedUrlValido,
  tracksParaSubtitulos,
} from "../services/megaplayNativo.js";
import { handleProxy, buildProxyUrl, buildSubtitleVttUrl, assinaturaValida, alvoSeguro } from "../services/proxy.js";
import { rateLimiter } from "../services/rateLimit.js";
import {
  searchSubtitles,
  fetchSubtitleAsVtt,
  subtitlesEnabled,
  getSubtitleVttCached,
} from "../services/subtitles.js";

export const playRouter = Router();

// Proxy HLS/CORS (m3u8 + segmentos). Limitado por IP para nao ser um proxy
// gratis para qualquer um; 300 pedidos/10s e' muito acima do que uma
// reproducao HLS precisa (playlist + segmentos esparcidos).
playRouter.get("/proxy", rateLimiter(300, 10_000), handleProxy);

// O extrator de anime (player proprio) esta configurado?
playRouter.get("/anime/enabled", (req, res) => {
  res.json({ enabled: animeExtractorEnabled() });
});

// O extrator "Sem anuncios" de filmes/series (Consumet) esta configurado?
playRouter.get("/extract/enabled", (req, res) => {
  res.json({ enabled: extractEnabled() });
});

// Reprodução NATIVA do MegaPlay: da' o m3u8 e as legendas em claro, sem
// iframe. E' o que resolve os dois problemas do iframe (ver
// services/megaplayNativo.js): as legendas passam a ser nossas (com escolha de
// idioma) e o play/pausa passa a sincronizar no Watch Party, porque nao ha'
// cross-origin pelo meio.
//
// Devolve `native: false` (e nao um erro) quando nao consegue: quem chama
// mostra o iframe como estava, que continua a funcionar.
playRouter.get("/anime/megaplay", async (req, res) => {
  const { url, audio } = req.query;
  if (!url) return res.status(400).json({ error: "falta o parametro url" });

  // O URL vem do cliente e esta rota e' publica: sem esta porta, `lerDataId`
  // fazia `fetch` ao que lhe dessem (um SSRF cego — 2026-10-19). So o MegaPlay
  // serve; o resto e' 400, e nao um `native: false` que parece "o site nao tem".
  if (!embedUrlValido(url)) {
    return res.status(400).json({ error: "url tem de ser https://megaplay.buzz/stream/..." });
  }

  const r = await extrairMegaPlayNativo({ embedUrl: String(url), audio });
  if (!r) return res.json({ native: false });

  res.json({
    native: true,
    audio: r.audio,
    intro: r.intro,
    outro: r.outro,
    // O m3u8 vai pelo nosso proxy: e' ele que poem o `Referer` que o MegaPlay
    // exige e que reescreve os segmentos da playlist tambem por aqui.
    sources: [{ isM3U8: true, url: buildProxyUrl(r.m3u8, "https://megaplay.buzz/") }],
    subtitles: tracksParaSubtitulos(r.tracks).map((s) => ({
      ...s,
      url: buildProxyUrl(s.url, "https://megaplay.buzz/"),
    })),
  });
});

// Extrai stream + legendas de um episodio de anime (player proprio).
playRouter.get("/anime/extract", async (req, res) => {
  try {
    const { title, episode, audio } = req.query;
    if (!animeExtractorEnabled()) {
      return res.status(400).json({ error: "Extrator de anime nao configurado." });
    }
    if (!title) return res.status(400).json({ error: "falta title" });

    const r = await extractAnime({
      title: String(title),
      episode: Number(episode) || 1,
      audio,
    });
    const ref = r.referer || "";
    const sources = r.sources.map((s) => ({
      isM3U8: s.isM3U8,
      url: s.isM3U8 ? buildProxyUrl(s.url, ref) : s.url,
    }));
    const subtitles = (r.subtitles || []).map((sub) => ({
      lang: sub.lang,
      label: sub.label || sub.lang,
      default: sub.default,
      url: buildSubtitleVttUrl(sub.url),
      source: "hianime",
    }));
    res.json({ provider: r.provider, sources, subtitles, intro: r.intro, outro: r.outro });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Extrai stream sem anuncios e devolve URLs ja encaminhadas pelo proxy.
playRouter.get("/extract", async (req, res) => {
  try {
    const { type, tmdb, imdb, title, year, season, episode } = req.query;
    if (type !== "movie" && type !== "tv") {
      return res.status(400).json({ error: "type tem de ser 'movie' ou 'tv'" });
    }
    if (!tmdb || !title) {
      return res.status(400).json({ error: "faltam tmdb e title" });
    }

    const ctx = {
      type,
      tmdb,
      imdb,
      title,
      year,
      season: season != null ? Number(season) : undefined,
      episode: episode != null ? Number(episode) : undefined,
    };
    const result = await extractStream(ctx);
    const ref = result.referer || "";

    // m3u8 -> via proxy (resolve CORS/Referer no browser).
    const sources = result.sources.map((s) => ({
      quality: s.quality,
      isM3U8: s.isM3U8,
      url: s.isM3U8 ? buildProxyUrl(s.url, ref) : s.url,
    }));
    // legendas do stream -> via /subtitles/vtt (convertidas para VTT).
    const subtitles = (result.subtitles || []).map((sub) => ({
      lang: sub.lang,
      label: sub.label || sub.lang,
      url: buildSubtitleVttUrl(sub.url),
      source: "stream",
    }));

    res.json({ provider: result.provider, sources, subtitles });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Lista legendas do OpenSubtitles para um titulo.
playRouter.get("/subtitles", async (req, res, next) => {
  try {
    const { imdb, season, episode, languages } = req.query;
    if (!subtitlesEnabled()) {
      return res.json({ enabled: false, subtitles: [] });
    }
    const list = await searchSubtitles({
      imdb,
      season: season != null ? Number(season) : undefined,
      episode: episode != null ? Number(episode) : undefined,
      languages,
    });
    res.json({
      enabled: true,
      subtitles: list.map((s) => ({
        lang: s.lang,
        label: s.label,
        url: `/api/subtitles/download/${s.fileId}`,
        source: "opensubtitles",
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Descarrega uma legenda do OpenSubtitles (devolve VTT, com cache/retry).
playRouter.get("/subtitles/download/:fileId", async (req, res) => {
  try {
    const vtt = await getSubtitleVttCached(req.params.fileId);
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(vtt);
  } catch (err) {
    res.status(500).send(`WEBVTT\n\nNOTE erro: ${err.message}`);
  }
});

// Converte uma legenda de um URL externo (do extractor) para VTT.
// Limitado: legendas sao pedidas poucas vezes por episodio.
// Exige assinatura valida (mesmo modelo do /api/proxy), nao segue IPs
// internos e corta respostas acima de 2 MB.
playRouter.get("/subtitles/vtt", rateLimiter(20, 60_000), async (req, res) => {
  try {
    const { url, ts, sig } = req.query;
    if (!url || !ts || !sig || !assinaturaValida(url, ts, sig)) {
      return res.status(403).json({ error: "legendas requerem assinatura valida" });
    }

    // `async` desde 2026-10-19: o `alvoSeguro` resolve o nome do hostname.
    const seguro = await alvoSeguro(url);
    if (!seguro.ok) {
      return res.status(403).json({ error: seguro.motivo });
    }

    const vtt = await fetchSubtitleAsVtt(url);
    if (Buffer.byteLength(vtt) > 2 * 1024 * 1024) {
      return res.status(413).json({ error: "legenda excede o limite de 2 MB" });
    }
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(vtt);
  } catch (err) {
    res.status(500).send(`WEBVTT\n\nNOTE erro: ${err.message}`);
  }
});
