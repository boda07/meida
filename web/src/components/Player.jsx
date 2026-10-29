import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullscreenButton from "./FullscreenButton.jsx";
import HlsPlayer from "./HlsPlayer.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { usePlayerFallback } from "./usePlayerFallback.js";
import { useNativeVideoSource } from "./useNativeVideoSource.js";

// Um provider pode devolver um `data:` URL (vi um a servir
// `data:application/pdf;base64,...` — um PDF disfarçado de página). Não é um
// player: o Chromium aborta o carregamento, o iframe nunca dispara `load`, e o
// auto-fallback acabava a trocar de fonte sozinho. Também não dá para acrescentar
// `?autoplay=` a um data: URL (vira lixo). Recusamos à partida.
function ePlayerValido(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

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

export default function Player({
  embeds,
  deadIds,
  title,
  startIndex = 0,
  manual = false,
  startAt,
  onProgress,
  audio,
}) {
  const t = useT();
  const iframeRef = useRef(null);
  const { settings } = useSettings();

  // Só entram fontes com URL http(s) — um `data:` URL não é um player.
  const lista = useMemo(
    () => (embeds || []).filter((e) => ePlayerValido(e.embedUrl)),
    [embeds]
  );
  const active = lista?.[0];
  const finalSrc = active ? applyPlaybackPrefs(active.embedUrl, settings) : null;

  // Auto-fallback de fontes: index, loaded, reloadKey, trocada, marcarCarregado.
  const {
    index,
    loaded,
    reloadKey,
    trocada,
    carregouRef,
    marcarCarregado,
    setIndex,
    setLoaded,
    setTrocada,
    setReloadKey,
    nextAlive,
  } = usePlayerFallback({
    lista,
    deadIds,
    startIndex,
    manual,
    arrancado: false,
    active,
  });

  // Fonte nativa (MegaPlay): o servidor devolve o m3u8 e as legendas em claro.
  const nativoUrl = active?.native ? active.embedUrl : null;
  const { nativoPronto } = useNativeVideoSource({ nativoUrl, audio });
  const isNativoPronto = Boolean(nativoPronto);

  // Com o autoplay DESLIGADO, o iframe só nasce depois de um clique.
  const [arrancado, setArrancado] = useState(() => settings.autoplay);

  // Fonte nova (episódio novo, título novo, trocar de áudio): o portão volta a
  // aparecer se o autoplay estiver desligado. Não se mexe quando só o índice muda,
  // para o auto-fallback de 15s poder trocar de fonte sem pedir outro clique.
  useEffect(() => {
    setArrancado(settings.autoplay);
  }, [lista, settings.autoplay]);

  // Erro fatal do hls.js na fonte nativa: mesma lógica do timeout de 15s.
  const onErroNativo = useCallback(() => {
    const proximo = nextAlive(index, lista, deadIds);
    if (proximo === index) {
      setErroFonte(active?.name || null);
      setLoaded(true);
      return;
    }
    setTrocada(active?.name || null);
    setIndex(proximo);
    setReloadKey((k) => k + 1);
    setLoaded(false);
    setErroFonte(null);
  }, [index, lista, deadIds, active, setIndex, setLoaded, setTrocada, setReloadKey]);

  // Estado de erro da fonte nativa (separado do fallback).
  const [erroFonte, setErroFonte] = useState(null);

  if (!active) return null;

  return (
    <>
      {arrancado && isNativoPronto ? (
        <HlsPlayer
          key={`${nativoUrl}-${audio || "sub"}`}
          sources={nativoPronto.sources}
          subtitles={nativoPronto.subtitles || []}
          startAt={startAt}
          onProgress={onProgress}
          onLoaded={marcarCarregado}
          onErro={onErroNativo}
          intro={nativoPronto.intro}
          outro={nativoPronto.outro}
        />
      ) : (
        <div className="player">
          {arrancado ? (
            <iframe
              key={reloadKey}
              ref={iframeRef}
              src={finalSrc}
              title={title || active.name || "player"}
              allowFullScreen
              referrerPolicy="origin"
              onLoad={marcarCarregado}
              allow={`${settings.autoplay ? "autoplay; " : ""}encrypted-media; fullscreen; picture-in-picture`}
            />
          ) : (
            <button
              type="button"
              className="player-arrancar"
              onClick={() => setArrancado(true)}
              title={t("Carregar o vídeo")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>{t("Carregar vídeo")}</span>
            </button>
          )}
          {arrancado && (
            <button
              type="button"
              className="player-reload"
              title={t("Recarregar fonte (se não carregar / erro 520)")}
              aria-label={t("Recarregar fonte")}
              onClick={() => {
                setReloadKey((k) => k + 1);
                setLoaded(false);
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 0 14.85-3.36L23 10M1 14l4.64 4.36A20.49 15 0 0 0 20.49 15" />
              </svg>
            </button>
          )}
          {arrancado && !loaded && active.name && (
            <span className="player-loading-hint muted" style={{ position: "absolute", right: 8, bottom: 8, fontSize: 12 }}>
              {t("{nome} · a carregar...", { nome: active.name })}
            </span>
          )}
          {arrancado && trocada && loaded && (
            <span className="player-loading-hint muted" style={{ position: "absolute", left: 8, bottom: 8, fontSize: 12 }}>
              {t("{fonte} não carregou · a usar {nome}", {
                fonte: trocada,
                nome: active?.name,
              })}
            </span>
          )}
          {arrancado && erroFonte && loaded && (
            <span className="player-loading-hint muted" style={{ position: "absolute", left: 8, bottom: 8, fontSize: 12, color: "#c90303" }}>
              {t("{fonte} falhou · a usar {nome}", {
                fonte: erroFonte,
                nome: active?.name,
              })}
            </span>
          )}
          {arrancado && <FullscreenButton targetRef={iframeRef} />}
        </div>
      )
  );
}
