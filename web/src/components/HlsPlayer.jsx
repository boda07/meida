import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { SubtitleTracks, SubtitleMenu } from "./subtitles.jsx";
import PlayerControls from "./PlayerControls.jsx";
import QualityMenu from "./QualityMenu.jsx";
import { usePlayerShortcuts } from "./usePlayerShortcuts.js";
import { useVideoSync } from "../watchparty/useVideoSync.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { pularVisivel, autoskipDestino, formatarTempo, rotuloNivel } from "./pularIntro.js";

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

  // ── Qualidade ──────────────────────────────────────────────────────────────
  // O `master.m3u8` do MegaPlay traz varias variantes (1080p, 720p, 480p...). O
  // `hls.js` le-as para `hls.levels` e escolhe sozinho, com `capLevelToPlayerSize`
  // afalse. Por omissao escolhe a melhor que a ligacao aguenta — que numa ligacao
  // lenta e' uma escolha errada: fica a trocar de qualidade a meio e a bloquear.
  // O menu deixa a pessoa fixar uma.
  const hlsRef = useRef(null);
  const [niveis, setNiveis] = useState([]); // rotulos, ou [] quando nao ha' o que escolher
  const [nivelAuto, setNivelAuto] = useState(true);
  const [ativo, setAtivo] = useState(0);

  function mudarQualidade(valor) {
    const hls = hlsRef.current;
    if (!hls) return;
    const auto = valor === "auto";
    setNivelAuto(auto);
    // -1 e' o "automatico" do hls.js: volta a escolher pela ligacao.
    hls.currentLevel = auto ? -1 : Number(valor);
  }

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
      // A instancia vive num ref porque e' ela que sabe as variantes que a
      // playlist trouxe. `hls.levels` so' esta preenchido DEPOIS de a playlist
      // mestre ser lida, por isso o menu so' aparece quando ha' mesmo mais que
      // uma variante (uma so e' o "Auto" e nao ha' nada para escolher).
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, dados) => {
        const nivel = dados?.levels?.length || 0;
        // Uma variante e' so' a variante. Duas ou mais e' que ha' o que escolher.
        setNiveis(nivel > 1 ? dados.levels.map((l, i) => rotuloNivel(l, i)) : []);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, dados) => setAtivo(dados?.level ?? 0));
    } else {
      // Safari (HLS nativo) ou ficheiro progressivo.
      video.src = src;
      // Sem `hls.js` nao ha' variantes para escolher — o Safari escolhe sozinho.
      hlsRef.current = null;
      setNiveis([]);
    }

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
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
      <div
        className="player"
        ref={containerRef}
        // Tocar no video alterna play/pausa. Sem `controls` nao ha' botao do
        // browser para isso, e o toque no video e' o gesto que toda a gente faz.
        onClick={(e) => {
          // Nao quando se clicou num botao (o evento sobe ate aqui).
          if (e.target.closest("button, input, .pc-seek, .pc-pop")) return;
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
      >
        {/* SEM `controls`: a barra e' nossa (ver `PlayerControls.jsx`). A do
            browser nao deixa meter um botao dentro — e' o que fazia o botao de
            legendas chocar com o volume. */}
        <video ref={videoRef} autoPlay={settings.autoplay} crossOrigin="anonymous" playsInline>
          {/* As faixas que o `SubtitleMenu` ja deslocou pelo atraso escolhido. */}
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
        {/* O botao de ecra inteiro da barra de controlos substitui o
            `.fs-btn` de topo, que agora nao faria sentido com a barra nossa. */}
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
