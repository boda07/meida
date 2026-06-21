import { config } from "../config.js";

const OS = "https://api.opensubtitles.com/api/v1";

function headers(extra = {}) {
  return {
    "Api-Key": config.openSubtitlesKey,
    "User-Agent": "StreamApp v0.1",
    Accept: "application/json",
    ...extra,
  };
}

export function subtitlesEnabled() {
  return Boolean(config.openSubtitlesKey);
}

// Converte SRT em VTT (o <track> do browser so aceita VTT).
export function toVtt(text) {
  const clean = text.replace(/^﻿/, "").replace(/\r+/g, "");
  if (/^WEBVTT/.test(clean.trimStart())) return clean;
  const body = clean.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2"
  );
  return "WEBVTT\n\n" + body;
}

// Pesquisa legendas no OpenSubtitles por IMDB id (+ temporada/episodio).
export async function searchSubtitles({ imdb, season, episode, languages }) {
  if (!subtitlesEnabled() || !imdb) return [];
  const id = String(imdb).replace(/^tt/i, "");
  const params = new URLSearchParams({ languages: languages || "pt,pt-br,en" });
  if (season && episode) {
    params.set("parent_imdb_id", id);
    params.set("season_number", String(season));
    params.set("episode_number", String(episode));
  } else {
    params.set("imdb_id", id);
  }

  const res = await fetch(`${OS}/subtitles?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`OpenSubtitles ${res.status}`);
  const data = await res.json();

  return (data.data || [])
    .map((d) => {
      const a = d.attributes || {};
      const file = a.files?.[0];
      if (!file?.file_id) return null;
      return {
        fileId: String(file.file_id),
        lang: a.language || "?",
        label: `${(a.language || "?").toUpperCase()} · ${a.release || "legenda"}`.slice(0, 70),
        downloads: a.download_count || 0,
      };
    })
    .filter(Boolean)
    .sort((x, y) => y.downloads - x.downloads)
    .slice(0, 12);
}

// Obtem o ficheiro da legenda (pede link ao OpenSubtitles) e devolve em VTT.
export async function getSubtitleVtt(fileId) {
  if (!subtitlesEnabled()) throw new Error("OpenSubtitles nao configurado");
  const res = await fetch(`${OS}/download`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ file_id: Number(fileId) }),
  });
  if (!res.ok) throw new Error(`OpenSubtitles download ${res.status}`);
  const data = await res.json();
  if (!data.link) throw new Error("sem link de download (quota?)");
  const sub = await fetch(data.link);
  return toVtt(await sub.text());
}

// Converte uma legenda de um URL qualquer (ex.: vinda do extractor) para VTT.
export async function fetchSubtitleAsVtt(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`legenda ${res.status}`);
  return toVtt(await res.text());
}
