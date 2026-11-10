// Clicar no atalho com a app ja' aberta nao pode arrancar uma segunda copia.
//
// O que acontecia (2026-11-10): a segunda copia arrancava, o backend dela nao
// conseguia a porta 5175 (a primeira ficou com ela) e aparecia o dialogo
// "MEIDA - o servidor nao arrancou" — com uma janela nova por cima da que ja'
// estava aberta. A tranca de instancia do Electron resolve isto: a copia
// redundante fecha e a que ja' existe vem para a frente.
//
// Este teste le o `electron/main.cjs` e prova a forma. O comportamento em si
// (a segunda copia fechar) e' medido em Electron real, nao aqui.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = fs.readFileSync(path.join(RAIZ, "electron", "main.cjs"), "utf8");
const ESTE = fileURLToPath(import.meta.url);

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

// Tira as linhas que sao so' comentario (um comentario pode citar o nome de
// uma funcao e fazer o teste passar por engano).
function semComentarios(src) {
  return src
    .split(/\r?\n/)
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

const FONTE = semComentarios(MAIN);

console.log("  1) a tranca de instancia");

ok_(
  "pede a tranca de instancia ao Electron",
  /app\.requestSingleInstanceLock\(\)/.test(FONTE)
);

const blocoTranca = (() => {
  const ini = FONTE.indexOf("const instanceLock");
  if (ini === -1) return "";
  const fim = FONTE.indexOf("\n}", ini);
  return fim === -1 ? FONTE.slice(ini) : FONTE.slice(ini, fim + 2);
})();

ok_("a tranca e' pedida antes do arranque", blocoTranca.length > 0);
ok_(
  "se a tranca for negada, a copia fecha",
  /if\s*\(!instanceLock\)\s*\{[\s\S]*?app\.quit\(\s*\)/.test(blocoTranca),
  blocoTranca.slice(0, 160)
);
ok_(
  "o ready nao arranca nada sem a tranca (senao a 2.a copia ligava um servidor)",
  /if\s*\(!instanceLock\)\s*return;/.test(FONTE)
);

console.log("  2) a copia que ja' existe vem para a frente");

const blocoSegundo = (() => {
  const ini = FONTE.indexOf('on("second-instance"');
  if (ini === -1) return "";
  const fim = FONTE.indexOf("\n  });", ini);
  return fim === -1 ? FONTE.slice(ini) : FONTE.slice(ini, fim + 6);
})();

ok_("ha' um handler de second-instance", blocoSegundo.length > 0);
ok_(
  "o handler nao faz nada sem janela",
  /if\s*\(!win\)\s*return;/.test(blocoSegundo)
);
ok_(
  "restaura se estiver minimizada",
  /isMinimized\(\)\)\s*win\.restore\(\)/.test(blocoSegundo)
);
ok_("mostra a janela", /win\.show\(\)/.test(blocoSegundo));
ok_("da' o foco a janela", /win\.focus\(\)/.test(blocoSegundo));

console.log("  3) mutacoes");

function blocoDe(src, marca, fecho) {
  const ini = src.indexOf(marca);
  if (ini === -1) return "";
  const fim = src.indexOf(fecho, ini);
  return fim === -1 ? src.slice(ini) : src.slice(ini, fim + fecho.length);
}

const mutacoes = [
  {
    nome: "nao pede a tranca de instancia",
    mutar: (s) =>
      s.replace(/const instanceLock = app\.requestSingleInstanceLock\(\);/, "const instanceLock = true;"),
    passa: (s) => /app\.requestSingleInstanceLock\(\)/.test(semComentarios(s)),
  },
  {
    nome: "a copia redundante nao fecha (app.quit removido do bloco da tranca)",
    mutar: (s) =>
      s.replace(
        /app\.quit\(\s*\)\s*;?\s*\r?\n\s*\} else \{/,
        "} else {"
      ),
    passa: (s) =>
      /app\.quit\(\s*\)\s*;?\s*\r?\n\s*\} else \{/.test(semComentarios(s)),
  },
  {
    nome: "a segunda copia arranca o servidor na mesma",
    mutar: (s) => s.replace(/if\s*\(!instanceLock\)\s*return;/, ""),
    passa: (s) => /if\s*\(!instanceLock\)\s*return;/.test(semComentarios(s)),
  },
  {
    nome: "o handler nao da' foco a janela",
    mutar: (s) => s.replace(/\s*win\.focus\(\s*\)\s*;?/, ""),
    passa: (s) => /win\.focus\(\)/.test(semComentarios(s)),
  },
  {
    nome: "o handler nao restaura a janela minimizada",
    mutar: (s) =>
      s.replace(/if\s*\(win\.isMinimized\(\)\)\s*win\.restore\(\s*\)\s*;?/, ""),
    passa: (s) => /isMinimized\(\)\)\s*win\.restore\(\)/.test(semComentarios(s)),
  },
  {
    nome: "o handler nao mostra a janela",
    mutar: (s) =>
      s.replace(
        /(\s*win\.show\(\s*\)\s*;?\s*\r?\n)(\s*win\.focus\(\s*\)\s*;?)/,
        "$2"
      ),
    passa: (s) =>
      /win\.show\(\)/.test(blocoDe(s, 'on("second-instance"', "\n  });")),
  },
];

for (const m of mutacoes) {
  const mutado = m.mutar(MAIN);
  if (mutado === MAIN) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o texto nao mudou): " + m.nome);
    falhou++;
    continue;
  }
  if (m.passa(mutado)) {
    console.log("  FALHA MUTACAO NAO DETECTADA: " + m.nome);
    falhou++;
  } else {
    console.log("  OK    MUTACAO apanhada: " + m.nome);
    ok++;
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
