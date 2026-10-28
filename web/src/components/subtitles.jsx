import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";
import {
  cssLegendas,
  urlComAtraso,
  ROTULO_TAMANHO,
  ROTULO_FONTE,
  TAMANHOS,
  FONTES,
  OPACIDADE_MIN,
  OPACIDADE_MAX,
  DELAY_MIN,
  DELAY_MAX,
} from "./legendas.js";
import { useSubtitlePreferences } from "./useSubtitlePreferences.js";
import { useAutoSubtitle } from "./useAutoSubtitle.js";

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
export function preferredIndex(subtitles, pref) {
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
//
// O `delay` (atraso) entra no URL: quem desloca os tempos e' o servidor
// (`server/src/services/legendas.js`), porque o `<track>` do browser nao deixa
// mexer neles. O `delay` entra na `key` para o React trocar o elemento quando o
// atraso muda — se nao entrasse, reutilizava o <track> antigo e a legenda ficava
// igual.
export function SubtitleTracks({ subtitles = [], delay = 0 }) {
  const t = useT();
  return (
    <>
      {subtitles.map((s, i) => (
        <track
          key={`${s.url}-${delay}-${i}`}
          kind="subtitles"
          src={urlComAtraso(s.url, delay)}
          srcLang={s.lang}
          label={t(s.label)}
        />
      ))}
    </>
  );
}

/**
 * Botao de legendas DENTRO do player, com a lista e as opcoes de displaying.
 *
 * Antes era um `<select>` por baixo do video. Isso obligeia a
 * olhar para baixo do ecra para mudar a legenda e — pior — no `HlsPlayer` o
 * menu ficava CORTADO pelo `overflow: hidden` da caixa do player (2026-10-12),
 * ou seja, no MegaPlay nativo nao se via nada. Agora e' um botao dentro do
 * player, como no YouTube/Netflix, e a decisao de mostrar ou nao legendas e'
 * tomada ali mesmo.
 *
 * O popup tem duas partes: a LISTA (que legenda, ou "desligadas") e as OPCOES
 * (tamanho, opacidade, fonte, atraso). Sao as quatro coisas que se pode mudar
 * sem sair do video — o resto seria um Formulario nas Definicoes, e o atraso
 * so' faz sentido a mexer aqui, com o video a dar.
 *
 * Monta-se dentro da barra de controlos (`PlayerControls.jsx`), por isso e'
 * posicionado em absoluto.
 */
export function SubtitleMenu({ videoRef, subtitles = [] }) {
  const t = useT();
  const [val, setVal] = useState("-1");
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef(null);

  // Preferencias de exibicao (tamanho, opacidade, fonte, atraso).
  const {
    subTamanho,
    subOpacidade,
    subFonte,
    subDelay,
    updateSubtitles,
  } = useSubtitlePreferences();

  // Seleciona automaticamente a legenda do idioma preferido.
  useAutoSubtitle({ videoRef, subtitles });

  function apply(idx) {
    const tracks = videoRef.current?.textTracks;
    if (tracks) {
      for (let k = 0; k < tracks.length; k++) {
        tracks[k].mode = k === idx ? "showing" : "hidden";
      }
    }
    setVal(String(idx));
  }

  // O `<video>` recebe as variaveis de CSS que o `::cue` consome. E' aqui que a
  // opacidade, a fonte e o tamanho mudam — nao ha' componente no meio.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const vars = cssLegendas({
      tamanho: subTamanho,
      opacidade: subOpacidade,
      fonte: subFonte,
    });
    for (const [k, v] of Object.entries(vars)) video.style.setProperty(k, v);
    // A fonte precisa de uma classe porque nao da para meter uma pilha com
    // virgulas numa variavel e usa-la em `font-family` sem a classe.
    video.classList.toggle("legenda-fonte", Boolean(vars["--sub-fonte"]));
  }, [videoRef, subTamanho, subOpacidade, subFonte]);

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

  const ligada = val !== "-1";

  if (!subtitles.length) return null;

  const classeBotao = `sub-cc-btn ${ligada ? "on" : ""}`;

  const podeRepor =
    (subTamanho && subTamanho !== "normal") ||
    subOpacidade !== 1 ||
    subFonte ||
    subDelay !== 0;

  return (
    <div className="sub-cc" ref={caixaRef}>
      <button
        type="button"
        className={classeBotao}
        onClick={() => setAberto((a) => !a)}
        title={t("Legendas")}
        aria-label={t("Legendas")}
        aria-expanded={aberto}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M10 10.2a2.6 2.6 0 1 0 0 3.6M18 10.2a2.6 2.6 0 1 0 0 3.6" />
        </svg>
      </button>

      {aberto && (
        <div className="pc-pop" role="menu">
          <div className="pc-pop-sec">
            <p className="pc-pop-titulo">{t("Legenda")}</p>
            {/* A primeira opcao e' SEM legendas. E' a resposta a "eu deveria
                decidir a aparecia das legendas dentro do player". */}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!ligada}
              className={!ligada ? "on" : ""}
              onClick={() => apply(-1)}
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
                onClick={() => apply(i)}
              >
                {t(s.label)}
              </button>
            ))}
          </div>

          <div className="pc-pop-sec">
            <p className="pc-pop-titulo">{t("Como mostrar")}</p>

            <label className="pc-pop-linha">
              <span>{t("Tamanho")}</span>
              <select
                value={subTamanho}
                onChange={(e) => updateSubtitles("subTamanho", e.target.value)}
              >
                {TAMANHOS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {t(ROTULO_TAMANHO[x.id])}
                  </option>
                ))}
              </select>
            </label>

            <label className="pc-pop-linha">
              <span>{t("Opacidade")}</span>
              <input
                type="range"
                min={OPACIDADE_MIN}
                max={OPACIDADE_MAX}
                step="0.05"
                value={subOpacidade}
                onChange={(e) => updateSubtitles("subOpacidade", Number(e.target.value))}
              />
              <em>{Math.round(subOpacidade * 100)}%</em>
            </label>

            <label className="pc-pop-linha">
              <span>{t("Fonte")}</span>
              <select value={subFonte} onChange={(e) => updateSubtitles("subFonte", e.target.value)}>
                {FONTES.map((f) => (
                  <option key={f.id || "sistema-padrao"} value={f.id}>
                    {t(ROTULO_FONTE[f.id])}
                  </option>
                ))}
              </select>
            </label>

            <label className="pc-pop-linha">
              <span>{t("Atraso")}</span>
              <input
                type="range"
                min={DELAY_MIN}
                max={DELAY_MAX}
                step="0.5"
                value={subDelay}
                onChange={(e) => updateSubtitles("subDelay", Number(e.target.value))}
              />
              <em>
                {subDelay > 0 ? "+" : ""}
                {subDelay}s
              </em>
            </label>

            {podeRepor ? (
              <button
                type="button"
                className="sub-cc-repor"
                onClick={() =>
                  updateSubtitles("subTamanho", "normal") ||
                  updateSubtitles("subOpacidade", 1) ||
                  updateSubtitles("subFonte", "") ||
                  updateSubtitles("subDelay", 0)
                }
              >
                {t("Repor")}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
