import { useEffect, useRef, useState } from "react";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";

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
  const t = useT();
  return (
    <>
      {subtitles.map((s, i) => (
        <track
          key={`${s.url}-${i}`}
          kind="subtitles"
          src={s.url}
          srcLang={s.lang}
          label={t(s.label)}
        />
      ))}
    </>
  );
}

/**
 * Botao de legendas DENTRO do player, com a lista num popup.
 *
 * Antes era um `<select>` por baixo do video (`.sub-menu`). Isso obligeia a
 * olhar para baixo do ecra para mudar a legenda e — pior — no `HlsPlayer` o
 * menu ficava CORTADO pelo `overflow: hidden` da caixa do player (2026-10-12),
 * ou seja, no MegaPlay nativo nao se via nada. Agora e' um botao dentro do
 * player, como no YouTube/Netflix, e a decisao de mostrar ou nao legendas e'
 * tomada ali mesmo.
 *
 * Monta-se dentro do `<div className="player">` (o do video), por isso e'
 * posicionado em absoluto.
 */
export function SubtitleMenu({ videoRef, subtitles = [] }) {
  const { settings } = useSettings();
  const t = useT();
  const [val, setVal] = useState("-1");
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef(null);

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

  // Clicar fora fecha o popup. Sem isto ficava aberto por cima do video.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  if (!subtitles.length) return null;

  const ligada = val !== "-1";

  return (
    <div className="sub-cc" ref={caixaRef}>
      <button
        type="button"
        className={`sub-cc-btn ${ligada ? "on" : ""}`}
        onClick={() => setAberto((a) => !a)}
        title={t("Legendas")}
        aria-label={t("Legendas")}
        aria-expanded={aberto}
      >
        {/* Icone CC (closed captions), o mesmo de sempre no ecra */}
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M10 10.2a2.6 2.6 0 1 0 0 3.6M18 10.2a2.6 2.6 0 1 0 0 3.6" />
        </svg>
      </button>

      {aberto && (
        <div className="sub-cc-pop" role="menu">
          {/* A primeira opcao e' SEM legendas. E' a resposta a "eu deveria
              decidir a aparecia das legendas dentro do player". */}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!ligada}
            className={!ligada ? "on" : ""}
            onClick={() => {
              apply(-1);
              setAberto(false);
            }}
          >
            {t("Desligadas")}
          </button>
          {subtitles.map((s, i) => (
            <button
              key={`${s.url}-${i}`}
              type="button"
              role="menuitemradio"
              aria-checked={val === String(i)}
              className={val === String(i) ? "on" : ""}
              onClick={() => {
                apply(i);
                setAberto(false);
              }}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
