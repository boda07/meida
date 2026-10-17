// Seguranca da autenticacao: rate limit no login/registo, body size, timing-safe equal.
// Arranca o servidor de verdade e verifica:
//   - 11.º login falho em 15 min -> 429
//   - POST /auth/login com body de 1 MB -> 413
import path from "node:path";
import fs from "node:fs";

const RAIZ = path.join(process.cwd());

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

const PORTA = 5800 + (process.pid % 90);
const dbDir = fs.mkdtempSync(path.join(RAIZ, "..", "meida-test-auth-"));
const { spawn } = await import("node:child_process");
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let servidorMorto = false;
filho.on("exit", (codigo) => { if (codigo !== 0) servidorMorto = codigo; });

try {
  let acordou = false;
  for (let n = 0; n < 60 && !acordou; n++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(1000) });
      acordou = r.ok;
    } catch { /* ainda nao esta' a la */ }
    if (!acordou) await new Promise((r) => setTimeout(r, 250));
  }
  ok_("o servidor arranca e responde a /api/health", acordou, servidorMorto ? "morreu com " + servidorMorto : "");

  if (acordou) {
    const pedir = (p, opcoes = {}) =>
      fetch(`http://127.0.0.1:${PORTA}${p}`, { signal: AbortSignal.timeout(10000), ...opcoes });

    // Regista um utilizador para poder tentar login contra ele.
    const reg = await pedir("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "authtestuser", password: "senha123456" }),
    });
    ok_("registo cria o utilizador (200 ou 409 se ja existir)", reg.status === 200 || reg.status === 409, "status " + reg.status);

    console.log("");
    console.log("  1) 11o login falho devolve 429");
    const estatuss = [];
    for (let n = 0; n < 11; n++) {
      const r = await pedir("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "authtestuser", password: "senhaerrada" }),
      });
      estatuss.push(r.status);
    }
    // As 10 primeiras tentam o login (401), a 11a e' bloqueada com 429.
    const primeirasDez = estatuss.slice(0, 10).every((s) => s === 401);
    ok_("as 10 primeiras devolvem 401 (senha invalida)", primeirasDez, JSON.stringify(estatuss.slice(0, 10)));
    ok_("a 11a e' bloqueada com 429", estatuss[10] === 429, "status " + estatuss[10]);

    console.log("");
    console.log("  2) POST /auth/login com body de 1 MB devolve 413");
    const corpoGrande = "x".repeat(1024 * 1024); // 1 MB
    const grande = await pedir("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: corpoGrande, password: "qualquer" }),
    });
    ok_("body de 1 MB e' rejeitado com 413", grande.status === 413, "status " + grande.status);

    ok_("o servidor nao morreu a meio do teste", !servidorMorto, servidorMorto ? "morreu com " + servidorMorto : "");
  }
} finally {
  try { filho.kill(); } catch { /* ja parado */ }
  try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch { /* ja foi */ }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);