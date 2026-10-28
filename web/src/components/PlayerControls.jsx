import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";
// O pedido de ecrã inteiro passa pelo modulo para o erro deixar de ir para o
// lixo. O nome local abaixo (`ecraInteiro_`) e' para nao chocar com o import.
import { ecraInteiro as ecraInteiro_ } from "./ecraInteiro.js";

// Barra de controlos do player, NOSSA.
//
// PORQUE NAO USAR OS DO BROWSER: a barra que o `<video controls>` desenha
// pertence ao browser. Nao e' DOM, nao tem posicao que se possa ler, e nao ha'
// CSS nem biblioteca que meta um botao dentro dela — era exactamente o
// problema do botao de legendas, que ficava a chocar com os botoes do volume
// porque os dois tentavam ocupar o mesmo sitio. Aqui a barra e' nossa e cada
// botao esta' onde o quisermos.
//
// O `<video>` fica SEM `controls`. Tudo o que se perderia (play, volume, seek,
// ecra inteiro) e' reimplementado aqui em cima do `videoRef`, que ja existia.
//
// O que fica de fora, de proposito: Picture-in-Picture, velocidade de
// reproducao e a barra de "atraso" do seek. Nao ha' nada no site que as use e
// sao tres botoes a mais numa barra que ja esta' apertada.
//
// O preenchimento da barra do seek e' actualizado por um REF e nao por estado:
// o `timeupdate` dispara ~4x por segundo, e um render por quarto de segundo
// faria o componente inteiro (com o menu de legendas e o do video inteiro)
// redesenhar-se. O tempo em texto so' muda de estado quando muda de segundo.

const OCULTAR_MS = 2600;

const VOLUME_KEY = "meida:volume";   // 0..1, lembrado entre episódios
const MUDO_KEY = "meida:mudo";      // "true" | "false"

