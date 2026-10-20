// Um unico pedido nao pode derrubar o servidor.
//
// Duas camadas, porque sao problemas diferentes:
//   1) A CAUSA: `assinaturaValida` acceptava um `sig` de 64 caracteres que nao
//      eram hexadecimais. `Buffer.from(sig, "hex")` truncava no primeiro par
//      invalido e o `timingSafeEqual` atirava `RangeError`. Num handler `async`
//      isso era uma rejeicao sem dono e o Node matava o processo. Reproduzido
//      contra o servidor real: um GET sem autenticacao levava o backend abaixo.
//   2) A REDE: mesmo com a causa corrigida, qualquer outro handler `async` que
//      lance tinha o mesmo efeito. `services/asyncRotas.js` envolve o ponto do
//      Express que chama os handlers para a rejeicao chegar ao middleware de
//      erro em vez de matar o processo.
//
// Cada seccao diz o que prova. Onde nao da para provar por comportamento (se a
// proteccao esta' ligada no servidor real) o teste diz isso em vez de fingir.
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const carregar = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) assinaturaValida nao lanca com assinatura malformada");
const SIGREDO = "teste-segredo-async-123";
process.env.MEIDA_PROXY_SECRET = SIGREDO;
// O `assinar` e' o do servidor, nao uma copia do HMAC. Com a copia, a chave
// derivada de 2026-10-18 fez este teste falhar em DOIS sítios — e o pior era o
// controlo positivo ("a assinatura certa passa"), que se via como "o portao
// rejeita assinatura valida" em vez de "o teste assina mal".
const { assinaturaValida, assinar } = await carregar("server/src/services/proxy.js");
const alvo = "https://exemplo.pt/a.m3u8";
const ts = String(Date.now());

// Todos estes passingam no teste antigo `sig.length !== esperado.length` e
// depois rebentavam o `timingSafeEqual`.
const malformadas = [
  ["64 'z'", "z".repeat(64)],
  ["32 hex + 32 'z'", "a".repeat(32) + "z".repeat(32)],
  ["64 chars, 'g' no fim", "a".repeat(63) + "g"],
  ["63 chars (hex)", "a".repeat(63)],
  ["65 chars (hex)", "a".repeat(65)],
  ["string vazia", ""],
  ["array", ["a".repeat(64)]],
  ["numero", 12345678901234],
  ["null", null],
  ["undefined", undefined],
];
for (const [nome, sig] of malformadas) {
  let lancou = null;
  let resultado = null;
  try { resultado = assinaturaValida(alvo, ts, sig); } catch (e) { lancou = e.constructor.name; }
  ok_(`recusa ${nome} sem lancar`, lancou === null && resultado === false, lancou ? "lancou " + lancou : "devolveu " + resultado);
}
// A validade passou de 10 minutos para 12 horas (bug do utilizador: a
// assinatura tem de durar uma sessao de video, nao um pedido — ver
// `testar-validade-assinatura.mjs`). Por isso o `ts` e' sempre passado
// explicitamente, e o caso "expirada" e' de 13 horas, nao de 11 minutos.
ok_("aceita a assinatura certa", assinaturaValida(alvo, ts, assinar(alvo, ts)) === true);
ok_("recusa assinatura de outro alvo", assinaturaValida("https://outro.pt/x", ts, assinar(alvo, ts)) === false);
const tsExpirado = String(Date.now() - 13 * 60 * 60 * 1000);
ok_("recusa assinatura expirada (13 h)", assinaturaValida(alvo, tsExpirado, assinar(alvo, tsExpirado)) === false);

// ---------------------------------------------------------------------------
console.log("");
console.log("  2) o middleware de handlers async transforma a rejeicao em 500");
const express = (await carregar("server/node_modules/express/index.js")).default;
const antes = (await carregar("server/src/services/asyncRotas.js")).proteccaoActiva;
ok_("a proteccao diz que esta activa", antes() === true);

// Duas apps com o MESMO Express: uma so' depois de importar o modulo.
const { proteccaoActiva } = await carregar("server/src/services/asyncRotas.js");
ok_("importar duas vezes nao patches duas vezes", proteccaoActiva() === true);

