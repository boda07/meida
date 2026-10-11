import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { SubtitleTracks, SubtitleMenu } from "./subtitles.jsx";
import FullscreenButton from "./FullscreenButton.jsx";
import { usePlayerShortcuts } from "./usePlayerShortcuts.js";
import { useVideoSync } from "../watchparty/useVideoSync.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";

// Player HLS próprio (sem anúncios) com legendas.
// `startAt` (s): retoma nessa posicao. `onProgress(p, d)`: chamado ~1x/5s.
// `onLoaded()`: chamado quando o video tem metadados. E' o que o `Player` usa
// para tirar o aviso "a carregar" — sem isto, um player nativo nunca o
// desligava e ficava a mostra-lo por cima do video a dar.
export default function HlsPlayer({
  sources = [],
  subtitles = [],
  startAt,
  onProgress,
  onLoaded,
}) {
  const t = useT();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { settings } = useSettings();
  const src = sources[0]?.url;
  useVideoSync(videoRef); // Watch Party: sincroniza play/pause/seek
  usePlayerShortcuts(videoRef, containerRef); // Atalhos de teclado

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls;

    if (Hls.isSupported() && sources[0]?.isM3U8 !== false) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      // Safari (HLS nativo) ou ficheiro progressivo.
      video.src = src;
    }

    return () => hls?.destroy();
  }, [src, sources]);

  // Retoma a meio (posicao guardada do "continua a ver") e avisa que ja ha' video.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => {
      if (startAt != null && video.currentTime < 2) video.currentTime = startAt;
      onLoaded?.();
    };
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [src, startAt, onLoaded]);

  // Reporta a posicao periodicamente (nao a cada timeupdate: spam desnecessario).
  useEffect(() => {
    if (!onProgress) return;
    const video = videoRef.current;
    if (!video) return;
    let last = 0;
    const onTime = () => {
      const now = Math.floor(video.currentTime);
      if (now - last >= 5) {
        last = now;
        onProgress(now, Math.floor(video.duration || 0));
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [src, onProgress]);

  if (!src) return <p className="muted">{t("Sem fonte.")}</p>;

  return (
    <div className="vplayer">
      <div className="player" ref={containerRef}>
        <video ref={videoRef} controls autoPlay={settings.autoplay} crossOrigin="anonymous">
          <SubtitleTracks subtitles={subtitles} />
        </video>
        <FullscreenButton targetRef={containerRef} />
      </div>
      <SubtitleMenu videoRef={videoRef} subtitles={subtitles} />
    </div>
  );
}
