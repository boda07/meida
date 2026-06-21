import { useRef, useState } from "react";
import FullscreenButton from "./FullscreenButton.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";

// Ajusta o URL do embed conforme as definicoes de autoplay/autoskip.
// (Nos iframes externos so podemos influenciar via parametros do URL.)
function applyPlaybackPrefs(src, { autoplay, autoskip }) {
  let url = src;
  const val = autoplay ? "true" : "false";
  url = url.replace(/(autoplay|autoPlay)=(true|false)/gi, `$1=${val}`);
  if (autoskip && !/autoSkipIntro=/i.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "autoSkipIntro=true&autoSkip=true";
  }
  return url;
}

// Player por iframe (providers externos). Inclui um botao de recarregar porque
// alguns providers (ex.: MegaPlay) devolvem erros transitorios (520) e basta
// voltar a carregar a fonte.
export default function Player({ src, title }) {
  const ref = useRef(null);
  const { settings } = useSettings();
  const [reloadKey, setReloadKey] = useState(0);
  if (!src) return null;
  const finalSrc = applyPlaybackPrefs(src, settings);
  return (
    <div className="player" ref={ref}>
      {/* Sem sandbox: estes providers detetam e recusam iframes em sandbox.
          O custo sao popups/anuncios, inerentes a este tipo de fonte. */}
      <iframe
        key={reloadKey}
        src={finalSrc}
        title={title || "player"}
        allowFullScreen
        referrerPolicy="origin"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      />
      <button
        type="button"
        className="player-reload"
        title="Recarregar fonte (se nao carregar / erro 520)"
        aria-label="Recarregar fonte"
        onClick={() => setReloadKey((k) => k + 1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
      <FullscreenButton targetRef={ref} />
    </div>
  );
}
