// Apanha dois bugs de SVG que NENHUMA verificacao apanhava, porque o build
// passa e o ESLint passa — o SVG e' valido, so' que nao desenha.
//
// 1. `<polygon points="12 2l3 7h7...">` — sintaxe de `<path d>` (comandos `l`,
//    `h`) metida no atributo `points`, que so' aceita pares de numeros. O
//    browser lia ZERO vertices e a estrela ficava 0x0 (medido no browser).
//
// 2. Um `<svg>` sem `width`/`height` E' VALIDO, mas dentro de um `inline-flex`
//    o browser dava-lhe 0x0px: os botoes "Reproduzir" e "Mais info" ficavam sem
//    icone nenhum (medido: 0x0px). Todos os icones de `icons.jsx` levam
//    `width`/`height`; os do `Hero.jsx` eram copias locais que se esqueceram.
//
// O teste le os ficheiros e ve as duas coisas. Um SVG partido nao da erro nenhum
// em lado nenhum — e' por isso que estes dois sobreviveram tanto tempo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "web", "src");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) {
    ok++;
    console.log("  OK    " + nome);
  } else {
    falhou++;
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
  }
}

// Todos os ficheiros de React/JS sob web/src.
function ficheiros(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheiros(p, acc);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const todos = ficheiros(SRC);

// Tira os comentarios ANTES de varrer. Nao e' cosmético: o comentario que
// explica o bug tem de poder MOSTRAR o atributo partido como exemplo, e se o
// teste lesse os comentarios ele falhava com a correcção ja feita. Um teste
// olha para codigo, nao para o que se escreve sobre ele.
function semComentarios(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ e {/* ... */ (JSX)
    .replace(/^[ \t]*\/\/.*$/gm, ""); // // ...
}

console.log("");
console.log("  " + todos.length + " ficheiros em web/src");

// ── 1) `points` de polygon/polyline tem de ser so numeros ────────────────────
console.log("");
console.log("  1) Todo o points=... de <polygon>/<polyline> so pode ter pares de numeros");
{
  const maus = [];
  for (const f of todos) {
    const original = fs.readFileSync(f, "utf8");
    const s = semComentarios(original);
    for (const m of s.matchAll(/points="([^"]*)"/g)) {
      const pontos = m[1].trim();
      if (!pontos) continue;
      // O `points` de um polygon/polyline e' "x1,y1 x2,y2 ...". Qualquer letra e'
      // o sinal de que ali esta um `d` de path.
      const temLetra = /[a-zA-Z]/.test(pontos);
      if (temLetra) {
        const linha = s.slice(0, m.index).split("\n").length;
        maus.push(
          path.relative(RAIZ, f) + ":" + linha + "  points=\"" + pontos.slice(0, 40) + "\""
        );
      }
    }
  }
  ok_(
    "nenhum polygon/polyline com sintaxe de <path d> nos pontos",
    maus.length === 0,
    maus.slice(0, 4).join(" | ")
  );
}

// ── 2) Todo o <svg> precisa de width e height ───────────────────────────────
// Só os que estão DENTRO de um elemento com classe de botão/ícone contável:
// um SVG de ecrã inteiro, por exemplo, pode legitimamente ocupar 100%.
console.log("");
console.log("  2) Os SVG dentro de botoes/icones levam width e height");
{
  // Os selects onde um icone sem dimensao fica invisivel (medido: 0x0px).
  const contextos = [
    { nome: "btn-play / btn-info", re: /className="btn-(play|info)"[\s\S]{0,220}?<svg([^>]*?)>/g },
    { nome: "card-score", re: /className="card-score"[\s\S]{0,300}?<svg([^>]*?)>/g },
  ];
  for (const c of contextos) {
    const achados = [];
    for (const f of todos) {
      const s = fs.readFileSync(f, "utf8");
      for (const m of s.matchAll(c.re)) {
        const attrs = m[1];
        const temW = /\bwidth\s*=/.test(attrs);
        const temH = /\bheight\s*=/.test(attrs);
        if (!temW || !temH) {
          achados.push(
            path.relative(RAIZ, f) + "  (width=" + temW + ", height=" + temH + ")"
          );
        }
      }
    }
    ok_(
      "todo o SVG em " + c.nome + " tem width e height",
      achados.length === 0,
      achados.slice(0, 3).join(" | ")
    );
  }
}

// ── 3) O hero usa os icones com dimensao, e ha CSS de reserva ───────────────
console.log("");
console.log("  3) Rede de seguranca: se um SVG sem dimensao se meter, nao some");
{
  const css = fs.readFileSync(path.join(SRC, "styles.css"), "utf8");
  ok_(
    "o CSS da uma dimensao aos SVG dos botoes do hero",
    /\.btn-play\s+svg,\s*\.btn-info\s+svg\s*\{[^}]*width/.test(css) ||
      /\.btn-play\s+svg[^{]*\{[^}]*width/.test(css),
    "sem regra .btn-play svg { width }"
  );
  const hero = fs.readFileSync(path.join(SRC, "components", "Hero.jsx"), "utf8");
  ok_("o Hero.jsx declara o width nos dois icones locais", (hero.match(/<svg[^>]*\bwidth=/g) || []).length >= 2);
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);