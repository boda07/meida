// Verificacao final, feita DEPOIS do publish e sem depender do que os scripts
// disseram. O aviso do AGENTS.md e' explicito: nao se acredita no "saiu com
// codigo 0", conta-se os assets e compara-se o hash.
//
// `fetch` e nao `curl`: o System32 nao esta' no PATH que o Node ve nesta maquina
// (ja happened, ver o aviso).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";

// A versao vem do `package.json` e nao e' escrita aqui. Estava fixo em "1.5.3" e
// era uma armadilha: na release seguinte a script verificava a release anterior
// (que ainda estava no GitHub e por isso "dava tudo certo"), sem dar conta de que
// a nova nem estava verificada. Ler o `package.json` e' o que impede isso — e o
// `package.json` ja foi bumped e commitado antes do publish, que e' a ordem certa.
const VER = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;
const BASE = "https://github.com/boda07/meida/releases/download/v" + VER + "/";

const gh = (args) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 20 });

let ok = 0;
let falhou = 0;
const ok_ = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
};

console.log("");
console.log("  1) a release tem os TRES assets");
const rel = JSON.parse(gh(["api", "repos/boda07/meida/releases/tags/v" + VER]));
const nomes = rel.assets.map((a) => a.name).sort();
ok_("existe a v" + VER, rel.tag_name === "v" + VER, rel.tag_name);
ok_("esta' publicada (nao e' draft)", rel.draft === false);
ok_("3 assets", rel.assets.length === 3, "n=" + rel.assets.length);
ok_("o instalador", nomes.includes("MEIDA-Setup-" + VER + ".exe"), nomes.join(","));
ok_("o blockmap", nomes.includes("MEIDA-Setup-" + VER + ".exe.blockmap"));
ok_("o latest.yml", nomes.includes("latest.yml"));

console.log("");
console.log("  2) o latest.yml PUBLICO aponta para esta versao, com o hash certo");
const pub = await (await fetch(BASE + "latest.yml")).text();
const ver = (pub.match(/version:\s*(\S+)/) || [])[1];
const sha = (pub.match(/sha512:\s*(\S+)/) || [])[1];
const tam = Number((pub.match(/size:\s*(\d+)/) || [])[1]);
const ficheiro = (pub.match(/path:\s*(\S+)/) || [])[1];
ok_("version: " + VER, ver === VER, String(ver));
ok_("o path tem tracos (e' assim que o updater procura)", ficheiro === "MEIDA-Setup-" + VER + ".exe", String(ficheiro));
ok_("size > 0", tam > 0, String(tam));

// O hash do .exe PUBLICO. Descarrega e hasheia: e' o unico jeito de provar que
// o que o updater vai buscar e' o que foi construido.
const exe = Buffer.from(await (await fetch(BASE + "MEIDA-Setup-" + VER + ".exe")).arrayBuffer());
const real = crypto.createHash("sha512").update(exe).digest("base64");
ok_("o sha512 do .exe publico bate com o do latest.yml", real === sha, "yml=" + String(sha).slice(0, 14) + "  real=" + real.slice(0, 14));
ok_("o tamanho bate", exe.length === tam, "exe=" + exe.length + " yml=" + tam);
ok_("o .exe publico nao esta' truncado (>100 MB)", exe.length > 100 * 1024 * 1024, Math.round(exe.length / 1048576) + " MB");

console.log("");
console.log("  3) a tag aponta para um commit que esta' no main");
const tag = JSON.parse(gh(["api", "repos/boda07/meida/git/ref/tags/v" + VER]));
const shaTag = tag.object.sha;
// **Ancestral do main, nao igual ao HEAD local.** Comparar com o HEAD dava uma
// FALSA imediatamente a seguir a publicacao: assim que se faz mais um commit (o
// habitual — corrigir o verificador, por exemplo) o HEAD anda para a frente e a
// verificacao falhava com a release impecavel. O que tem de ser verdade e' que o
// commit da tag NAO se perdeu: e' esse o erro real (tagar um commit que nao esta
// no main, ou o push nao ter ido).
try { execFileSync("git", ["fetch", "origin", "--tags", "--quiet"], { encoding: "utf8" }); } catch { /* sem rede: a verificacao seguinte da */ }
let noMain;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", shaTag, "origin/main"], { encoding: "utf8" });
  noMain = true;
} catch { noMain = false; }
ok_("a tag v" + VER + " aponta para um commit que esta' no main", noMain, "tag=" + shaTag.slice(0, 10));
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const movido = head !== shaTag;
console.log(
  "        " +
    (movido
      ? "o HEAD local ja foi para a frente (" + shaTag.slice(0, 7) + " -> " + head.slice(0, 7) + "), como deve ser: a tag fica na release."
      : "o HEAD local e' o commit da release.")
);

console.log("");
console.log("  4) o instalador e' x64 (esta maquina e' ARM)");
const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * O campo "Machine" do cabecalho PE. **Tem de se ir pelo `e_lfanew`** (o
 * offset guardado no byte 0x3C): procurar "PE" com `indexOf` acha a sigla em
 * qualquer lado do ficheiro — foi o que me deu 0x0022 numa leitura feita a
 * mao, um numero que nao e' nenhuma maquina valida.
 */
function maquinaDe(buf) {
  if (buf.length < 0x40) return null;
  const off = buf.readUInt32LE(0x3c);
  if (buf.slice(off, off + 4).toString("latin1") !== "PE\0\0") return null;
  return buf.readUInt16LE(off + 4);
}

const maqApp = fs.existsSync("release/win-unpacked/MEIDA.exe")
  ? maquinaDe(fs.readFileSync("release/win-unpacked/MEIDA.exe"))
  : null;
ok_("o MEIDA.exe do pacote e' x64 (0x8664)", maqApp === 0x8664, maqApp === null ? "MEIDA.exe nao encontrado" : "0x" + maqApp.toString(16));

const armAntigo = fs.existsSync("release/win-arm64-unpacked/MEIDA.exe")
  ? fs.statSync("release/win-arm64-unpacked/MEIDA.exe").mtime
  : null;
ok_(
  "nenhuma pasta arm64 tocada por esta build",
  !armAntigo || armAntigo.getTime() < hoje(),
  armAntigo ? "arm64 de " + armAntigo.toISOString().slice(0, 16) : "nao existe (melhor)"
);
ok_("o builder so empacotou x64", (() => {
  try { return !/arm64/.test(fs.readFileSync("release/builder-debug.yml", "utf8")); }
  catch { return true; }
})());

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);