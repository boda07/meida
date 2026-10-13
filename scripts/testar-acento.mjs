// O acento e' usado para bordas e fundos (cor cheia) E para texto. Sao dois
// papeis com requisitos diferentes: sobre o fundo escuro da app, o vermelho por
// omissao da 3,35:1 — abaixo do minimo de 4,5:1 da WCAG para texto normal.
//
// A correcao e' um `--accent-text` (o mesmo acento clareado 35% para o branco),
// usado so onde o acento e' TEXTO. Este teste ve que isso se mantem: mede o
// contraste de todos os presets, com a formula da WCAG, e falha se algum ficar
// abaixo do limite — o que apanha tambem um preset NOVO que se acrescente sem
// alguem se lembrar de lhe medir o contraste.
//OPDADE.
//
// Medido a 2026-10-13: sem o `--accent-text`, `#c90303` dava 3,35:1 e
// `#e50914` 4,20:1 (ambem abaixo). Com ele, todos passam.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// ---- a formula da WCAG 2.1 -------------------------------------------------
function luminancia(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contraste(a, b) {
  const l1 = luminancia(a), l2 = luminancia(b);
  if (l1 == null || l2 == null) return null;
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
// O mesmo `shade(hex, 0.35)` que o `SettingsContext` usa.
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

const css = ler("web/src/styles.css");
const settings = ler("web/src/settings/SettingsContext.jsx");
const settingsJsx = ler("web/src/pages/Settings.jsx");

const FUNDO = "#070708";
const SUPERFICIE = "#15151b";
const LIMITE = 4.5;

// Os presets sao lidos do sitio onde vivem, para o teste nao ficar com uma lista
// propria que envelhece sem ninguem dar por isso.
const mPresets = settingsJsx.match(/const ACCENT_PRESETS = \[([\s\S]*?)\]/);
ok_("a lista de presets do accentpicker existe", !!mPresets);
const PRESETS = mPresets ? [...mPresets[1].matchAll(/#[0-9a-fA-F]{6}/g)].map((x) => x[0]) : [];
ok_("ha' presets para testar", PRESETS.length >= 6, PRESETS.length + " encontrados");

console.log("");
console.log("  1) O `--accent-text` passa 4,5:1 em TODOS os presets");
for (const p of PRESETS) {
  const t = shade(p, 0.35);
  const cFundo = contraste(t, FUNDO);
  const cSup = contraste(t, SUPERFICIE);
  ok_(
    p + " -> " + t + "  " + cFundo.toFixed(2) + ":1 no fundo, " + cSup.toFixed(2) + ":1 na superficie",
    cFundo >= LIMITE && cSup >= LIMITE,
    "abaixo de " + LIMITE
  );
}

console.log("");
console.log("  2) E o acento CHEIO continua a servir para bordas e fundos");
// Nao ha de falhar nada disto: o acento cheio e' que preenche os chips
// activos, as barras de progresso e os botoes. Se alguem o trocasse pelo
// `--accent-text` por engano, os botoes vermelhos viravam cor-de-rosa.
ok_(
  "continua a haver `background: var(--accent)` (chips, botoes activos)",
  /background:\s*var\(--accent\)/.test(css)
);
ok_("continua a haver `border-color: var(--accent)`", /border-color:\s*var\(--accent\)/.test(css));
ok_("continua a haver `accent-color: var(--accent)` (controlos nativos)", /accent-color:\s*var\(--accent\)/.test(css));
ok_("continua a haver `caret-color: var(--accent)`", /caret-color:\s*var\(--accent\)/.test(css));

console.log("");
console.log("  3) O `--accent-text` existe em CSS E em JS, e com o mesmo valor");
const mRoot = css.match(/--accent-text:\s*(#[0-9a-fA-F]{6})/);
ok_("o `:root` declara `--accent-text`", !!mRoot);
ok_("o `SettingsContext` define-o", /setProperty\("--accent-text"/.test(settings));
ok_("com o MESMO clareamento (0.35) que o valor medido", /shade\(accent,\s*0\.35\)/.test(settings));
if (mRoot) {
  ok_(
    "o valor por omissao do CSS e' o do acento por omissao clareado",
    mRoot[1].toLowerCase() === shade("#c90303", 0.35).toLowerCase(),
    "CSS=" + mRoot[1] + " esperado=" + shade("#c90303", 0.35)
  );
}

console.log("");
console.log("  4) Nenhum texto ficou com o acento escuro");
{
  const semText = css.match(/(^|[^\w-])color:\s*var\(--accent\s*\)/g) || [];
  ok_("nenhuma regra usa `color: var(--accent)` sem ser o `-text`", semText.length === 0, semText.length + " sobraram");
  const comText = css.match(/color:\s*var\(--accent-text/g) || [];
  ok_("ha' texto a usar `--accent-text`", comText.length >= 20, comText.length + " sitios");
  // E o inverso: nenhuma BORDA pode estar a usar o `-text`.
  ok_(
    "nenhuma `border-color` usa `--accent-text` (a borda e' o acento cheio)",
    !/border-color:\s*var\(--accent-text/.test(css)
  );
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);