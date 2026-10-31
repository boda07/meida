// node scripts/diagnostico-megaplay.mjs "https://megaplay.buzz/stream/ani/<anilistId>/<ep>/sub"
import crypto from "node:crypto";
const embed = process.argv[2];
if (!embed) { console.error("Uso: node scripts/diagnostico-megaplay.mjs <URL do embed do MegaPlay>"); process.exit(2); }
const BASE = "https://megaplay.buzz";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CHAVE = "i?LMTAx0Q6,:}50U", IV = "W0;27ToaUpl_P%'c";
const L = (ok, passo, det = "") => console.log(`${ok ? "OK   " : "FALHA"} ${passo}${det ? " — " + det : ""}`);
async function pedir(url, headers = {}) {
  try { return { r: await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(15000) }) }; }
  catch (e) { return { erro: e.cause?.code || e.message }; }
}
const I = (t, n) => { const o = new Uint8Array(n); o.set(new TextEncoder().encode(t).subarray(0, n)); return o; };
const deB64Url = (s) => { let t = s.replace(/-/g, "+").replace(/_/g, "/"); if (t.length % 4) t += "====".slice(t.length % 4); return Buffer.from(t, "base64"); };

let { r, erro } = await pedir(embed, { Referer: BASE + "/" });
if (erro) { L(false, "1. página do embed", erro); process.exit(1); }
const html = await r.text();
L(r.ok, "1. página do embed", `HTTP ${r.status}, ${html.length} bytes`);
const m = /data-id="(\d+)"/.exec(html);
L(!!m, "2. data-id na página", m ? m[1] : "não encontrado (HTML mudou ou página de erro)");
if (!m) { console.log("   início:", html.slice(0, 300).replace(/\s+/g, " ")); process.exit(1); }

({ r, erro } = await pedir(`${BASE}/stream/getSources?id=${m[1]}`, { Referer: embed, accept: "application/json, text/plain, */*" }));
if (erro) { L(false, "3. getSources", erro); process.exit(1); }
const texto = await r.text();
let dados; try { dados = JSON.parse(texto); } catch { dados = null; }
L(r.ok && !!dados, "3. getSources", `HTTP ${r.status}, ${dados ? "campos: " + Object.keys(dados).join(", ") : "não é JSON: " + texto.slice(0, 160)}`);
if (!dados) process.exit(1);
console.log("   tracks:", (dados.tracks || []).length, "| intro:", JSON.stringify(dados.intro), "| outro:", JSON.stringify(dados.outro));

let ficheiro = dados.sources?.file || (Array.isArray(dados.sources) ? dados.sources[0]?.file : null);
if (ficheiro) L(true, "4. vídeo em claro (sem cifra)", ficheiro);
else if (dados.enc) {
  try {
    const d = crypto.createDecipheriv("aes-256-cbc", I(CHAVE, 32), I(IV, 16));
    const claro = JSON.parse(Buffer.concat([d.update(deB64Url(dados.enc)), d.final()]).toString("utf8"));
    ficheiro = claro.file; L(!!ficheiro, "4. decifrar `enc` com a chave do código", ficheiro || JSON.stringify(claro));
  } catch (e) {
    L(false, "4. decifrar `enc` com a chave do código", `${e.message} → A CHAVE/IV MUDARAM`);
    const { r: rj } = await pedir(`${BASE}/lib/newclient.min.js`, { Referer: BASE + "/" });
    const js = rj ? await rj.text() : "";
    const i = js.indexOf("__MegaPlayCfg");
    console.log(i >= 0 ? "   trecho de newclient.min.js:\n" + js.slice(Math.max(0, i - 150), i + 450) : "   __MegaPlayCfg não existe em newclient.min.js");
    process.exit(1);
  }
} else { L(false, "4. vídeo", "nem `sources` nem `enc` na resposta"); process.exit(1); }

for (const [nome, h] of [["só Referer", { Referer: BASE + "/" }], ["Referer + Origin", { Referer: BASE + "/", Origin: BASE }]]) {
  ({ r, erro } = await pedir(ficheiro, h));
  if (erro) { L(false, `5. playlist (${nome})`, erro); continue; }
  const pl = await r.text();
  L(r.ok && pl.startsWith("#EXTM3U"), `5. playlist (${nome})`, `HTTP ${r.status}, ${pl.length} bytes`);
  const sub = pl.split("\n").find((l) => l && !l.startsWith("#"));
  if (r.ok && sub) {
    const { r: r2, erro: e2 } = await pedir(new URL(sub, ficheiro).toString(), h);
    L(!e2 && r2.ok, `6. 1.º item da playlist (${nome})`, e2 || `HTTP ${r2.status}, ${r2.headers.get("content-type")}`);
  }
}
