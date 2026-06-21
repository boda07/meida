import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { SubtitleTracks, SubtitleMenu } from "./subtitles.jsx";
import FullscreenButton from "./FullscreenButton.jsx";
import { useVideoSync } from "../watchparty/useVideoSync.js";
import { useSettings } from "../settings/SettingsContext.jsx";

// Player HLS próprio (sem anúncios) com legendas.
export default function HlsPlayer({ sources = [], subtitles = [] }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { settings } = useSettings();
  const src = sources[0]?.url;
  useVideoSync(videoRef); // Watch Party: sincroniza play/pause/seek

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
  }, [src]);

  if (!src) return <p className="muted">Sem fonte.</p>;

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
