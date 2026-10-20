// A assinatura tinha de durar um PEDIDO. Tem de durar uma SESSAO DE VIDEO.
//
// Bug do utilizador, confirmado reproduzindo: `rewritePlaylist` assina os
// segmentos uma unica vez, no momento em que a playlist e' lida, e um leitor de
// VOD nao volta a le-la. Com 10 minutos de validade, o mesmo segmento dava 200
// aos 10 min e 403 aos 11 — ou seja, qualquer reproducao mais longa que isso
// (ou uma pausa de 10 minutos) partia.
//
// E o segredo: era `MEIDA_PROXY_SECRET || randomBytes(32)`, e essa variavel
// **nao esta definida em lado nenhum**, portanto em producao era aleatorio em
// cada arranque. Um reinicio (o Render hiberna) invalidava todas as URLs
// assinadas e cortava a reproducao em curso.
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const SEGREDO = "teste-validade-assinatura-24680";
process.env.MEIDA_PROXY_SECRET = SEGREDO;

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000;
const HORA = 60 * MIN;

// `?instancia=` da uma nova avaliacao do modulo, que e' como se simula um
// reinicio do servidor (a chave e' derivada no arranque do modulo).
const arranque = (nome) =>
  import(pathToFileURL(path.join(RAIZ, "server/src/services/proxy.js")).href + "?arranque=" + nome);

const { buildProxyUrl, assinar, assinaturaValida } = await arranque("1");

const ALVO = "https://cdn.exemplo.pt/video/segmento001.ts";
const realNow = Date.now;
function comRelogio(t, fn) {
  Date.now = () => t;
  try { return fn(); } finally { Date.now = realNow; }
}

// O `ts` e' o momento em que a PLAYLIST foi lida; fica congelado nos segmentos.
const params = new URL("http://127.0.0.1" + buildProxyUrl(ALVO, "https://megaplay.buzz/")).searchParams;
const ts = params.get("ts");
const sig = params.get("sig");
const agora = Number(ts);

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) a assinatura dura uma sessao inteira, nao um pedido");
// As fronteiras medem-se a partir do `ts` que a playlist estampou, e nao a
// partir de um `Date.now()` tirado a parte. A primeira versao tirava `agora`
// ANTES de `buildProxyUrl`, de modo que `ts` ficava alguns ms no futuro e o
// limite de "12 h + 1 ms" ficava a prova do tempo que o import demorava: a
// verificacao falhava em 3 de 8 corridas, sem o bug nenhum.
const base = Number(ts);
for (const [rotulo, minutos] of [
  ["a leitura da playlist", 0],
  ["+5 min", 5],
  ["+11 min  (o caso que partia)", 11],
  ["+59 min  (quase a hora de falha)", 59],
  ["+3 h    (um filme)", 180],
  ["+11 h   (com pausas)", 660],
]) {
  const t = base + minutos * MIN;
  ok_(rotulo + " ainda vale", comRelogio(t, () => assinaturaValida(ALVO, ts, sig)) === true);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  2) mas ainda expira (12 h)");
ok_("+11 h 59 min ainda vale", comRelogio(base + 12 * HORA - MIN, () => assinaturaValida(ALVO, ts, sig)) === true);
ok_("+12 h + 1 min ja expirou", comRelogio(base + 12 * HORA + MIN, () => assinaturaValida(ALVO, ts, sig)) === false);
ok_("+13 h ja expirou", comRelogio(base + 13 * HORA, () => assinaturaValida(ALVO, ts, sig)) === false);

// ---------------------------------------------------------------------------
console.log("");
console.log("  3) um ts no futuro tem limite");
// Antes, `agora - ts` dava negativo e passava sem limite nenhum.
ok_("+1 h no futuro e' recusado", comRelogio(agora - HORA, () => assinaturaValida(ALVO, String(agora + HORA), assinar(ALVO, String(agora + HORA)))) === false);
ok_("+6 min no futuro e' recusado", comRelogio(agora - MIN, () => assinaturaValida(ALVO, String(agora + 6 * MIN), assinar(ALVO, String(agora + 6 * MIN)))) === false);
// Tolerancia para desvio de relogio: tem de continuar a passar.
ok_("+2 min no futuro ainda passa (tolerancia de relogio)", comRelogio(agora - MIN, () => assinaturaValida(ALVO, String(agora + 2 * MIN), assinar(ALVO, String(agora + 2 * MIN)))) === true);

// ---------------------------------------------------------------------------
console.log("");
console.log("  4) a assinatura continua presa ao seu URL");
// Validade maior NAO pode abrir o proxy: o que nao e' para este URL continua
// fora, mesmo com uma assinatura perfeitamente valida.
ok_("o mesmo sig noutro URL nao serve", assinaturaValida("https://cdn.exemplo.pt/outro.ts", ts, sig) === false);
ok_("o mesmo sig noutro host nao serve", assinaturaValida("https://outro-cdn.exemplo.pt/x.ts", ts, sig) === false);

// ---------------------------------------------------------------------------
console.log("");
console.log("  5) o segredo sobrevive a um reinicio");
// Sem `MEIDA_PROXY_SECRET` (como em producao antes desta correccao), a chave
// tinha de vir do `JWT_SECRET`, que o `config.js` exige em producao.
delete process.env.MEIDA_PROXY_SECRET;
process.env.JWT_SECRET = "o-jwt-secret-do-render";
const antesDoReinicio = await arranque("antes-do-reinicio");
const urlAntes = new URL("http://127.0.0.1" + antesDoReinicio.buildProxyUrl(ALVO, "https://megaplay.buzz/")).searchParams;
const depoisDoReinicio = await arranque("depois-do-reinicio");
ok_("assinatura de um arranque vale noutro (so' com JWT_SECRET)",
  depoisDoReinicio.assinaturaValida(ALVO, urlAntes.get("ts"), urlAntes.get("sig")) === true);

