import { useCallback, useEffect, useRef, useState } from "react";

// Sincroniza o estado do <video> com o React.
//
// Responsabilidade unica: ouvir eventos do video e manter o estado atualizado.
// O preenchimento da barra de seek e da zona carregada e' escrito por ref
// (nao por estado) para nao re-renderizar o componente a cada `timeupdate`
// (~4x/s). Tudo o resto (duracao, segundo, volume, mudo, buffering, piP) e'
// estado React porque a interface depende dele.
export function useVideoState(videoRef) {
  const [duracao, setDuracao] = useState(0);
  const [segundo, setSegundo] = useState(0);
  const [volume, setVolume] = useState(1);
  const [mudo, setMudo] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [piP, setPiP] = useState(false);

  const preenchimentoRef = useRef(null);
  const bolinhaRef = useRef(null);
  const carregadoRef = useRef(null);

  const pintar = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    const frac = d > 0 ? Math.min(1, Math.max(0, video.currentTime / d)) : 0;
    const pct = (frac * 100).toFixed(2) + "%";
    if (preenchimentoRef.current) preenchimentoRef.current.style.width = pct;
    if (bolinhaRef.current) bolinhaRef.current.style.left = pct;

    // Zona carregada (buffered): faixa fina atras da barra de progresso.
    if (carregadoRef.current && d > 0 && video.buffered.length > 0) {
      let carregadoAte = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        const start = video.buffered.start(i);
        const end = video.buffered.end(i);
        if (video.currentTime >= start && video.currentTime <= end) {
          carregadoAte = end;
          break;
        }
        carregadoAte = Math.max(carregadoAte, end);
      }
      carregadoRef.current.style.width = ((carregadoAte / d) * 100).toFixed(2) + "%";
    }
  }, [videoRef]);

  const onMeta = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuracao(Number.isFinite(video.duration) ? video.duration : 0);
    setVolume(video.volume);
    setMudo(video.muted);
    pintar();
  }, [videoRef, pintar]);

  const onTime = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    pintar();
    const s = Math.floor(video.currentTime || 0);
    setSegundo((antes) => (antes === s ? antes : s));
  }, [videoRef, pintar]);

  const onVol = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setVolume(video.volume);
    setMudo(video.muted);
  }, [videoRef]);

  const onWaiting = useCallback(() => setBuffering(true), []);
  const onCanPlay = useCallback(() => setBuffering(false), []);
  const onEnterPiP = useCallback(() => setPiP(true), []);
  const onLeavePiP = useCallback(() => setPiP(false), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlay);
    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);

    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("volumechange", onVol);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlay);
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, [videoRef, onMeta, onTime, onVol, onWaiting, onCanPlay, onEnterPiP, onLeavePiP]);

  return {
    duracao,
    segundo,
    volume,
    mudo,
    buffering,
    piP,
    preenchimentoRef,
    bolinhaRef,
    carregadoRef,
  };
}
