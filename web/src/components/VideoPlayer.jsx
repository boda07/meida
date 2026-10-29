import { useEffect, useRef, useState } from "react";
import { SubtitleTracks, SubtitleMenu } from "./subtitles.jsx";
import PlayerControls from "./PlayerControls.jsx";
import { usePlayerShortcuts } from "./usePlayerShortcuts.js";
import { useVideoSync } from "../watchparty/useVideoSync.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { useVideoProgress } from "./useVideoProgress.js";
import { useTorrentStatus } from "./useTorrentStatus.js";
import { useStopTorrent } from "./useStopTorrent.js";

// Player HTML5 próprio para streams de torrent (sem anúncios).
// `startAt` (s): retoma nessa posicao. `onProgress(p, d)`: chamado ~1x/5s com a
// posicao e duracao atuais (para o "continua a ver" retomar a meio).
export default function VideoPlayer({ src, infoHash, subtitles = [], startAt, onProgress, onRemoved }) {
  const t = useT();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { settings } = useSettings();
  const [err, setErr] = useState(false);

  useVideoSync(videoRef); // Watch Party: sincroniza play/pause/seek
  usePlayerShortcuts(videoRef, containerRef); // Atalhos de teclado

  // Retoma a meio (posicao guardada do "continua a ver").
  useEffect(() => {
    const video = videoRef.current;
    if (!video || startAt == null) return;
    const onMeta = () => {
      if (video.currentTime < 2) video.currentTime = startAt;
    };
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [src, startAt]);

  // Reporta a posicao periodicamente (nao a cada timeupdate: spam desnecessario).
  useVideoProgress({ videoRef, onProgress });

  // Status do stream (progresso do WebTorrent, peers, velocidade).
  const { status } = useTorrentStatus({ infoHash, src });

  // Parar o torrent (WebTorrent local).
  const { stop, removing, erroParar } = useStopTorrent({ infoHash });

  const mb = (n) => (n / 1024 / 1024).toFixed(1);

  return (
    <div className="vplayer">
      <div
        className="player"
        ref={containerRef}
        // Tocar no video alterna play/pausa, como no `HlsPlayer`: sem `controls`
        // nao ha' botao do browser para isso.
        onClick={(e) => {
          // Nao quando se clicou num botao (o evento sobe ate aqui).
          if (e.target.closest("button, input, .pc-seek, .pc-pop")) return;
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
      >
        {/* SEM `controls`: a barra e' nossa, a mesma do `HlsPlayer`
            (`PlayerControls.jsx`). Sem mudancas de qualidade porque este
            player e' de um ficheiro progressivo — nao ha' variantes. */}
        <video
          ref={videoRef}
          src={src}
          autoPlay={settings.autoplay}
          crossOrigin="anonymous"
          playsInline
          onError={() => setErr(true)}
        >
          <SubtitleTracks subtitles={subtitles} delay={settings.subDelay || 0} />
        </video>
        {/* O ecra inteiro ja vem na barra (ultimo botao), por isso o
            `FullscreenButton` de topo nao se usa aqui. */}
        <PlayerControls videoRef={videoRef}>
          <SubtitleMenu videoRef={videoRef} subtitles={subtitles} />
        </PlayerControls>
      </div>
      {err && (
        <p className="vhint">
          {t("O browser não consegue reproduzir este ficheiro (provavelmente .mkv ou codec x265). Usa o filtro {filtro} na lista de torrents e escolhe um {formato}.")}
        </p>
      )}
      {erroParar && (
        <p className="vhint vhint-erro" role="alert">
          {erroParar}
        </p>
      )}
      {status && (
        <div className="vstatus">
          <span className="vbar">
            <span style={{ width: `${status.progress}%` }} />
          </span>
          {t("{pct}% · 👤 {peers} peers · ⬇ {vel} MB/s", {
            pct: status.progress,
            peers: status.peers,
            vel: mb(status.downloadSpeed),
          })}
          <button className="vstop" onClick={stop} disabled={removing}>
            {removing ? t("A parar...") : "✕ Parar torrent"}
          </button>
        </div>
      )}
    </div>
  );
}
