import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";

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

export default function PlayerControls({ videoRef, children }) {
  const t = useT();
  const [aDar, setADar] = useState(true); // a reproduzir? (para esconder a barra)
  const [segundo, setSegundo] = useState(0); // o tempo EM TEXTO (muda 1x/s)
  const [duracao, setDuracao] = useState(0);
  const [volume, setVolume] = useState(1);
  const [mudo, setMudo] = useState(false);
  const [barraVisivel, setBarraVisivel] = useState(true);

  const preenchimentoRef = useRef(null);
  const bolinhaRef = useRef(null);
  const arrastoRef = useRef(null); // {fracao} enquanto se arrasta
  const temporizadorRef = useRef(null);

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
  }, [mostrar, segundo]);

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
    };

    const onMeta = () => {
      setDuracao(Number.isFinite(video.duration) ? video.duration : 0);
      setVolume(video.volume);
      setMudo(video.muted);
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
    };

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVol);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVol);
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
    video.muted = !video.muted;
  };

  const mudarVolume = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const v = Number(e.target.value);
    video.volume = v;
    // Tocar no volume tira o mudo — como em qualquer player.
    if (v > 0) video.muted = false;
  };

  const ecraInteiro = () => {
    const v = videoRef.current;
    const alvo = v?.closest(".player") || v;
    if (!alvo) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (alvo.requestFullscreen || alvo.webkitRequestFullscreen)?.call(alvo);
  };

  const min = (s) => String(Math.floor(s / 60));
  const seg = (s) => String(Math.floor(s % 60)).padStart(2, "0");

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
          <div className="pc-seek-cheio" ref={preenchimentoRef} />
          <div className="pc-seek-bolinha" ref={bolinhaRef} />
        </div>
      </div>

      <div className="pc-linha">
        <button
          type="button"
          className="pc-btn"
          onClick={alternarPlay}
          title={aDar ? t("Pausar") : t("Reproduzir")}
          aria-label={aDar ? t("Pausar") : t("Reproduzir")}
        >
          {aDar ? <IconPausa /> : <IconPlay />}
        </button>

        <span className="pc-tempo">
          {min(segundo)}:{seg(segundo)}
          <span className="pc-tempo-de">/{min(duracao)}:{seg(duracao)}</span>
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