// Falhas que um handler sem tratamento deixaria passar. Declarado antes de
// `appDeTeste` porque o middleware de erro o usa.
const errosVistos = new Set();
// **Engolir uma excecao transformaria um teste partido num teste que "passa":**
// o modulo aborta, o Node sai com 0 e nao ha resumo. Era exactamente o que
// acontecia (mutacao M2).
//
// Os dois casos sao diferentes e nao podem ser tratados da mesma maneira:
//  - `uncaughtException` e' o CODIGO DESTE TESTE a partir. Nao ha resultado
//    possivel, por isso sai-se logo com codigo de erro.
//  - `unhandledRejection` pode ser o que o teste provocou de proposito (a app
//    de teste com o wrapper desligado). Mata-la aqui tirava ao teste a
//    possibilidade de reportar a falha, por isso regista-se e deixa-se a
//    assercao do fim julgar.
process.on("uncaughtException", (e) => {
  errosVistos.add(e?.code || e?.constructor?.name || String(e));
  console.error("  ERRO SEM TRATAMENTO (o teste em si rebentou): " + (e?.stack || e));
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  errosVistos.add("unhandledRejection: " + (e?.constructor?.name || typeof e));
});

function appDeTeste(rotas) {
  const app = express();
  for (const [metodo, caminho, handler] of rotas) app[metodo](caminho, handler);
  app.use((err, req, res, _next) => {
    // Chegar aqui com a resposta ja enviada e' a falha que a guarda
    // `res.headersSent` do wrapper evita. Registamos aqui porque a excepcao
    // que daqui sai e' apanhada pelo proprio Express e nunca chega a um
    // `uncaughtException` — ou seja, detectá-la por la era uma verificacao
    // MORTA que passava mesmo com o bug (foi o que a mutacao M4 provou).
    if (res.headersSent) { errosVistos.add("RESPOSTA JA ENVIADA AO MIDDLEWARE DE ERRO"); return; }
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

function ouvir(app) {
  return new Promise((res) => {
    const s = app.listen(0, "127.0.0.1", () => res(s));
  });
}
// `pedir` tem TEMPO LIMITE de proposito: com a proteccao desligada, um handler
// que rejeita nao produz resposta nenhuma e o `fetch` ficava a espera para
// sempre — o teste pendurava em vez de falhar (mutacao M2 apanhada por SIGTERM).
const ESPERA_MS = 5000;
const pedir = async (porta, caminho) => {
  try {
    const r = await fetch(`http://127.0.0.1:${porta}${caminho}`, { signal: AbortSignal.timeout(ESPERA_MS) });
    return { status: r.status, corpo: await r.text() };
  } catch (e) { return { erro: e.name === "TimeoutError" ? "TEMPO ESGOTADO (sem resposta)" : e.message }; }
};

const rotas = [
  // Rejeita: era isto que matava o processo.
  ["get", "/lancou", async () => { throw new Error("rejeicao de handler async"); }],
  // Rejeita depois de uma pausa: o mesmo bug com outro tempo de espera.
  ["get", "/lancou-tarde", async () => { await new Promise((r) => setTimeout(r, 10)); throw new Error("tarde"); }],
  // `throw` sincrono num handler `async`: continua a ser rejeicao.
  ["get", "/sincrono", async () => { null.x; }],
  // Rejeicao DEPOIS de responder: nao ha pedido a que responder, nao pode
  // partir o servidor nem estalar "headers already sent".
  ["get", "/depois-de-responder", async (req, res) => { res.json({ ok: true }); throw new Error("tarde demais"); }],
  // Handler normal: nao pode ser estragado pela proteccao.
  ["get", "/normal", async (req, res) => { res.json({ ok: 1 }); }],
  // Rejeicao de valor nao-Error.
  ["get", "/lancou-string", async () => { throw "texto"; }],
];
const app = appDeTeste(rotas);
// Registado AQUI, e nao no fim: se o script morrer a meio, o `process.exit()` do
// fim nunca corre e o resumo nao aparecia — com exit code 0, ou seja um teste
// partido a parecer um teste que passa. Este hook garante que se ve.
//
// **O hook nao pode verificar `codigo === 0 && falhou === 0` para ficar calado:**
// uma morte silenciosa tem exactamente esse aspecto. A unica coisa que diz que o
// script chegou ao fim e' `resumoImpresso` (isto e' o que apanha o `ReferenceError`
// de um `const` em falta: o `uncaughtException` engolia-o, o modulo abortava e o
// Node saia com 0 e sem uma unica linha de resultado).
let resumoImpresso = false;
process.on("exit", (codigo) => {
  if (resumoImpresso) return;
  console.error("");
  console.error("  SAIDA ANOMALA (o script nao chegou ao fim): " + ok + " ok, " + falhou + " falha(s), codigo " + codigo);
  console.error("  erros sem tratamento: " + ([...errosVistos].join(", ") || "nenhum"));
});
const srv = await ouvir(app);
const porta = srv.address().port;
try {
  for (const [caminho, esperado] of [
    ["/lancou", 500], ["/lancou-tarde", 500], ["/sincrono", 500],
    ["/depois-de-responder", 200], ["/normal", 200], ["/lancou-string", 500],
  ]) {
    const r = await pedir(porta, caminho);
    ok_(`${caminho} responde ${esperado}`, r.status === esperado, "status " + (r.status ?? r.erro));
  }
  // O servidor continua a servir depois de tudo aquilo.
  const vivo = await pedir(porta, "/normal");
  ok_("a app sobreviveu a todos os pedidos", vivo.status === 200, "status " + (vivo.status ?? vivo.erro));
  const r = await pedir(porta, "/lancou");
  // `r.corpo` nao existe se o pedido deu timeout: sem este guarda o teste
  // rebentava com TypeError em vez de reportar a falha.
  ok_("e a rejeicao chegou ao middleware de erro", (r.corpo || "").includes("rejeicao de handler async"), r.corpo || r.erro);
  // Um handler que responde e DEPOIS lanca nao pode fazer o middleware de erro
  // rebentar com ERR_HTTP_HEADERS_SENT: o pedido teve sucesso.
  ok_("respondeu-e-depois-lancou nao leva o erro a um pedido ja respondido",
    !errosVistos.has("RESPOSTA JA ENVIADA AO MIDDLEWARE DE ERRO"), [...errosVistos].join(", "));
} finally { srv.close(); }

// ---------------------------------------------------------------------------
console.log("");
console.log("  3) o SERVIDOR REAL aguenta o pedido que o derrubava");
const PORTA = 5700 + (process.pid % 90);
const dbDir = fs.mkdtempSync(path.join(RAIZ, "..", "meida-test-async-"));
const { spawn } = await import("node:child_process");
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", MEIDA_PROXY_SECRET: SIGREDO },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));
let codigoSaida = null;
filho.on("exit", (codigo) => { codigoSaida = codigo; });

try {
  let acordou = false;
  for (let n = 0; n < 80 && !acordou; n++) {
    try { const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(ESPERA_MS) }); if (r.ok) { acordou = true; break; } } catch { /* ainda nao */ }
    await dormir(150);
  }
  ok_("o servidor arrancou", acordou, saida.slice(-400));

  if (acordou) {
    const alvos = [
      ["/api/proxy", "url", alvo],
      ["/api/subtitles/vtt", "url", "https://exemplo.pt/a.vtt"],
    ];
    for (const [rota, chave, valor] of alvos) {
      for (const [nome, sig] of malformadas.slice(0, 3)) {
        const p = new URLSearchParams({ [chave]: valor, ts });
        p.set("sig", sig);
        const r = await pedir(PORTA, `${rota}?${p.toString()}`);
        ok_(`${rota} com ${nome} responde 403`, r.status === 403, "status " + (r.status ?? r.erro));
      }
    }
    // E volta a servir.
    const vivo = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(ESPERA_MS) }).then((r) => r.status).catch(() => 0);
    ok_("o servidor continua vivo", vivo === 200, "health " + vivo);
    ok_("o processo nao morreu", codigoSaida === null, "codigo " + codigoSaida);
    ok_("e nao ha 'RangeError' no log", !saida.includes("RangeError"), "o log tem RangeError");
    // Um pedido a serio, com assinatura valida, continua a passar o portao.
    const bom = new URLSearchParams({ url: alvo, ts });
    bom.set("sig", assinar(alvo, ts));
    const rBom = await pedir(PORTA, `/api/proxy?${bom.toString()}`);
    ok_("assinatura valida passa o portao (nao e' 403)", rBom.status !== 403, "status " + (rBom.status ?? rBom.erro));
  }
} finally {
  // Primeiro matar, DEPOIS esperar que o processo saia, e so' entao apagar.
  // A ordem errada (esperar o `exit` antes do `kill`) faz a espera expirar
  // sempre, e o `rmSync` corre com o servidor ainda a morrer: da `EPERM` no
  // Windows e cada corrida deixa uma pasta `meida-test-async-*` em Documents.
  try { filho.kill(); } catch { /* ja parado */ }
  await Promise.race([
    new Promise((r) => filho.once("exit", r)),
    dormir(5000),
  ]);
  try { fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ja foi */ }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  4) o servidor real tem a protecco ligada");