export default function PlayerControls({ videoRef, children }) {
  const t = useT();
  const [aDar, setADar] = useState(true); // a reproduzir? (para esconder a barra)
  const [segundo, setSegundo] = useState(0); // o tempo EM TEXTO (muda 1x/s)
  const [duracao, setDuracao] = useState(0);
  const [volume, setVolume] = useState(1);
  const [mudo, setMudo] = useState(false);
  const [barraVisivel, setBarraVisivel] = useState(true);
  const [buffering, setBuffering] = useState(false); // a aguardar dados (waiting/canplay)
  const [velocidade, setVelocidade] = useState(1); // x0.5 / 1 / 1.5 / 2
  const [piP, setPiP] = useState(false); // picture-in-picture ativo

  const preenchimentoRef = useRef(null);
  const bolinhaRef = useRef(null);
  const arrastoRef = useRef(null); // {fracao} enquanto se arrasta
  const temporizadorRef = useRef(null);
  const ultimoVolumeRef = useRef(1); // volume antes de se por a 0 / mudo
  const carregadoRef = useRef(null); // zona carregada (buffered) na barra de seek

  // ---- mostrar/esconder ----------------------------------------------------
  // Esconde-se quando esta' a dar e o rato esta' parado. Quando esta' em pausa
  // fica sempre a mostra — senao nao ha' como carregar no play.
  const mostrar = useCallback(() => {
    setBarraVisivel(true);
    clearTimeout(temporizadorRef.current);
    temporizadorRef.current = setTimeout(() => {
      const v = videoRef.current;
      // So' esconde se estiver a dar E nao houver o rato em cima (e' o
      // behaviour normal de qualquer player).
      if (v && !v.paused) setBarraVisivel(false);
    }, OCULTAR_MS);
  }, [videoRef]);

  useEffect(() => {
    mostrar();
    return () => clearTimeout(temporizadorRef.current);
  }, [mostrar]);

  // Lembra o volume e o mudo entre episódios: aplica ao montar um vídeo novo.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const v = localStorage.getItem(VOLUME_KEY);
      const m = localStorage.getItem(MUDO_KEY);
      if (v != null) {
        const vol = Number(v);
        if (Number.isFinite(vol)) {
          video.volume = vol;
          setVolume(vol);
          ultimoVolumeRef.current = vol;
        }
      }
      if (m != null) {
        const mud = m === "true";
        video.muted = mud;
        setMudo(mud);
      }
    } catch (e) {
      // localStorage indisponível (modo privado, etc.): ignora e fica com o padrão.
    }
  }, [videoRef]);

  // ----estado do video -----------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const pintar = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      const frac = d > 0 ? Math.min(1, Math.max(0, video.currentTime / d)) : 0;
      const pct = (frac * 100).toFixed(2) + "%";
      // Por REF: e' a cada `timeupdate` e nao pode ser um setState.
      if (preenchimentoRef.current) preenchimentoRef.current.style.width = pct;
      if (bolinhaRef.current) bolinhaRef.current.style.left = pct;

      // Zona carregada (buffered): faixa fina atras da barra de progresso.
      // Mostra ate onde o video ja baixou, para a pessoa saber se vale a pena
      // esperar ou mudar de fonte.
      if (carregadoRef.current && d > 0 && video.buffered.length > 0) {
        // Segmento carregado que cobre a posicao atual (ou o ultimo, se nao houver cobertura).
        let carregadoAte = 0;
        for (let i = 0; i < video.buffered.length; i++) {
          const start = video.buffered.start(i);
          const end = video.buffered.end(i);
          if (video.currentTime >= start && video.currentTime <= end) {
            carregadoAte = end;
            break;
          }
          carregadoAte = Math.max(carregadoAte, end);
        }
        carregadoRef.current.style.width = ((carregadoAte / d) * 100).toFixed(2) + "%";
      }
    };

    const onMeta = () => {
      setDuracao(Number.isFinite(video.duration) ? video.duration : 0);
      setVolume(video.volume);
      setMudo(video.muted);
      // Aplica a velocidade escolhida (default 1x).
      video.playbackRate = velocidade;
      pintar();
    };
    const onTime = () => {
      pintar();
      // O texto so' muda quando muda o segundo inteiro — 1 render por segundo,
      // em vez de 4.
      const s = Math.floor(video.currentTime || 0);
      setSegundo((antes) => (antes === s ? antes : s));
    };
    const onPlay = () => { setADar(true); mostrar(); };
    const onPause = () => { setADar(false); setBarraVisivel(true); };
    const onVol = () => {
      setVolume(video.volume);
      setMudo(video.muted);
      // Lembra entre episódios (mesmo valor aplicado ao montar acima).
      try {
        localStorage.setItem(VOLUME_KEY, String(video.volume));
        localStorage.setItem(MUDO_KEY, String(video.muted));
      } catch (e) {}
    };
    const onWaiting = () => setBuffering(true); // a aguardar dados
    const onCanPlay = () => setBuffering(false); // dados chegaram
    const onRateChange = () => {
      // Mantem o estado sincronizado com o video (ex.: se o site mudar a taxa).
      setVelocidade(video.playbackRate || 1);
    };
    const onEnterPiP = () => setPiP(true);
    const onLeavePiP = () => setPiP(false);

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlay);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVol);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlay);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, [videoRef, mostrar]);

  // ---- seek ----------------------------------------------------------------
  const fracaoDoPonteiro = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };

  // Enquanto se arrasta, so' se pinta a barra (por ref, sem render). O seek
  // verdadeiro acontece no `pointerup` — Seek a cada pixel dava saltos e
  // lutava com o buffer.
  const aoArrancar = (e) => {
    const f = fracaoDoPonteiro(e);
    arrastoRef.current = f;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const pct = (f * 100).toFixed(2) + "%";
    if (preenchimentoRef.current) preenchimentoRef.current.style.width = pct;
    if (bolinhaRef.current) bolinhaRef.current.style.left = pct;
  };

  const aoArrastar = (e) => {
    if (arrastoRef.current === null) return;
    const f = fracaoDoPonteiro(e);
    arrastoRef.current = f;
    const pct = (f * 100).toFixed(2) + "%";
    if (preenchimentoRef.current) preenchimentoRef.current.style.width = pct;
    if (bolinhaRef.current) bolinhaRef.current.style.left = pct;
  };

  const aoLargar = (e) => {
    const f = arrastoRef.current;
    arrastoRef.current = null;
    if (f === null) return;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = f * video.duration;
    // O Watch Party tem de saber: um seek nosso que nao passa pelo `seeked` do
    // outro jogador deixa os participantes dessincronizados.
    video.dispatchEvent(new Event("seeked"));
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // ---- acoes ---------------------------------------------------------------
  const alternarPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const alternarMudo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      // Repõe o som: tira o mudo e, se o volume estava a 0, devolve o ultimo
      // volume (ou 0.5 se nunca houve um).
      video.muted = false;
      setMudo(false);
      if (video.volume === 0) {
        const v = ultimoVolumeRef.current || 0.5;
        video.volume = v;
        setVolume(v);
      }
    } else {
      // Guarda o volume atual e silencia.
      ultimoVolumeRef.current = video.volume;
      video.muted = true;
      setMudo(true);
    }
  };

  const mudarVolume = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const v = Number(e.target.value);
    video.volume = v;
    ultimoVolumeRef.current = v;
    // Tocar no volume tira o mudo — como em qualquer player.
    if (v > 0) video.muted = false;
    setMudo(video.muted);
    setVolume(v);
  };

  const ecraInteiro = () => {
    const v = videoRef.current;
    const alvo = v?.closest(".player") || v;
    if (!alvo) return;
    ecraInteiro_(alvo);
  };

  // Velocidade de reproducao: cicla entre 0.5x, 1x, 1.5x, 2x.
  const VELOCIDADES = [0.5, 1, 1.5, 2];
  const alternarVelocidade = () => {
    const video = videoRef.current;
    if (!video) return;
    const atual = video.playbackRate || 1;
    const prox = VELOCIDADES.find((v) => v > atual) || VELOCIDADES[0];
    video.playbackRate = prox;
    setVelocidade(prox);
  };

  // Picture-in-picture: sai do vídeo para uma janela flutuante.
  const alternarPiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (piP) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      // Nao suportado ou bloqueado pelo browser: ignora silenciosamente.
    }
  };

  // Formata o tempo: M:SS abaixo de 1 h, H:MM:SS acima de 1 h (ex.: 1:05:00).
  const formatarTempo = (s) => {
    const total = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  };

  return (
    <div className={`pc-barra ${barraVisivel ? "visivel" : "escondida"}`} onMouseMove={mostrar}>
      {/* A barra do seek e' a coisa mais larga de toda a barra: e' onde o rato
          vai por defeito, e e' o que o browser faz. */}
      <div
        className="pc-seek"
        onPointerDown={aoArrancar}
        onPointerMove={aoArrastar}
        onPointerUp={aoLargar}
        onPointerCancel={aoLargar}
        role="slider"
        tabIndex={0}
        aria-label={t("Posição no vídeo")}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.floor(duracao))}
        aria-valuenow={segundo}
      >
        <div className="pc-seek-trilho">
          {/* Zona carregada (buffered), atras da barra de progresso. */}
          <div className="pc-seek-carregado" ref={carregadoRef} />
          <div className="pc-seek-cheio" ref={preenchimentoRef} />
          <div className="pc-seek-bolinha" ref={bolinhaRef} />
        </div>
      </div>

      <div className="pc-linha">
        <button
          type="button"
          className="pc-btn"
          onClick={alternarPlay}
          title={aDar ? t("Pausar vídeo") : t("Reproduzir")}
          aria-label={aDar ? t("Pausar vídeo") : t("Reproduzir")}
        >
          {aDar ? <IconPausa /> : <IconPlay />}
        </button>

        <span className="pc-tempo">
          {buffering && <span className="pc-buffering" aria-hidden="true">⟳</span>}
          {formatarTempo(segundo)}
          <span className="pc-tempo-de">/{formatarTempo(duracao)}</span>
        </span>

        <div className="pc-vazio" />

        {/* Os botoes que o `children` traz (o de legendas) entram aqui, na
            ordem que o `Player` quiser — e' a barra que decide a posicao. */}
        {children}

        <div className="pc-volume">
          <button
            type="button"
            className="pc-btn"
            onClick={alternarMudo}
            title={mudo || volume === 0 ? t("Com som") : t("Sem som")}
            aria-label={mudo || volume === 0 ? t("Com som") : t("Sem som")}
          >
            {mudo || volume === 0 ? <IconMudo /> : <IconVolume />}
          </button>
          <input
            type="range"
            className="pc-volume-tilho"
            min="0"
            max="1"
            step="0.05"
            value={mudo ? 0 : volume}
            onChange={mudarVolume}
            aria-label={t("Volume")}
          />
        </div>

        <button
          type="button"
          className="pc-btn"
          onClick={ecraInteiro}
          title={t("Ecra inteiro")}
          aria-label={t("Ecra inteiro")}
        >
          <IconEcraInteiro />
        </button>
        <button
          type="button"
          className="pc-btn"
          onClick={alternarVelocidade}
          title={`×${velocidade} ${t("Velocidade")}`}
          aria-label={`×${velocidade} ${t("Velocidade")}`}
        >
          <IconVelocidade velocidade={velocidade} />
        </button>
        <button
          type="button"
          className="pc-btn"
          onClick={alternarPiP}
          title={piP ? t("Sair do picture-in-picture") : t("Picture-in-picture")}
          aria-label={piP ? t("Sair do picture-in-picture") : t("Picture-in-picture")}
        >
          <IconPiP ativo={piP} />
        </button>
      </div>
    </div>
  );
}

/* Os icones sao SVG inline (como os de `icons.jsx`), para a barra nao depender
   de um ficheiro partilhado so para estes quatro. */

function IconPlay() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPausa() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function IconVolume() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function IconMudo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}

function IconEcraInteiro() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconVelocidade({ velocidade }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21" />
      <path d="M15 10h2M15 14h2M11 10h2M11 14h2" stroke-linecap="round" />
      <text x="11" y="20" font-size="10" fill="currentColor">{velocidade}x</text>
    </svg>
  );
}

function IconPiP({ ativo }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="13" height="13" />
      <rect x="8" y="8" width="13" height="13" />
      {ativo && <path d="M12 15l-3-3 3-3" stroke-linecap="round" stroke-linejoin="round" />}
    </svg>
  );
}
