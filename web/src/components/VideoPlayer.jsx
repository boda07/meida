import { useEffect, useRef, useState } from "react";
import { SubtitleTracks, SubtitleMenu } from "./subtitles.jsx";
import FullscreenButton from "./FullscreenButton.jsx";
import { useVideoSync } from "../watchparty/useVideoSync.js";
import { useSettings } from "../settings/SettingsContext.jsx";

// Player HTML5 proprio para streams de torrent (sem anuncios).
export default function VideoPlayer({ src, infoHash, subtitles = [] }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { settings } = useSettings();
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(false);
  useVideoSync(videoRef); // Watch Party: sincroniza play/pause/seek

  useEffect(() => {
    if (!infoHash) return;
    setErr(false);
    const tick = () =>
      fetch(`/api/stream/${infoHash}/status`)
        .then((r) => r.json())
        .then((d) => setStatus(d.status))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [infoHash, src]);

  const mb = (n) => (n / 1024 / 1024).toFixed(1);

  return (
    <div className="vplayer">
      <div className="player" ref={containerRef}>
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay={settings.autoplay}
          crossOrigin="anonymous"
          onError={() => setErr(true)}
        >
          <SubtitleTracks subtitles={subtitles} />
        </video>
        <FullscreenButton targetRef={containerRef} />
      </div>
      <SubtitleMenu videoRef={videoRef} subtitles={subtitles} />
      {err && (
        <p className="vhint">
          O browser nao consegue reproduzir este ficheiro (provavelmente .mkv ou
          codec x265). Experimenta um torrent <b>1080p em .mp4 / x264</b>.
        </p>
      )}
      {status && (
        <div className="vstatus">
          <span className="vbar">
            <span style={{ width: `${status.progress}%` }} />
          </span>
          {status.progress}% · 👤 {status.peers} peers · ⬇ {mb(status.downloadSpeed)} MB/s
        </div>
      )}
    </div>
  );
}
