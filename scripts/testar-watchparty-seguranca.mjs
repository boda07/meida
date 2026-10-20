// Watch Party: o limite de tamanho media "[object Object]", qualquer pessoa
// publicava em qualquer sala, e a navegacao remota ia parar a um sitio externo.
//
// Tudo medido contra o servidor real antes da correccao:
//   - `data: {x: "a".repeat(5000)}` -> 200 (o limite de 2 KB media 15 bytes)
//   - um utilizador que nunca entrou na sala -> 200
//   - `from` do cliente, sem verificacao -> aceite
//   - `\\evil.com`, `//evil.com` e `https://evil.com` -> todos 200
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const RAIZ = process.cwd();
const PORTA = 5910 + (process.pid % 30);
const BASE = `http://127.0.0.1:${PORTA}`;
const SENHA = "senha-correta-123";

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) a regra do caminho, nos dois lados");
// O servidor tem a expressao em `routes/watchparty.js`; o cliente em
// `WatchPartyContext.jsx`. As duas tem de ser a MESMA.
const fonteServidor = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "watchparty.js"), "utf8");
const fonteCliente = fs.readFileSync(path.join(RAIZ, "web", "src", "watchparty", "WatchPartyContext.jsx"), "utf8");
const RE = /^\/(?![/\\])[^\s\\]{0,300}$/;
{
  const noServidor = /const NAV_PATH_RE = (\/.*\/);/.exec(fonteServidor);
  ok_("o servidor tem a regra", Boolean(noServidor));
  if (noServidor) {
    const r = eval(noServidor[1]);
    for (const [p, deve] of [
      ["/details/123?lang=pt", true], ["/", true], ["/ok", true],
      ["\\evil.com", false], ["//evil.com", false], ["https://evil.com", false],
      ["http://evil.com", false], ["/path com espaco", false], ["/path\\invertida", false],
      ["", false], ["/" + "a".repeat(300), true], ["/" + "a".repeat(301), false],
    ]) {
      ok_("servidor: " + JSON.stringify(p).slice(0, 30).padEnd(32) + (deve ? "aceita" : "recusa"), r.test(p) === deve);
    }
    ok_("e a do servidor e' identica a do teste", r.source === RE.source,
      "servidor " + r.source + " | teste " + RE.source);
  }
  const noCliente = /const NAV_PATH_RE = (\/.*\/);/.exec(fonteCliente);
  ok_("o cliente tem a regra", Boolean(noCliente));
  if (noCliente) ok_("e e' a mesma", noCliente[1] === (noServidor ? noServidor[1] : ""));
  ok_("o cliente valida ANTES do navigate",
    fonteCliente.includes("if (!navPathValido(path))") && /navigate\(path\)/.test(fonteCliente));
  // Ordem: a validacao tem de estar ANTES da chamada.
  const iValida = fonteCliente.indexOf("if (!navPathValido(path))");
  const iNavega = fonteCliente.indexOf("navigate(path)", iValida);
  ok_("e a validacao aparece antes", iValida > -1 && iNavega > iValida, `valida@${iValida} navega@${iNavega}`);
}

// ---------------------------------------------------------------------------
const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-wp-"));
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: "t-wp" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));

const pedir = (caminho, opcoes = {}) => fetch(BASE + caminho, { signal: AbortSignal.timeout(8000), ...opcoes });
async function utilizador(nome) {
  const u = nome + "_" + Math.random().toString(36).slice(2, 6) + "_u";
  await pedir("/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: SENHA }),
  });
  const r = await pedir("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: SENHA }),
  });
  const j = await r.json();
  return { nome: u, id: j.user.id, token: j.token };
}

