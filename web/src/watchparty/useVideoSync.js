import { useEffect } from "react";
import { useWatchParty } from "./WatchPartyContext.jsx";

// Sincroniza um elemento <video> com a sala (play/pause/seek).
// Qualquer participante que mexa propaga para os outros; "pausa = pausa p/ todos".
// Liga aos players NOSSOS (HLS/torrent) — nos iframes não e possível.
export function useVideoSync(videoRef) {
  const party = useWatchParty();
  const active = party?.active;
  const send = party?.send;
  const subscribe = party?.subscribe;

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    // Enquanto aplicamos um evento remoto, não reemitimos (evita loops).
    let applying = false;
    const guard = (fn) => {
      applying = true;
      try {
        fn();
      } finally {
        // Liberta no próximo tick (depois dos eventos play/pause/seeked).
        setTimeout(() => {
          applying = false;
        }, 80);
      }
    };

    const onPlay = () => !applying && send("playback", { action: "play", time: video.currentTime });
    const onPause = () => !applying && send("playback", { action: "pause", time: video.currentTime });
    const onSeeked = () => !applying && send("playback", { action: "seek", time: video.currentTime });

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);

    const off = subscribe((payload) => {
      if (payload.kind === "sync-request") {
        // Alguem entrou a ver: partilha o estado atual.
        send("playback", {
          action: video.paused ? "pause" : "play",
          time: video.currentTime,
        });
        return;
      }
      if (payload.kind !== "playback") return;
      const { action, time } = payload.data || {};
      guard(() => {
        if (typeof time === "number" && Math.abs(video.currentTime - time) > 0.7) {
          video.currentTime = time;
        }
        if (action === "play") video.play().catch(() => {});
        else if (action === "pause") video.pause();
      });
    });

    // Pede o estado atual a quem já esta a ver.
    send("sync-request", {});

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      off?.();
    };
  }, [active, send, subscribe, videoRef]);
}
