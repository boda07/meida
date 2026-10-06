// Regenera o `latest.yml` a partir do instalador JA ASSINADO e sobe os ficheiros
// que faltam na release. Isto e' preciso porque o `electron-builder` falha
// muitas vezes a criar a release no GitHub (422 "Validation Failed"), e quando
// falha deixa a release publicada pela metade — ja aconteceu nas versoes 1.2.0,
// 1.2.1, 1.2.2 e 1.3.2. O `latest.yml` e' o ficheiro que o electron-updater le
// para saber o que ha para instalar; sem ele (ou com o hash de outra versao) o
// botao "Procurar atualizacao" parte sem dar erro nenhum.
//
// Duas regras que este script existe para fazer respeitar:
//
// 1. O `latest.yml` tem de ser gerado DEPOIS da assinatura. A assinatura
//    acrescenta bytes ao .exe, por isso um hash calculado antes nao bate com o
//    ficheiro final e o updater rejeita.
// 2. O nome do asset tem tracos (`MEIDA-Setup-1.3.2.exe`), mesmo que o ficheiro
//    em disco tenha espacos. E' assim que o updater o procura.
//
// E' idempotente: sobe o que falta ou o que mudou de tamanho, por isso pode ser
// repetido as vezes que for preciso sem reenviar 228 MB.
//
// Como corre: `node scripts/fix-latest.cjs <versao>`
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const RELEASE_DIR = "release";
const REPO = "boda07/meida";
const TAG = (v) => `v${v}`;

function log(m) {
  console.log("  " + m);
}
function falha(m) {
  console.error("  ERRO: " + m);
  process.exit(1);
}
function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // O gh despeja o manual inteiro no stderr; nao faz sentido mostrar isso.
    const msg = String(e.stderr || e.message || "")
      .split("\n")
      .find((l) => l.trim() && !/^(Makes|Flags|USAGE|INHERITED|EXAMPLES|ENVIRONMENT|LEARN|Many|For|You|The|When|Note|Override|Pass|Add|List|Makes|For|Print|Set|$|\s{2})/.test(l))
      ?.trim();
    throw new Error(msg || "gh falhou", { cause: e });
  }
}

const versao = process.argv[2];
if (!versao) falha("uso: node scripts/fix-latest.cjs <versao>  (ex.: 1.3.2)");

const nomeAsset = `MEIDA-Setup-${versao}.exe`;
const exeEmDisco = path.join(RELEASE_DIR, `MEIDA Setup ${versao}.exe`);
const exeAsset = path.join(RELEASE_DIR, nomeAsset);
const blockmapEmDisco = path.join(RELEASE_DIR, `MEIDA Setup ${versao}.exe.blockmap`);

if (!fs.existsSync(exeEmDisco)) falha(`nao encontro o instalador: ${exeEmDisco}`);

// 1) Copia para o nome com tracos (o que vai ser publicado).
fs.copyFileSync(exeEmDisco, exeAsset);

// 2) Hash e tamanho do ficheiro JA assinado.
const bytes = fs.readFileSync(exeAsset);
const sha512 = crypto.createHash("sha512").update(bytes).digest("base64");

const latestPath = path.join(RELEASE_DIR, "latest.yml");
fs.writeFileSync(
  latestPath,
  [
    `version: ${versao}`,
    "files:",
    `  - url: ${nomeAsset}`,
    `    sha512: ${sha512}`,
    `    size: ${bytes.length}`,
    `path: ${nomeAsset}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    "",
  ].join("\n"),
  "utf8"
);
log(`latest.yml gerado: version=${versao}  size=${bytes.length}  sha512=${sha512.slice(0, 24)}...`);

// 3) O .blockmap tem de ser do MESMO ficheiro: serve para retomar um download
//    interrompido, e um blockmap de outra build leva a ficheiros corrompidos.
const aSubir = [{ f: exeAsset, tamanho: bytes.length }];
if (fs.existsSync(blockmapEmDisco)) {
  if (fs.statSync(blockmapEmDisco).mtimeMs < fs.statSync(exeAsset).mtimeMs) {
    falha("o .blockmap e' mais VELHO que o instalador — regerar a build antes de publicar");
  }
  const destino = path.join(RELEASE_DIR, nomeAsset + ".blockmap");
  fs.copyFileSync(blockmapEmDisco, destino);
  aSubir.push({ f: destino, tamanho: fs.statSync(destino).size });
} else {
  falha("nao encontro o .blockmap");
}
aSubir.push({ f: latestPath, tamanho: fs.statSync(latestPath).size });

// 4) Estado actual da release, para nao reenviar o que ja esta la e certo.
let release;
try {
  release = JSON.parse(gh(["api", `repos/${REPO}/releases/tags/${TAG(versao)}`]));
} catch (e) {
  falha(`a release ${TAG(versao)} nao existe: ${e.message}`);
}
const jaLa = new Map(release.assets.map((a) => [a.name, a.size]));

let subiu = 0;
for (const { f, tamanho } of aSubir) {
  const nome = path.basename(f);
  if (jaLa.get(nome) === tamanho) {
    log(`${nome}: ja esta published com o tamanho certo (${tamanho} bytes) — nao reenvio`);
    continue;
  }
  try {
    gh(["release", "upload", TAG(versao), f, "--clobber", "--repo", REPO]);
    log(`${nome}: publicado (${tamanho} bytes)`);
    subiu++;
  } catch (e) {
    falha(`nao consegui subir ${nome}: ${e.message}`);
  }
}
if (!subiu) log("nada para subir; so confirmei o que la esta");

// 5) Verificacao final. E' a unica forma fiavel: o log do electron-builder
//    pode acabar em erro mesmo com a release boa, e vice-versa.
const final = JSON.parse(gh(["api", `repos/${REPO}/releases/tags/${TAG(versao)}`]));
const nomes = final.assets.map((a) => a.name);
log(`assets na release ${TAG(versao)}: ${nomes.length}`);
for (const n of nomes) log(`  ${n}`);

const obrigatorios = [nomeAsset, "latest.yml", nomeAsset + ".blockmap"];
const emFalta = obrigatorios.filter((o) => !nomes.includes(o));
if (emFalta.length) falha(`faltam na release: ${emFalta.join(", ")}`);

// 6) O `latest.yml` publico e' o que o electron-updater vai mesmo ler.
const publico = execFileSync(
  "curl",
  ["-sL", `https://github.com/${REPO}/releases/latest/download/latest.yml`],
  { encoding: "utf8" }
);
const v = /version:\s*(\S+)/.exec(publico);
const s = /sha512:\s*(\S+)/.exec(publico);
log(`latest.yml publico: version=${v ? v[1] : "(ilegivel)"}`);
if (!v || v[1] !== versao) {
  falha(`o latest.yml publico aponta para ${v ? v[1] : "?"} e nao para ${versao}`);
}
if (!s || s[1] !== sha512) {
  falha("o sha512 do latest.yml publico nao bate com o do instalador");
}

log(`\n${TAG(versao)} completa: instalador + blockmap + latest.yml, e o hash publico bate com o do ficheiro assinado.`);
