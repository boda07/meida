import { useCallback, useEffect, useRef, useState } from "react";
import { SubtitleTracks, SubtitleMenu } from "./subtitles.jsx";
import PlayerControls from "./PlayerControls.jsx";
import QualityMenu from "./QualityMenu.jsx";
import { usePlayerShortcuts } from "./usePlayerShortcuts.js";
import { useVideoSync } from "../watchparty/useVideoSync.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { pularVisivel, autoskipDestino, formatarTempo } from "./pularIntro.js";
import { useHlsEngine } from "./useHlsEngine.js";
import { useVideoProgress } from "./useVideoProgress.js";

// Player HLS próprio (sem anúncios) com legendas.
//
// `startAt` (s): retoma nessa posicao. `onProgress(p, d)`: chamado ~1x/5s.
// `onLoaded()`: chamado quando o video tem metadados.
// `intro` / `outro`: `{start, end}` em segundos, como o MegaPlay devolve.
// `pularIntro.js` — a logica e' pura e esta testada por mutacao.
export default function HlsPlayer({
  sources = [],
  subtitles = [],
  startAt,
  onProgress,
  onLoaded,
  onErro, // falha fatal irrecuperavel: o Player passa para a fonte seguinte
  intro = null,
  outro = null,
}) {
  const t = useT();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { settings } = useSettings();
  const src = sources[0]?.url;
  useVideoSync(videoRef); // Watch Party: sincroniza play/pause/seek
  usePlayerShortcuts(videoRef, containerRef); // Atalhos de teclado

  // ── Engine hls.js (qualidade + recuperacao de erros) ──
  const { hls, niveis, nivelAuto, ativo, mudarQualidade } = useHlsEngine({
    src,
    videoRef,
    onErro,
  });

  // ── Reportar progresso ──
  useVideoProgress({ videoRef, onProgress });

  // ── Pular a abertura e o fim ──
  // `tempo` e' o `currentTime`, mas NAO o metemos num `setState` a cada
  // `timeupdate`. So' se re-renderiza quando a decisao muda (aparece/
  // desaparece/salta).
  const [pulando, setPulando] = useState(null); // {tipo, destino} ou null
  const jaSaltou = useRef(new Set());

  const decidir = useCallback((video) => {
    if (!video) return;
    const tempo = video.currentTime;
    const duracao = video.duration;

    // Autoskip ligado: salta sozinho, uma vez, e sem mostrar botao.
    if (settings.autoskip) {
      const destino = autoskipDestino({
        intro,
        tempo,
        jaSaltou: jaSaltou.current,
        duracao,
      });
      if (destino != null) {
        saltarPara(destino, "intro");
        return;
      }
    }

    const v = pularVisivel({
      intro,
      outro,
      tempo,
      jaSaltou: jaSaltou.current,
      duracao,
    });
    setPulando((atual) => {
      if (!v) return atual === null ? atual : null;
      if (atual && atual.tipo === v.tipo && atual.destino === v.destino) return atual;
      return v;
    });
  }, [intro, outro, settings.autoskip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => decidir(video);
    const onTime = () => decidir(video);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("timeupdate", onTime);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("timeupdate", onTime);
    };
  }, [decidir]);

  // Episodio novo: o que se saltou no anterior nao vale para este.
  useEffect(() => {
    jaSaltou.current = new Set();
    setPulando(null);
  }, [src]);

  const saltarPara = (destino, tipo) => {
    const video = videoRef.current;
    if (!video) return;
    jaSaltou.current.add(tipo);
    video.currentTime = destino;
    setPulando(null);
    // O Watch Party tem de saber: um seek nosso que nao passa pelo `seeked`
    // do outro jogador deixa os participantes dessincronizados.
    video.dispatchEvent(new Event("seeked"));
  };

  // Retoma a meio (posicao guardada do "continua a ver") e avisa que ja ha video.
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

  if (!src) return <p className="muted">{t("Sem fonte.")}</p>;

  return (
    <div className="vplayer">
      <div
        className="player"
        ref={containerRef}
        // Tocar no video alterna play/pausa. Sem `controls` nao ha' botao do
        // browser para isso, e o toque no video e' o gesto que toda a gente faz.
        onClick={(e) => {
          if (e.target.closest("button, input, .pc-seek, .pc-pop")) return;
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
      >
        {/* SEM `controls`: a barra e' nossa (ver `PlayerControls.jsx`). */}
        <video ref={videoRef} autoPlay={settings.autoplay} crossOrigin="anonymous" playsInline>
          <SubtitleTracks subtitles={subtitles} delay={settings.subDelay || 0} />
        </video>
        {pulando && (
          <button
            type="button"
            className="skip-btn"
            onClick={() => saltarPara(pulando.destino, pulando.tipo)}
          >
            {pulando.tipo === "intro"
              ? t("Saltar a abertura")
              : t("Saltar o fim")}
            <span className="skip-btn-sub">{t("Ir para {t}", { t: formatarTempo(pulando.destino) })}</span>
          </button>
        )}
        <PlayerControls videoRef={videoRef}>
          <QualityMenu
            niveis={niveis}
            nivelAuto={nivelAuto}
            ativo={ativo}
            onMudar={mudarQualidade}
          />
          <SubtitleMenu videoRef={videoRef} subtitles={subtitles} />
        </PlayerControls>
      </div>
    </div>
  );
}
