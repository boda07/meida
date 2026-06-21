import { Router } from "express";
import { extractStream } from "../services/extractor/index.js";
import { handleProxy, buildProxyUrl } from "../services/proxy.js";
import {
  searchSubtitles,
  getSubtitleVtt,
  fetchSubtitleAsVtt,
  subtitlesEnabled,
} from "../services/subtitles.js";

export const playRouter = Router();

// Proxy HLS/CORS (m3u8 + segmentos).
playRouter.get("/proxy", handleProxy);

// Extrai stream sem anuncios e devolve URLs ja encaminhadas pelo proxy.
playRouter.get("/extract", async (req, res, next) => {
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
      url: `/api/subtitles/vtt?url=${encodeURIComponent(sub.url)}`,
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

// Descarrega uma legenda do OpenSubtitles (devolve VTT).
playRouter.get("/subtitles/download/:fileId", async (req, res, next) => {
  try {
    const vtt = await getSubtitleVtt(req.params.fileId);
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(vtt);
  } catch (err) {
    res.status(500).send(`WEBVTT\n\nNOTE erro: ${err.message}`);
  }
});

// Converte uma legenda de um URL externo (do extractor) para VTT.
playRouter.get("/subtitles/vtt", async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "falta url" });
    const vtt = await fetchSubtitleAsVtt(url);
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(vtt);
  } catch (err) {
    res.status(500).send(`WEBVTT\n\nNOTE erro: ${err.message}`);
  }
});
