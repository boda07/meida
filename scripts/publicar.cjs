// Publica a app e cura sozinho no 422.
//
// O electron-builder falha muitas vezes a criar a release no GitHub
// (422 "Validation Failed"), e quando falha deixa a release publicada
// pela metade (1 asset de 3, sem aviso). O fix-latest.cjs repara:
// sobe os assets em falta, gera o latest.yml a partir do .exe ja
// assinado e verifica que o latest.yml publico bate com o instalador.
//
// Fluxo:
//   1. electron-builder --x64 --publish always
//   2. Se falhou (saida != 0): node scripts/fix-latest.cjs <versao>
//   3. Se o fix-latest tambem falhou: sair com codigo 1
//   4. node scripts/prune-releases.mjs (mantem so as 3 releases mais recentes)
//
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(process.cwd());
const versao = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8")).version;

function run(cmd, args) {
  try {
    execFileSync(cmd, args, { stdio: "inherit", cwd: RAIZ, encoding: "utf8" });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

console.log(`  Publicando a v${versao}...`);

const codigo = run("electron-builder", ["--x64", "--publish", "always"]);

if (codigo !== 0) {
  console.log(`  electron-builder saiu com codigo ${codigo} — a tentar reparar com fix-latest...`);
  const codigoFix = run("node", ["scripts/fix-latest.cjs", versao]);
  if (codigoFix !== 0) {
    console.error("  ERRO: o fix-latest nao conseguiu reparar a release.");
    process.exit(codigoFix);
  }
  console.log("  release reparada com sucesso pelo fix-latest.");
} else {
  console.log("  electron-builder terminou bem.");
}

const codigoPrune = run("node", ["scripts/prune-releases.mjs"]);
if (codigoPrune !== 0) {
  console.error("  ERRO: o prune-releases falhou.");
  process.exit(codigoPrune);
}

// O verificar-release.mjs e um modulo ESM (usa import/await no topo), por isso
// nao pode ser importado deste ficheiro CommonJS. Corremos-no como processo a
// parte; ele lê a versao do package.json sozinho e sai com codigo 1 se alguma
// verificacao falhar. Precisa de rede (gh api + fetch ao GitHub), o que e'
// aceitavel aqui porque o publish ja usa rede.
console.log("  a verificar a release publicada...");
const codigoVerify = run("node", ["scripts/verificar-release.mjs"]);
if (codigoVerify !== 0) {
  console.error("  ERRO: a verificacao da release falhou.");
  process.exit(codigoVerify);
}

console.log("  publicacao concluida e verificada.");
