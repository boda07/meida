// O contador de salas por IP ficava preso para sempre.
//
// A sala e' registada em `roomsPerIp` com o IP de QUEM A CRIOU (o `incRoomIp`).
// Ao esvaziar, `decRoomIp` era chamado com o IP de QUEM SAISSE POR ULTIMO. Se
// nao fosse o criador, o registo do criador nunca saia do mapa — e `roomsPerIp`
// **nao tem varrimento nenhum** que o reconcilie com `rooms` (o unico
// `setInterval` do ficheiro e' o ping de 20 s do SSE). Ao fim de 10 salas assim,
// esse IP levava "Limite de salas por IP atingido" ate' o servidor reiniciar.
//
// Medido antes da correccao: A cria 10 salas e da 11.a em diante leva 429.
//
// **Este teste ve-se pelo comportamento, nao por `roomsPerIp.size`:** o mapa nao
// e' exportado, e nao vale a pena abrir um gancho so' para olhar. O sinal que
// interessa e' "o IP consegue continuar a criar salas".
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const RAIZ = process.cwd();
const PORTA = 5930 + (process.pid % 30);
const BASE = `http://127.0.0.1:${PORTA}`;
const SENHA = "senha-correta-123";
const MAX_ROOMS_POR_IP = 10;

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// "trust proxy" e' o que da' dois IPs a partir da mesma maquina: com o
// omissao a 0 (a correccao do N5) o `X-Forwarded-For` seria ignorado e os dois
// seriam o mesmo 127.0.0.1, e o bug nao aparecia.
const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-wpip-"));
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: "t-wpip", TRUST_PROXY: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));

const pedir = (caminho, opcoes = {}) => fetch(BASE + caminho, { signal: AbortSignal.timeout(8000), ...opcoes });

async function utilizador(nome) {
  const u = nome + Math.random().toString(36).slice(2, 6) + "_u";
  await pedir("/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: SENHA }),
  });
  const r = await pedir("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: SENHA }),
  });
  return (await r.json()).token;
}

async function entrar(token, sala, client, nick, ip) {
  const ctrl = new AbortController();
  const r = await fetch(`${BASE}/api/wp/stream?room=${sala}&client=${client}&nick=${nick}&token=${token}`,
    { signal: ctrl.signal, headers: { "x-forwarded-for": ip } });
  if (r.status !== 200) return { status: r.status, sair: () => {} };
  const leitor = r.body.getReader();
  await leitor.read();
  return { status: 200, sair: () => ctrl.abort() };
}

// Um ciclo: o criador entra, o outro entra, e saem por uma ordem indicada.
// Devolve o status com que o criador entrou.
async function ciclo(tokenA, tokenB, sala, ipA, ipB, quemSaiUltimo) {
  const a = await entrar(tokenA, sala, "c1", "Ana", ipA);
  if (a.status !== 200) return a.status;
  const b = await entrar(tokenB, sala, "c2", "Bruno", ipB);
  if (b.status !== 200) { a.sair(); await dormir(150); return b.status; }
  if (quemSaiUltimo === "criador") {
    b.sair(); await dormir(150); a.sair();
  } else {
    a.sair(); await dormir(150); b.sair();
  }
  await dormir(250);
  return 200;
}

