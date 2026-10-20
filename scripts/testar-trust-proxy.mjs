// Duas falhas no mesmo sitio: o `trust proxy` fixo e o limite a contar sucessos.
//
//  1. `app.set("trust proxy", 1)` fixo. Sem proxy a frente, qualquer cliente
//     manda `X-Forwarded-For` e o `req.ip` passa a ser o que ele quizer — e o
//     `req.ip` alimenta o limite por IP, o bloqueio de login e o do watch party.
//     Medido antes da correccao: 12 tentativas com senha errada, cada uma com um
//     XFF diferente, e **nenhum 429**.
//  2. O limite do login contava TODOS os pedidos. Medido: o 11.o login
//     BEM-SUCEDIDO seguido dava 429 — o que parte uma casa, uma escola ou quem
//     troque de conta.
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const SEGREDO_JWT = "teste-trust-proxy-jwt";
process.env.JWT_SECRET = SEGREDO_JWT;

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const resumir = (estados) => {
  const c = {};
  for (const e of estados) c[e] = (c[e] || 0) + 1;
  return Object.entries(c).map(([k, v]) => `${v}x ${k}`).join(", ");
};
// Sem hifens: o utilizador so' aceita letras, numeros e sublinhado.
const NOVO_USUARIO = () => "t" + Math.random().toString(36).slice(2, 8) + "_u";
const SENHA = "senha-correta-123";

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) o ambiente e' lido, e o omissao e' 0");
{
  const carregar = (q) => import(pathToFileURL(path.join(RAIZ, "server", "src", "config.js")).href + q);
  delete process.env.TRUST_PROXY;
  ok_("sem TRUST_PROXY, omissao 0", (await carregar("?a")).config.trustProxy === 0);
  process.env.TRUST_PROXY = "1";
  ok_("TRUST_PROXY=1", (await carregar("?b")).config.trustProxy === 1);
  process.env.TRUST_PROXY = "2";
  ok_("TRUST_PROXY=2", (await carregar("?c")).config.trustProxy === 2);
  process.env.TRUST_PROXY = "0";
  ok_("TRUST_PROXY=0 explicito", (await carregar("?d")).config.trustProxy === 0);
  // So' numeros. `true` faria o Express confiar em TUDO.
  for (const mau of ["true", "false", "loopback", "abc", "1.5", "-1", "10.0.0.1", " "]) {
    process.env.TRUST_PROXY = mau;
    const v = (await carregar("?m" + encodeURIComponent(mau))).config.trustProxy;
    ok_("TRUST_PROXY=" + JSON.stringify(mau) + " -> 0 (nao e' numero de saltos)", v === 0, "veio " + v);
  }
  delete process.env.TRUST_PROXY;
}

// ---------------------------------------------------------------------------
async function comServador(envExtra, accao) {
  const PORTA = 5850 + Math.floor(Math.random() * 40);
  const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-proxy-"));
  const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: SEGREDO_JWT, ...envExtra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let saida = "";
  filho.stdout.on("data", (d) => (saida += d));
  filho.stderr.on("data", (d) => (saida += d));
  let morreu = null;
  filho.on("exit", (c) => { morreu = c; });
  const pedir = (caminho, opcoes = {}) =>
    fetch(`http://127.0.0.1:${PORTA}${caminho}`, { signal: AbortSignal.timeout(8000), ...opcoes });
  const login = (utilizador, senha, cabecalhos = {}) =>
    pedir("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", ...cabecalhos },
      body: JSON.stringify({ username: utilizador, password: senha }),
    });
  // Criar o utilizador e' `/auth/register`; `login` nao cria nada (a primeira
  // versao deste teste usava `login` para "criar" e tudo dava 401).
  const registar = (utilizador, senha) =>
    pedir("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: utilizador, password: senha }),
    });

  try {
    let pronto = false;
    for (let i = 0; i < 120 && !pronto && !morreu; i++) {
      try { const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) pronto = true; }
      catch { await dormir(150); }
    }
    if (!pronto) throw new Error("servidor nao arrancou: " + saida.slice(-400));
    return await accao({ pedir, login, registar, dizer: (s) => (saida += s) });
  } finally {
    try { filho.kill(); } catch { /* ja parado */ }
    await Promise.race([new Promise((r) => filho.once("exit", r)), dormir(5000)]);
    try { filho.stdout.destroy(); filho.stderr.destroy(); filho.unref(); } catch { /* ja fechado */ }
    try { fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ja foi */ }
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  2) com o omissao, o X-Forwarded-For e' IGNORADO");
await comServador({}, async ({ login, registar }) => {
  // (a) 12 logins BEM-SUCEDIDOS do mesmo IP nao podem dar 429.
  const u = NOVO_USUARIO();
  const reg = await registar(u, SENHA);
  ok_("consegui criar o utilizador", reg.status === 200, "status " + reg.status);
  const certos = [];
  for (let i = 0; i < 12; i++) certos.push((await login(u, SENHA)).status);
  ok_("12 logins CORRETOS seguidos: " + resumir(certos), certos.every((e) => e === 200));

  // (b) Com XFF falsificado a mudar, tem de contar na MESMA janela de IP.
  // Antes da correccao dava 30x 401 (zero 429) — o XFF era acreditado e cada
  // "IP" falsificado abria a sua propria janela. Agora o limite aperta.
  const u2 = NOVO_USUARIO();
  await registar(u2, SENHA);
  const falsificados = [];
  for (let i = 1; i <= 30; i++) {
    falsificados.push((await login(u2, "errada-" + i, { "x-forwarded-for": `1.2.3.${i}` })).status);
  }
  const com429 = falsificados.filter((e) => e === 429).length;
  ok_("o XFF falsificado NAO abre uma janela nova: o limite aperta (" + com429 + " de 30 barrados)",
    com429 > 0, resumir(falsificados));
  ok_("e as primeiras 10 passam (401) antes de bloquear",
    falsificados.slice(0, 10).every((e) => e === 401), resumir(falsificados.slice(0, 12)));
  ok_("Nenhuma das 30 deu 200", falsificados.every((e) => e !== 200));
});

