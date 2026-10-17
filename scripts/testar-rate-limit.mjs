// Limite de pedidos no login e no registo.
// Testa as funcoes de rate limit diretamente (sem servidor HTTP), porque
// nao da para esperar 15 min nem 1 hora num teste de unidade.
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// ---------- 1) estaBloqueadoLogin / registarFalhaLogin ----------
console.log("");
console.log("  1) bloqueio por falhas de login (10 por 15 min)");
const rateLimit = await import(
  "file:///" + path.join(RAIZ, "server", "src", "services", "rateLimit.js").replace(/\\/g, "/")
);
const { estaBloqueadoLogin, registarFalhaLogin } = rateLimit;

const ip = "127.0.0.1";
const username = "testuser";

// Dez falhas seguidas para a mesma (ip, username) bloqueiam a partir da 10a.
for (let n = 0; n < 9; n++) {
  const conta = registarFalhaLogin(ip, username);
  ok_(`falha ${n + 1} nao bloqueia (conta=${conta})`, !estaBloqueadoLogin(ip, username), `conta=${conta}`);
}

// A 10a falha ja bloqueia (conta >= FALHAS_MAX = 10).
const conta10 = registarFalhaLogin(ip, username);
ok_("a 10a falha ja bloqueia (conta=10)", estaBloqueadoLogin(ip, username), `conta=${conta10}`);

// A 11a tambem bloqueia.
const conta11 = registarFalhaLogin(ip, username);
ok_("a 11a falha tambem bloqueia (conta=11)", estaBloqueadoLogin(ip, username), `conta=${conta11}`);

// Outra username nao fica bloqueada pelas falhas da primeira.
ok_("outra username nao bloqueada", !estaBloqueadoLogin(ip, "outrouser"));

// O IP so conta para a (ip, username) especifica.
// Um IP diferente com a mesma username nao fica bloqueado.
ok_("IP diferente com mesma username nao bloqueado", !estaBloqueadoLogin("10.0.0.1", username));

// ---------- 2) rateLimiter geral ----------
console.log("");
console.log("  2) rateLimiter geral (login: 10 por 15 min, register: 10 por hora)");
const { rateLimiter } = rateLimit;

// Simula pedidos de login: 10 por 15 min por IP.
const loginLimiter = rateLimiter(10, 15 * 60 * 1000);
for (let n = 0; n < 11; n++) {
  // Criar objetos novos a cada iteracao (o rateLimiter usa referencias).
  const req = { ip: "1.2.3.4", socket: { remoteAddress: "1.2.3.4" }, path: "/api/auth/login" };
  const res = { set: () => res, status: () => res, json: () => res };
  let nextCalled = false;
  loginLimiter(req, res, () => { nextCalled = true; });
  if (n < 10) {
    ok_(`login pedido ${n + 1} passa (next chamado)`, nextCalled, `pedido ${n + 1}`);
  } else {
    ok_("login pedido 11 e' bloqueado (next nao chamado)", !nextCalled, `pedido 11`);
  }
}

// Simula pedidos de registo: 10 por hora por IP.
const registerLimiter = rateLimiter(10, 60 * 60 * 1000);
for (let n = 0; n < 11; n++) {
  const req = { ip: "1.2.3.4", socket: { remoteAddress: "1.2.3.4" }, path: "/api/auth/register" };
  const res = { set: () => res, status: () => res, json: () => res };
  let nextCalled = false;
  registerLimiter(req, res, () => { nextCalled = true; });
  if (n < 10) {
    ok_(`registro pedido ${n + 1} passa (next chamado)`, nextCalled, `pedido ${n + 1}`);
  } else {
    ok_("registro pedido 11 e' bloqueado (next nao chamado)", !nextCalled, `pedido 11`);
  }
}

// Diferente IP nao compartilha o limite.
const reqDiferente = { ip: "5.6.7.8", socket: { remoteAddress: "5.6.7.8" }, path: "/api/auth/login" };
const resDiferente = { set: () => resDiferente, status: () => resDiferente, json: () => resDiferente };
let nextDiferente = false;
loginLimiter(reqDiferente, resDiferente, () => { nextDiferente = true; });
ok_("IP diferente nao e' bloqueado pelo limite do primeiro IP", nextDiferente);

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);