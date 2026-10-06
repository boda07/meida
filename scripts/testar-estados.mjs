// O estado de um item da biblioteca e' decidido por DUAS funcoes: estadoDe()
// no servidor (server/src/store.js) e estadoDe() no frontend
// (web/src/components/profileStats.js).
//
// Sao duas porque o frontend nao pode importar o store do servidor — essa
// cadeia traz o SQLite. Sao oito linhas, o que significa que basta um toque
// para divergirem, e foi a divergencia que fez o perfil contar 389 "para ver"
// quando a pessoa via 2 (2026-10-07).
//
// Este teste passa por CIMA das duas versoes e compara os resultados em todos
// os casos possiveis. Se alguma mudar sem a outra, falha.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "meida-estados-"));
process.env.DB_DIR = dir;

const store = await import("file:///C:/Users/white/Documents/Meida/server/src/store.js");
const { estadoDe: doFrontend } = await import(
  "file:///C:/Users/white/Documents/Meida/web/src/components/profileStats.js"
);

let n = 0;
let mau = 0;
function ok(rotulo, fn) {
  try {
    fn();
    n++;
    console.log(`  OK    ${rotulo}`);
  } catch (e) {
    mau++;
    console.log(`  FALHA ${rotulo}\n        ${e.message}`);
  }
}

// Todas as combinacoes possiveis de status x watched x watchlist. Sao 12 (3
// estados de status por 4 combinacoes de flags) mais o caso sem nada.
const CASOS = [
  null,
  "paused",
  "dropped",
  "watched",
  "watched+watchlist",
  "watchlist",
  "paused+watched",
  "paused+watchlist",
  "paused+watched+watchlist",
  "dropped+watched",
  "dropped+watchlist",
  "dropped+watched+watchlist",
];

function item(caso) {
  if (caso === null) return { status: null, watched: false, watchlist: false };
  const partes = caso.split("+");
  return {
    status: partes.includes("paused") ? "paused" : partes.includes("dropped") ? "dropped" : null,
    watched: partes.includes("watched"),
    watchlist: partes.includes("watchlist"),
  };
}

console.log("  --- as duas versoes concordam? ---");
for (const c of CASOS) {
  const it = item(c);
  const servidor = store.estadoDe(it);
  const web = doFrontend(it);
  ok(`${String(c).padEnd(24)} servidor=${servidor.padEnd(9)} web=${web}`, () => {
    if (servidor !== web) throw new Error("DIVERGEM: " + servidor + " vs " + web);
  });
}

console.log("  --- e a regra e' a que faz sentido? ---");
ok("visto com watchlist = completed (o visto ganha)", () => {
  const e = store.estadoDe({ status: null, watched: true, watchlist: true });
  if (e !== "completed") throw new Error("veio " + e);
});
ok("paused ganha a watched (estados exclusivos)", () => {
  const e = store.estadoDe({ status: "paused", watched: true, watchlist: true });
  if (e !== "paused") throw new Error("veio " + e);
});
ok("dropped ganha a watchlist", () => {
  const e = store.estadoDe({ status: "dropped", watched: false, watchlist: true });
  if (e !== "dropped") throw new Error("veio " + e);
});

console.log("  --- e as contagens do perfil respeitam os estados? ---");
const lista = [
  { status: null, watched: true, watchlist: false, score: 90 }, // completed
  { status: null, watched: true, watchlist: true, score: 80 }, // completed
  { status: null, watched: false, watchlist: true, score: null }, // plan
  { status: "paused", watched: false, watchlist: true, score: 70 }, // paused
  { status: "dropped", watched: false, watchlist: true, score: null }, // dropped
  { status: null, watched: false, watchlist: false, score: null }, // none
];
const stats = (await import("file:///C:/Users/white/Documents/Meida/web/src/components/profileStats.js"))
  .statsFrom(lista);
const { detalheStats } = await import(
  "file:///C:/Users/white/Documents/Meida/web/src/components/profileStats.js"
);

ok("6 titulos no total", () => {
  if (stats.total !== 6) throw new Error("veio " + stats.total);
});
ok("2 vistos", () => {
  if (stats.vistos !== 2) throw new Error("veio " + stats.vistos);
});
ok("1 para ver (a pausa e o abandonado NAO contam como tal)", () => {
  if (stats.aVer !== 1) throw new Error("veio " + stats.aVer + " — era este o bug do 389");
});
ok("1 em pausa", () => {
  if (stats.emPausa !== 1) throw new Error("veio " + stats.emPausa);
});
ok("1 abandonado", () => {
  if (stats.abandonados !== 1) throw new Error("veio " + stats.abandonados);
});
ok("media so dos 3 com nota (90+80+70 = 240 / 3 = 80)", () => {
  // statsFrom so devolve a media, nao o numero de notas com nota — quem precisa
  // desse numero e' a aba de estatisticas (detalheStats), que tem comNota.
  if (stats.media !== 80) throw new Error("media veio " + stats.media);
});
ok("detalheStats conta os estados e diz quantos tem nota", () => {
  const d = detalheStats(lista);
  if (d.emPausa !== 1) throw new Error("emPausa veio " + d.emPausa);
  if (d.abandonados !== 1) throw new Error("abandonados veio " + d.abandonados);
  if (d.comNota !== 3) throw new Error("comNota veio " + d.comNota);
  if (d.maisAlta !== 90) throw new Error("maisAlta veio " + d.maisAlta);
  if (d.maisBaixa !== 70) throw new Error("maisBaixa veio " + d.maisBaixa);
  if (d.mediana !== 80) throw new Error("mediana veio " + d.mediana);
  // As faixas de nota sairam de proposito: nao separavam nada.
  if (d.faixas !== undefined) throw new Error("as faixas ainda existem");
});

const { closeDb } = await import("file:///C:/Users/white/Documents/Meida/server/src/db/index.js");
closeDb?.();
rmSync(dir, { recursive: true, force: true });
console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);
