// Watch Party: sincroniza temporada/episodio/separador E a fonte escolhida.
import { useEffect, useRef } from "react";

export function useWatchPartySync({
  party,
  season,
  episode,
  mode,
  active,
  embeds,
  wantedSourceRef,
  setSeason,
  setEpisode,
  setMode,
  setActive,
  setPlayerIndex,
}) {
  // Enquanto aplicamos um "session" recebido, nao o devolvemos ao host: senao
  // ficavam os dois a responder um ao outro.
  const applyingUntil = useRef(0);

  useEffect(() => {
    if (!party?.active) return;
    return party.subscribe((p) => {
      if (p.kind === "hello") {
        party.send("session", { season, episode, mode, provider: active?.provider });
        return;
      }
      if (p.kind !== "session") return;
      applyingUntil.current = Date.now() + 400;
      const d = p.data || {};
      if (d.season != null) setSeason(d.season);
      if (d.episode != null) setEpisode(d.episode);
      if (d.mode) setMode(d.mode);
      if (d.provider) {
        // Guarda para aplicar quando as fontes carregarem; aplica ja se possivel.
        wantedSourceRef.current = d.provider;
        const match = embeds.find((e) => e.provider === d.provider);
        if (match) {
          setActive(match);
          setPlayerIndex(embeds.findIndex((e) => e.provider === d.provider));
        }
      }
    });
  }, [party, season, episode, mode, embeds, active, wantedSourceRef, setSeason, setEpisode, setMode, setActive, setPlayerIndex]);

  useEffect(() => {
    if (!party?.active) return;
    if (Date.now() < applyingUntil.current) return;
    party.send("session", { season, episode, mode, provider: active?.provider });
  }, [party, season, episode, mode, active]);
}