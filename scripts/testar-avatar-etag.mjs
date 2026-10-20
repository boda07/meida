// O ETag do avatar era `avatar.length`.
//
// Dois emojis diferentes tem o mesmo `length` (medido: "emoji:😀" e "emoji:😁"
// dao ambos 8), portanto o ETag nao mudava quando o avatar mudava. O `res.json`
// do Express trata o `If-None-Match` sozinho, pelo que o cliente revalidava,
// levava **304** e ficava com o avatar antigo indefinidamente.
//
// **Este teste tem de usar HTTP CRU, nunca `fetch`.** O `fetch` do Node (undici)
// manda `cache-control: no-cache` por omissao e o pacote `fresh` do Express
// devolve `false` nesse caso (por desenho, para suportar reload end-to-end): com
// `fetch` nenhuma revalidacao chegava a dar 304 e o bug parecia nao existir. Foi
// o que aconteceu na primeira reproducao deste bug.
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

const RAIZ = process.cwd();
const PORTA = 5880 + (process.pid % 40);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// Cabecalhos minimos e explicitos: e' um browser a revalidar, nao o fetch do Node.
function pedir(caminho, cabecalhos = {}, metodo = "GET", corpo = null) {
  return new Promise((res, recusa) => {
    const dados = corpo === null ? null : Buffer.from(corpo);
    const cab = { ...cabecalhos, host: `127.0.0.1:${PORTA}`, connection: "close" };
    if (dados) cab["content-type"] = "application/json";
    if (dados) cab["content-length"] = dados.length;
    const r = http.request({ host: "127.0.0.1", port: PORTA, path: caminho, method: metodo, headers: cab }, (resp) => {
      let txt = "";
      resp.on("data", (d) => (txt += d));
      resp.on("end", () => res({ status: resp.statusCode, cabecalhos: resp.headers, corpo: txt }));
    });
    r.on("error", recusa);
    if (dados) r.write(dados);
    r.end();
  });
}

// Um 304 nao tem corpo, e `JSON.parse("")` atira — o que matava o teste a meio
// em vez de reportar a falha (foi o que aconteceu com as mutacoes M1 e M4).
const lerAvatar = (corpo) => {
  try { return JSON.parse(corpo || "{}").avatar; } catch { return null; }
};

const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-avatar-"));
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: "teste-avatar" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));

try {
  let pronto = false;
  for (let i = 0; i < 120 && !pronto; i++) {
    try { const r = await pedir("/api/health"); if (r.status === 200) pronto = true; }
    catch { await dormir(150); }
  }
  ok_("o servidor arrancou", pronto, saida.slice(-400));

  if (pronto) {
    const nome = "avatar_et" + Math.random().toString(36).slice(2, 6) + "_u";
    const senha = "senha-correta-123";
    const reg = await pedir("/api/auth/register", {}, "POST", JSON.stringify({ username: nome, password: senha }));
    const { token, user } = JSON.parse(reg.corpo);
    const id = user.id;
    const porAvatar = (valor) =>
      pedir("/api/auth/profile", { authorization: "Bearer " + token }, "PATCH", JSON.stringify({ avatar: valor }));
    const avatar = (cab = {}) => pedir(`/api/users/${id}/avatar`, cab);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  1) dois valores com o MESMO comprimento dao ETags diferentes");
    const A = "emoji:\u{1F600}"; // 😀
    const B = "emoji:\u{1F601}"; // 😁
    ok_("os dois valores tem o mesmo length (e' o que enganava)", A.length === B.length, `${A.length} vs ${B.length}`);
    ok_("e sao valores diferentes", A !== B);

    await porAvatar(A);
    const a = await avatar();
    await porAvatar(B);
    const b = await avatar();
    ok_("os ETags sao diferentes: " + a.cabecalhos.etag + " vs " + b.cabecalhos.etag,
      a.cabecalhos.etag !== b.cabecalhos.etag);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  2) revalidar com o ETag ANTIGO devolve 200 com o valor NOVO");
    const rev = await avatar({ "if-none-match": a.cabecalhos.etag });
    ok_("status 200 (antes dava 304)", rev.status === 200, "status " + rev.status);
    ok_("e o corpo e' o avatar novo", lerAvatar(rev.corpo) === B, rev.corpo);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  3) mas o caching continua a funcionar: ETag certo -> 304");
    const certo = await avatar({ "if-none-match": b.cabecalhos.etag });
    ok_("com o ETag actual, 304", certo.status === 304, "status " + certo.status);
    ok_("e sem corpo", (certo.corpo === "" || certo.corpo === undefined), JSON.stringify(certo.corpo));

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  4) o Cache-Control nao promete um dia sem revalidar");
    const cc = b.cabecalhos["cache-control"] || "";
    ok_("tem must-revalidate", /must-revalidate/.test(cc), cc);
    ok_("tem max-age=300", /max-age=300/.test(cc), cc);
    ok_("NAO tem immutable", !/immutable/.test(cc), cc);
    ok_("e continua publico", /public/.test(cc), cc);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  5) o ETag e' mesmo o SHA-1 do valor");
    const esperado = '"' + createHash("sha1").update(B).digest("base64") + '"';
    ok_("bater com sha1(valor): " + esperado, b.cabecalhos.etag === esperado, b.cabecalhos.etag);
    const esperadoA = '"' + createHash("sha1").update(A).digest("base64") + '"';
    ok_("e o do valor anterior tambem", a.cabecalhos.etag === esperadoA, a.cabecalhos.etag);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  6) valores de comprimento diferente (o caso que ja funcionava)");
    await porAvatar("emoji:\u{1F600}x");
    const c = await avatar();
    ok_("ETag diferente do de B", c.cabecalhos.etag !== b.cabecalhos.etag);
    const revC = await avatar({ "if-none-match": b.cabecalhos.etag });
    ok_("e revalidar com o de B da 200", revC.status === 200, "status " + revC.status);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  7) data URL grande (o caso em que o SHA-1 custava ~6 ms)");
    const grande = "data:image/png;base64," + "A".repeat(300 * 1024);
    const t0 = Date.now();
    await porAvatar(grande);
    const g = await avatar();
    const t1 = Date.now();
    await avatar();
    const t2 = Date.now();
    ok_("ETag do avatar grande: " + g.cabecalhos.etag.slice(0, 20) + "...", /^[A-Za-z0-9+/=]+$/.test(g.cabecalhos.etag.replace(/"/g, "")));
    ok_("revalidar com ele da 304 (o valor nao mudou)", (await avatar({ "if-none-match": g.cabecalhos.etag })).status === 304);
    // A segunda vez tem de vir do memo: o `===` de uma string de 300 KB e' imediato.
    ok_("a segunda leitura e' mais rapida que a primeira (memo)", t2 - t1 < Math.max(1, t1 - t0),
      `1a ${t1 - t0} ms, 2a ${t2 - t1} ms`);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  8) sem avatar da 404 (e nao um ETag de nada)");
    await porAvatar("");
    ok_("avatar vazio -> 404", (await avatar()).status === 404, "status " + (await avatar()).status);

    // -----------------------------------------------------------------------
    console.log("");
    console.log("  9) o ETag e' o mesmo em pedidos repetidos (memo coerente)");
    await porAvatar(B);
    const m1 = await avatar();
    const m2 = await avatar();
    const m3 = await avatar();
    ok_("tres pedidos seguidos dao o mesmo ETag",
      m1.cabecalhos.etag === m2.cabecalhos.etag && m2.cabecalhos.etag === m3.cabecalhos.etag);
    ok_("e igual ao sha1 do valor", m1.cabecalhos.etag === esperado);
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