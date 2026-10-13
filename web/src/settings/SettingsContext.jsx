import { createContext, useContext, useEffect, useState } from "react";
import { settingsStore } from "../api/client.js";
import { t } from "../i18n/traduzir.js";

const SettingsContext = createContext(null);

// Clareia/escurece uma cor hex (amount em -1..1) para derivar tons de hover.
function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Definições do utilizador (idiomas, legendas, cor, separador inicial). Guardadas
// em localStorage via settingsStore; este contexto torna-as reativas na UI.
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => settingsStore.get());
  // Erro a guardar: so aparece se o localStorage recusou a escrita. Antes nao
  // havia nada — o utilizador via a mudanca no ecra e achava que estava guardada.
  const [erroGuardar, setErroGuardar] = useState(null);

  // Aplica a cor de destaque escolhida as variaveis CSS (--accent).
  useEffect(() => {
    const root = document.documentElement;
    const accent = settings.accent || "#c90303";
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-hover", shade(accent, 0.18));
    // O acento QUANDO E' TEXTO. Sao duas cores porque sao dois papeis: o acento
    // cheio vai para bordas e fundos, onde a legibilidade nao conta; o texto
    // precisa de 4,5:1 sobre o fundo escuro (WCAG 2.1), e o vermelho por omissao
    // da so 3,35:1. Clarear 35% para o branco da 5,46:1.
    //
    // `color-mix(in srgb, var(--accent) 65%, white)` daria o mesmo numero e
    // dispensava o JS — mas nao se consegue mudar com o accent picker sem
    // reescrever a regra, e o `shade()` ja existe e e' o que o `--accent-hover`
    // usa. O `:root` do `styles.css` tem o valor por omissao para o ecra de
    // arranque, que aparece antes de este codigo correr.
    root.style.setProperty("--accent-text", shade(accent, 0.35));
  }, [settings.accent]);

  // Aplica a cor de fundo (e deriva as superficies um pouco mais claras).
  useEffect(() => {
    const root = document.documentElement;
    const bg = settings.bgColor || "#070708";
    root.style.setProperty("--bg-dark", bg);
    root.style.setProperty("--bg-surface", shade(bg, 0.08));
    root.style.setProperty("--bg-surface2", shade(bg, 0.13));
  }, [settings.bgColor]);

  // Aplica o estilo de fundo (padrao/imagem/simples). O padrao escolhido e feito
  // em CSS via [data-bg]; a imagem personalizada vai numa variavel.
  useEffect(() => {
    const root = document.documentElement;
    const style = settings.bgStyle || "none";
    root.dataset.bg = style;
    if (style === "image" && settings.bgImage) {
      root.style.setProperty("--app-bg-image", `url("${settings.bgImage}")`);
    } else {
      root.style.removeProperty("--app-bg-image");
    }
  }, [settings.bgStyle, settings.bgImage]);

  // Aplica o tamanho dos cartazes: largura, e a proporcao (largura/altura) que
  // mantem a forma sem esticar (object-fit: cover no poster).
  useEffect(() => {
    const root = document.documentElement;
    const w = settings.cardW || 184;
    const h = settings.cardH || 272;
    root.style.setProperty("--card-w", `${w}px`);
    root.style.setProperty("--poster-ratio", `${w} / ${h}`);
  }, [settings.cardW, settings.cardH]);

  function update(patch) {
    let gravou = true;
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      // Gravar DENTRO do actualizador era perigoso: um throw aqui (ex.: limite
      // do localStorage com uma imagem grande) perdia a alteracao E subia para
      // o React como erro de render, em vez de se limitar a nao guardar.
      gravou = settingsStore.set(next);
      return next;
    });
    if (!gravou) {
      setErroGuardar(
        t(
          "Nao foi possivel guardar (o espaco no navegador esta cheio). A alteracao vale so nesta sessao."
        )
      );
    } else {
      setErroGuardar(null);
    }
  }

  // Diz ao processo principal se o autoplay esta ligado. Tem de acontecer AQUI
  // e nao no Player: o cabecalho tem de estar na resposta do documento do
  // iframe, e o primeiro provider carrega muito depois deste ponto. Se so fosse
  // no Player, o primeiro video ja arrancaria antes da politica estar posta.
  useEffect(() => {
    window.electronAPI?.setAutoplay?.(settings.autoplay !== false);
  }, [settings.autoplay]);

  return (
    <SettingsContext.Provider value={{ settings, update, erroGuardar }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
