// Seguranca do `/api/proxy`: assinatura, IP privado bloqueado, redirect manual.
// Arranca o servidor com `MEIDA_PROXY_SECRET` fixo e usa o mesmo segredo no
// teste para assinar URLs — igual ao que `buildProxyUrl` faz no servidor.
import path from "node:path";
import fs from "node:fs";
import { createHmac } from "node:crypto";

const RAIZ = path.join(process.cwd());
const SEGREDO = "teste-seguro-proxy-12345";

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

function assinar(targetUrl, ts = String(Date.now())) {
  return createHmac("sha256", SEGREDO).update(targetUrl + "|" + ts).digest("hex");
}

function proxyUrl(targetUrl, adulterarSig = false, ts = String(Date.now())) {
  const p = new URLSearchParams({ url: targetUrl, ts });
  p.set("sig", adulterarSig ? "0".repeat(64) : assinar(targetUrl, ts));
  return `/api/proxy?${p.toString()}`;
}

const PORTA = 5600 + (process.pid % 90);
const dbDir = fs.mkdtempSync(path.join(RAIZ, "..", "meida-test-proxy-"));
const { spawn } = await import("node:child_process");
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", MEIDA_PROXY_SECRET: SEGREDO },
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

    console.log("");
    console.log("  1) sem assinatura -> 403");
    const semSig = await pedir("/api/proxy?url=" + encodeURIComponent("https://example.com/"));
    ok_("URL sem assinatura e' rejeitada com 403", semSig.status === 403, "status " + semSig.status);

    console.log("");
    console.log("  2) assinatura valida -> busca o alvo");
    const valido = await pedir(proxyUrl("https://example.com/"));
    const corpo = await valido.text();
    ok_("URL assinada devolve o conteudo (200)", valido.status === 200 && corpo.includes("example"), "status " + valido.status + " corpo=" + JSON.stringify(corpo.slice(0, 40)));

    console.log("");
    console.log("  3) assinatura adulterada -> 403");
    const adulterada = await pedir(proxyUrl("https://example.com/", true));
    ok_("assinatura adulterada e' rejeitada com 403", adulterada.status === 403, "status " + adulterada.status);

    console.log("");
    console.log("  4) assinatura expirada (ts de ha mais de 10 min) -> 403");
    const expirado = await pedir(proxyUrl("https://example.com/", false, String(Date.now() - 20 * 60 * 1000)));
    ok_("assinatura expirada e' rejeitada com 403", expirado.status === 403, "status " + expirado.status);

    console.log("");
    console.log("  5) IP privado (127.0.0.1) com assinatura valida -> 403");
    const privado = await pedir(proxyUrl("http://127.0.0.1/"));
    ok_("IP privado e' rejeitado com 403", privado.status === 403, "status " + privado.status);
    const corpoPrivado = await privado.text().catch(() => "");
    ok_("motivo menciona endereco interno", /endereco interno/.test(corpoPrivado), corpoPrivado);

    console.log("");
    console.log("  6) outros IPs privados tambem bloqueados");
    for (const alvo of ["http://10.0.0.1/", "http://192.168.1.1/", "http://172.16.0.1/", "http://169.254.169.254/"]) {
      const r = await pedir(proxyUrl(alvo));
      ok_("bloqueia " + alvo, r.status === 403, "status " + r.status);
    }

    console.log("");
    console.log("  7) host externo nao e' bloqueado (solta por diante)");
    const externo = await pedir(proxyUrl("https://example.com/"));
    ok_("host externo funciona", externo.status === 200, "status " + externo.status);

    ok_("o servidor nao morreu a meio do teste", !servidorMorto, servidorMorto ? "morreu com " + servidorMorto : "");
  }
} finally {
  try { filho.kill(); } catch { /* ja parado */ }
  try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch { /* ja foi */ }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);