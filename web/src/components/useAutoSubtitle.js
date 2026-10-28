import { useCallback, useEffect, useRef } from "react";
import { useSettings } from "../settings/SettingsContext.jsx";
import { preferredIndex } from "./subtitles.jsx";

// Seleciona automaticamente a legenda do idioma preferido quando as legendas mudam.
//
// Responsabilidade unica: chamar `preferredIndex` e aplicar a faixa correta
// via `video.textTracks`. As textTracks podem ainda nao estar prontas, por isso
// tenta no proximo frame com `requestAnimationFrame`.
//
// Devolve: nada (efeito colateral so).
export function useAutoSubtitle({ videoRef, subtitles = [] }) {
  const { settings } = useSettings();
  const idRef = useRef(null);

  const apply = useCallback((idx) => {
    const tracks = videoRef.current?.textTracks;
    if (!tracks) return;
    for (let k = 0; k < tracks.length; k++) {
      tracks[k].mode = k === idx ? "showing" : "hidden";
    }
  }, [videoRef]);

  useEffect(() => {
    if (!subtitles.length) return;
    const idx = preferredIndex(subtitles, settings.subtitleLang);
    idRef.current = requestAnimationFrame(() => apply(idx));
    return () => cancelAnimationFrame(idRef.current);
  }, [subtitles, settings.subtitleLang, apply]);
}
