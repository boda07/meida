import { useCallback, useEffect, useRef } from "react";

// Reporta a posicao do video periodicamente.
//
// Responsabilidade unica: chamar onProgress com o tempo atual (e duracao) a
// cada 5s, e tambem em pause, ended e ao desmontar, para o "Continua a ver"
// nunca ficar parado num tempo antigo quando se recua no video.
//
// Devolve: nada (efeito colateral so).
export function useVideoProgress({ videoRef, onProgress }) {
  if (!onProgress) return;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let last = 0;

    const reportar = () => {
      const now = Math.floor(video.currentTime || 0);
      last = now;
      onProgress(now, Math.floor(video.duration || 0));
    };

    const onTime = () => {
      const now = Math.floor(video.currentTime || 0);
      // Math.abs: depois de recuar, now - last fica negativo e nunca chegava a 5.
      if (Math.abs(now - last) >= 5) {
        reportar();
      }
    };

    const onPause = () => reportar();
    const onEnded = () => reportar();

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      reportar();
    };
  }, [videoRef, onProgress]);
}
