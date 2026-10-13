// O fundo escolhido nas Definicoes (imagem, glow, aurora, mesh, pontos, grelha)
// vive num pseudo-elemento `body::before` com `z-index: -1`. Isso so aparece se o
// `body` NAO tiver um fundo opaco por cima — e foi exactamente o que o bloco
// `<style>` do `index.html` (do ecra de arranque) passou a fazer na 1.4.9:
//
//     html, body { margin: 0; padding: 0; background: #070708; color: #fff; }
//
// Com o `body` opaco, o pseudo-elemento fica escondido ATRAS dele. O sintoma
// era "o fundo com a imagem nao funciona" — e,Turno a verdade, NENHUMA das
// opcoes funcionava: todas usam o mesmo pseudo-elemento.
//
// Este teste existe para o `html` poder ficar opaco (e' o que evita o flash
// branco antes de o `styles.css` carregar) mas o `body` ter de ficar
// TRANSPARENTE. E' uma regra pequena que ninguem vai notar se desaparecer.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

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

const html = ler("web/index.html");
const css = ler("web/src/styles.css");

console.log("");
console.log("  1) O index.html nao pode pintar o body por cima do fundo");

// O bloco <style> do ecra de arranque.
const bloco = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

{
  // A regra que existia e que escondia tudo: fundo opaco no `body`.
  const htmlBody = bloco.match(/html,\s*body\s*\{[^}]*\}/);
  ok_(
    "nao existe a regra 'html, body { ... background: opaco ... }'",
    !htmlBody || !/background\s*:/.test(htmlBody[0]) || !/transparent/.test(htmlBody[0]),
    htmlBody ? htmlBody[0].slice(0, 90) : ""
  );

  const regraBody = bloco.match(/(^|[;{}\s])body\s*\{([^}]*)\}/);
  ok_("existe uma regra `body` no bloco do ecra de arranque", !!regraBody);
  const corpoBody = regraBody ? regraBody[2] : "";
  const fundo = (corpoBody.match(/background(?:-color)?\s*:\s*([^;]+)/) || [])[1];
  ok_(
    "o body fica TRANSPARENTE (senao tapa o pseudo-elemento do fundo)",
    !fundo || /transparent/.test(fundo),
    "body tem background: " + fundo
  );

  // O `html` PODE (e deve) ficar opaco: e' o que evita o flash branco antes do
  // CSS carregar. Se alguem o tornar transparente, regressa o flash branco.
  const regraHtml = bloco.match(/(^|[;{}\s])html\s*\{([^}]*)\}/);
  const corpoHtml = regraHtml ? regraHtml[2] : "";
  const fundoHtml = (corpoHtml.match(/background(?:-color)?\s*:\s*([^;]+)/) || [])[1];
  ok_(
    "o html mantem uma cor de fundo opaca (evita o flash branco no arranque)",
    !!fundoHtml && !/transparent/.test(fundoHtml),
    "html tem background: " + (fundoHtml || "(nenhum)")
  );
}

console.log("");
console.log("  2) O styles.css concorda: html com cor, body sem");
{
  const regraCss = css.match(/(^|[;{}\s])body\s*\{([^}]*)\}/);
  const corpo = regraCss ? regraCss[2] : "";
  ok_(
    "o `body` do styles.css nao tem fundo opaco",
    !/background/.test(corpo),
    corpo.slice(0, 80)
  );
}

console.log("");
console.log("  3) Os estilos de fundo dependem mesmo desse pseudo-elemento");
{
  // Se algum dia o `::before` deixar de existir, estas regras ficam a pintar
  // nada — e o teste tem de dizer que a base desapareceu.
  ok_("o styles.css ainda define `body::before`", /body::before\s*\{/.test(css));
  ok_("o pseudo-elemento continua a ser fixo e a cobrir o ecra", /body::before\s*\{[^}]*position:\s*fixed/.test(css));
  ok_("o pseudo-elemento continua atras do conteudo", /body::before\s*\{[^}]*z-index:\s*-1/.test(css));

  // Todas as opcoes tem de estar nesse pseudo-elemento — nenhuma pode estar
  // noutro sítio, senao o `body` transparente nao as affecta e o teste
  // mentiria ao dizer que estao covered.
  const estilos = [...css.matchAll(/html\[data-bg="(\w+)"\]\s+body::before/g)].map((m) => m[1]);
  ok_("ha' estilos de fundo no pseudo-elemento", estilos.length >= 5, "encontrou " + estilos.join(", "));
  ok_("o estilo 'image' usa o pseudo-elemento", estilos.includes("image"));
  for (const e of estilos) {
    ok_('"' + e + '" aponta para body::before (nao para body)', true);
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);