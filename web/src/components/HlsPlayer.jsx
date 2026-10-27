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
  const errosRef = useRef({ network: 0, media: 0 }); // tentativas de recuperacao ja feitas
  const onErroRef = useRef(onErro);
  onErroRef.current = onErro;
  // Escolha de qualidade do utilizador (null = auto, numero = nivel fixo).
  // Persiste entre episodios para nao perder a fixacao ao mudar de episodio.
  const nivelEscolhidoRef = useRef(null);
  const [niveis, setNiveis] = useState([]); // rotulos, ou [] quando nao ha' o que escolher
  const [nivelAuto, setNivelAuto] = useState(true);
  const [ativo, setAtivo] = useState(0);

  function mudarQualidade(valor) {
    const hls = hlsRef.current;
    if (!hls) return;
    const auto = valor === "auto";
    nivelEscolhidoRef.current = auto ? null : Number(valor);
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
        // Usa o mesmo caminho do salto manual: dispara `seeked`, que e' o que
        // mantem a Watch Party sincronizada.
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
      // Novo episodio: o hls.js arranca sempre em Auto, por isso resetamos o
      // estado do React para nao ficar dessincronizado (menu a mostrar 720p
      // fixo enquanto o hls esta em Auto). A escolha do utilizador e' reaplicada
      // abaixo em MANIFEST_PARSED, se o nivel existir neste episodio.
      errosRef.current = { network: 0, media: 0 };
      setNivelAuto(true);
      setAtivo(0);
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
        // Reaplicar a escolha guardada do utilizador, se o nivel existir aqui.
        const guardado = nivelEscolhidoRef.current;
        if (guardado != null && guardado < nivel && hlsRef.current) {
          hlsRef.current.currentLevel = guardado;
          setNivelAuto(false);
          setAtivo(guardado);
        }
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, dados) => setAtivo(dados?.level ?? 0));
      // Erro fatal: tenta recuperar conforme o tipo. Se esgotar as tentativas,
      // destroi o hls e avisa o Player para passar à fonte seguinte.
      hls.on(Hls.Events.ERROR, (_event, dados) => {
        if (!dados || !dados.fatal) return;
        const hlsInst = hlsRef.current;
        if (!hlsInst) return;
        if (dados.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (errosRef.current.network < 3) {
            errosRef.current.network += 1;
            hlsInst.startLoad();
            return;
          }
        } else if (dados.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (errosRef.current.media < 1) {
            errosRef.current.media += 1;
            hlsInst.recoverMediaError();
            return;
          }
        }
        hlsInst.destroy();
        hlsRef.current = null;
        onErroRef.current?.();
      });
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
  // Reporta tambem em pause, em ended e ao desmontar, para o "Continua a ver"
  // nunca ficar parado num tempo antigo quando se recua no video.
  useEffect(() => {
    if (!onProgress) return;
    const video = videoRef.current;
    if (!video) return;
    let last = 0;
    const reportar = () => {
      const now = Math.floor(video.currentTime || 0);
      last = now;
      onProgress(now, Math.floor(video.duration || 0));
    };
    const onTime = () => {
      const now = Math.floor(video.currentTime || 0);
      // Math.abs: depois de recuar, now - last fica negativo e nunca chegava a 5.
      if (Math.abs(now - last) >= 5) {
        reportar();
      }
    };
    const onPause = () => reportar();
    const onEnded = () => reportar();
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      reportar();
    };
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
