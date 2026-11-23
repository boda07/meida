// Titulos localizados de uma lista do TMDB.
//
// O TMDB devolve o titulo ORIGINAL (na lingua do filme) quando nao ha traducao;
// comparamos com `original_title` para nao mostrar o original como se fosse a
// traducao.
import { tmdbFetch } from "./base.js";

export function bestTitle(localized, enTitle) {
  if (!localized) return enTitle || "";
  const loc = localized.title || localized.name || "";
  const original = localized.original_title || localized.original_name || "";
  if (loc && loc !== original) return loc; // ha traducao real -> usa-a
  return enTitle || loc; // sem traducao -> ingles
}

/**
 * Devolve Map(id -> { title, poster }) para uma lista, no idioma `titleLang`,
 * com fallback de titulo PT->EN. O cartaz vem do pedido nesse idioma (o TMDB
 * devolve o cartaz localizado), para o cartaz seguir o idioma dos titulos.
 * `localizedResp` evita refazer o pedido quando ja o temos.
 */
export async function resolveTitleMeta(path, params, titleLang, localizedResp) {
  if (titleLang === "en-US") {
    const en = localizedResp || (await tmdbFetch(path, params, "en-US"));
    return new Map(
      (en.results || []).map((it) => [
        it.id,
        { title: it.title || it.name || "", poster: it.poster_path || null },
      ])
    );
  }
  const [loc, en] = await Promise.all([
    localizedResp ? Promise.resolve(localizedResp) : tmdbFetch(path, params, titleLang),
    tmdbFetch(path, params, "en-US"),
  ]);
  const enMap = new Map((en.results || []).map((it) => [it.id, it.title || it.name || ""]));
  const map = new Map();
  for (const it of loc.results || [])
    map.set(it.id, { title: bestTitle(it, enMap.get(it.id)), poster: it.poster_path || null });
  return map;
}