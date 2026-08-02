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
  const clean = text.replace(/^\uFEFF/, "").replace(/\r+/g, "");
  if (/^WEBVTT/.test(clean.trimStart())) return clean;
  const body = clean.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2"
  );
  return "WEBVTT\n\n" + body;
}

// Pesquisa legendas no OpenSubtitles por IMDB id (+ temporada/episodio).
// Ordena a dar prioridade a portugues de Portugal (pt/por) acima de PT-BR,
// para o europeu nao ficar enterrado nos resultados (PT-BR tem mais downloads).
function langRank(lang) {
  const l = String(lang || "").toLowerCase();
  return l === "pt" || l === "por" || l === "pt-pt" || l === "por-pt" ? 0 : 1;
}

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
    .sort(
      (x, y) =>
        langRank(x.lang) - langRank(y.lang) || y.downloads - x.downloads
    )
    .slice(0, 12);
}

// Obtem o ficheiro da legenda (pede link ao OpenSubtitles) e devolve em VTT.
// O link so e valido ~15s e o CDN recusa conexoes sem User-Agent; por isso
// usa retry e re-pede o link se a descarga do ficheiro falhar.
export async function getSubtitleVtt(fileId) {
  if (!subtitlesEnabled()) throw new Error("OpenSubtitles nao configurado");
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${OS}/download`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ file_id: Number(fileId) }),
      });
      if (!res.ok) throw new Error(`OpenSubtitles download ${res.status}`);
      const data = await res.json();
      if (!data.link) throw new Error("sem link de download (quota?)");
      const sub = await fetch(data.link, {
        headers: { "User-Agent": "StreamApp v0.1" },
      });
      if (!sub.ok) throw new Error(`legenda ${sub.status}`);
      return toVtt(await sub.text());
    } catch (err) {
      lastErr = err;
      if (err.message.includes("429")) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      // falha de rede/link expirado: tenta de novo (re-pede o link)
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
      else break;
    }
  }
  throw lastErr;
}

// Converte uma legenda de um URL qualquer (ex.: vinda do extractor) para VTT.
export async function fetchSubtitleAsVtt(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`legenda ${res.status}`);
  return toVtt(await res.text());
}

// Cache de legendas ja descarregadas (fileId -> VTT). O OpenSubtitles tem
// rate-limit por hora; quando o player pede varios tracks seguidos, sem cache
// arriscamos 500s em serie. Tamanho maximo simples (fifo).
const subCache = new Map();
const SUB_CACHE_MAX = 200;

export function cachedSubtitle(fileId) {
  return subCache.get(String(fileId)) ?? null;
}

function cacheSubtitle(fileId, vtt) {
  subCache.set(String(fileId), vtt);
  if (subCache.size > SUB_CACHE_MAX) {
    subCache.delete(subCache.keys().next().value);
  }
}

// Descarrega uma legenda do OpenSubtitles com cache e retry (rate-limit 429).
export async function getSubtitleVttCached(fileId) {
  const hit = cachedSubtitle(fileId);
  if (hit != null) return hit;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const vtt = await getSubtitleVtt(fileId);
      cacheSubtitle(fileId, vtt);
      return vtt;
    } catch (err) {
      lastErr = err;
      if (err.message.includes("429")) {
        // rate-limit: espera e tenta de novo
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}
