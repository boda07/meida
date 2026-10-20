// Arranca a versao web (PWA): o backend a servir o `web/dist` na mesma origem.
//
// **O build so' acontece se for preciso.** O Render ja constroi no passo de build;
// se o start command voltar a construir, sao ~47 s (medido no Render: "built in
// 47.11s") ate o servidor arrancar, e o scanner de portas do Render da-se por
// vencido entretanto:
//
//   ==> No open ports detected, continuing to scan...
//   ==> Port scan timeout reached, no open ports detected.
//
// O scanner do Render corre num namespace de rede separado do processo, por isso
// so' ve o porto depois de o servidor o abrir — e o servidor abre em **390 ms**
// (medido). Logo: o que come o tempo e' o build, e a correccao e' o que a
// documentacao do Render diz — *"Keep the start command to one long-running
// server"*.
//
// O `SERVE_WEB=1` e' posto aqui, e nao com `cross-env`: assim o caminho critico
// nao depende de uma devDependency estar instalada no servidor.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const RAIZ = path.resolve(__dirname, "..");
const WEB = path.join(RAIZ, "web");
const DIST = path.join(WEB, "dist");
const INDEX = path.join(DIST, "index.html");

const semBuild = process.argv.includes("--sem-build");
const forcar = process.env.MEIDA_FORCE_BUILD === "1";

/** O mtime mais recente de um directorio, sem `dist` nem `node_modules`. */
function maisRecente(dir) {
  let mais = 0;
  let achou = false;
  const stack = [dir];
  while (stack.length) {
    const atual = stack.pop();
    let entradas;
    try { entradas = fs.readdirSync(atual, { withFileTypes: true }); } catch { continue; }
    for (const e of entradas) {
      if (e.name === "dist" || e.name === "node_modules" || e.name === ".git") continue;
      const cheio = path.join(atual, e.name);
      if (e.isDirectory()) { stack.push(cheio); continue; }
      try {
        const m = fs.statSync(cheio).mtimeMs;
        if (!achou || m > mais) { mais = m; achou = true; }
      } catch { /* desapareceu entre o readdir e o stat */ }
    }
  }
  return achou ? mais : 0;
}

/** Porquê construir: falta o dist, ou ha algo mais novo do que o dist. */
function precisaConstruir() {
  if (!fs.existsSync(INDEX)) return "nao ha build (web/dist/index.html nao existe)";
  if (forcar) return "MEIDA_FORCE_BUILD=1";
  const doDist = fs.statSync(INDEX).mtimeMs;
  const fonte = maisRecente(WEB);
  if (fonte > doDist) {
    return "a fonte e' mais nova do que o build (fonte " + new Date(fonte).toISOString() +
      ", build " + new Date(doDist).toISOString() + ")";
  }
  return null;
}

const motivo = semBuild ? "--sem-build pedido" : precisaConstruir();

if (semBuild) {
  if (!fs.existsSync(INDEX)) {
    console.error("  ERRO: --sem-build, mas nao ha web/dist/index.html. O build tem de ser feito antes.");
    process.exit(1);
  }
  console.log("  a usar o build que ja existe (sem construir).");
  arrancar();
} else if (motivo) {
  console.log("  a construir o frontend (" + motivo + ")...");
  const r = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["--prefix", "web", "run", "build"], {
    cwd: RAIZ,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  r.on("exit", (codigo) => {
    if (codigo !== 0) {
      console.error("  ERRO: o build do frontend saiu com codigo " + codigo);
      process.exit(codigo || 1);
    }
    arrancar();
  });
} else {
  console.log("  o build esta' em dia; a arrancar.");
  arrancar();
}

function arrancar() {
  process.env.SERVE_WEB = "1";
  const servidor = spawn(process.execPath, ["server/src/index.js"], {
    cwd: RAIZ,
    stdio: "inherit",
    env: process.env,
  });
  // O Render manda SIGTERM no deploy. Sem isto, o processo morre e o
  // servidor-filho fica orfao a segurar a porta.
  const encaminhar = (sinal) => { try { servidor.kill(sinal); } catch { /* ja morreu */ } };
  process.on("SIGTERM", () => encaminhar("SIGTERM"));
  process.on("SIGINT", () => encaminhar("SIGINT"));
  servidor.on("exit", (codigo, sinal) => {
    if (sinal) process.exit(1);
    process.exit(codigo === null ? 1 : codigo);
  });
}
