// A publicacao tem de correr o electron-builder a serio.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **`publicar.cjs` tem de conseguir LANÇAR o electron-builder, e isso só se prova
// lançando-o.**
//
// Havia um bug que gastou a tentativa de publicar a 1.5.5 inteira. O script fazia
// `execFileSync("electron-builder", ...)`, e no Windows isso dá **ENOENT**: o que
// está no PATH é um `electron-builder.cmd`, e o Node só lança um `.cmd` com
// `shell: true`.
//
// O que o torna pior do que um erro é **a forma como se manifestava**:
//
//   1. O `catch` devolvia `e.status ?? 1` → 1.
//   2. O script imprimia "electron-builder saiu com codigo 1 — a tentar reparar
//      com fix-latest", que é a mensagem de um **422 do GitHub**.
//   3. O `fix-latest` ia procurar `release\MEIDA Setup 1.5.5.exe`, que nunca
//      tinha sido construído, e falhava também.
//
// Ou seja: **nenhuma das mensagens apontava para a causa**, e as duas apontavam
// para o mesmo sítio errado. O `release/` ficou com o `.exe` do 1.5.4 e o
// `builder-debug.yml` de 16 de outubro — a build nunca chegou a começar.
//
// Isto não se apanha com `grep` a ver se a string aparece. Chama-se a
// ferramenta com `--version`: se o caminho estiver certo, ela responde. É o que
// o teste faz, e é rápido — `--version` não empacota nada.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { caminhoCli, rodar, rodarScript, RAIZ: raizModulo } = require(
  path.join(RAIZ, "scripts", "correr-cli.cjs")
);

const PUBLICAR = fs.readFileSync(path.join(RAIZ, "scripts", "publicar.cjs"), "utf8");

/**
 * O codigo sem os comentarios.
 *
 * Sem isto, este ficheiro testava as suas proprias explicacoes: a primeira
 * versao falhou com "o publicar.cjs NAO chama execFileSync(\"electron-builder\")"
 * porque essa frase esta escrita no comentario que explica **porque** o codigo
 * esta assim. Um teste que le o texto em vez do codigo acaba a aprovar o bug
 * (ou a reprovar a correccao) conforme a redaccao do comentario.
 *
 * Nao e' um parser. Estes dois ficheiros nao tem URLs em strings, que e' o unico
 * caso em que um `//` inline seria confundido com um comentario — e o
 * `testaQueNaoEstragou` abaixo falha alto se isso mudar.
 */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/[ \t]\/\/.*$/gm, "");
}

/** O stripper tem de continuar a devolver codigo com alguma coisa dentro. */
function testaQueNaoEstragou(codigo, limpo) {
  const a = codigo.replace(/\s+/g, "");
  const b = limpo.replace(/\s+/g, "");
  return b.length > 0 && b.length < a.length;
}

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) o caminho do electron-builder existe mesmo");
{
  const cli = caminhoCli("electron-builder");
  ok_("o cli.js esta onde o modulo diz", fs.existsSync(cli), cli);
  ok_("e o nome do pacote bate certo com o bin (electron-builder.cmd)", fs.existsSync(path.join(RAIZ, "node_modules", ".bin", "electron-builder.cmd")));
  ok_("o modulo aponta para a raiz do repositorio", raizModulo === path.resolve(RAIZ));
}

console.log("");
console.log("  2) o electron-builder ARRANCA por esse caminho (isto e' a assercao)");
{
  // `--version` nao empacota nada: e' o teste mais barato que prova que o
  // processo e' mesmo lancado. Se der ENOENT, volta a falhar em silencio.
  const cli = caminhoCli("electron-builder");
  const pin = require(path.join(RAIZ, "node_modules", "electron-builder", "package.json")).version;
  let saida = "";
  let codigo = 0;
  try {
    const { execFileSync } = require("node:child_process");
    saida = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  } catch (e) {
    codigo = e.status ?? 127;
  }
  ok_("o electron-builder responde a --version", codigo === 0 && saida.trim().length > 0, "code=" + codigo);
  // E' a MESMA versao que o package.json declara: se o cli.js lancado fosse outro,
  // isto nao bateria certo.
  ok_("e e' a versao que o package.json declara", saida.trim() === pin, "disse " + JSON.stringify(saida.trim()) + ", pin " + pin);
}

