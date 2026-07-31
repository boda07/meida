// Fallback do TMDB para SERIES: quando o TMDB falha, os detalhes e os episodios
// vêm do TVMaze (API publica, gratuita, sem chave). A procura é por titulo+ano
// (o TVMaze nao aceita ids do TMDB). Tudo fica cacheado em disco (a resposta
// inclui os episodios de todas as temporadas, por isso serve tanto os detalhes
// como o /season). Sempre em ingles — aceitavel num fallback.
import { netFetch } from "./net.js";
import { cacheGet, cacheSet } from "./cache.js";

const API = "https://api.tvmaze.com";

function cleanHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function normalizeEpisode(ep) {
  return {
    episodeNumber: ep.number || 0,
    name: ep.name || "",
    overview: cleanHtml(ep.summary),
    still: ep.image?.medium || null,
    airDate: ep.airdate || null,
    rating: ep.rating?.average || null,
  };
}

// Detalhes de uma serie por titulo (+ ano, para escolher o match certo).
// Devolve no formato do getDetails do TMDB (id preenchido pelo chamador) com
// `episodesBySeason` extra para o /season reutilizar. null se nao encontrar.
export async function getTvDetailsByTitle(title, year) {
  if (!title) return null;
  const key = `tvz:${String(title).toLowerCase().replace(/\s+/g, "_")}:${year || ""}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  try {
    const q = encodeURIComponent(title);
    const res = await netFetch(`${API}/singlesearch/shows?q=${q}&embed=episodes`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const show = await res.json();

    const episodesBySeason = new Map();
    for (const ep of show._embedded?.episodes || []) {
      if (!episodesBySeason.has(ep.season)) episodesBySeason.set(ep.season, []);
      episodesBySeason.get(ep.season).push(normalizeEpisode(ep));
    }
    const seasons = [...episodesBySeason.keys()].sort((a, b) => a - b).map((s) => ({
      seasonNumber: s,
      name: `Temporada ${s}`,
      episodeCount: episodesBySeason.get(s).length,
    }));

    const out = {
      id: null, // o chamador poe o id do TMDB (o URL é sempre /details/tv/{tmdbId})
      type: "tv",
      title: show.name || title,
      overview: cleanHtml(show.summary),
      poster: show.image?.medium || null,
      backdrop: null,
      year: (show.premiered || "").slice(0, 4) || null,
      rating: show.rating?.average || null,
      imdbId: show.externals?.imdb || null,
      trailer: null,
      genres: (show.genres || []).map((g) => String(g).toLowerCase()),
      cast: [],
      runtime: show.runtime || null,
      seasons,
      totalSeasons: seasons.length || null,
      episodesBySeason: Object.fromEntries(episodesBySeason),
    };

    // Elenco (1 pedido extra, best-effort).
    try {
      const castRes = await netFetch(`${API}/shows/${show.id}/cast`, {
        headers: { accept: "application/json" },
      });
      if (castRes.ok) {
        const cast = await castRes.json();
        out.cast = cast.slice(0, 10).map((c) => ({
          name: c.person?.name || "",
          character: c.character?.name || "",
          profile: c.person?.image?.medium || null,
        }));
      }
    } catch {
      /* sem elenco -> vazio */
    }

    cacheSet(key, out);
    return out;
  } catch {
    return null;
  }
}

// Episodios de uma temporada (fallback do /season quando o TMDB falha).
export async function getTvEpisodesByTitle(title, year, seasonNumber) {
  const show = await getTvDetailsByTitle(title, year);
  if (!show) return null;
  const list = show.episodesBySeason?.[seasonNumber];
  return list ? [...list] : null;
}