try {
  let pronto = false;
  for (let i = 0; i < 120 && !pronto; i++) {
    try { const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) pronto = true; }
    catch { await dormir(150); }
  }
  ok_("o servidor arrancou", pronto, saida.slice(-400));

  if (pronto) {
    const ana = await utilizador("ana");
    const bruno = await utilizador("bruno");
    const sala = "ABCDEF";

    // A Ana entra de facto na sala (o EventSource cria-a).
    const ctrl = new AbortController();
    const stream = await fetch(`${BASE}/api/wp/stream?room=${sala}&client=c1&nick=Ana&token=${ana.token}`, { signal: ctrl.signal });
    const leitor = stream.body.getReader();
    await dormir(400);
    await leitor.read(); // o snapshot conta como a ligacao estar viva

    const enviar = (u, corpo) =>
      pedir("/api/wp/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + u.token },
        body: JSON.stringify(corpo),
      });

    console.log("");
    console.log("  2) o limite de tamanho mede o payload a serio");
    const grande = await enviar(ana, { room: sala, from: "c1", kind: "event", data: { x: "a".repeat(5000) } });
    ok_("data: {x: 'a'.repeat(5000)} -> 400", grande.status === 400, "status " + grande.status);
    // O corpo le-se UMA vez: `Response.text()` duas vezes da "Body has already
    // been read" (foi o que rebentou a primeira versao deste teste).
    const corpoGrande = await grande.text();
    ok_("  e a mensagem e' a do limite", /max 2 KB/.test(corpoGrande), corpoGrande.slice(0, 70));
    const dentro = await enviar(ana, { room: sala, from: "c1", kind: "event", data: { texto: "a".repeat(1500) } });
    ok_("um payload de 1,5 KB passa", dentro.status === 200, "status " + dentro.status);
    // E um que passa em JSON mas nao em String().
    const quase = await enviar(ana, { room: sala, from: "c1", kind: "event", data: { y: "b".repeat(2100) } });
    ok_("2,1 KB (que em String() seria quase nada) -> 400", quase.status === 400, "status " + quase.status);

    console.log("");
    console.log("  3) so membros publicam, e o `from` e' do servidor");
    const intruso = await enviar(bruno, { room: sala, from: "c9", kind: "nav", data: { path: "/x" } });
    ok_("Bruno (nunca entrou) -> 403", intruso.status === 403, "status " + intruso.status);
    const corpoIntruso = await intruso.text();
    ok_("  e a mensagem diz o porque", /membro/.test(corpoIntruso), corpoIntruso.slice(0, 70));
    const spoof = await enviar(ana, { room: sala, from: "c9-indoutro", kind: "event", data: { texto: "oi" } });
    ok_("Ana com um `from` que nao existe -> 403", spoof.status === 403, "status " + spoof.status);

    // **O caso que distingue "ligacao desconhecida" de "ligacao de outro
    // membro":** o Bruno entra mesmo na sala (com o client `c2`). Agora o
    // `from: "c2"` EXISTE, so' que pertence a outra conta — e so o userId
    // apanha. Sem esta verificacao a mutacao M3 passava a batota toda.
    const ctrlBruno = new AbortController();
    const streamBruno = await fetch(`${BASE}/api/wp/stream?room=${sala}&client=c2&nick=Bruno&token=${bruno.token}`, { signal: ctrlBruno.signal });
    const leitorBruno = streamBruno.body.getReader();
    await dormir(400);
    await leitorBruno.read();

    const fingindo = await enviar(ana, { room: sala, from: "c2", kind: "event", data: { texto: "fingindo ser o Bruno" } });
    ok_("Ana com o `from` de OUTRO MEMBRO (que existe) -> 403", fingindo.status === 403, "status " + fingindo.status);
    const proprio = await enviar(bruno, { room: sala, from: "c2", kind: "event", data: { texto: "sou eu" } });
    ok_("e o proprio Bruno com esse `from` -> 200", proprio.status === 200, "status " + proprio.status);

    const legitimo = await enviar(ana, { room: sala, from: "c1", kind: "event", data: { texto: "oi" } });
    ok_("Ana com o `from` dela -> 200", legitimo.status === 200, "status " + legitimo.status);

    console.log("");
    console.log("  4) o servidor recusa caminhos perigosos");
    for (const [p, esperado] of [
      ["/details/1", 200], ["/ok", 200],
      ["\\evil.com", 400], ["//evil.com", 400], ["https://evil.com", 400],
      ["/com espaco", 400], ["/com\\barra", 400], ["/" + "a".repeat(400), 400],
    ]) {
      const r = await enviar(ana, { room: sala, from: "c1", kind: "nav", data: { path: p } });
      ok_("nav " + JSON.stringify(p).slice(0, 26).padEnd(28) + "-> " + esperado, r.status === esperado, "status " + r.status);
    }

    console.log("");
    console.log("  5) o /wp/send tem limite de pedidos");
    {
      let barrados = 0;
      for (let i = 0; i < 90; i++) {
        const r = await enviar(ana, { room: sala, from: "c1", kind: "event", data: { n: i } });
        if (r.status === 429) barrados++;
      }
      ok_("90 pedidos seguidos dao 429 (" + barrados + " barrados)", barrados > 0,
        "nenhum barrado — o limite nao esta' a funcionar");
      ok_("e o servidor continua vivo", (await pedir("/api/health")).ok === true);
    }

    ctrl.abort();
    ctrlBruno.abort();
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