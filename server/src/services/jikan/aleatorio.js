// "Escolhe algo para mim" de anime: um titulo aleatorio com generos a
// incluir/excluir, com fallback para a AniList quando o Jikan falha.
import { netFetch } from "../net.js";
import { jikanFetch } from "./fetch.js";
import { getAnimeGenres } from "./generos.js";
import { dedupe, isRomaji, normalizeAnime, normalizeAnilistAnime } from "./normalizar.js";

export async function pickAnime({ genres = [], exclude = [] }, opts = {}) {
  const romaji = isRomaji(opts);
  let q = `/anime?order_by=popularity&sort=asc&limit=25${opts.adult ? "" : "&sfw=true"}`;
  if (genres.length) q += `&genres=${genres.join(",")}`;
  if (exclude.length) q += `&genres_exclude=${exclude.join(",")}`;

  let first;
  try {
    first = await jikanFetch(q);
  } catch {
    // Jikan em baixo/instavel -> fallback na AniList (que aceita nomes de
    // genero em vez de ids do MAL).
    return pickAnimeFromAnilist({ genres, exclude }, opts);
  }
  const totalPages = Math.min(first?.pagination?.last_visible_page || 1, 20);
  let items = first.data || [];
  if (totalPages > 1) {
    const page = 1 + Math.floor(Math.random() * totalPages);
    try {
      const d = await jikanFetch(`${q}&page=${page}`);
      if (d.data?.length) items = d.data;
    } catch {
      /* fica com a 1a pagina */
    }
  }
  const list = items.map((a) => normalizeAnime(a, romaji)).filter(Boolean);
  if (!list.length) return pickAnimeFromAnilist({ genres, exclude }, opts);
  return list[Math.floor(Math.random() * list.length)];
}

// Fallback do "Escolhe algo para mim" de anime quando o Jikan falha. A AniList
// filtra por nomes de genero, por isso converte os ids do MAL em nomes.
export async function pickAnimeFromAnilist({ genres = [], exclude = [] }, opts = {}) {
  try {
    const all = await getAnimeGenres();
    const byId = new Map(all.map((g) => [String(g.id), g.name]));
    const genreIn = genres.map((id) => byId.get(String(id))).filter(Boolean);
    const genreNotIn = exclude.map((id) => byId.get(String(id))).filter(Boolean);
    const romaji = isRomaji(opts);
    const query = `query($genre_in:[String],$genre_not_in:[String],$isAdult:Boolean){Page(page:1,perPage:25){media(type:ANIME,sort:POPULARITY_DESC,genre_in:$genre_in,genre_not_in:$genre_not_in,isAdult:$isAdult){idMal format title{romaji english native} description(asHtml:false) coverImage{extraLarge large} bannerImage startDate{year} averageScore meanScore}}}`;
    const res = await netFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query,
        variables: {
          // A AniList nao aceita arrays vazios (devolvem 0 resultados): usa null.
          genre_in: genreIn.length ? genreIn : null,
          genre_not_in: genreNotIn.length ? genreNotIn : null,
          isAdult: opts.adult ? null : false,
        },
      }),
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const data = await res.json();
    const list = dedupe(
      (data?.data?.Page?.media || []).map((a) => normalizeAnilistAnime(a, romaji)).filter(Boolean)
    );
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  } catch {
    return null;
  }
}