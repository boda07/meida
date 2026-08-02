import { useEffect, useRef, useState } from "react";
import FullscreenButton from "./FullscreenButton.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";

function applyPlaybackPrefs(src, { autoplay, autoskip }) {
  let url = src;
  const val = autoplay ? "true" : "false";
  if (/autoplay=/i.test(url)) {
    url = url.replace(/(autoplay|autoPlay)=(true|false)/gi, `$1=${val}`);
  } else {
    url += (url.includes("?") ? "&" : "?") + `autoplay=${val}&autoPlay=${val}`;
  }
  if (autoskip && !/autoSkipIntro=/i.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "autoSkipIntro=true&autoSkip=true";
  }
  return url;
}

// Player por iframe (providers externos). Auto-fallback: se uma fonte demorar
// demais (>TIMEOUT ms) ou falhar, passa automaticamente para a proxima da lista,
// saltando os providers marcados como mortos (deadIds). Evita o "loading" infinito
// quando o provider activo esta down (ex.: IPs de datacenter, bot detection).
const TIMEOUT_MS = 15000;
export default function Player({ embeds, deadIds, title, startIndex = 0 }) {
  const iframeRef = useRef(null);
  const { settings } = useSettings();
  const [reloadKey, setReloadKey] = useState(0);
  // Indice da fonte activa dentro da lista `embeds` (nao o providerId).
  const [index, setIndex] = useState(() => firstAlive(embeds, deadIds, startIndex));
  const [loaded, setLoaded] = useState(false);

  const active = embeds?.[index];
  const finalSrc = active ? applyPlaybackPrefs(active.embedUrl, settings) : null;

  useEffect(() => {
    // Re-inicia o indice activo quando a lista ou a origem mudarem.
    setIndex(() => firstAlive(embeds, deadIds, startIndex));
    setReloadKey((k) => k + 1);
    setLoaded(false);
  }, [embeds, deadIds, startIndex]);

  useEffect(() => {
    if (!active) return;
    setLoaded(false);
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        // Timeout: provider provavelmente down. Avanca silenciosamente.
        done = true;
        setIndex((i) => nextAlive(i + 1, embeds, deadIds));
        setReloadKey((k) => k + 1);
        setLoaded(false);
      }
    }, TIMEOUT_MS);

    const iframe = iframeRef.current;
    const onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        setLoaded(true);
      }
    };
    iframe?.addEventListener("load", onload);
    return () => {
      clearTimeout(timer);
      iframe?.removeEventListener("load", onload);
    };
  }, [active, embeds, deadIds]);

  if (!active) return null;

  return (
    <div className="player" ref={iframeRef}>
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={finalSrc}
        title={title || active.name || "player"}
        allowFullScreen
        referrerPolicy="origin"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      />
      <button
        type="button"
        className="player-reload"
        title="Recarregar fonte (se não carregar / erro 520)"
        aria-label="Recarregar fonte"
        onClick={() => {
          setReloadKey((k) => k + 1);
          setLoaded(false);
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 0 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
      {!loaded && active.name && (
        <span className="player-loading-hint muted" style={{ position: "absolute", right: 8, bottom: 8, fontSize: 12 }}>
          {active.name} · a carregar...
        </span>
      )}
      <FullscreenButton targetRef={iframeRef} />
    </div>
  );
}

// Primeiro embed "vivo" (nao em deadIds), ou o primeiro conhecido.
function firstAlive(list, dead, start) {
  if (!list?.length) return 0;
  const s = Math.max(0, start);
  for (let i = s; i < list.length; i++) if (!dead?.has(list[i].provider)) return i;
  for (let i = 0; i < s; i++) if (!dead?.has(list[i].provider)) return i;
  return s < list.length ? s : 0;
}

// Proximo indice vivo a partir de `i`.
function nextAlive(i, list, dead) {
  if (!list?.length) return 0;
  for (let j = i; j < list.length; j++) if (!dead?.has(list[j].provider)) return j;
  for (let j = 0; j < i; j++) if (!dead?.has(list[j].provider)) return j;
  return 0;
}
