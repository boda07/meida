// A base do TMDB: configuracao, idiomas e a chamada HTTP.
//
// `tmdbFetch` e' o unico ponto que fala com a API. E' resiliente: cada resposta
// bem-sucedida fica em disco; se o TMDB falhar (rede, 5xx, chave invalida),
// serve a ultima resposta conhecida em vez de rebentar.
import { config, assertTmdbConfigured } from "../../config.js";
import { cacheGet, cacheSet } from "../cache.js";
import { netFetch } from "../net.js";

const { baseUrl, language, titleLanguage } = config.tmdb;

// Mapeia os codigos curtos das definicoes ("pt"/"en") para os do TMDB.
const LANG_MAP = { pt: "pt-PT", en: "en-US" };

function resolveLang(short, fallback) {
  if (!short) return fallback;
  return LANG_MAP[short] || (String(short).includes("-") ? short : fallback);
}

// A partir das opcoes do pedido decide o idioma da sinopse e dos titulos.
function langsFrom(opts = {}) {
  return {
    overview: resolveLang(opts.overviewLang, language),
    title: resolveLang(opts.titleLang, titleLanguage),
  };
}

/**
 * Chamada generica ao TMDB. Usa o token v4 (Bearer) se existir, senao a chave v3.
 * `lang` permite forcar um idioma diferente do default (ex.: para titulos em ingles).
 */
export async function tmdbFetch(path, params = {}, lang = language) {
  assertTmdbConfigured();

  const url = new URL(baseUrl + path);
  url.searchParams.set("language", lang);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  const headers = { accept: "application/json" };
  if (config.tmdb.accessToken) {
    headers.authorization = `Bearer ${config.tmdb.accessToken}`;
  } else {
    url.searchParams.set("api_key", config.tmdb.apiKey);
  }

  try {
    const res = await netFetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`TMDB ${res.status} em ${path}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    cacheSet(`tmdb:${url.pathname + url.search}`, json);
    return json;
  } catch (err) {
    const disk = cacheGet(`tmdb:${url.pathname + url.search}`);
    if (disk) return disk;
    throw err;
  }
}

export { LANG_MAP, resolveLang, langsFrom };