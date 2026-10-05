// electron-builder afterPack: corrige os modulos nativos do server/.
//
// Porque e' preciso
// -----------------
// O @electron/rebuild so reconstroi o modulo nativo do projecto principal. O
// server/ e' copiado tal e qual pelo extraResources, por isso qualquer binario
// nativo (.node / .dll) que esteja lá dentro vai sempre com a arquitectura da
// maquina onde a build foi feita. Como esta maquina e' um PC ARM, o pacote x64
// saia com o binario ARM64 dentro e a app morria ao arrancar em qualquer PC x86:
//
//   Error: node_datachannel.node is not a valid Win32 application
//     code: 'ERR_DLOPEN_FAILED'
//
// Como corrige
// -------------
// Aqui, ja depois de o app estar montado em release\win-unpacked (ou
// win-arm64-unpacked), trocamos esse binario pelo da arquitectura que estamos a
// empacotar. Os binarios vem de scripts\native\, tirados dos prebuilds oficiais
// do node-datachannel (napi, portanto independem da versao do Node/Electron).
//
// No fim varre tudo o que ficou no pacote e falha a build se houver algum
// binario com a arquitectura errada - e' o que torna este bug impossivel de
// repetir em silencio.

const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");
const PREBUILDS = path.join(RAIZ, "scripts", "native");

// machine do cabecalho PE -> arquitectura (ver http://www.pe.gatech.edu/)
const MACHINE = { 0x8664: "x64", 0xaa64: "arm64", 0x14c: "ia32" };

// electron-builder passa o arch como numero (Arch do builder-util) ou como
// string, conforme a versao. Tratamos os dois.
const ARCH_NUM = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64" };

// Binarios que sabemos trocar. A chave e' o caminho relativo dentro do
// server/node_modules (com "/" mesmo no Windows).
const TROCAR = [
  {
    de: "node-datachannel/build/Release/node_datachannel.node",
    ficheiro: (arch) => `node_datachannel.win32-${arch}.node`,
  },
];

// Pastas onde os binarios sao escolhidos em runtime (require-addon monta
// "prebuilds/<plataforma>-<arquitectura>"), por isso nao contam como errados.
const RUNTIME = /(^|[\\/])prebuilds[\\/]/i;

function arquitecturaDe(ficheiro) {
  const b = fs.readFileSync(ficheiro);
  if (b.length < 0x40) return null;
  const pe = b.readUInt32LE(0x3c);
  if (pe + 6 > b.length) return null;
  if (b.toString("latin1", pe, pe + 4) !== "PE\0\0") return null;
  return MACHINE[b.readUInt16LE(pe + 4)] || "?";
}

function nomeDoArch(context) {
  const a = context.arch;
  if (typeof a === "string" && a) return a;
  if (typeof a === "number") return ARCH_NUM[a] || "?";
  const nome = path.basename(context.appOutDir || "");
  const m = nome.match(/win-(x64|arm64|ia32|armv7l)-unpacked/);
  return m ? m[1] : "?";
}

function listar(dir, acc = []) {
  let nomes;
  try {
    nomes = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const n of nomes) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) {
      listar(p, acc);
    } else if (/\.(node|dll)$/i.test(n.name)) {
      acc.push(p);
    }
  }
  return acc;
}

exports.default = async function afterPack(context) {
  if ((context.electronPlatformName || process.platform) !== "win32") return;

  const arch = nomeDoArch(context);
  const modulos = path.join(context.appOutDir, "resources", "server", "node_modules");
  if (!fs.existsSync(modulos)) {
    console.log("  [nativos] server/node_modules nao esta no pacote - nada a fazer");
    return;
  }

  console.log(`  [nativos] a corrigir os binarios para ${arch}`);

  // 1. Trocar os que sabemos.
  for (const t of TROCAR) {
    const destino = path.join(modulos, ...t.de.split("/"));
    const fonte = path.join(PREBUILDS, t.ficheiro(arch));
    if (!fs.existsSync(destino)) {
      console.log(`  [nativos] ${t.de}: nao esta no pacote, a ignorar`);
      continue;
    }
    if (!fs.existsSync(fonte)) {
      throw new Error(
        `[nativos] falta scripts/native/${t.ficheiro(arch)} - o pacote ${arch} sairia com o binario errado`
      );
    }
    const de = arquitecturaDe(destino);
    const para = arquitecturaDe(fonte);
    if (de === para) {
      console.log(`  [nativos] ${t.de}: ja e' ${para}`);
      continue;
    }
    fs.copyFileSync(fonte, destino);
    const feito = arquitecturaDe(destino);
    if (feito !== arch) {
      throw new Error(
        `[nativos] ${t.de}: troquei o binario mas ficou ${feito} em vez de ${arch}`
      );
    }
    console.log(`  [nativos] ${t.de}: ${de} -> ${feito}`);
  }

  // 2. Varredura final: nenhum binario pode ficar com a arquitectura errada.
  const errados = listar(modulos)
    .filter((f) => !RUNTIME.test(path.relative(modulos, f).replace(/\\/g, "/")))
    .map((f) => ({ f, a: arquitecturaDe(f) }))
    .filter((x) => x.a && x.a !== arch);

  if (errados.length) {
    for (const x of errados) {
      console.error(`  [nativos] ERRADO: ${path.relative(modulos, x.f)} e' ${x.a}`);
    }
    throw new Error(
      `[nativos] ${errados.length} binario(s) com a arquitectura errada no pacote ${arch}`
    );
  }

  console.log(`  [nativos] todos os binarios estao em ${arch}`);
};