// Prova que a reproducao NATIVA do MegaPlay funciona: da'-nos o m3u8 em claro
// (decifrando o `enc`) e as legendas.
//
// Bate no site REAL, porque o ponto e' exactamente a cifra: um teste com um
// `enc` de mentira passaria mesmo com a chave errada. Por isso o teste:
//   1) decifra um `enc` fresco e confirma que sai JSON com `file`;
//   2) prova que a funcao `I` (o enchimento de zeros) esta' certa — e' ela que
//      transforma a chave de 16 chars numa de 32, e sem ela o AES nao arranca;
//   3) confirma que o m3u8 real responde e tem segmentos.
//
// Salta (em vez de falhar) se o site mudar o formato: um teste que falha porque
// o outro mudou o site nao diz nada sobre o codigo.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const caminho = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "server",
  "src",
  "services",
  "megaplayNativo.js"
);

const CHAVE = "i?LMTAx0Q6,:}50U";
const IV = "W0;27ToaUpl_P%'c";

let ok = 0;
let falhou = 0;
let saltados = 0;
const ok_ = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  (" + extra + ")" : "")); }
};
const saltar = (p) => { saltados++; console.log("  --    saltado: " + p); };

const BASE = "https://megaplay.buzz";
const H = { "User-Agent": "Mozilla/5.0", Referer: BASE + "/" };

// 1) A funcao `I` — enchimento de zeros. E' a razao de a chave de 16 dar 32.
function I(texto, tamanho) {
  const bytes = new TextEncoder().encode(String(texto));
  const out = new Uint8Array(tamanho);
  out.set(bytes.subarray(0, Math.min(tamanho, bytes.length)));
  return out;
}
ok_("I(): 16 chars -> 32 bytes (com zeros a seguir)", I(CHAVE, 32).length === 32);
ok_("I(): os primeiros 16 bytes sao o texto", Buffer.from(I(CHAVE, 32).slice(0, 16)).toString() === CHAVE);
ok_("I(): os ultimos 16 sao zero", I(CHAVE, 32).slice(16).every((b) => b === 0));
ok_("I(): trunca quando o texto e' maior que o alvo", I("abcdefghij", 5).length === 5);

// 2) O round-trip da cifra: cifrar e decifrar tem de dar o original. Isto
//    apanha uma chave/IV trocados OU um padding diferente, sem tocar na rede.
function deB64Url(s) {
  let t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const r = t.length % 4;
  if (r) t += "====".slice(r);
  return Buffer.from(t, "base64");
}
const original = JSON.stringify({ file: "https://exemplo.test/master.m3u8" });
{
  const c = crypto.createCipheriv("aes-256-cbc", I(CHAVE, 32), I(IV, 16));
  const cifrado = Buffer.concat([c.update(Buffer.from(original)), c.final()]);
  const d = crypto.createDecipheriv("aes-256-cbc", I(CHAVE, 32), I(IV, 16));
  const decifrado = Buffer.concat([d.update(cifrado), d.final()]).toString("utf8");
  ok_("cifrar+decifrar da' o original", decifrado === original);
}

