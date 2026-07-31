import { useEffect, useRef } from "react";

// Atalhos de teclado para os players HTML5 próprios (torrent/HLS).
// Ativos quando o rato está por cima do player, quando o player tem foco
// (ex.: depois de clicar no vídeo) ou em ecrã inteiro — para não interferir
// com a navegação da página (ex.: setas a fazer scroll).
//   Espaco / K  -> reproduzir / pausar
//   Setas < >   -> saltar 10s
//   Setas ^ v   -> volume
//   M           -> mudo
//   F           -> ecra inteiro
export function usePlayerShortcuts(videoRef, containerRef) {
  const activeRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const setActive = (v) => (activeRef.current = v);
    const onEnter = () => setActive(true);
    const onLeave = () => setActive(false);
    const onFocusIn = (e) => {
      if (container.contains(e.target)) setActive(true);
    };
    const onFocusOut = (e) => {
      if (!container.contains(e.relatedTarget)) setActive(false);
    };
    const onFullscreenChange = () => {
      setActive(document.fullscreenElement === container);
    };

    container.addEventListener("mouseenter", onEnter);
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    const onKeyDown = (e) => {
      const t = e.target;
      // Não interfere enquanto o utilizador escreve (pesquisa, etc.).
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const active = activeRef.current || document.fullscreenElement === container;
      if (!active) return;
      const video = videoRef.current;
      if (!video) return;

      const seek = (delta) => {
        const t0 = video.currentTime || 0;
        const dur = Number.isFinite(video.duration) ? video.duration : Infinity;
        video.currentTime = Math.max(0, Math.min(dur, t0 + delta));
      };

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, (video.volume || 0) + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, (video.volume || 0) - 0.1);
          break;
        case "m":
        case "M":
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          } else {
            (container.requestFullscreen || container.webkitRequestFullscreen)?.call(container);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("mouseenter", onEnter);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [videoRef, containerRef]);
}
