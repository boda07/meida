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
//   5. node scripts/verificar-release.mjs (3 assets + latest.yml publico)
//
// **O passo 1 tem de ser `rodar(caminhoCli("electron-builder"), ...)`, nunca
// `execFileSync("electron-builder", ...)`.** A segunda forma da ENOENT no
// Windows (o que esta no PATH e' um `.cmd`) e falha em silencio — o `catch`
// devolvia 1 e o script culpava o 422, quando o electron-builder nunca tinha
// corrido. Ver `scripts/correr-cli.cjs` e `scripts/testar-publicar.mjs`.
//
// O `verificar-release.mjs` e um modulo ESM (usa import/await no topo), por isso
// nao pode ser importado deste ficheiro CommonJS. Corre-se como processo a
// parte; ele le a versao do package.json sozinho e sai com codigo 1 se alguma
// verificacao falhar. Precisa de rede (gh api + fetch ao GitHub), o que e'
// aceitavel aqui porque o publish ja usa rede.
const fs = require("node:fs");
const path = require("node:path");
const { RAIZ, caminhoCli, rodar, rodarScript } = require("./correr-cli.cjs");

const versao = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8")).version;

console.log(`  Publicando a v${versao}...`);

const codigo = rodar(
  caminhoCli("electron-builder"),
  ["--x64", "--publish", "always"],
  "o electron-builder"
);

if (codigo === 127) process.exit(127); // ferramenta em falta: nao ha nada a reparar
if (codigo !== 0) {
  console.log(`  electron-builder saiu com codigo ${codigo} — a tentar reparar com fix-latest...`);
  const codigoFix = rodarScript("fix-latest.cjs", [versao], "o fix-latest");
  if (codigoFix !== 0) {
    console.error("  ERRO: o fix-latest nao conseguiu reparar a release.");
    process.exit(codigoFix);
  }
  console.log("  release reparada com sucesso pelo fix-latest.");
} else {
  console.log("  electron-builder terminou bem.");
}

const codigoPrune = rodarScript("prune-releases.mjs", [], "o prune-releases");
if (codigoPrune !== 0) {
  console.error("  ERRO: o prune-releases falhou.");
  process.exit(codigoPrune);
}

console.log("  a verificar a release publicada...");
const codigoVerify = rodarScript("verificar-release.mjs", [], "o verificar-release");
if (codigoVerify !== 0) {
  console.error("  ERRO: a verificacao da release falhou.");
  process.exit(codigoVerify);
}

console.log("  publicacao concluida e verificada.");