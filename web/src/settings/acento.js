// Funcoes puras de cor para o acento de destaque.
// Extraídas do SettingsContext.jsx para poderem ser testadas sem montar o React
// (nao ha jsdom nem testing-library neste projeto).
//
// Estas funcoes nao dependem de nenhum modulo: sao pura entrada/saida, o que as
// torna fáceis de testar por mutacao.

export const CONTRASTE_MINIMO = 4.5;

// Clareia/escurece uma cor hex (amount em -1..1) para derivar tons de hover.
export function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Luminancia relativa (WCAG 2.1) de uma cor hex, escala 0..1.
// O passo de linearizacao e' essencial: sem ele, o vermelho puro parece mais
// escuro do que o verde puro para a mesma luz, e a razao sai errada.
export function luminancia(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

// Razao de contraste entre duas cores hex (WCAG 2.1), escala 1..21.
// A cor mais clara vai no numerador; o resultado e' independente da ordem.
export function contraste(c1, c2) {
  const l1 = luminancia(c1);
  const l2 = luminancia(c2);
  const clara = Math.max(l1, l2);
  const escura = Math.min(l1, l2);
  return (clara + 0.05) / (escura + 0.05);
}

// Deve-se mostrar o aviso de contraste para este racio?
export function precisaAviso(ratio) {
  return ratio < CONTRASTE_MINIMO;
}

// O texto de destaque (acento clareado 35%).
// Exportada de proposito para se poder testar por mutacao: e' a mesma funcao
// que o `useEffect` do SettingsContext usa para definir `--accent-text`, para
// que a mutacao que tira o `shade()` seja apanhada pelo teste.
export function textoAcento(accent) {
  return shade(accent || "#c90303", 0.35);
}
