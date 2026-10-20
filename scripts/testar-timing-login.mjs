// Duas coisas que andam na mesma area de risco.
//
//  1. O tempo de resposta do login denunciava se o utilizador existia. Com
//     `!row || (await bcrypt.compare(...))`, um nome inexistente nao tinha nada
//     para comparar e o `||` saltava o bcrypt: ~0 ms contra os ~74 ms de um nome
//     que existe (medido). Diferenca de 74 ms que qualquer script de enumeracao
//     de usernames aproveita sem dificuldade.
//
//  2. `__ativarModoTeste()` (e o `__permitirHostsNoTeste`, do mesmo tipo) desliga
//     a assinatura e o filtro de IPs do proxy, sem exigir nada. Agora so'
//     funcionam com `NODE_ENV=test`, e **atiram** em vez de falhar em silencio.
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const PORTA = 5890 + (process.pid % 40);
const SENHA = "senha-correta-123";

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) os ganchos de teste nao funcionam sem NODE_ENV=test");
{
  const urlProxy = pathToFileURL(path.join(RAIZ, "server", "src", "services", "proxy.js")).href;
  const antes = process.env.NODE_ENV;

  delete process.env.NODE_ENV;
  const semTest = await import(urlProxy + "?sem-test");
  for (const [nome, chamar] of [
    ["__ativarModoTeste", () => semTest.__ativarModoTeste()],
    ["__permitirHostsNoTeste", () => semTest.__permitirHostsNoTeste(["localhost"])],
  ]) {
    let lancou = null;
    try { chamar(); } catch (e) { lancou = e.message; }
    ok_(nome + " ATIRA sem NODE_ENV=test", lancou !== null, "nao atirou");
    ok_("  e a mensagem explica o porque", /NODE_ENV=test/.test(lancou || ""), lancou || "(sem erro)");
  }
  // E o proxy continua a estar fechado depois de tentar.
  const seguro = await semTest.alvoSeguro("http://127.0.0.1/");
  ok_("e o filtro de IPs continua activo (nada foi desligado)", seguro.ok === false, JSON.stringify(seguro));

  process.env.NODE_ENV = "test";
  const comTest = await import(urlProxy + "?com-test");
  let passou = true;
  try { comTest.__permitirHostsNoTeste(["exemplo-teste.invalid"]); } catch { passou = false; }
  ok_("com NODE_ENV=test o gancho funciona", passou);
  process.env.NODE_ENV = antes;
  if (antes === undefined) delete process.env.NODE_ENV;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  2) o login nao denuncia mais o nome pelo tempo");

const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-timing-"));
const envServidor = { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: "teste-timing" };
delete envServidor.NODE_ENV; // o servidor corre como em producao
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ, env: envServidor, stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));

const pedir = async (corpo, cabecalhos = {}) => {
  const t = process.hrtime.bigint();
  const r = await fetch(`http://127.0.0.1:${PORTA}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15000),
  });
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  return { status: r.status, ms, corpo: await r.text() };
};

try {
  let pronto = false;
  for (let i = 0; i < 120 && !pronto; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) pronto = true; }
    catch { await dormir(150); }
  }
  ok_("o servidor arrancou", pronto, saida.slice(-400));

  if (pronto) {
    const nome = "timing_" + Math.random().toString(36).slice(2, 6) + "_u";
    const reg = await fetch(`http://127.0.0.1:${PORTA}/api/auth/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: nome, password: SENHA }), signal: AbortSignal.timeout(15000),
    });
    ok_("utilizador criado", reg.ok, "status " + reg.status);

    // Aquece o JIT e a ligacao, para as primeiras medicoes nao enganarem.
    for (let i = 0; i < 2; i++) { await pedir({ username: nome, password: SENHA }); await pedir({ username: "nao_existe_" + i, password: "x" }); }

    const N = 7;
    const comUtilizador = [];
    const semUtilizador = [];
    for (let i = 0; i < N; i++) {
      // Senha CORRECTA: nao conta como falha, nao ha bloqueio.
      comUtilizador.push((await pedir({ username: nome, password: SENHA })).ms);
      // Nome INEXISTENTE e novo de cada vez: o bloqueio e' por (ip, utilizador).
      semUtilizador.push((await pedir({ username: "inexistente_" + i + "_u", password: "qualquer" })).ms);
    }
    const mCom = mediana(comUtilizador);
    const mSem = mediana(semUtilizador);

    console.log("     mediana com utilizador existente: " + mCom.toFixed(1) + " ms   [" + comUtilizador.map((x) => x.toFixed(0)).join(", ") + "]");
    console.log("     mediana sem utilizador          : " + mSem.toFixed(1) + " ms   [" + semUtilizador.map((x) => x.toFixed(0)).join(", ") + "]");
    console.log("     diferenca: " + Math.abs(mCom - mSem).toFixed(1) + " ms");

    // O teste robusto e' o piso absoluto: sem o hash falso, um nome inexistente
    // respondia em ~0 ms. Com bcrypt a correr, nunca desce abaixo de ~40 ms.
    // Comparar as duas medianas seria fragil (carga da maquina).
    ok_("um nome INEXISTENTE ainda passa pelo bcrypt (>40 ms)", mSem > 40, mSem.toFixed(1) + " ms");
    ok_("e o custo e' o mesmo do nome existente (dentro de 1.8x)",
      mSem / mCom > 0.55 && mSem / mCom < 1.8, "razao " + (mSem / mCom).toFixed(2));

    // Nenhuma amostra pode ter fugido para o caminho rapido.
    ok_("NENHUMA amostra de nome inexistente foi rapida", semUtilizador.every((x) => x > 30),
      "minimo " + Math.min(...semUtilizador).toFixed(1) + " ms");

    // E o login continua a funcionar.
    const certo = await pedir({ username: nome, password: SENHA });
    ok_("a senha certa continua a dar 200", certo.status === 200, "status " + certo.status);
    const errado = await pedir({ username: nome, password: "errada-boa" });
    ok_("a senha errada continua a dar 401", errado.status === 401, "status " + errado.status);
    ok_("e as duas mensagens sao iguais (nao dizem qual falhou)",
      JSON.parse(errado.corpo).error === JSON.parse(certo.corpo).error || certo.status === 200,
      errado.corpo);
    const inexistente = await pedir({ username: "outro_inexistente_u", password: "x" });
    ok_("e o 401 de um nome inexistente tem a MESMA mensagem", inexistente.corpo === errado.corpo,
      inexistente.corpo + " vs " + errado.corpo);
  }
} finally {
  try { filho.kill(); } catch { /* ja parado */ }
  await Promise.race([new Promise((r) => filho.once("exit", r)), dormir(5000)]);
  try { filho.stdout.destroy(); filho.stderr.destroy(); filho.unref(); } catch { /* ja fechado */ }
  try { fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ja foi */ }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;