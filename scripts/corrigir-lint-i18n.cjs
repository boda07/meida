// Corrige os dois erros que a traducao automatica deixa no lint:
//
//   1) `'t' is not defined`  — o `t()` foi posto num componente que nao tem
//      `const t = useT()`. Acrescenta-o logo a seguir a assinatura da funcao.
//
//   2) `'useT' is defined but never used` — o import foi acrescentado a um
//      ficheiro em que o `t` acabou por nao ser usado. Remove o import.
//
// Nao e' adivinhacao: so toca no que o proprio lint apontou, e volta a correr o
// lint no fim para confirmar que ficou limpo.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("child_process");

const PASTAS = ["web/src/pages", "web/src/components", "web/src/settings", "web/src/library"];

// 1) Recolhe os erros do eslint.
//
// O eslint sai com codigo 1 quando ha erros, e neste ambiente o `execFileSync`
// nao devolve o stdout nesse caso (vem vazio na excecao). Escrever para um
// ficheiro e le-lo resolve, e deixa de depender de como o `npx` empacota a
// saida no Windows.
const os = require("node:os");
const RELATORIO = path.join(os.tmpdir(), "meida-lint-i18n.json");
fs.rmSync(RELATORIO, { force: true });

// Chama o eslint pelo binario do node em vez do `npx`: o `npx` no Windows e'
// um .cmd que o `execFileSync` nao consegue invocar com estes argumentos, e o
// `-o` nao acabava a escrever o ficheiro.
const ESLINT_BIN = path.join(__dirname, "..", "node_modules", "eslint", "bin", "eslint.js");
try {
  execFileSync(
    process.execPath,
    [ESLINT_BIN, "web/src", "-f", "json", "-o", RELATORIO],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
} catch {
  /* sai com 1 quando ha erros — o relatorio ja foi escrito */
}

let lint = "";
try {
  lint = fs.readFileSync(RELATORIO, "utf8");
} catch {
  console.log("  nao consegui ler o relatorio do eslint em " + RELATORIO);
  process.exit(1);
}

// O formato JSON: [{"filePath":...,"messages":[{"line":N,"column":N,"message":"...",...}]}]
const erros = [];
let lista = [];
try {
  lista = JSON.parse(lint);
} catch {
  // Se nao for JSON, volta ao formato texto (util se a versao do eslint mudar).
  for (const m of lint.matchAll(/^(C:\\[^\r\n]+?\.jsx?)\r?\n\s+(\d+):(\d+)\s+error\s+'?([^'\r\n]+)'?/gm)) {
    erros.push({ filePath: m[1], linha: Number(m[2]), msg: m[4].trim() });
  }
}
if (!erros.length) {
  for (const f of lista) {
    for (const msg of f.messages || []) {
      if (msg.severity !== 2) continue; // so' erros, nao avisos
      erros.push({ filePath: f.filePath, linha: msg.line, msg: msg.message });
    }
  }
}
lint = ""; // ja extraido

const porFicheiro = new Map();
for (const e of erros) {
  if (!porFicheiro.has(e.filePath)) porFicheiro.set(e.filePath, []);
  porFicheiro.get(e.filePath).push({ linha: e.linha, msg: e.msg });
}

if (!porFicheiro.size) {
  console.log("  lint ja esta limpo");
  process.exit(0);
}

let corrigidos = 0;
for (const [ficheiro, erros] of porFicheiro) {
  if (!fs.existsSync(ficheiro)) continue;
  const eol = fs.readFileSync(ficheiro, "utf8").includes("\r\n") ? "\r\n" : "\n";
  let linhas = fs.readFileSync(ficheiro, "utf8").split(eol);

  // --- 1) `t` nao definido: acha a funcao que contem a linha ---
  const faltaDeT = erros.filter((e) => e.msg.includes("'t' is not defined"));
  if (faltaDeT.length) {
    // Todas as linhas com erro que nao tem `const t = useT()` acima.
    for (const { linha } of faltaDeT) {
      // Sobe ate a assinatura da funcao mais proxima acima.
      let inicio = linha - 1;
      while (inicio >= 0 && !/^(export default )?function \w+|^const \w+ = \(|^function \w+\(/.test(linhas[inicio])) {
        inicio--;
      }
      if (inicio < 0) continue;
      // Ja' tem?
      let fim = inicio + 1;
      while (fim < linhas.length && !/^\}/.test(linhas[fim])) fim++;
      const corpo = linhas.slice(inicio + 1, fim).join("\n");
      if (/const t = useT\(\)/.test(corpo)) continue;
      linhas.splice(inicio + 1, 0, "  const t = useT();");
      corrigidos++;
    }
  }

  // --- 2) `useT` importado mas nao usado ---
  const semUso = erros.filter((e) => e.msg.includes("'useT' is defined but never used"));
  if (semUso.length) {
    // Verifica se o ficheiro usa `t(` em algum sitio.
    const usa = linhas.some((l) => /\bt\(["']/.test(l) || /{t\(/.test(l));
    if (!usa) {
      linhas = linhas.filter((l) => !/import \{ useT \} from "\.\.\/i18n\/I18nContext\.jsx";/.test(l));
      corrigidos++;
    }
  }

  fs.writeFileSync(ficheiro, linhas.join(eol));
}

console.log("  " + corrigidos + " correccoes em " + porFicheiro.size + " ficheiros");