try {
  let pronto = false;
  for (let i = 0; i < 120 && !pronto; i++) {
    try { const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) pronto = true; }
    catch { await dormir(150); }
  }
  ok_("o servidor arrancou", pronto, saida.slice(-400));

  if (pronto) {
    const tokenA = await utilizador("ana");
    const tokenB = await utilizador("bruno");
    const IP_A = "10.0.0.1";
    const IP_B = "10.0.0.2";

    // Confirma que os dois IPs sao mesmo diferentes (senao o bug nao aparece).
    const soA = await entrar(tokenA, "TESTE01", "c1", "Ana", IP_A);
    ok_("A entra com o seu IP", soA.status === 200, "status " + soA.status);
    const soB = await entrar(tokenB, "TESTE01", "c2", "Bruno", IP_B);
    ok_("B entra na mesma sala", soB.status === 200, "status " + soB.status);
    soB.sair(); await dormir(150); soA.sair(); await dormir(250);

    // -----------------------------------------------------------------------
    // **A ordem importa.** Quem vai primeiro e' o caso em que o IP do criador e'
    // tambem o do ultimo a sair — o unico que nao acumulava NEM COM O BUG.
    // Serve de controlo positivo: se o contador estivesse preso por outra
    // razao, falhava aqui, nao em cascata nas seccoes seguintes.
    console.log("");
    console.log("  1) quem cria e sai sozinho nao acumula (controlo)");
    let barradasSozinho = 0;
    for (let n = 1; n <= MAX_ROOMS_POR_IP + 3; n++) {
      const sala = "SO" + String(n).padStart(2, "0") + "ZINH";
      const a = await entrar(tokenA, sala, "c1", "Ana", IP_A);
      if (a.status !== 200) barradasSozinho++;
      a.sair();
      await dormir(220);
    }
    ok_("A sozinha: " + barradasSozinho + " barradas em " + (MAX_ROOMS_POR_IP + 3), barradasSozinho === 0);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  2) quem sai por ultimo e' o OUTRO (o caso do bug)");
    let barradas = 0;
    let ultima = 200;
    for (let n = 1; n <= MAX_ROOMS_POR_IP + 2; n++) {
      const sala = "SA" + String(n).padStart(2, "0") + "OUTRO";
      const s = await ciclo(tokenA, tokenB, sala, IP_A, IP_B, "outro");
      if (s !== 200) barradas++;
      ultima = s;
    }
    ok_("A criou e esvaziou " + (MAX_ROOMS_POR_IP + 2) + " salas com o outro a sair por ultimo: " + barradas + " barradas",
      barradas === 0, "ultima deu " + ultima);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  3) e tambem quando quem sai por ultimo e' o criador");
    let barradas2 = 0;
    for (let n = 1; n <= MAX_ROOMS_POR_IP + 2; n++) {
      const sala = "SA" + String(n).padStart(2, "0") + "CRIADOR";
      const s = await ciclo(tokenA, tokenB, sala, IP_A, IP_B, "criador");
      if (s !== 200) barradas2++;
    }
    ok_("o mesmo quando o criador sai por ultimo: " + barradas2 + " barradas", barradas2 === 0);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  4) o limite por IP continua a existir (nao foi removido)");
    {
      // Dez salas abertas ao mesmo tempo pelo MESMO IP: a 11.a tem de falhar.
      const ctrl = new AbortController();
      const abertos = [];
      let recusa = 0;
      for (let n = 1; n <= MAX_ROOMS_POR_IP + 1; n++) {
        const a = await entrar(tokenA, "LI" + String(n).padStart(2, "0") + "MITE", "c1", "Ana", IP_A);
        if (a.status !== 200) recusa++;
        abertos.push(a);
      }
      ok_("com " + (MAX_ROOMS_POR_IP + 1) + " salas abertas do mesmo IP, " + recusa + " recusada(s)", recusa === 1,
        "esperava exactamente 1 recusa");
      for (const a of abertos) a.sair();
      await dormir(300);
      // E depois de fechar, volta a poder criar.
      const depois = await entrar(tokenA, "LIMPOS", "c1", "Ana", IP_A);
      ok_("e depois de fechar todas, volta a conseguir criar", depois.status === 200, "status " + depois.status);
      depois.sair();
      ctrl.abort();
    }

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  5) o codigo diz o que tem de dizer");
    {
      const f = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "watchparty.js"), "utf8");
      ok_("o cleanup usa room.ip", /decRoomIp\(room\.ip, code\)/.test(f));
      // `decRoomIp` e' uma funcao com assinatura `(ip, code)` — um `test`
      // que procure `decRoomIp(ip, code)` apanha a DECLARACAO e falha sem
      // haver chamada nenhuma errada. Aqui percor-se as ocorrencias e so' as
      // CHAMADAS contam (as que nao tem `function ` atras).
      const ocorrencias = [...f.matchAll(/decRoomIp\(([^)]*)\)/g)];
      const chamadas = ocorrencias.filter((m) => !f.slice(Math.max(0, m.index - 9), m.index).endsWith("function "));
      ok_("a funcao e' chamada " + chamadas.length + " vez(es)", chamadas.length > 0, "nenhuma chamada encontrada");
      ok_("e todaas com room.ip, nunca com o ip da ligacao",
        chamadas.length > 0 && chamadas.every((m) => m[1].trim() === "room.ip, code"),
        chamadas.map((m) => m[1].trim()).join(" | "));
      ok_("o incRoomIp usa o ip de quem cria", /incRoomIp\(ip, code\)/.test(f));
      ok_("e a sala guarda o ip de quem criou", /room = \{ members: new Map\(\), ip \}/.test(f));
    }
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