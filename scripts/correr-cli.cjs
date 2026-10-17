// Correr uma ferramenta da linha de comandos pelo seu `cli.js`, sem shell.
//
// Porque e' preciso
// ----------------
// `execFileSync("electron-builder", ...)` DA ENOENT no Windows. O que esta no
// PATH e' `electron-builder.cmd`, e o Node so consegue lancar um `.cmd` com
// `shell: true` — sem isso, ENOENT.
//
// E o pior nao e' que falhe: e' **como** falha. O `catch` devolvia 1, o
// `publicar.cjs` imprimia "electron-builder saiu com codigo 1 — a tentar
// reparar com o fix-latest", e o `fix-latest` ia procurar o instalador que
// nunca tinha sido construido. A unica pista era essa mensagem final, e ela
// aponta para o sintoma errado (uma release partida) quando nao ha release
// nenhuma. Foi assim que a 1.5.5 gastou uma tentativa a publicar.
//
// E' o mesmo problema do `execFileSync("curl")` (ver AGENTS.md), pela mesma
// razao: o PATH que o processo Node ve nao e' o PATH do PowerShell.
//
// A solucao e' nao depender do PATH: corre-se o `cli.js` da propria ferramenta
// com o `node` que esta a correr (`process.execPath`). Sem shell, sem `.cmd`,
// sem PATH. E o `node` tambem deixa de ser um nome deitou ao acaso.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");

/** O `cli.js` de uma ferramenta de node_modules, pelo nome do pacote. */
function caminhoCli(pacote) {
  return path.join(RAIZ, "node_modules", pacote, "cli.js");
}

/**
 * Corre um script com o node e devolve o codigo de saida.
 *
 * `127` significa "a ferramenta nao existe", e e' separado de "correu e falhou"
 * de proposito: e' o unico caso em que reparar a release nao faz sentido, porque
 * nunca chegou a haver release para reparar.
 */
function rodar(caminho, args, rotulo) {
  try {
    execFileSync(process.execPath, [caminho, ...args], { stdio: "inherit", cwd: RAIZ });
    return 0;
  } catch (e) {
    if (e.code === "ENOENT" || !fs.existsSync(caminho)) {
      console.error(
        `  ERRO: nao encontrei ${rotulo} (${caminho}).\n` +
          "        Corre `npm install` na raiz antes de publicar."
      );
      return 127;
    }
    return e.status ?? 1;
  }
}

/**
 * Corre um script nosso da pasta `scripts/` (serve para `.cjs` e para `.mjs`:
 * o `node` resolve os dois da mesma maneira).
 */
function rodarScript(nome, args = [], rotulo = nome) {
  return rodar(path.join(RAIZ, "scripts", nome), args, rotulo);
}

module.exports = { RAIZ, caminhoCli, rodar, rodarScript };