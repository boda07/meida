// O filtro de destinos tinha 15 buracos em 30 casos (medido antes da correccao).
//
//  1. `url.hostname` traz os IPv6 ENTRE PARENTESES (`[::1]`) e `isIP("[::1]")`
//     da 0 — por isso `if (ip === 4 || ip === 6)` nunca era verdade para um IPv6
//     literal e TODOS passavam: loopback, link-local, unique local, multicast.
//  2. A expressao regular do CGNAT estava errada em ambos os sentidos:
//     bloqueava `100.200.x.x` (publico) e deixava passar `100.120.x.x` (CGNAT).
//  3. Os hostnames nunca eram resolvidos: `localtest.me` e `127.0.0.1.nip.io`
//     devolviam `ok: true` com o filtro antigo — um bypass completo, medido.
//  4. O `/api/anime/megaplay` aceitava qualquer URL e fazia `fetch` ao que o
//     cliente mandasse (SSRF cego).
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const SEGREDO = "teste-filtro-alvos-31415";
process.env.MEIDA_PROXY_SECRET = SEGREDO;
const mod = await import(
  pathToFileURL(path.join(RAIZ, "server", "src", "services", "proxy.js")).href
);
const { alvoSeguro } = mod;
const { embedUrlValido } = await import(
  pathToFileURL(path.join(RAIZ, "server", "src", "services", "megaplayNativo.js")).href
);

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) IPv6 literais: os parenteses faziam isIP dar 0 e passavam todos");
for (const u of [
  "http://[::1]/", "http://[::]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/",
  "http://[fe80::1]/", "http://[fc00::1]/", "http://[fd12:3456::1]/", "http://[ff02::1]/",
  "http://[fe80::a9fe:a9fe]/",
]) {
  const r = await alvoSeguro(u);
  ok_(u.replace("http://", "").padEnd(24) + " bloqueado", r.ok === false, JSON.stringify(r));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  2) CGNAT: 100.64.0.0/10 e' 64..127, e o resto e' publico");
// A regra antiga era `100\.(6[4-9]|7[0-9]|8[0-9]|9[0-9]|1[0-1][0-9]|2[0-5][0-5])\.`:
// saltava de 119 para 200. Blockeava `100.200` (publico) e deixava
// `100.120`..`100.127` (CGNAT) passar.
for (const u of [
  "http://100.64.0.1/", "http://100.100.0.1/", "http://100.119.255.255/",
  "http://100.120.0.1/", "http://100.127.255.255/",
]) {
  const r = await alvoSeguro(u);
  ok_(u.replace("http://", "").padEnd(20) + " bloqueado", r.ok === false, JSON.stringify(r));
}
for (const u of ["http://100.63.255.255/", "http://100.128.0.1/", "http://100.200.0.1/", "http://100.255.255.255/"]) {
  const r = await alvoSeguro(u);
  ok_(u.replace("http://", "").padEnd(20) + " deixa passar", r.ok === true, JSON.stringify(r));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  3) as outras sub-redes");
for (const [u, deve] of [
  ["http://0.0.0.0/", false], ["http://0.1.2.3/", false],
  ["http://10.255.255.255/", false], ["http://172.16.0.1/", false], ["http://172.31.255.255/", false],
  ["http://192.168.1.1/", false], ["http://169.254.169.254/", false],
  ["http://127.0.0.1/", false], ["http://127.9.9.9/", false],
  ["http://224.0.0.1/", false], ["http://239.255.255.250/", false],
  // publicos: nao podem ser bloqueados (falso positivo parte o video)
  ["http://172.15.255.255/", true], ["http://172.32.0.1/", true],
  ["http://8.8.8.8/", true], ["http://1.1.1.1/", true], ["http://93.184.216.34/", true],
]) {
  const r = await alvoSeguro(u);
  ok_(u.replace("http://", "").padEnd(22) + (deve ? " passa" : " bloqueado"), r.ok === deve, JSON.stringify(r));
}

// **Um IPv6 publico tem de PASSAR.** Sem esta verificacao a mutacao que deixa de
// tirar os parenteses NAO e' apanhada: `dns.lookup("[2606:...]")` falha, o alvo
// e' bloqueado, e a seccao 1 ("todos os IPv6 literais estao bloqueados") continua
// a passar. O efeito real dessa mutacao e' SOBRE-BLOQUEIO: parte o video em
// maquinas so' com IPv6.
for (const u of [
  "http://[2606:4700:4700::1111]/",
  "http://[2001:4860:4860::8888]/",
  "https://[2a00:1450:4001:81b::200e]/",
]) {
  const r = await alvoSeguro(u);
  ok_(u.replace("https://", "").padEnd(30) + " passa (IPv6 publico)", r.ok === true, JSON.stringify(r));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  3b) TODOS os enderecos de um nome, nao so' o primeiro");