// E `MEIDA_PROXY_SECRET` tem mesmo prioridade sobre o `JWT_SECRET`.
process.env.MEIDA_PROXY_SECRET = SEGREDO;
const comProxy1 = await arranque("com-proxy-1");
const comProxy2 = await arranque("com-proxy-2");
const urlProxy = new URL("http://127.0.0.1" + comProxy1.buildProxyUrl(ALVO, "https://megaplay.buzz/")).searchParams;
ok_("e com MEIDA_PROXY_SECRET tambem", comProxy2.assinaturaValida(ALVO, urlProxy.get("ts"), urlProxy.get("sig")) === true);

// ---------------------------------------------------------------------------
console.log("");
console.log("  6) a chave e' derivada, nao o segredo em claro");
// Se fosse o segredo do JWT tal e qual, um HMAC do proxy compromised
// permitiria forjar um token de login.
const { createHmac } = await import("node:crypto");
const derivada = createHmac("sha256", SEGREDO).update("meida/proxy/hls/v1").digest();
const emClaro = createHmac("sha256", SEGREDO).update(ALVO + "|" + ts).digest();
ok_("o que assina NAO e' o segredo em claro", !derivada.equals(emClaro));
ok_("e a assinatura bate com a derivacao documentada", assinar(ALVO, ts) === createHmac("sha256", derivada).update(ALVO + "|" + ts).digest("hex"));

// ---------------------------------------------------------------------------
console.log("");
console.log("  7) no servidor REAL: assinado passa, sem assinatura nao");
const PORTA = 5750 + (process.pid % 90);
const dbDir = fs.mkdtempSync(path.join(RAIZ, "..", "meida-test-validade-"));
const { spawn } = await import("node:child_process");
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", MEIDA_PROXY_SECRET: SEGREDO, JWT_SECRET: SEGREDO },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));
let codigoSaida = null;
filho.on("exit", (c) => { codigoSaida = c; });

const pedir = async (caminho) => {
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA}${caminho}`, { signal: AbortSignal.timeout(8000) });
    return { status: r.status, corpo: await r.text() };
  } catch (e) { return { erro: e.name === "TimeoutError" ? "TEMPO ESGOTADO" : e.message }; }
};

try {
  let acordou = false;
  for (let n = 0; n < 80 && !acordou; n++) {
    try { const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(4000) }); if (r.ok) { acordou = true; break; } } catch { /* ainda nao */ }
    await dormir(150);
  }
  ok_("o servidor arrancou", acordou, saida.slice(-300));

  if (acordou) {
    // Assinado, com 11 minutos: era 403, tem de dar 200.
    const p11 = new URLSearchParams({ url: "https://example.com/", ts: String(Date.now() - 11 * MIN) });
    p11.set("sig", assinar("https://example.com/", p11.get("ts")));
    const r11 = await pedir(`/api/proxy?${p11.toString()}`);
    ok_("no servidor real: segmento de ha 11 min da 200", r11.status === 200, "status " + (r11.status ?? r11.erro));

    // E a porta de entrada continua fechada.
    const semAssinatura = await pedir("/api/proxy?url=" + encodeURIComponent("https://example.com/"));
    ok_("sem assinatura continua a dar 403", semAssinatura.status === 403, "status " + (semAssinatura.status ?? semAssinatura.erro));
    const ts13 = String(Date.now() - 13 * HORA);
    const p13 = new URLSearchParams({ url: "https://example.com/", ts: ts13 });
    p13.set("sig", assinar("https://example.com/", ts13));
    const r13 = await pedir(`/api/proxy?${p13.toString()}`);
    ok_("com 13 h continua a dar 403", r13.status === 403, "status " + (r13.status ?? r13.erro));
    const vivo = await pedir("/api/health");
    ok_("o servidor continua vivo", vivo.status === 200, "status " + (vivo.status ?? vivo.erro));
    ok_("e nao morreu", codigoSaida === null, "codigo " + codigoSaida);
  }
} finally {
  try { filho.kill(); } catch { /* ja parado */ }
  await Promise.race([new Promise((r) => filho.once("exit", r)), dormir(5000)]);
  try { fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ja foi */ }
  // Esperar pelo `exit` do processo NAO chega: os pipes do stdout/stderr ainda
  // estao a fechar, e o `process.exit()` a seguir faz o Windows abortar com
  // `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` do libuv — media
  // volta em cada 6 execucoes, mesmo com o teste todo a passar.
  try { filho.stdout?.destroy(); filho.stderr?.destroy(); filho.removeAllListeners(); filho.unref(); } catch { /* ja fecho */ }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  8) higiene");
for (const f of ["server/src/services/proxy.js"]) {
  const t = fs.readFileSync(path.join(RAIZ, f), "utf8");
  ok_(f + " sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(t));
  ok_(f + " sem caractere de substituicao", !t.includes("\uFFFD"));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
// `process.exitCode` em vez de `process.exit()`: sair a forca enquanto o libuv
// ainda anda a fechar handles aborta o processo no Windows
// (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`), mesmo com o
// processo filho ja morto e os pipes ja destruidos. Medido: 1 em cada 10
// execucoes, com o teste todo a passar.
process.exitCode = falhou ? 1 : 0;