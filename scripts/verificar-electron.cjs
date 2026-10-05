// electron-builder beforePack: o Electron que vai no binario tem de ser o mesmo
// que o package.json pede.
//
// Porque e' preciso
// -----------------
// O electron-builder NAO tem `electronVersion` fixo: usa o binario que esta em
// node_modules. Se esse node_modules estiver desatualizado, a release sai com um
// Electron diferente do declarado e **ninguem ve o erro** — o electron-builder
// impressiona "packaging ... electron=33.4.11" e segue.
//
// As consequencias sao graves. O `server/` importa `node:sqlite`
// (server/src/db/index.js), que so existe no Node 22+. O Electron 33 traz o
// Node 20, portanto o backend morre no `import` e a app fica com a janela preta
// em QUALQUER PC. Foi assim que a 1.2.4 saiu partida (e a 1.2.5 existiu para
// corrigir).
//
// Este hook transforma esse silencio num erro de build, antes de gastar meio
// minuto a empacotar.
//
// Ficheiros que interessam
// ------------------------
//   node_modules/electron/package.json  -> a versao que esta instalada
//   node_modules/electron/dist/         -> o binario em si
//
// O `postinstall` do electron pode ser ignorado (`--ignore-scripts`, alguns
// caches de CI, ou um `npm install` que ficou a meio). Aí a pasta `dist/` falta
// e o electron-builder volta a ir buscar a versao dele ao registry — que e
// exactamente o buraco que este hook fecha.

const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");

// "44.5.1" ou "^44.5.1" -> "44.5.1". O package.json usa a versao exacta (sem ^),
// por isso um "^" aqui e' sempre um erro de escrita, mas tratamos os dois.
function versaoPedida() {
  const pkg = require(path.join(RAIZ, "package.json"));
  const cru = (pkg.devDependencies && pkg.devDependencies.electron) || "";
  return cru.replace(/^[\^~>=<\s]+/, "").trim();
}

// Onde pode estar o binario para o modo de desenvolvimento. Nao e' obrigatorio
// para o empacotamento (o electron-builder descarrega o Electron do GitHub), por
// isso isto e' so um aviso: sem isto o `npm run app:electron` nao arranca.
function ondeEstaOBinario() {
  const base = path.join(RAIZ, "node_modules", "electron");
  const candidatos = [];
  const txt = path.join(base, "path.txt");
  if (fs.existsSync(txt)) {
    const dentro = fs.readFileSync(txt, "utf8").trim();
    // O path.txt pode dizer "dist" (verses antigas) ou ja trazer o executavel.
    if (dentro) candidatos.push(path.join(base, dentro));
  }
  candidatos.push(path.join(base, "dist", "electron.exe"), path.join(base, "electron.exe"));
  return candidatos.find((c) => fs.existsSync(c)) || null;
}

exports.default = async function beforePack() {
  const pedida = versaoPedida();
  if (!pedida) {
    console.log("  [electron] devDependencies.electron nao esta definido - a ver");
    return;
  }

  const pkgEl = path.join(RAIZ, "node_modules", "electron", "package.json");
  if (!fs.existsSync(pkgEl)) {
    throw new Error(
      "[electron] node_modules/electron nao existe. Corre `npm install` antes de empacotar."
    );
  }

  // O que interessa mesmo: a versao. E' dela que o electron-builder tira o
  // numero para descarregar o Electron certo.
  const instalada = require(pkgEl).version;
  if (instalada !== pedida) {
    throw new Error(
      `[electron] o package.json pede ${pedida} mas o node_modules tem ${instalada}.\n` +
        "            O electron-builder usa a versao que esta em node_modules, por isso a\n" +
        "            release sairia com o Electron errado. Corre `npm install` e tenta de novo.\n" +
        "            ( Electron antigo = sem node:sqlite = o backend morre = janela preta. )"
    );
  }

  console.log(`  [electron] ${pedida} (ok)`);
  if (!ondeEstaOBinario()) {
    console.log(
      "  [electron] aviso: nao ha electron.exe em node_modules (o postinstall nao correu).\n" +
        "            Isso NAO afecta o instalador, mas `npm run app:electron` nao arranca.\n" +
      "            Paraumo: node node_modules/electron/install.js"
    );
  }
};
