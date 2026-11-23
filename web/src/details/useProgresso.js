// Retomar a meio e contar tempo de visionamento.
//
// Duas coisas diferentes com o mesmo nome de dominio:
//   * `saved`/`startAt` — onde e' que ficaste (servidor + "Continua a ver");
//   * o diário — "comecaste a ver" ao fim de 5 minutos com uma fonte aberta.
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

export function useProgresso({
  user,
  details,
  season,
  episode,
  active,
  activeProviderRef,
  embeds,
  wantedSourceRef,
  setActive,
  setPlayerIndex,
  animeSeasons,
  episodes,
  resumeAtRef,
}) {
  // Retomar a meio: posicao guardada no servidor para este titulo (com o
  // episodio a que pertence, para so retomar no mesmo episodio).
  const [saved, setSaved] = useState(null); // { position, duration, season, episode }
  const [startAt, setStartAt] = useState(null); // passado aos players (seg.)

  // Restaura o provider guardado apenas na 1a entrada do titulo (nao volta a
  // impor ao mudar de episodio/audio durante a sessao — deixaria o user na mao).
  const restoreProviderDone = useRef(null);
  useEffect(() => {
    restoreProviderDone.current = details ? `${details.type}:${details.id}` : null;
  }, [details]);

  // startAt = posicao do "Continua a ver" (?t=) ou a guardada, mas so quando o
  // episodio atual e' o mesmo em que estivemos. Limpa ao trocar de episodio.
  useEffect(() => {
    const fromUrl = resumeAtRef.current;
    resumeAtRef.current = null; // so vale na primeira abertura
    const curSeason = details?.type === "tv" ? season : null;
    const curEpisode = details?.type === "anime" || details?.type === "tv" ? episode : null;
    const match =
      saved && (details?.type === "movie" || (saved.season === curSeason && saved.episode === curEpisode));
    // Retoma a meio so se vale a pena (nao logo no inicio nem quase no fim).
    const worth =
      match && saved.position > 20 && (saved.duration == null || saved.duration - saved.position > 30);
    setStartAt(fromUrl || (worth ? saved.position : null));
  }, [details, season, episode, saved, resumeAtRef]);

  // Le o progresso guardado (posicao + provider). Tem de correr depois de
  // `embeds`/`wantedSourceRef` estarem declarados (usam-nos no corpo e nas deps).
  useEffect(() => {
    if (!user || !details) {
      setSaved(null);
      return;
    }
    api
      .progressItem(details.type, details.id)
      .then((d) => {
        const it = d.item;
        setSaved(
          it?.position
            ? {
                position: it.position,
                duration: it.duration ?? null,
                season: details.type === "tv" ? it.season : null,
                episode: it.episode ?? null,
              }
            : null
        );
        // Restaura a fonte (provider) em que o user estava, para o "Continua a
        // ver" abrir na mesma e nao no 1o provider vivo. So na 1a entrada.
        if (it?.provider && restoreProviderDone.current === `${details.type}:${details.id}`) {
          restoreProviderDone.current = false;
          wantedSourceRef.current = it.provider;
          const match = embeds.find((e) => e.provider === it.provider);
          if (match) {
            setActive(match);
            setPlayerIndex(embeds.findIndex((e) => e.provider === it.provider));
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, details, embeds]);

  // Diario: so considera que estas a ver depois de 5 MINUTOS com uma fonte
  // aberta (assim abrir e fechar logo nao conta). 1x por episodio/sessao. O
  // contador nao reinicia ao trocar de fonte (depende so de haver fonte ativa,
  // nao de qual).
  const startedRef = useRef(new Set());
  const hasSource = Boolean(active);
  useEffect(() => {
    if (!user || !details || !hasSource) return;
    const ep = details.isMovie ? null : episode;
    const s = details.type === "tv" ? season : null;
    const key = `${details.type}:${details.id}:${s}:${ep}`;
    if (startedRef.current.has(key)) return;
    const t = setTimeout(() => {
      startedRef.current.add(key);
      api
        .progressStart({
          type: details.type,
          tmdbId: details.id,
          title: details.title,
          poster: details.poster,
          provider: activeProviderRef.current,
          season: s,
          episode: ep,
        })
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [user, details, hasSource, season, episode, activeProviderRef]);

  // Proxima posicao (para avancar o "continua a ver" ao concluir um episodio).
  function nextEpisodePos() {
    if (details.type === "anime") {
      // Os episodios sao globais (1..N) atraves das temporadas agrupadas.
      const lastSeason = animeSeasons[animeSeasons.length - 1];
      const lastEp = lastSeason
        ? lastSeason.episodes[lastSeason.episodes.length - 1]?.episodeNumber
        : episodes.length;
      return episode < lastEp ? { season: null, episode: episode + 1 } : null;
    }
    if (details.type === "tv") {
      if (episode < episodes.length) return { season, episode: episode + 1 };
      const idx = details.seasons?.findIndex((s) => s.seasonNumber === season) ?? -1;
      const nextS = idx >= 0 ? details.seasons[idx + 1] : null;
      return nextS ? { season: nextS.seasonNumber, episode: 1 } : null;
    }
    return null;
  }

  return { saved, startAt, nextEpisodePos };
}