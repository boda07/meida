import { useEffect } from "react";
import { ligarEventosDeProgresso } from "./progressoVideo.js";

// Reporta a posicao do video periodicamente.
//
// Responsabilidade unica: ligar os eventos do <video> ao `onProgress` enquanto o
// componente estiver montado. A decisao de quando reportar (intervalo de 5s,
// pausa, fim e limpeza) vive em `progressoVideo.js`, que se testa com um video
// falso, sem React nem browser.
//
// Devolve: nada (efeito colateral so).
export function useVideoProgress({ videoRef, onProgress }) {
  useEffect(() => {
    if (!onProgress) return;
    const video = videoRef.current;
    if (!video) return;
    return ligarEventosDeProgresso({ video, onProgress });
  }, [videoRef, onProgress]);
}
