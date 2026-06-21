// Extractor de streams "sem anuncios": tenta varios providers por ordem e
// devolve o primeiro que der sources (m3u8). Para trocar/arranjar, edita os
// ficheiros desta pasta — a interface de cada provider e simples:
//
//   provider = { name, async extract(ctx) -> { sources, subtitles, referer } }
//   ctx = { type, tmdb, imdb, title, year, season, episode }
//   sources  = [{ url, quality, isM3U8 }]
//   subtitles= [{ url, lang, label }]
//
import { config } from "../../config.js";
import { consumetProvider } from "./consumet.js";
import { embedsuProvider } from "./embedsu.js";
import { vidsrcccProvider } from "./vidsrccc.js";

function activeProviders() {
  const list = [];
  // Se ligaste um extractor externo (Consumet), e o preferido (mais fiavel).
  if (config.extractorApiBase) list.push(consumetProvider);
  // Best-effort sem dependencias (frageis — tenta varios, ajusta se partirem).
  list.push(vidsrcccProvider, embedsuProvider);
  return list;
}

export async function extractStream(ctx) {
  const errors = [];
  for (const p of activeProviders()) {
    try {
      const r = await p.extract(ctx);
      if (r && r.sources?.length) return { provider: p.name, ...r };
      errors.push(`${p.name}: sem sources`);
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  const err = new Error(
    "Nao foi possivel extrair o stream. " +
      (errors.join(" | ") || "nenhum provider disponivel.")
  );
  err.status = 502;
  throw err;
}
