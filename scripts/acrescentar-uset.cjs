// Acrescenta `const t = useT();` aos sub-componentes de um ficheiro que usam
// `t()` mas nao o declaram, e garante o import.
//
// Como funciona: percorre as funcoes de topo; se dentro do corpo de uma ha'
// `t("` e nao ha' `const t = useT()`, acrescenta logo a seguir a assinatura.
// O `useT` tem de estar importado no topo.
const fs = require("node:fs");

const ficheiro = process.argv[2];
if (!ficheiro) {
  console.error("uso: node scripts/acrescentar-uset.cjs <ficheiro.jsx>");
  process.exit(1);
}

const IMPORT = 'import { useT } from "../i18n/I18nContext.jsx";';
let src = fs.readFileSync(ficheiro, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";

// 1) O import (uma vez so).
if (!src.includes("i18n/I18nContext.jsx")) {
  // Depois do ultimo import relativo do topo.
  const imports = [...src.matchAll(/^import .*?;$/gm)];
  if (!imports.length) {
    console.error("  nao achei imports para inserir depois");
    process.exit(1);
  }
  const ultimo = imports[imports.length - 1];
  const pos = ultimo.index + ultimo[0].length;
  src = src.slice(0, pos) + eol + IMPORT + src.slice(pos);
  console.log("  import adicionado");
}

// 2) As declaracoes dentro dos sub-componentes.
const linhas = src.split(eol);

// Onde acaba cada componente de topo? Procura `}` no inicio da linha.
let acrescentados = 0;
for (let i = 0; i < linhas.length; i++) {
  const linha = linhas[i];
  // So' interessa a assinatura de uma funcao (nao uma chamada).
  const m = /^(export default )?function (\w+)\(([^)]*)\)\s*\{/.exec(linha);
  if (!m) continue;
  const nome = m[2];

  // O corpo vai ate ao proximo `}` sozinho na linha (indice 0).
  let fim = i + 1;
  while (fim < linhas.length && !/^\}/.test(linhas[fim])) fim++;
  const corpo = linhas.slice(i + 1, fim).join("\n");

  const usaT = /\bt\(["']/.test(corpo);
  const temT = /const t = useT\(\)/.test(corpo);

  if (usaT && !temT) {
    linhas.splice(i + 1, 0, "  const t = useT();");
    acrescentados++;
    console.log("  + useT em " + nome);
    i++; // salta a linha inserida
  }
}

src = linhas.join(eol);
fs.writeFileSync(ficheiro, src);
console.log("  " + acrescentados + " sub-componentes com useT adicionado");