// ---------------------------------------------------------------------------
console.log("");
console.log("  3) o bloqueio por falhas e' o controlo que aperta");
await comServador({}, async ({ login, registar }) => {
  const u = NOVO_USUARIO();
  await registar(u, SENHA);
  const falhas = [];
  for (let i = 1; i <= 12; i++) falhas.push((await login(u, "errada-" + i)).status);
  ok_("10 falhas seguidas dao bloqueio: " + resumir(falhas), falhas.filter((e) => e === 429).length > 0);
  const ultima = await login(u, "errada-final");
  const corpo = await ultima.text();
  ok_("e a mensagem e' a do bloqueio por falhas (nao a do limite por IP)",
    /Muitas tentativas falhadas/.test(corpo), corpo.slice(0, 90));
  // O bloqueio e' por (ip, utilizador): outra conta do mesmo IP nao e' afetada.
  const outra = NOVO_USUARIO();
  await registar(outra, SENHA);
  const outraLogin = await login(outra, SENHA);
  ok_("outra conta do mesmo IP nao fica bloqueada", outraLogin.status === 200, "status " + outraLogin.status);
});

// ---------------------------------------------------------------------------
console.log("");
console.log("  4) TRUST_PROXY=1 volta a confiar no cabecalho (para quem tem proxy)");
await comServador({ TRUST_PROXY: "1" }, async ({ login }) => {
  // Com um salto confiado, cada XFF diferente e' um `req.ip` diferente, logo o
  // limite por IP nao se acumula. E' o comportamento correcto PARA QUEM TEM
  // PROXY A FRENTE — e o que prova que a env esta' mesmo a ser lida.
  const u = NOVO_USUARIO();
  const estados = [];
  for (let i = 1; i <= 30; i++) estados.push((await login(u, "errada-" + i, { "x-forwarded-for": `5.6.7.${i}` })).status);
  ok_("30 tentativas com 30 XFF diferentes: nenhuma 429 (cada uma e' um IP)", estados.every((e) => e !== 429), resumir(estados));
});

// ---------------------------------------------------------------------------
console.log("");
console.log("  5) o tecto do login subiu e o do registo nao se mexeu");
{
  const auth = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "auth.js"), "utf8");
  ok_("o login tem 100 por 15 min", /rateLimiter\(100,\s*15 \* 60 \* 1000\)/.test(auth));
  ok_("o registo continua a 10 por hora", /rateLimiter\(10,\s*60 \* 60 \* 1000\)/.test(auth));
  const index = fs.readFileSync(path.join(RAIZ, "server", "src", "index.js"), "utf8");
  ok_("o index.js nao fixa mais o trust proxy", !/app\.set\("trust proxy",\s*\d+\)/.test(index),
    "ainda ha um numero fixo");
  ok_("e usa o que vem do ambiente", /app\.set\("trust proxy", config\.trustProxy\)/.test(index));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  6) higiene");
for (const f of ["server/src/config.js", "server/src/index.js", "server/src/routes/auth.js"]) {
  const t = fs.readFileSync(path.join(RAIZ, f), "utf8");
  ok_(f.split("/").pop() + " sem CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(t));
  ok_(f.split("/").pop() + " sem caractere de substituicao", !t.includes("\uFFFD"));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;