console.log("");
console.log("  3) a forma que dava ENOENT nao pode voltar ao script");
{
  const CODIGO = semComentarios(PUBLICAR);
  ok_("o stripper de comentarios nao estragou o codigo", testaQueNaoEstragou(PUBLICAR, CODIGO));
  ok_("o codigo NAO chama execFileSync(\"electron-builder\")",
    !/execFileSync\(\s*["']electron-builder["']/.test(CODIGO));
  ok_("nem passa o nome da ferramenta como comando",
    !/rodar\(\s*["']electron-builder["']/.test(CODIGO));
  ok_("usa caminhoCli(\"electron-builder\")", /caminhoCli\(\s*["']electron-builder["']\s*\)/.test(CODIGO));
  ok_("e o `node` e' o binario que esta a correr", !/execFileSync\(\s*["']node["']/.test(CODIGO));
}

console.log("");
console.log("  4) falhar tem de ser distinguivel de faltar");
{
  const RUN = rodar.toString();
  ok_("o 127 significa 'a ferramenta nao existe'", /return 127/.test(RUN));
  ok_("e o ENOENT e' mapeado para 127", /ENOENT/.test(RUN));
  ok_("o publicar.cjs nao tenta reparar quando deu 127", /if \(codigo === 127\) process\.exit\(127\)/.test(PUBLICAR));
  ok_("e diz o que fazer, em vez de culpar a release", /npm install/.test(RUN));
  // O wrapper dos scripts proprios tem de dar 127 tambem — e nao 1, que e' o
  // que fazia o `fix-latest` culpar o GitHub por um ficheiro que nao existia.
  ok_("rodarScript devolve 127 para um script que nao existe",
    rodarScript("nao-existe-mesmo.mjs", [], "o script de teste") === 127);
}

console.log("");
console.log("  5) a cadeia inteira continua a ser a mesma");
{
  // O 127 tem de aparecer ANTES do fix-latest, senao volta a procurar um
  // instalador que nunca foi construido — que e' como se começou.
  const CODIGO = semComentarios(PUBLICAR);
  const iEB = CODIGO.indexOf('caminhoCli("electron-builder")');
  const i127 = CODIGO.indexOf("process.exit(127)");
  const iFix = CODIGO.indexOf("fix-latest.cjs");
  ok_("o electron-builder e' o primeiro", iEB > -1);
  ok_("o 127 sai antes do fix-latest", iEB < i127 && i127 < iFix, "eb=" + iEB + " 127=" + i127 + " fix=" + iFix);
  ok_("o prune-releases vem depois", CODIGO.indexOf("prune-releases.mjs") > iFix);
  ok_("e a verificacao no fim", CODIGO.indexOf("verificar-release.mjs") > CODIGO.indexOf("prune-releases.mjs"));
  ok_("e o wrapper continua a correr os tres passos", /rodarScript\(\s*"prune-releases\.mjs"/.test(CODIGO) && /rodarScript\(\s*"verificar-release\.mjs"/.test(CODIGO));
}

console.log("");
console.log("  6) os scripts da cadeia existem todos");
{
  for (const f of ["publicar.cjs", "correr-cli.cjs", "fix-latest.cjs", "prune-releases.mjs", "verificar-release.mjs"]) {
    ok_("scripts/" + f, fs.existsSync(path.join(RAIZ, "scripts", f)));
  }
}

console.log("");
console.log("  7) higiene");
{
  const alvos = PUBLICAR + fs.readFileSync(path.join(RAIZ, "scripts", "correr-cli.cjs"), "utf8");
  ok_("sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(alvos));
  ok_("sem caractere de substituicao", !/[\uFFFD]/.test(alvos));
  ok_("rodarScript so existe uma vez", (fs.readFileSync(path.join(RAIZ, "scripts", "correr-cli.cjs"), "utf8").match(/function rodarScript\(/g) || []).length === 1);
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);