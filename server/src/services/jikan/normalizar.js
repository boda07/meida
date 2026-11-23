// Normalizacao dos anime (Jikan e AniList) para o formato dos cartoes.

function yearOf(a) {
  if (a.year) return a.year;
  if (a.aired?.prop?.from?.year) return a.aired.prop.from.year;
  if (a.aired?.from) return new Date(a.aired.from).getFullYear();
  return "";
}

// Normaliza um anime para o formato dos cartoes. O poster e um URL COMPLETO
// (o imageUrl no frontend deixa passar URLs completos).
export function normalizeAnime(a, romaji = false) {
  if (!a?.mal_id) return null;
  // a.title = romaji/default; a.title_english = ingles. Ingles por default.
  const title = romaji
    ? a.title || a.title_english || a.title_japanese || ""
    : a.title_english || a.title || a.title_japanese || "";
  return {
    id: a.mal_id,
    type: "anime",
    // Na biblioteca o `type` e' "anime" para filmes e series (o id e' o do MAL).
    // Esta marca e' o que permite ao feed dizer "viu o filme" em vez de "viu a
    // serie" quando alguem marca um cartaz como visto. Vem do `type` do Jikan
    // ("Movie", "TV", "OVA"...), que e' a mesma informacao que o detalhe usa.
    isMovie: /movie/i.test(a.type || ""),
    title,
    overview: a.synopsis || "",
    poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
    backdrop: null,
    year: String(yearOf(a) || ""),
    rating: a.score ? Math.round(a.score * 10) / 10 : null,
  };
}

export const clean = (d, romaji) =>
  (d.data || []).map((a) => normalizeAnime(a, romaji)).filter(Boolean);

export const isRomaji = (opts) => opts?.animeTitleLang === "romaji";

function stripHtml(s) {
  return String(s || "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

export function normalizeAnilistAnime(a, romaji = false) {
  if (!a?.idMal) return null;
  const title = romaji
    ? a.title?.romaji || a.title?.english || a.title?.native || ""
    : a.title?.english || a.title?.romaji || a.title?.native || "";
  return {
    id: a.idMal,
    type: "anime",
    // Mesma marca do normalizador do Jikan: "MOVIE" e' um filme, o resto e'
    // serie. Vem do `format` do AniList (as queries pedem-no).
    isMovie: a.format === "MOVIE",
    title,
    overview: stripHtml(a.description),
    poster: a.coverImage?.extraLarge || a.coverImage?.large || null,
    backdrop: a.bannerImage || null,
    year: String(a.startDate?.year || ""),
    rating: a.averageScore || a.meanScore ? Math.round((a.averageScore || a.meanScore) / 10) : null,
  };
}

// Remove duplicados por id (o Jikan repete entradas entre listas as vezes).
export function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
}

// Uma lista de filmes de anime leva `isMovie` em cada item. Estas listas sao
// filmes POR DEFINICAO (`/top/anime?type=movie`), portanto a marca fica
// garantida mesmo que o payload nao traga o `type` que o normalizador le — e e'
// o que faz o feed dizer "viu o filme X" em vez de "viu a serie X".
export const comoFilme = (items) => items.map((i) => (i ? { ...i, isMovie: true } : i));