import { useEffect } from "react";
import { useWatchParty } from "./WatchPartyContext.jsx";

// Sincroniza um elemento <video> com a sala (play/pause/seek).
// Qualquer participante que mexa propaga para os outros; "pausa = pausa p/ todos".
// Liga aos players NOSSOS (HLS/torrent) — nos iframes (providers) não e possível.
export function useVideoSync(videoRef) {
  const party = useWatchParty();
  const active = party?.active;
  const send = party?.send;
  const subscribe = party?.subscribe;

  useEffect(() => {
    if (!active || !send || !subscribe) return;
    const video = videoRef.current;
    if (!video) return;

    // Enquanto aplicamos um evento remoto, não reemitimos (evita loops).
    let applying = false;
    // Estado que a sala quer (null = ainda nao sabemos). Serve para arrancar a
    // reproducao assim que o video ficar pronto, se "play" chegou antes disso.
    let wantPlaying = null;
    const guard = (fn) => {
      applying = true;
      try {
        fn();
      } finally {
        // Liberta depois dos eventos play/pause/seeked dispararem.
        setTimeout(() => {
          applying = false;
        }, 120);
      }
    };

    const emit = (action) => {
      if (applying) return;
      send("playback", { action, time: video.currentTime });
    };
    const onPlay = () => emit("play");
    const onPause = () => emit("pause");
    const onSeeked = () => emit("seek");
    // O video so ficou pronto agora: se a sala estava a reproduzir, arranca.
    // (O play remoto pode ter chegado enquanto o torrent ainda ligava.)
    const onCanPlay = () => {
      if (wantPlaying === true && video.paused) {
        guard(() => video.play().catch(() => {}));
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onCanPlay);

    const applyState = (action, time) => {
      guard(() => {
        if (typeof time === "number" && Math.abs(video.currentTime - time) > 0.7) {
          video.currentTime = time;
        }
        if (action === "play") {
          wantPlaying = true;
          // Se falhar (ainda a carregar), o onCanPlay volta a tentar.
          video.play().catch(() => {});
        } else if (action === "pause") {
          wantPlaying = false;
          video.pause();
        }
      });
    };

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
      applyState(action, time);
    });

    // Pede o estado atual a quem já esta a ver. Varias vezes, porque o player do
    // outro pode ainda nao estar montado quando entramos (o pedido perder-se-ia).
    const reqTimers = [0, 600, 1500, 3000].map((ms) =>
      setTimeout(() => send("sync-request", {}), ms)
    );

    return () => {
      reqTimers.forEach(clearTimeout);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onCanPlay);
      off?.();
    };
  }, [active, send, subscribe, videoRef]);
}
