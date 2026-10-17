// Seguranca da Watch Party: codigo de sala, limite de salas/membros, payload, login.
// Arranca o servidor de verdade e verifica:
//   - codigo com 300 caracteres -> 400
//   - codigo com 5 caracteres -> 400
//   - codigo valido (6-12 A-Z0-9) -> aceito
//   - 21o membro na mesma sala -> 429
//   - sem token -> 401
//   - payload acima de 2 KB -> 400
import path from "node:path";
import fs from "node:fs";

const RAIZ = path.join(process.cwd());

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

const PORTA = 6000 + (process.pid % 90);
const dbDir = fs.mkdtempSync(path.join(RAIZ, "..", "meida-test-wp-"));
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

    // Regista e faz login para obter token.
    await pedir("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wpuser", password: "senha123456" }),
    });
    const login = await pedir("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wpuser", password: "senha123456" }),
    });
    const token = login.ok ? (await login.json()).token : null;
    ok_("login devolve token", !!token);
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    console.log("");
    console.log("  1) codigo de sala invalido -> 400");
    const cod300 = "A".repeat(300);
    const c300 = await pedir(`/api/wp/stream?room=${encodeURIComponent(cod300)}&client=c1&token=${encodeURIComponent(token || "")}`);
    ok_("codigo de 300 caracteres devolve 400", c300.status === 400, "status " + c300.status);

    const c5 = await pedir(`/api/wp/stream?room=ABCDE&client=c2&token=${encodeURIComponent(token || "")}`);
    ok_("codigo de 5 caracteres devolve 400", c5.status === 400, "status " + c5.status);

    console.log("");
    console.log("  2) codigo valido (6-12 A-Z0-9) e' aceito");
    const codigoValido = "ABC123DEF";
    // O SSE fica aberto; fechamos logo depois de abrir. So verificamos que nao e' 400/401.
    const cOk = await pedir(`/api/wp/stream?room=${codigoValido}&client=c_ok&token=${encodeURIComponent(token || "")}`, {
      signal: AbortSignal.timeout(3000),
    });
    ok_("codigo valido nao e' rejeitado (200 ou SSE aberto)", cOk.status === 200, "status " + cOk.status);

    console.log("");
    console.log("  3) sem token -> 401");
    const cSemToken = await pedir(`/api/wp/stream?room=${codigoValido}&client=c_notk`);
    ok_("sem token devolve 401", cSemToken.status === 401, "status " + cSemToken.status);

    console.log("");
    console.log("  4) payload acima de 2 KB em /wp/send -> 400");
    const payloadGrande = "x".repeat(3000); // 3 KB > 2 KB
    const cGrande = await pedir("/api/wp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ room: codigoValido, from: "f1", kind: "event", data: payloadGrande }),
    });
    ok_("payload de 3 KB devolve 400", cGrande.status === 400, "status " + cGrande.status);

    console.log("");
    console.log("  5) 21o membro na mesma sala -> 429");
    // Usa uma sala diferente para nao conflitar com o teste do item 2.
    const codigoSala = "WPTEST99";
    // Abre 20 conexoes SSE para a mesma sala (cada uma com client diferente) em
    // paralelo. A 21a deve ser recusada com 429.
    const abrirMembro = async (n) => {
      try {
        const r = await pedir(`/api/wp/stream?room=${codigoSala}&client=m${n}&token=${encodeURIComponent(token || "")}`, {
          signal: AbortSignal.timeout(5000),
        });
        return r.status;
      } catch {
        return "timeout";
      }
    };
    const statuses = await Promise.all(Array.from({ length: 20 }, (_, n) => abrirMembro(n)));
    const membrosOk = statuses.every((s) => s === 200);
    ok_("os 20 primeiros membros abrem a sala (200)", membrosOk, "statuses=" + JSON.stringify(statuses));

    const c21 = await pedir(`/api/wp/stream?room=${codigoSala}&client=m20&token=${encodeURIComponent(token || "")}`, {
      signal: AbortSignal.timeout(5000),
    });
    ok_("o 21o membro e' recusado com 429", c21.status === 429, "status " + c21.status);

    ok_("o servidor nao morreu a meio do teste", !servidorMorto, servidorMorto ? "morreu com " + servidorMorto : "");
  }
} finally {
  try { filho.kill(); } catch { /* ja parado */ }
  try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch { /* ja foi */ }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);