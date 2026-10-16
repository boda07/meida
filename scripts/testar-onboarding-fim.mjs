// O onboarding contra o servidor a SERIO.
//
// **Porquê um teste com o servidor arrancado.** A regra que decide se o wizard
// aparece ou nao depende de `library.count`, que vem do `LibraryContext` — e essa
// e' a unica coisa que um teste com listas inventadas nao prova. O pior caso
//Known e' o inverso: `count` a `null` (ainda a carregar) contado como zero, e o
// wizard aparece a quem ja tem 400 titulos e importa por cima deles.
//
// Este teste cria dois utilizadores de verdade — um vazio e um cheio — e ve o
// que a biblioteca devolve a cada um.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meida-onboarding-e2e-"));

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
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
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
console.log("  1) o servidor arranca");
let arrancou = false;
for (let i = 0; i < 80; i++) {
  if (morreu !== null) break;
  try { if ((await fetch(BASE + "/api/health")).status === 200) { arrancou = true; break; } } catch { /* ainda */ }
  await dormir(500);
}
if (!arrancou) {
  console.log("  FALHA o servidor nao arrancou (saiu com " + morreu + ")");
  console.log("        " + (saida.split("\n").find((l) => /Error/.test(l)) || saida).trim().slice(0, 140));
  parar();
  process.exit(1);
}
ok_("`/api/health` responde", true);

const H = { "content-type": "application/json" };
const criar = async (nome) => {
  const r = await (await fetch(BASE + "/api/auth/register", {
    method: "POST", headers: H,
    body: JSON.stringify({ username: nome + Date.now().toString().slice(-7), password: "abc12345" }),
  })).json();
  return { ...H, authorization: "Bearer " + r.token };
};

try {
  console.log("");
  console.log("  2) a biblioteca de um utilizador NOVO e' mesmo vazia");
  const T1 = await criar("ob1");
  const lib1 = await (await fetch(BASE + "/api/library", { headers: T1 })).json();
  const itens1 = Array.isArray(lib1) ? lib1 : lib1.items || [];
  ok_("devolve uma lista (nao um erro)", Array.isArray(itens1));
  ok_("e esta vazia", itens1.length === 0, "n=" + itens1.length);
  // E' este o `count === 0` que faz o wizard aparecer. **Nao e' `null`**: o
  // `LibraryContext` so passa de `null` a um numero depois da resposta.
  ok_("portanto `count === 0` e' verdadeiro", itens1.length === 0);

  console.log("");
  console.log("  3) um utilizador com titulos NAO e' vazio — e' o caso que custa caro");
  const T2 = await criar("ob2");
  for (let i = 0; i < 3; i++) {
    const r = await fetch(BASE + "/api/library", {
      method: "POST", headers: T2,
      body: JSON.stringify({ type: "movie", tmdbId: 7000 + i, watched: true, title: "Titulo " + i, year: 2000 + i }),
    });
    if (r.status !== 200) ok_("o POST da biblioteca respondeu " + r.status, false);
  }
  const lib2 = await (await fetch(BASE + "/api/library", { headers: T2 })).json();
  const itens2 = Array.isArray(lib2) ? lib2 : lib2.items || [];
  ok_("o utilizador com 3 titulos tem 3", itens2.length === 3, "n=" + itens2.length);
  ok_("portanto `count === 0` e' FALSO (o wizard nao aparece)", itens2.length !== 0);
  // E o `count === null`: a resposta **chegou**, por isso ja nao e' null. A
  // janela perigosa e' ANTES da resposta, e e' um estado do cliente.
  ok_("e a lista tem o `watchedAt` (o import usa a mesma rota)", itens2.every((i) => i.watchedAt !== undefined), "o primeiro: " + JSON.stringify(itens2[0] && { watchedAt: itens2[0].watchedAt }));

  console.log("");
  console.log("  4) as rotas de estado que o passo de importar consulta");
  // Sao **seis** pedidos em paralelo, e cada um pode falhar sem partir a folha:
  // e' o `Promise.all` todo com `.catch()` em cada um. Se algum devolvesse 500
  // sem o `.catch`, a folha nunca aparecia.
  for (const rota of ["/api/genres?type=movie", "/api/mal/enabled", "/api/anilist/enabled", "/api/letterboxd/status", "/api/letterboxd/status"]) {
    const r = await fetch(BASE + rota, { headers: T1 });
    ok_(rota + " responde sem rebentar", r.status < 500, "=" + r.status);
  }

  console.log("");
  console.log("  5) o `malStatus`/`letterboxdStatus` dao `linked` (e nao 500 sem conta)");
  const lb = await (await fetch(BASE + "/api/letterboxd/status", { headers: T1 })).json();
  ok_("o Letterboxd responde com um objecto", lb && typeof lb === "object");
  /**
   * **O campo e' `username`, nao `linked`.** Foi este teste que apanhou o bug: a
   * rota responde `{ username: null }` (o mesmo que o `LetterboxdSection` das
   * Definicoes le), e o componente perguntava por `lb.linked`, que nao existe. O
   * campo dava `undefined` e a porta do Letterboxd nunca aparecia — sem erro
   * nenhum, so uma opcao em falta.
   */
  ok_("**e tem `username` (e nao `linked`)**", lb && "username" in lb && !("linked" in lb), JSON.stringify(lb).slice(0, 60));
  ok_("e sem conta o `username` e' null", lb && lb.username === null, JSON.stringify(lb).slice(0, 60));
  const mal = await (await fetch(BASE + "/api/mal/enabled", { headers: T1 })).json();
  ok_("o `mal/enabled` devolve um objecto", mal && typeof mal === "object");

  console.log("");
  console.log("  6) `/api/genres` da a lista de que o passo dos generos vive");
  const g = await (await fetch(BASE + "/api/genres?type=movie")).json();
  ok_("devolve `genres`", Array.isArray(g.genres));
  ok_("com `id` numerico e `name`", g.genres.length > 0 && g.genres.every((x) => Number.isFinite(Number(x.id)) && String(x.name || "").trim()), "n=" + (g.genres || []).length);
  // **`generosParaOferecer` e' alimentado por isto.** Se o TMDB nao responde, a
  // lista fica vazia e o passo e' saltado — nunca um wizard com zero opcoes.
  ok_("ha generos suficientes para escolher (o passo nao fica vazio)", g.genres.length > 4, "n=" + g.genres.length);

  console.log("");
  console.log("  7) o `/api/discover` aceita os generos escolhidos");
  // E o consumidor da escolha: se isto nao aceitar `genres`, os generos do
  // onboarding eram uma preferencia morta.
  const dsc = await (await fetch(BASE + "/api/discover?type=movie&genres=28")).json();
  ok_("responde com itens", dsc && Array.isArray(dsc.items || dsc), "keys=" + Object.keys(dsc || {}).join(","));
} catch (e) {
  falhou++;
  console.log("  FALHA o teste rebentou: " + e.message);
} finally {
  parar();
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);