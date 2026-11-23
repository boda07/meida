// Blocos de 100 episodios (animes longos, 1000+ eps): a lista inteira de uma
// vez nao da para usar.
import { useEffect, useState } from "react";

export const EP_BLOCK = 100;

export function useBlocos(episodes, episode) {
  const [epStart, setEpStart] = useState(0);

  // Mantem o bloco visivel alinhado com o episodio atual/selecionado.
  useEffect(() => {
    setEpStart(Math.floor((episode - 1) / EP_BLOCK) * EP_BLOCK);
  }, [episode]);

  const manyEps = episodes.length > EP_BLOCK;
  const epRanges = [];
  if (manyEps) {
    for (let i = 0; i < episodes.length; i += EP_BLOCK) epRanges.push(i);
  }
  const visibleEpisodes = manyEps ? episodes.slice(epStart, epStart + EP_BLOCK) : episodes;

  return { epStart, setEpStart, manyEps, epRanges, visibleEpisodes };
}