// Nao existe nome publico no mundo que devolva um endereco publico e um privado
// em conjunto, portanto um teste so' com DNS real nunca apanharia um "so' julgo
// o primeiro". Da' a funcao pura `algumEnderecoBloqueado`.
{
  const { algumEnderecoBloqueado } = mod;
  const publico = { address: "93.184.216.34" };
  const loopback = { address: "127.0.0.1" };
  const linkLocal = { address: "fe80::1" };
  ok_("so' publicos -> nao bloqueado", algumEnderecoBloqueado([publico, { address: "8.8.8.8" }]) === false);
  ok_("o primeiro publico, o segundo loopback -> bloqueado",
    algumEnderecoBloqueado([publico, loopback]) === true, "foi o que o bug nao via");
  ok_("o primeiro loopback, o segundo publico -> bloqueado",
    algumEnderecoBloqueado([loopback, publico]) === true);
  ok_("o segundo e' link-local -> bloqueado", algumEnderecoBloqueado([publico, linkLocal]) === true);
  ok_("lista vazia -> nao bloqueado", algumEnderecoBloqueado([]) === false);
  ok_("lista invalida -> bloqueado (lado seguro)", algumEnderecoBloqueado(null) === true);
  ok_("e' uma funcao, nao uma promessa (pura)", typeof algumEnderecoBloqueado([publico]) === "boolean");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  4) hostnames: agora sao resolvidos");
// Nomes publicos que apontam para loopback. Medido nesta maquina: o filtro
// antigo devolvia `ok: true` para todos estes.
for (const nome of ["localtest.me", "127.0.0.1.nip.io"]) {
  const r = await alvoSeguro(`http://${nome}/`);
  ok_(nome.padEnd(22) + " bloqueado (resolve para loopback)", r.ok === false, JSON.stringify(r));
}
ok_("localhost tambem", (await alvoSeguro("http://localhost/")).ok === false);
{
  const r = await alvoSeguro("http://localhost:5175/api/health");
  ok_("localhost com porta tambem", r.ok === false, JSON.stringify(r));
}
ok_("um nome publico continua a passar", (await alvoSeguro("https://example.com/")).ok === true);

// ---------------------------------------------------------------------------
console.log("");
console.log("  5) esquemas e URLs invalidos");
for (const [u, deve] of [
  ["ftp://exemplo.pt/x", false], ["file:///etc/passwd", false], ["gopher://exemplo.pt/", false],
  ["nao-e-um-url", false], ["", false],
  ["https://exemplo.pt/x", true],
]) {
  const r = await alvoSeguro(u);
  ok_(JSON.stringify(u).padEnd(24) + (deve ? " passa" : " recusado"), r.ok === deve, JSON.stringify(r));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  6) o filtro e' async e resolve o cache");
{
  const antes = alvoSeguro("http://127.0.0.1/");
  ok_("devolve uma promessa (nao um objecto)", typeof antes.then === "function", typeof antes);
  ok_("e o resultado tem a forma antiga", (await antes).ok === false);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  7) MegaPlay: so o proprio site, e so /stream/");
for (const [u, deve] of [
  ["https://megaplay.buzz/stream/ani/12345/1/sub", true],
  ["https://megaplay.buzz/stream/mal/12345/2/dub", true],
  ["https://megaplay.buzz/stream/s-2/7827/1/sub", true],
  ["https://MEGAPLAY.BUZZ/stream/ani/1/1/sub", true],   // o URL normaliza a caixa
  ["https://megaplay.buzz/admin", false],
  ["https://megaplay.buzz/", false],
  ["https://megaplay.buzz/stream/../../etc", false],
  ["http://megaplay.buzz/stream/ani/1/1/sub", false],  // http
  ["https://megaplay.buzz:8443/stream/ani/1/1/sub", false],  // outro porto
  ["https://megaplay.buzz.evil.pt/stream/ani/1/1/sub", false],
  ["https://evil.pt/stream/ani/1/1/sub", false],
  ["http://127.0.0.1:5175/", false],
  ["http://169.254.169.254/latest/meta-data/", false],
  ["http://localhost:5175/", false],
  ["", false], [null, false], [undefined, false], [12345, false],
]) {
  const r = embedUrlValido(u);
  // `JSON.stringify(undefined)` devolve `undefined` e nao uma string, por isso
  // o `String()` — sem ele o `padEnd` rebenta.
  ok_(String(JSON.stringify(u)).padEnd(40) + (deve ? " aceite" : " recusado"), r === deve, "veio " + r);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  7b) a ROTA responde 400 (servidor real, nao o handler)");
