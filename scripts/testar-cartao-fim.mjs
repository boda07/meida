// O cartao de partilha, contra o servidor a SERIO.
//
// **Porquê um teste separado, com o servidor arrancado.** A forma das linhas da
// biblioteca e' o bug que quase nao foi visto:
//
//   - `/api/goals` passa `listLibrary()`, que devolve `{type, updatedAt, …}`.
//   - `/api/stats` passa `SELECT *` — linhas CRUAS, com `{media_type, updated_at}`.
//
// As funcoes de `metas.js` foram escritas para a primeira forma. Com a segunda,
// `l.type` e' `undefined`, o `continue` comeca a correr e `filmesPorAno` e
// `topDoAno` voltam **vazios** — sem erro, sem aviso, com o build e os 80 testes
// puros a passar, porque nenhum deles executa o SQL.
//
// Este teste arranca o `index.js`, insere titulos e le `/api/stats`. E' o que
// apanha essa classe de bug: nao ha teste puro que apanhe um nome de campo
// trocado entre a base de dados e a funcao.
//
// Cumpre a regra do AGENTS.md: mexer no arranque ou nas rotas obriga a
// arrancar o servidor de verdade.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meida-cartao-e2e-"));

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

/** Uma porta livre. Pedir uma e solta-la pode colidir com outro teste. */
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
  env: {
    ...process.env,
    PORT: String(PORTA),
    HOST: "127.0.0.1",
    DB_DIR: DIR,
    // Sem web servida: este teste so' fala de API, e servir os ficheiros
    // poupava uns segundos sem trazer nada.
    SERVE_WEB: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let saida = "";
filho.stdout.on("data", (d) => { saida += d.toString(); });
filho.stderr.on("data", (d) => { saida += d.toString(); });

let morreu = null;
filho.on("exit", (codigo) => { morreu = codigo; });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperaSaudavel(limiteMs = 40000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (morreu !== null) return false;
    try {
      const r = await fetch(BASE + "/api/health");
      if (r.status === 200) return true;
    } catch {
      // Ainda nao esta' a responder — tenta-se de novo no ciclo seguinte.
    }
    await dormir(500);
  }
  return false;
}

const parar = () => {
  try {
    filho.kill();
  } catch {
    // Ja morreu.
  }
  try {
    fs.rmSync(DIR, { recursive: true, force: true });
  } catch {
    // A pasta temporaria pode estar presa por um ficheiro aberto.
  }
};

console.log("");
console.log("  1) o servidor arranca a serio com uma base nova");
const arrancou = await esperaSaudavel();
if (!arrancou) {
  console.log("  FALHA o servidor nao arrancou (saiu com " + morreu + ")");
  console.log("        " + (saida.split("\n").find((l) => /Error|error/.test(l)) || saida).trim().slice(0, 140));
  parar();
  process.exit(1);
}
ok_("`/api/health` responde 200", true);
ok_("as migracoes correram", /migracao \d+/.test(saida));

