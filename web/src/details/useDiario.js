// Diario: marcar como visto (filme) / concluir o episodio (serie e anime).
import { useState } from "react";
import { api } from "../api/client.js";

export function useDiario({ details, season, episode, t, nextEpisodePos }) {
  const [finishing, setFinishing] = useState(false);
  const [finishMsg, setFinishMsg] = useState(null);
  const isMovieLike = details?.isMovie || details?.type === "movie";

  // Marca como acabado (filme) / conclui o episodio atual (serie/anime).
  async function markFinished() {
    if (!details || finishing) return;
    setFinishing(true);
    setFinishMsg(null);
    try {
      if (isMovieLike) {
        await api.progressFinish({
          type: details.type,
          tmdbId: details.id,
          title: details.title,
          poster: details.poster,
        });
        await api
          .saveLibrary({
            tmdbId: details.id,
            type: details.type,
            title: details.title,
            poster: details.poster,
            genres: details.genres || [],
            rating: details.rating ?? null,
            // Filme de anime: o `type` e' "anime", e' este campo que diz ao
            // servidor que e' um filme (para o feed nao dizer "viu a serie").
            isMovie: details.isMovie,
            watched: true,
          })
          .catch(() => {});
      } else {
        const next = nextEpisodePos();
        await api.progressFinish({
          type: details.type,
          tmdbId: details.id,
          title: details.title,
          poster: details.poster,
          season: details.type === "tv" ? season : null,
          episode,
          nextSeason: next?.season ?? null,
          nextEpisode: next?.episode ?? null,
        });
        if (details.isAnime && details.malId) {
          api.malScrobble(details.malId, episode).catch(() => {});
          // Se o MAL nao esta ligado, marca no AniList (quando este estiver ligado).
          api.anilistScrobble(details.malId, episode).catch(() => {});
        }
      }
      setFinishMsg(t("Guardado no diário."));
    } catch {
      setFinishMsg(t("Não foi possível guardar."));
    } finally {
      setFinishing(false);
    }
  }

  return { finishing, finishMsg, isMovieLike, markFinished };
}