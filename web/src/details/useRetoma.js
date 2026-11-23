// Retoma do "Continua a ver" (?s=temporada&e=episodio&t=seg).
//
// Os refs vivem aqui, e nao no componente, para as tres partes que precisam
// deles (carregar detalhes, carregar episodios e calcular o `startAt`) lerem o
// mesmo estado sem o React desmontar a ordem.
//
// `pending` so e' consumida quando a temporada de retoma carrega DE FACTO
// (guarda `loadedSeasonRef`); assim os efeitos que correm 2x em StrictMode (dev)
// nao consomem a retoma duas vezes nem repoem o episodio a 1.
import { useCallback, useRef } from "react";

export function useRetoma(searchParams) {
  const resumeRef = useRef({
    season: Number(searchParams.get("s")) || null,
    episode: Number(searchParams.get("e")) || null,
    position: Number(searchParams.get("t")) || null,
    pending: true,
  });
  // Posicao (segundos) para retomar a meio, so quando voltamos ao mesmo
  // episodio vindo do "Continua a ver" (senao os players comecam do 0).
  const resumeAtRef = useRef(resumeRef.current.position);
  // Temporada cuja lista de episodios ja foi aplicada — evita que re-invocacoes
  // do efeito (StrictMode em dev, refetch de detalhes) reponham o episodio a 1.
  const loadedSeasonRef = useRef(null);

  // Devolve o episodio inicial: o de retoma (uma vez) ou 1.
  //
  // `useCallback` com deps vazias: mexe so em refs, e a identidade tem de ficar
  // quieta — quem a chama poe-a nas deps dos proprios efeitos (carregar
  // episodios, cair no fallback do anime) e uma funcao nova a cada render
  // repunha o episodio a 1 ou desparava um pedido de temporada em ciclo.
  const takeResumeEpisode = useCallback(() => {
    const r = resumeRef.current;
    if (r.pending && r.episode) {
      r.pending = false;
      return r.episode;
    }
    return 1;
  }, []);

  return { resumeRef, resumeAtRef, loadedSeasonRef, takeResumeEpisode };
}