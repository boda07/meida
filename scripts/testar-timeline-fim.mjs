// A data de visionamento, contra o servidor a SERIO.
//
// **Porquê um teste com o servidor arrancado.** O `watched_at` tem TRES
// comportamentos que so' aparecem com o SQL a correr de verdade:
//
//   1. marcar como visto grava a data de agora;
//   2. dar nota a um filme JA VISTO nao mexe na data (e era o erro facil: um
//      COALESCE simples apagava-a);
//   3. marcar como nao visto apaga a data.
//
// Nenhum deles se ve num teste que chame uma funcao pura com objectos inventados —
// o SQL e' o que decide. E o bug mais caro desta sessao (o `toApi` faltante no
// `statsFor`) foi exactamente disto: nenhuma das 86 verificacoes puras executava
// uma unica vez o `SELECT`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meida-timeline-e2e-"));

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

function portaLivre() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.on("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
}

const PORTA = await portaLivre();
const BASE = `http://127.0.0.1:${PORTA}`;

const filho = spawn(process.execPath, ["src/index.js"], {
  cwd: path.join(RAIZ, "server"),
  env: { ...process.env, PORT: String(PORTA), HOST: "127.0.0.1", DB_DIR: DIR, SERVE_WEB: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => { saida += d; });
filho.stderr.on("data", (d) => { saida += d; });
let morreu = null;
filho.on("exit", (c) => { morreu = c; });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const parar = () => {
  try { filho.kill(); } catch { /* ja morreu */ }
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* preso */ }
};

console.log("");
console.log("  1) o servidor arranca com a migracao 9 aplicada");
let arrancou = false;
for (let i = 0; i < 80; i++) {
  if (morreu !== null) break;
  try {
    if ((await fetch(BASE + "/api/health")).status === 200) { arrancou = true; break; }
  } catch { /* ainda a responder */ }
  await dormir(500);
}
if (!arrancou) {
  console.log("  FALHA o servidor nao arrancou (saiu com " + morreu + ")");
  console.log("        " + (saida.split("\n").find((l) => /Error/.test(l)) || saida).trim().slice(0, 140));
  parar();
  process.exit(1);
}
ok_("`/api/health` responde", true);
ok_("a migracao 9 foi aplicada", /migracao 9/.test(saida), saida.split("\n").filter((l) => /migracao/.test(l)).join(" | ").slice(0, 90));

const H = { "content-type": "application/json" };
const username = "tl" + Date.now().toString().slice(-8);
const reg = await (await fetch(BASE + "/api/auth/register", { method: "POST", headers: H, body: JSON.stringify({ username, password: "abc12345" }) })).json();
const T = { ...H, authorization: "Bearer " + reg.token };
ok_("o registo devolve token", !!reg.token);

const ler = async (tmdbId) => {
  const j = await (await fetch(BASE + "/api/library", { headers: T })).json();
  const itens = Array.isArray(j) ? j : j.items || j.library || [];
  return itens.find((i) => Number(i.tmdbId) === Number(tmdbId)) || null;
};

try {
  console.log("");
  console.log("  2) marcar como visto GRAVA a data");
  const r1 = await fetch(BASE + "/api/library", { method: "POST", headers: T, body: JSON.stringify({ type: "movie", tmdbId: 9001, watched: true, title: "Visto hoje", year: 2001 }) });
  ok_("o POST devolve 200", r1.status === 200, "=" + r1.status);
  const depoisDeVer = await ler(9001);
  ok_("o item existe", !!depoisDeVer);
  ok_("e tem `watchedAt`", !!depoisDeVer.watchedAt, "watchedAt=" + depoisDeVer.watchedAt);
  ok_("e a data e' hoje", String(depoisDeVer.watchedAt).slice(0, 10) === new Date().toISOString().slice(0, 10), String(depoisDeVer.watchedAt));

  console.log("");
  console.log("  3) DAR NOTA A UM FILME JA VISTO NAO MEXE NA DATA");
  // **O erro facil.** Um COALESCE simples trataria "marcar como visto" e "dar
  // nota" do mesmo jeito, e a segunda escreveria NULL por cima, apagando a data
  // que a meta e a timeline dependem.
  const antes = (await ler(9001)).watchedAt;
  await new Promise((r) => setTimeout(r, 1100)); // um segundo de diferenca
  await fetch(BASE + "/api/library", { method: "POST", headers: T, body: JSON.stringify({ type: "movie", tmdbId: 9001, score: 88 }) });
  const depois = (await ler(9001)).watchedAt;
  ok_("a data de visionamento sobrevive a dar nota", depois === antes, "antes=" + antes + " depois=" + depois);
  ok_("e a nota foi gravada", (await ler(9001)).score === 88);
  ok_("o `updatedAt`, esse sim, mudou", (await ler(9001)).updatedAt !== undefined);

  console.log("");
  console.log("  4) um titulo que NUNCA foi visto nao tem data de visionamento");
  await fetch(BASE + "/api/library", { method: "POST", headers: T, body: JSON.stringify({ type: "movie", tmdbId: 9002, watchlist: true, title: "So na lista", year: 1999 }) });
  const naLista = await ler(9002);
  ok_("existe", !!naLista);
  ok_("e `watchedAt` e' null", naLista.watchedAt === null, "=" + JSON.stringify(naLista.watchedAt));
  ok_("**e o `updatedAt` EXISTE** (por isso a timeline nao o pode usar)", !!naLista.updatedAt);

  console.log("");
  console.log("  5) marcar como NAO visto APAGA a data");
  await fetch(BASE + "/api/library", { method: "POST", headers: T, body: JSON.stringify({ type: "movie", tmdbId: 9001, watched: false }) });
  ok_("a data desaparece", (await ler(9001)).watchedAt === null, "=" + JSON.stringify((await ler(9001)).watchedAt));

  console.log("");
  console.log("  6) marcar de novo volta a gravar");
  await fetch(BASE + "/api/library", { method: "POST", headers: T, body: JSON.stringify({ type: "movie", tmdbId: 9001, watched: true }) });
  ok_("a data volta a existir", !!(await ler(9001)).watchedAt);
  ok_("e e' a de hoje", String((await ler(9001)).watchedAt).slice(0, 10) === new Date().toISOString().slice(0, 10));

  console.log("");
  console.log("  7) o export/import leva a data de volta (visto por PC)");
  const exported = await (await fetch(BASE + "/api/export", { headers: T })).json();
  const linha = (exported.library || []).find((i) => Number(i.tmdbId) === 9001);
  ok_("o JSON de export tem `watchedAt`", !!linha && !!linha.watchedAt, "watchedAt=" + (linha && linha.watchedAt));

  const username2 = "t2" + Date.now().toString().slice(-7);
  const reg2 = await (await fetch(BASE + "/api/auth/register", { method: "POST", headers: H, body: JSON.stringify({ username: username2, password: "abc12345" }) })).json();
  const T2 = { ...H, authorization: "Bearer " + reg2.token };
  const imp = await fetch(BASE + "/api/export/import", { method: "POST", headers: T2, body: JSON.stringify(exported) });
  ok_("o import responde", imp.status === 200 || imp.status === 201, "=" + imp.status);
  const depois2 = (await (await fetch(BASE + "/api/library", { headers: T2 })).json());
  const copiado = (Array.isArray(depois2) ? depois2 : depois2.items || []).find((i) => Number(i.tmdbId) === 9001);
  ok_("o titulo importado tem a MESMA data de visionamento", !!copiado && copiado.watchedAt === linha.watchedAt, (copiado ? copiado.watchedAt : "sem item") + " vs " + linha.watchedAt);
} catch (e) {
  falhou++;
  console.log("  FALHA o teste rebentou: " + e.message);
} finally {
  parar();
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);