// Verifica se um ficheiro tem caracteres CJK (U+2E80-U+9FFF e as duas
// gamas adjunctas) ou o caractere de substituicao (U+FFFD = UTF-8 partido).
// Existe em script porque o `-e` do PowerShell parte as sequencias \uXXXX
// sempre que uma delas aparece a meio da linha — e foi assim que um ficheiro
// com lixo CJK passou despercebido.
//
//   node scripts/verificar-cjk.mjs <ficheiro> [<ficheiro> ...]
//
// Sai com codigo 1 se algum ficheiro estiver sujo, para servir de porta nas
// suites de teste.
import fs from "node:fs";

const CJK = /[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;
const INVALIDO = "\uFFFD";

const ficheiros = process.argv.slice(2);
if (!ficheiros.length) {
  console.log("  uso: node scripts/verificar-cjk.mjs <ficheiro> [...]");
  process.exit(2);
}

let sujo = 0;
for (const f of ficheiros) {
  const s = fs.readFileSync(f, "utf8");
  const problemas = [];

  const cjk = s
    .split(/\r?\n/)
    .map((linha, i) => (CJK.test(linha) ? i + 1 : 0))
    .filter(Boolean);
  if (cjk.length) problemas.push("CJK nas linhas " + cjk.join(", "));

  const invalidos = s
    .split(/\r?\n/)
    .map((linha, i) => (linha.includes(INVALIDO) ? i + 1 : 0))
    .filter(Boolean);
  if (invalidos.length) problemas.push("caractere invalido nas linhas " + invalidos.join(", "));

  if (problemas.length) {
    sujo++;
    console.log("  SUJO  " + f + ": " + problemas.join(" | "));
    // A linha offender: mostra-la e' o que torna isto util, e nao so' dizer
    // "ha CJK" sem dizer onde.
    const alvo = cjk[0] || invalidos[0];
    if (alvo) {
      const linha = s.split(/\r?\n/)[alvo - 1];
      const marcadores = [...linha].filter((c) => CJK.test(c) || c === INVALIDO);
      console.log("          L" + alvo + ": " + marcadores.map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" "));
    }
  } else {
    console.log("  OK    " + f);
  }
}

console.log("");
console.log(sujo ? "  " + sujo + " ficheiro(s) com lixo." : "  Todos limpos.");
process.exit(sujo ? 1 : 0);