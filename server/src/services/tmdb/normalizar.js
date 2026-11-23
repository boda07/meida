// Normalizacao de um item do TMDB para o formato que o frontend usa, e os
// ajudantes de titulo/cartaz que andam com ela.
import { cacheGet, cacheSet } from "../cache.js";

/** Normaliza um item de filme/serie para o formato que o frontend usa. */
export function normalizeMedia(item) {
  if (!item) return null;
  const type = item.media_type || (item.title ? "movie" : "tv");
  if (type !== "movie" && type !== "tv") return null;
  const out = {
    id: item.id,
    type,
    title: item.title || item.name || "",
    overview: item.overview || "",
    poster: item.poster_path || null,
    backdrop: item.backdrop_path || null,
    year: (item.release_date || item.first_air_date || "").slice(0, 4),
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
  };
  // Indice titulo/ano por id: alimenta o fallback do TVMaze quando o TMDB esta
  // em baixo (o TVMaze procura por titulo, nao por id do TMDB).
  if (out.title) {
    const idxKey = `tvidx:${type}:${item.id}`;
    const idx = cacheGet(idxKey);
    if (!idx || idx.title !== out.title || idx.year !== out.year) {
      cacheSet(idxKey, { title: out.title, year: out.year });
    }
  }
  return out;
}

// Aplica o titulo/cartaz localizados a uma lista de itens ja normalizados.
export function applyMeta(items, meta) {
  return items.map((m) => {
    const mt = meta.get(m.id);
    if (!mt) return m;
    return { ...m, title: mt.title || m.title, poster: mt.poster || m.poster };
  });
}

// Escolhe o cartaz no idioma pedido.
// Em PT: o TMDB nao separa PT-PT de PT-BR (ambos marcados "pt") e a maioria dos
// cartazes "pt" tem texto em PT-BR, que choca com o titulo em PT-PT. Por isso,
// preferimos um cartaz SEM texto (neutro) -> pt -> ingles.
// Nos outros idiomas: idioma -> sem texto -> ingles.
export function pickPoster(posters, short) {
  if (!posters?.length) return null;
  const order = short === "pt" ? [null, "pt", "en"] : [short, null, "en"];
  for (const code of order) {
    const p = posters.find((x) => x.iso_639_1 === code);
    if (p?.file_path) return p.file_path;
  }
  return posters[0]?.file_path || null;
}