try {
  console.log("");
  console.log("  2) registar e encher a biblioteca");
  const H = { "content-type": "application/json" };
  const username = "cart" + Date.now().toString().slice(-8);
  const reg = await (await fetch(BASE + "/api/auth/register", { method: "POST", headers: H, body: JSON.stringify({ username, password: "abc12345" }) })).json();
  ok_("o registo devolve token", !!reg.token);
  const T = { ...H, authorization: "Bearer " + reg.token };

  const ano = new Date().getUTCFullYear();
  const itens = [
    // 4 vistos COM nota e COM cartaz, de THIS year.
    ...Array.from({ length: 4 }, (_, i) => ({ type: "movie", tmdbId: 700000 + i, watched: true, score: 90 - i * 5, title: "Visto " + i, year: 1980 + i, poster: "https://example.test/p" + i + ".jpg" })),
    // 3 na watchlist: nao podem entrar na conta.
    ...Array.from({ length: 3 }, (_, i) => ({ type: "movie", tmdbId: 710000 + i, watched: false, watchlist: true, title: "Lista " + i, year: 1990 })),
    // 1 serie vista: "filmes" nao a inclui.
    { type: "tv", tmdbId: 720000, watched: true, score: 95, title: "Serie", year: 2001 },
    // 1 sem ano: conta para os dias mas nao para as decadas.
    { type: "movie", tmdbId: 730000, watched: true, score: 80, title: "Sem ano", year: null },
  ];
  let entraram = 0;
  for (const it of itens) {
    const r = await fetch(BASE + "/api/library", { method: "POST", headers: T, body: JSON.stringify(it) });
    if (r.status === 200) entraram++;
  }
  ok_("todos os " + itens.length + " titulos entraram", entraram === itens.length, entraram + "/" + itens.length);

  console.log("");
  console.log("  3) o `/api/stats` conta o que foi marcado — E' AQUI QUE O BUG VIVIA");
  const s = await (await fetch(BASE + "/api/stats", { headers: T })).json();

  ok_("devolve `filmesPorAno`", Array.isArray(s.filmesPorAno));
  const balde = (s.filmesPorAno || []).find((x) => x.ano === ano);
  // 4 filmes vistos + 1 sem ano = 5. A watchlist (3) e a serie (1) ficam fora.
  ok_("conta 5 filmes marcados neste ano", balde && balde.n === 5, "n=" + (balde ? balde.n : "sem balde"));
  ok_("a watchlist nao contou", balde && balde.n !== itens.length, "=" + (balde ? balde.n : "?"));

  ok_("devolve `topDoAno`", Array.isArray(s.topDoAno));
  const top = s.topDoAno || [];
  ok_("e traz os 3 melhores (ha 5 com nota)", top.length === 3, "=" + top.length);
  ok_("por ordem de nota", top.map((t) => t.score).join(",") === "90,85,80", top.map((t) => t.score).join(","));
  ok_("NINGUM deles e' da watchlist", !top.some((t) => String(t.titulo).startsWith("Lista")));
  ok_("NINGUM deles e' a serie", !top.some((t) => t.tipo === "tv"), top.map((t) => t.tipo).join(","));
  ok_("e trazem o cartaz, que e' o que o `crossOrigin` precisa", top.every((t) => typeof t.poster === "string" && t.poster.startsWith("http")), JSON.stringify(top[0] || null).slice(0, 80));

  console.log("");
  console.log("  4) o `/api/goals` concorda com o `/api/stats` no mesmo numero");
  const g = await (await fetch(BASE + "/api/goals", { headers: T })).json();
  const gBalde = (g.filmesPorAno || []).find((x) => x.ano === ano);
  ok_("os doisEndpoints contam igual", gBalde && balde && gBalde.n === balde.n, "goals=" + (gBalde ? gBalde.n : "?") + " stats=" + (balde ? balde.n : "?"));

  console.log("");
  console.log("  5) a rota do alvo, com o verbo certo");
  const patch = await fetch(BASE + "/api/goals", { method: "PATCH", headers: T, body: JSON.stringify({ alvo: 100 }) });
  ok_("PATCH /api/goals -> 200 (e nao 404)", patch.status === 200, "=" + patch.status);
  const g2 = await (await fetch(BASE + "/api/goals", { headers: T })).json();
  ok_("e o alvo ficou gravado", g2.alvo === 100, "=" + g2.alvo);
  const mau = await fetch(BASE + "/api/goals", { method: "PATCH", headers: T, body: JSON.stringify({ alvo: 73 }) });
  ok_("um alvo fora da lista da 400", mau.status === 400, "=" + mau.status);
  const put = await fetch(BASE + "/api/goals", { method: "PUT", headers: T, body: JSON.stringify({ alvo: 100 }) });
  ok_("e um PUT da 404 (o cliente usa PATCH)", put.status === 404, "=" + put.status);
} catch (e) {
  falhou++;
  console.log("  FALHA o teste rebentou: " + e.message);
} finally {
  parar();
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);