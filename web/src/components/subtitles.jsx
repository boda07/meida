import { useEffect, useState } from "react";
import { useSettings } from "../settings/SettingsContext.jsx";

// Normaliza codigos de idioma variados (pt, pt-BR, por, en, eng...).
// Devolve 0 (nao corresponde), 1 (corresponde) ou 2 (corresponde em
// portugues de Portugal / ingles exato) para a preferencia dada.
function langScore(lang, pref) {
  const l = String(lang || "").toLowerCase().trim();
  if (pref === "pt") {
    if (l === "pt" || l === "por" || l === "pt-pt" || l === "por-pt") return 2;
    if (l.startsWith("pt") || l.startsWith("por") || l.startsWith("pob") || l.startsWith("pb")) return 1;
    return 0;
  }
  if (pref === "en") {
    if (l === "en" || l === "eng") return 2;
    if (l.startsWith("en") || l.startsWith("eng")) return 1;
    return 0;
  }
  return 0;
}

// Indice da melhor legenda que corresponde ao idioma preferido (-1 se nenhum).
// Prefere sempre PT-PT (2) a PT-BR (1) quando a preferencia e "pt".
function preferredIndex(subtitles, pref) {
  if (pref === "off") return -1;
  let best = -1;
  let bestScore = 0;
  subtitles.forEach((s, i) => {
    const sc = langScore(s.lang, pref);
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  });
  return best;
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