const fonte = fs.readFileSync(path.join(RAIZ, "server", "src", "index.js"), "utf8");
ok_("o index.js importa asyncRotas", /from "\.\/services\/asyncRotas\.js"/.test(fonte));
ok_("e avisa no arranque se ela nao estiver activa", /AVISO: handlers async sem proteccao/.test(fonte));
const mod = fs.readFileSync(path.join(RAIZ, "server", "src", "services", "asyncRotas.js"), "utf8");
ok_("e o modulo envolve o handle_request do Express", /handle_request/.test(mod));

// ---------------------------------------------------------------------------
console.log("");
console.log("  5) admin.js compara bytes, nao caracteres");
const admin = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "admin.js"), "utf8");
ok_("compara comprimentos de buffer", /fornecidoBuf\.length !== esperadoBuf\.length/.test(admin));
ok_("e ja nao compara a string", !/provided\.length !== expected\.length/.test(admin));

// O porquê, medido: duas strings com o mesmo nº de caracteres e bytes diferentes.
// Um caractere fora do plano BEM (como um emoji) ocupa 2 unidades de codigo e
// 4 bytes, por isso passa o teste `provided.length !== expected.length` e rebenta
// o `timingSafeEqual`. E' o caso que o `provided.length` nao apanhava.
const curto = "ab";                             // 2 caracteres, 2 bytes
const foraDoBMP = "\u{1F600}";          // 2 unidades de codigo, 4 bytes
ok_(
  "o exemplo do bug tem os mesmos caracteres e bytes diferentes",
  curto.length === foraDoBMP.length && Buffer.byteLength(curto) !== Buffer.byteLength(foraDoBMP),
  `chars ${curto.length}/${foraDoBMP.length}, bytes ${Buffer.byteLength(curto)}/${Buffer.byteLength(foraDoBMP)}`
);

// ---------------------------------------------------------------------------
console.log("");
console.log("  6) higiene");
for (const f of ["server/src/services/asyncRotas.js", "server/src/services/proxy.js", "server/src/routes/admin.js", "server/src/index.js"]) {
  const t = fs.readFileSync(path.join(RAIZ, f), "utf8");
  ok_(f + " sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(t));
  ok_(f + " sem caractere de substituicao", !t.includes("\uFFFD"));
}

// Com a proteccao a funcionar, nada rejeita sem dono: cada rejeicao dos handlers
// de teste tem de ter chegado ao middleware de erro. E' a verificacao que
// apanha o wrapper desligado (mutacao M2) sem o teste se matar a meio.
const semDono = [...errosVistos].filter((e) => e.startsWith("unhandledRejection"));
ok_("nenhuma rejeicao ficou sem dono", semDono.length === 0, semDono.join(", "));

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
resumoImpresso = true;
process.exit(falhou ? 1 : 0);