// Generos e temas de anime (Jikan), para o "Escolhe algo para mim".
//
// Junta generos (ex.: Slice of Life) e temas (ex.: Gore), que partilham o mesmo
// espaco de ids no filtro do Jikan.
import { jikanFetch } from "./fetch.js";

let animeGenresCache = null;

export async function getAnimeGenres() {
  if (animeGenresCache) return animeGenresCache;
  try {
    // allSettled: se um dos dois endpoints falhar (ex.: 504 no "themes"),
    // usa o que tiver funcionado em vez de deitar tudo fora.
    const results = await Promise.allSettled([
      jikanFetch(`/genres/anime`),
      jikanFetch(`/genres/anime?filter=themes`),
    ]);
    const seen = new Set();
    const list = [];
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value?.data) continue;
      for (const x of r.value.data) {
        if (seen.has(x.mal_id)) continue;
        seen.add(x.mal_id);
        list.push({ id: x.mal_id, name: x.name });
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return animeGenresCache || [];
    animeGenresCache = list;
    return list;
  } catch {
    return animeGenresCache || [];
  }
}