// Chamar `embedUrlValido` directamente provava so' a funcao. O que interessa e'
// que a rota publica recuse — e que o servidor interno nao seja buscado.
{
  const { spawn } = await import("node:child_process");
  const PORTA = 5760 + (process.pid % 90);
  const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-filtro-"));
  let escritas = 0;
  const http = await import("node:http");
  const segredo = http.createServer((req, res) => {
    escritas++;
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<b data-id="9999">');
  });
  await new Promise((r) => segredo.listen(0, "127.0.0.1", r));
  segredo.unref();
  const portaSegredo = segredo.address().port;

  const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: "teste" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let saida = "";
  filho.stdout.on("data", (d) => (saida += d));
  filho.stderr.on("data", (d) => (saida += d));
  let morreu = null;
  filho.on("exit", (c) => { morreu = c; });
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    let pronto = false;
    for (let i = 0; i < 120 && !pronto && !morreu; i++) {
      try { const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) pronto = true; }
      catch { await dormir(150); }
    }
    ok_("o servidor arrancou", pronto, saida.slice(-400));

    if (pronto) {
      const pedir = async (alvo) => {
        try {
          const r = await fetch(`http://127.0.0.1:${PORTA}/api/anime/megaplay?url=${encodeURIComponent(alvo)}`,
            { signal: AbortSignal.timeout(8000) });
          return r.status;
        } catch { return 0; }
      };
      // O caso do utilizador, literalmente.
      ok_("url=http://127.0.0.1:<porta>/ da 400", (await pedir(`http://127.0.0.1:${portaSegredo}/`)) === 400);
      ok_("o proprio backend da 400", (await pedir(`http://127.0.0.1:${PORTA}/api/health`)) === 400);
      ok_("metadados da nuvem da 400", (await pedir("http://169.254.169.254/latest/meta-data/")) === 400);
      ok_("localhost da 400", (await pedir(`http://localhost:${portaSegredo}/`)) === 400);
      ok_("outro site da 400", (await pedir("https://exemplo.pt/x")) === 400);
      ok_("MegaPlay fora do /stream/ da 400", (await pedir("https://megaplay.buzz/admin")) === 400);
      ok_("NENHUM pedido chegou ao servidor interno", escritas === 0, "foram " + escritas);
      ok_("e o servidor continua vivo", (await fetch(`http://127.0.0.1:${PORTA}/api/health`)).ok === true);
    }
  } finally {
    try { filho.kill(); } catch { /* ja parado */ }
    await Promise.race([new Promise((r) => filho.once("exit", r)), dormir(5000)]);
    try { filho.stdout.destroy(); filho.stderr.destroy(); filho.unref(); } catch { /* ja fechado */ }
    try { segredo.close(); } catch { /* ja fechado */ }
    try { fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ja foi */ }
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  8) o gancho de teste esta' desligado por omissao");
{
  // Se o gancho estivesse ligado por defeito, `127.0.0.1` passaria. Este bloco
  // corre num sub-processo para nao poder herdar o estado do teste do proxy.
  const codigo = `
    import { pathToFileURL } from "node:url";
    const m = await import(pathToFileURL(${JSON.stringify(path.join(RAIZ, "server", "src", "services", "proxy.js"))}).href);
    process.stdout.write(String((await m.alvoSeguro("http://127.0.0.1/")).ok));
  `;
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", codigo], { encoding: "utf8" });
  ok_("num processo novo, 127.0.0.1 continua bloqueado", r.stdout.trim() === "false", "veio " + JSON.stringify(r.stdout.trim()) + r.stderr);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  9) higiene");
const proxy = fs.readFileSync(path.join(RAIZ, "server", "src", "services", "proxy.js"), "utf8");
const subs = fs.readFileSync(path.join(RAIZ, "server", "src", "services", "subtitles.js"), "utf8");
const play = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "play.js"), "utf8");
for (const f of ["server/src/services/proxy.js", "server/src/services/megaplayNativo.js", "server/src/services/subtitles.js", "server/src/routes/play.js"]) {
  const t = fs.readFileSync(path.join(RAIZ, f), "utf8");
  ok_(f.split("/").pop() + " sem CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(t));
  ok_(f.split("/").pop() + " sem caractere de substituicao", !t.includes("\uFFFD"));
}
{
  // Todo o chamador tem de esperar pela promessa. A declaracao
  // (`function alvoSeguro(`) nao e' uma chamada, por isso fica de fora — e um
  // comentario que escreva `alvoSeguro(` sem `await` conta como erro, para
  // obrigar a documentacao a bater com o codigo.
  const semAwait = (t, nome) => {
    const maus = [];
    let i = t.indexOf("alvoSeguro(");
    while (i >= 0) {
      const antes = t.slice(Math.max(0, i - 12), i);
      if (!/await $/.test(antes) && !/function $/.test(antes)) {
        maus.push(JSON.stringify(t.slice(Math.max(0, i - 34), i + 12).replace(/\s+/g, " ")));
      }
      i = t.indexOf("alvoSeguro(", i + 1);
    }
    ok_(nome, maus.length === 0, maus.join(" | "));
  };
  semAwait(proxy, "proxy.js: todas as chamadas com await");
  semAwait(subs, "subtitles.js: todas as chamadas com await");
  semAwait(play, "play.js: todas as chamadas com await");
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;