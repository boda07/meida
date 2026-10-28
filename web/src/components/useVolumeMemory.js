import { useEffect } from "react";

const VOLUME_KEY = "meida:volume";   // 0..1, lembrado entre episodios
const MUDO_KEY = "meida:mudo";      // "true" | "false"

// Lembra o volume e o mudo entre episodios via localStorage.
//
// Responsabilidade unica: restaurar volume/mudo ao montar um video novo e
// persistir sempre que mudam. O componente continua a gerir o estado React
// (volume/mudo); este hook so espelha para o localStorage e aplica direto
// ao <video> no mount (sem passar pelo React, para evitar render desnecessario).
export function useVolumeMemory(videoRef) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Restaurar valores guardados (aplica direto ao video, sem setState).
    try {
      const v = localStorage.getItem(VOLUME_KEY);
      const m = localStorage.getItem(MUDO_KEY);
      if (v != null) {
        const vol = Number(v);
        if (Number.isFinite(vol)) video.volume = vol;
      }
      if (m != null) video.muted = m === "true";
    } catch (e) {
      // localStorage indisponível (modo privado, etc.): ignora.
    }

    // Persistir sempre que mudam.
    const onVol = () => {
      try {
        localStorage.setItem(VOLUME_KEY, String(video.volume));
        localStorage.setItem(MUDO_KEY, String(video.muted));
      } catch (e) {}
    };

    video.addEventListener("volumechange", onVol);
    return () => video.removeEventListener("volumechange", onVol);
  }, [videoRef]);
}
