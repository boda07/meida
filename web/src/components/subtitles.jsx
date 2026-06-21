import { useEffect, useState } from "react";
import { useSettings } from "../settings/SettingsContext.jsx";

// Normaliza codigos de idioma variados (pt, pt-BR, por, en, eng...).
function langMatches(lang, pref) {
  const l = String(lang || "").toLowerCase();
  if (pref === "pt") return l.startsWith("pt") || l.startsWith("por");
  if (pref === "en") return l.startsWith("en") || l.startsWith("eng");
  return false;
}

// Indice da primeira legenda que corresponde ao idioma preferido (-1 se nenhum).
function preferredIndex(subtitles, pref) {
  if (pref === "off") return -1;
  return subtitles.findIndex((s) => langMatches(s.lang, pref));
}

// Faixas <track> para colocar dentro de um <video>.
export function SubtitleTracks({ subtitles = [] }) {
  return (
    <>
      {subtitles.map((s, i) => (
        <track
          key={`${s.url}-${i}`}
          kind="subtitles"
          src={s.url}
          srcLang={s.lang}
          label={s.label}
        />
      ))}
    </>
  );
}

// Menu para escolher a legenda ativa, controlando textTracks do video.
// Ativa automaticamente a legenda do idioma preferido das definições.
export function SubtitleMenu({ videoRef, subtitles = [] }) {
  const { settings } = useSettings();
  const [val, setVal] = useState("-1");

  function apply(idx) {
    const tracks = videoRef.current?.textTracks;
    if (tracks) {
      for (let k = 0; k < tracks.length; k++) {
        tracks[k].mode = k === idx ? "showing" : "hidden";
      }
    }
    setVal(String(idx));
  }

  // Quando as legendas mudam, liga a do idioma preferido (se existir).
  useEffect(() => {
    if (!subtitles.length) return;
    const idx = preferredIndex(subtitles, settings.subtitleLang);
    // As textTracks podem ainda não estar prontas; tenta no próximo frame.
    const id = requestAnimationFrame(() => apply(idx));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles, settings.subtitleLang]);

  if (!subtitles.length) return null;
  return (
    <div className="sub-menu">
      <label>Legendas:</label>
      <select value={val} onChange={(e) => apply(Number(e.target.value))}>
        <option value="-1">Desligadas</option>
        {subtitles.map((s, i) => (
          <option key={i} value={i}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
