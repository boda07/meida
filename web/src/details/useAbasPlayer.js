// Separadores do player (providers / sem anuncios / torrents) e se cada um
// esta' configurado no servidor.
//
// O "Sem anuncios" (Consumet) so aparece se houver Docker no servidor: sem
// isso nunca funcionava e a aba so confundia. O extrator de anime (player
// proprio) tem o seu proprio interruptor.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export function useAbasPlayer(defaultTab) {
  const [mode, setMode] = useState(defaultTab || "providers");
  // O extrator de anime (player proprio) esta configurado no servidor?
  const [animeExtractorOn, setAnimeExtractorOn] = useState(false);
  // O "Sem anuncios" de filmes/series (Consumet) esta configurado?
  const [extractOn, setExtractOn] = useState(null);

  useEffect(() => {
    api.animeEnabled().then((d) => setAnimeExtractorOn(d.enabled)).catch(() => {});
    api.extractEnabled().then((d) => setExtractOn(d.enabled)).catch(() => setExtractOn(false));
  }, []);

  // Se a aba "Sem anuncios" nao esta disponivel mas era o separador inicial,
  // cai para os Providers (para nao ficar um ecra vazio).
  useEffect(() => {
    if (extractOn === false && mode === "extract") setMode("providers");
  }, [extractOn, mode]);

  return { mode, setMode, extractOn, animeExtractorOn };
}