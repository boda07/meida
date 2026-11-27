// Laboratorio das legendas — pagina de DEV, nao faz parte da app.
//
// PORQUE EXISTE: o menu das legendas so' aparece dentro do player, e o player
// so' existe com um episodio a dar. Sem chave do TMDB nao ha' episodio, e
// entao ninguem conseguia ver as opcoes (tamanho, contorno, cores, opacidade)
// nem confirmar que a opacidade e' a da CAIXA e nao a do texto.
//
// Esta pagina monta os COMPONENTES REAIS (`SubtitleMenu`, `SubtitleTracks`),
// com o `styles.css` real, sobre um video gerado aqui mesmo (canvas +
// MediaRecorder, porque nao ha' ffmpeg na maquina) e um `.vtt` local.
//
// O video e' cinza uniforme (#808080) de proposito: e' contra esse valor que se
// mede a caixa da legenda. A 60% de opacidade a caixa da ~51 (0,4 x 128); a 10%
// da' ~115. Se a opacidade fosse a do texto, o branco (255) ia para ~141 a 10%.
//
// Nao entra no build: o `vite build` so' usa o `index.html` da raiz.
import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import "../src/styles.css";
import { I18nProvider } from "../src/i18n/I18nContext.jsx";
import { SettingsProvider } from "../src/settings/SettingsContext.jsx";
import { SubtitleMenu, SubtitleTracks } from "../src/components/subtitles.jsx";
import PlayerControls from "../src/components/PlayerControls.jsx";

const LEGENDA = [
  { url: "/laboratorio/legendas-teste.vtt", lang: "pt", label: "Português" },
];

// Grava ~5 s de canvas num webm e devolve um object URL. Sem `ffmpeg`, e' a
// unica forma de ter um <video> a serio — e o `::cue` so' pinta com media.
async function gravarVideoDeTeste() {
  // O canvas tem a MESMA proporcao alta do palco (0,4375). O `.player video`
  // do `styles.css` usa `object-fit: contain`: um canvas 16/9 num palco alto
  // ficava com barras pretas e a legenda caia em cima do PRETO, onde a
  // opacidade da caixa nao se ve nem se mede.
  const L = 700;
  const A = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d");
  const t0 = performance.now();
  let raf = 0;

  function desenhar() {
    // Cinza uniforme: e' o fundo que fica por tras da legenda e o valor com que
    // a caixa translucida se mistura.
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, L, A);

    const t = (performance.now() - t0) / 1000;
    ctx.fillStyle = "#c90303";
    ctx.fillRect(40 + ((t * 60) % 500), 250, 110, 110);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText("Episódio de teste", 40, 470);
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("fundo #808080 para medir a caixa", 40, 510);

    raf = requestAnimationFrame(desenhar);
  }
  desenhar();

  const stream = canvas.captureStream(30);
  const tipos = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mimeType = tipos.find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const pedacos = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) pedacos.push(e.data);
  };
  const parado = new Promise((resolver) => {
    rec.onstop = resolver;
  });

  rec.start();
  await new Promise((r) => setTimeout(r, 5000));
  rec.stop();
  await parado;
  cancelAnimationFrame(raf);
  stream.getTracks().forEach((t) => t.stop());

  return URL.createObjectURL(new Blob(pedacos, { type: mimeType || "video/webm" }));
}

function Palco() {
  const videoRef = useRef(null);
  const [estado, setEstado] = useState("a gravar o video de teste (~5 s)");
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let url = null;
    let vivo = true;
    gravarVideoDeTeste()
      .then((u) => {
        url = u;
        if (!vivo) return;
        videoRef.current.src = u;
        setEstado("video pronto");
        return videoRef.current.play();
      })
      .then(() => {
        if (!vivo) return;
        // Pausa dentro do primeiro cue (0,4–4,8 s): a legenda fica no ecra
        // parada, e assim a medicao de pixels nao apanha um instante vazio.
        videoRef.current.pause();
        videoRef.current.currentTime = 1.2;
        setEstado("a dar (parado no 1,2 s)");
      })
      .catch((e) => setErro(String(e && e.message ? e.message : e)));

    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  // O laboratorio abre o menu sozinho e escolhe a legenda: e' o estado que se
  // quer ver, e evita depender de alguem clicar antes da fotografia.
  useEffect(() => {
    const abertura = setTimeout(() => {
      document.querySelector(".sub-cc-btn")?.click();
    }, 700);
    const escolha = setTimeout(() => {
      const itens = document.querySelectorAll('.pc-pop button[role="menuitemradio"]');
      if (itens.length > 1) itens[1].click();
    }, 1100);
    return () => {
      clearTimeout(abertura);
      clearTimeout(escolha);
    };
  }, []);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "10px 20px 30px" }}>
      <h1 style={{ fontSize: 14, margin: "0 0 8px", color: "#a9a9b2", fontWeight: 600 }}>
        Laboratório das legendas — {estado}
        {erro ? ` — erro: ${erro}` : ""}
      </h1>

      {/* Altura fixa em vez de 16/9: a janela deste browser tem 500 px de
          largura e o popup (326 px de alto) nao cabia nos 260 px de um player
          16/9 — aparecia cortado pelo `overflow: hidden` do `.player`. */}
      <div className="player" style={{ width: "100%", aspectRatio: "auto", height: 700 }}>
        <video ref={videoRef} muted playsInline loop>
          <SubtitleTracks subtitles={LEGENDA} delay={0} />
        </video>

        {/* A barra de controlos REAL, a mesma que o player da app usa. */}
        <PlayerControls videoRef={videoRef}>
          <SubtitleMenu videoRef={videoRef} subtitles={LEGENDA} />
        </PlayerControls>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <SettingsProvider>
        <Palco />
      </SettingsProvider>
    </I18nProvider>
  </React.StrictMode>
);
