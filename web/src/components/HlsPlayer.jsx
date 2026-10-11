import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { SubtitleTracks, SubtitleMenu } from "./subtitles.jsx";
import FullscreenButton from "./FullscreenButton.jsx";
import { usePlayerShortcuts } from "./usePlayerShortcuts.js";
import { useVideoSync } from "../watchparty/useVideoSync.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { pularVisivel, autoskipDestino, formatarTempo } from "./pularIntro.js";

// Player HLS próprio (sem anúncios) com legendas.
// `startAt` (s): retoma nessa posicao. `onProgress(p, d)`: chamado ~1x/5s.
// `onLoaded()`: chamado quando o video tem metadados. E' o que o `Player` usa
// para tirar o aviso "a carregar" — sem isto, um player nativo nunca o
// desligava e ficava a mostra-lo por cima do video a dar.
// `intro` / `outro`: `{start, end}` em segundos, como o MegaPlay devolve. Ver
// `pularIntro.js` — a logica e' pura e esta testada por mutacao.
export default function HlsPlayer({
  sources = [],
  subtitles = [],
  startAt,
  onProgress,
  onLoaded,
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

  // ── Pular a abertura e o fim ───────────────────────────────────────────────
  // `tempo` e' o `currentTime`, mas NAO o metemos num `setState` a cada
  // `timeupdate`: o `timeupdate` dispara ~4x por segundo e o componente tem o
  // `sources` inteiro como dependencia do efeito do `hls.js` — um render por
  // quarto de segundo nao e' o que se quer. Em vez disso, so' se re-renderiza
  // quando a **decisao** muda (aparece um botao, desaparece, salta). E' um
  // botao que dura 90 s; nao precisa de 4actualizacoes por segundo.
  const [pulando, setPulando] = useState(null); // {tipo, destino} ou null
  const jaSaltou = useRef(new Set());

  const decidir = useCallback((video) => {
    if (!video) return;
    const tempo = video.currentTime;
    const duracao = video.duration;

    // Autoskip ligado: salta sozinho, uma vez, e sem mostrar botao. A Definicoes
    // promete "tenta saltar a intro" — nao "pergunta". Desligado, so o botao.
    if (settings.autoskip) {
      const destino = autoskipDestino({
        intro,
        tempo,
        jaSaltou: jaSaltou.current,
        duracao,
      });
      if (destino != null) {
        jaSaltou.current.add("intro");
        video.currentTime = destino;
        setPulando(null);
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
    // `setState` com o MESMO valor nao re-renderiza o React, portanto comparar
    // aqui e' so uma optimizacao — o `timeupdate` dispara 4x/s e o botao nao
    // muda nesse intervalo.
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
    // `decidir` entra porque e' um `useCallback` que muda so' quando mudam o
    // intro/outro ou a definicao — e quando muda, tem de ser o closure novo a
    // estar a ouvir. Sem isto o botao continuaria a usar os tempos do episodio
    // anterior depois de trocar de episode.
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
    // O Watch Party tem de saber: um seek nosso que nao passa pelo `seeked` do
    // outro jogador deixa os participantes dessincronizados.
    video.dispatchEvent(new Event("seeked"));
  };

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
        <FullscreenButton targetRef={containerRef} />
      </div>
      <SubtitleMenu videoRef={videoRef} subtitles={subtitles} />
    </div>
  );
}