// 3) O `enc` REAL. `/stream/ani/164212/1/sub` -> pagina -> data-id -> getSources.
let dados = null;
try {
  const pagina = await fetch(`${BASE}/stream/ani/164212/1/sub`, {
    headers: H,
    signal: AbortSignal.timeout(20000),
  });
  const html = await pagina.text();
  const dataId = /data-id="(\d+)"/.exec(html)?.[1];
  if (!dataId) throw new Error("a pagina nao tem data-id");
  const r = await fetch(`${BASE}/stream/getSources?id=${dataId}`, {
    headers: { ...H, accept: "application/json", "x-requested-with": "XMLHttpRequest" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("getSources " + r.status);
  dados = await r.json();
  ok_("o `enc` do site decifra para JSON com `file`", (() => {
    try {
      const d = crypto.createDecipheriv("aes-256-cbc", I(CHAVE, 32), I(IV, 16));
      const j = JSON.parse(Buffer.concat([d.update(deB64Url(dados.enc)), d.final()]).toString("utf8"));
      return typeof j.file === "string" && j.file.includes(".m3u8");
    } catch {
      return false;
    }
  })());
  ok_("o m3u8 e' um https", String(dados.enc || "").length > 0 && (() => {
    const d = crypto.createDecipheriv("aes-256-cbc", I(CHAVE, 32), I(IV, 16));
    return JSON.parse(Buffer.concat([d.update(deB64Url(dados.enc)), d.final()]).toString("utf8")).file.startsWith("https://");
  })());
} catch (e) {
  saltar("o site mudou ou nao respondeu: " + e.message);
}

// 4) O m3u8 e as legendas sao reais (quando o `enc` se decifrou).
if (dados?.enc) {
  const d = crypto.createDecipheriv("aes-256-cbc", I(CHAVE, 32), I(IV, 16));
  const json = JSON.parse(Buffer.concat([d.update(deB64Url(dados.enc)), d.final()]).toString("utf8"));
  try {
    const m = await fetch(json.file, { headers: H, signal: AbortSignal.timeout(20000) });
    const txt = await m.text();
    ok_("o master.m3u8 responde", m.ok && txt.startsWith("#EXTM3U"));
    ok_("o master tem variantes", txt.includes(".m3u8"));

    const variante = new URL([...txt.matchAll(/^(?!#)(\S+\.m3u8)$/gm)][0]?.[1] ?? "", json.file).href;
    if (variante) {
      const r = await fetch(variante, { headers: H, signal: AbortSignal.timeout(20000) });
      const vt = await r.text();
      ok_("a variante responde e e' VOD", r.ok && vt.includes("#EXT-X-PLAYLIST-TYPE:VOD"));
      const nSeg = (vt.match(/#EXTINF:/g) || []).length;
      ok_("a variante tem segmentos (o episodio inteiro)", nSeg > 10, nSeg + " segmentos");

      // As legendas: o .vtt em claro. E' o que a ideia queria.
      const tr = dados.tracks?.[0];
      if (tr?.file) {
        const rt = await fetch(tr.file, { headers: H, signal: AbortSignal.timeout(20000) });
        const vtt = await rt.text();
        ok_("a legenda .vtt responde", rt.ok && vtt.startsWith("WEBVTT"));
        ok_("a legenda tem blocos de texto", (vtt.match(/-->/g) || []).length > 3,
          (vtt.match(/-->/g) || []).length + " blocos");
      }
    }
  } catch (e) {
    saltar("m3u8 nao respondeu: " + e.message);
  }
}

/* ---------- MUTACOES ---------- */
// A cifra e' o nucleo: partir a chave tem de partir o teste.

const MUTACOES = [
  ["a chave perde o enchimento de zeros (16 em vez de 32)",
   "I(chaveTexto, 32)", "I(chaveTexto, 16)"],
  ["o IV fica com 32 bytes",
   "I(ivTexto, 16)", "I(ivTexto, 32)"],
  // Chave e IV trocados: o `createDecipheriv` aceita (chave, iv) e nao se
  // queixa de nada — o resultado e' lixo. E' o que torna esta mutacao boa:
  // nao rebenta, da' wrong data em silencio.
  ["chave e IV trocados",
   '"aes-256-cbc",\n    I(chaveTexto, 32),\n    I(ivTexto, 16)',
   '"aes-256-cbc",\n    I(ivTexto, 16),\n    I(chaveTexto, 32)'],
];

console.log("");
const fonteReal = fs.readFileSync(caminho, "utf8");

// A mutacao e' aplicada ao FICHEIRO REAL (numa copia temporaria), e o modulo
// partido e' importado. E' a unica forma de provar que o codigo detectaria a
// mutacao: reimplementar a cifra no teste provaria o teste, nao o servico.
//
// A copia precisa do `log.js` ao lado, porque o servico o importa.
const servicosDir = path.dirname(caminho);
const modReal = await import("file:///" + caminho.replace(/\\/g, "/") + "?ok=" + Date.now());
const antesReal = await modReal.extrairMegaPlayNativo({
  embedUrl: "https://megaplay.buzz/stream/ani/164212/1/sub",
});

for (const [nome, de, para] of MUTACOES) {
  if (!fonteReal.includes(de)) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
    falhou++;
    continue;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-mp-mut-"));
  for (const f of fs.readdirSync(servicosDir)) {
    if (!f.endsWith(".js")) continue;
    fs.copyFileSync(path.join(servicosDir, f), path.join(dir, f));
  }
  const ficheiroMut = path.join(dir, "megaplayNativo.js");
  fs.writeFileSync(ficheiroMut, fonteReal.replace(de, para));

  let depois;
  try {
    const modMut = await import("file:///" + ficheiroMut.replace(/\\/g, "/"));
    depois = await modMut.extrairMegaPlayNativo({
      embedUrl: "https://megaplay.buzz/stream/ani/164212/1/sub",
    });
  } catch (e) {
    depois = "REBENTOU: " + e.message;
  }
  fs.rmSync(dir, { recursive: true, force: true });

  // Com a mutacao, o resultado tem de mudar. `null`, lixo ou excepcao contam.
  const mudou = JSON.stringify(antesReal) !== JSON.stringify(depois);
  if (mudou) {
    console.log("  OK    MUTACAO apanhada: " + nome);
    ok++;
  } else {
    console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
    falhou++;
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)" + (saltados ? ", " + saltados + " saltado(s)" : ""));
process.exit(falhou ? 1 : 0);