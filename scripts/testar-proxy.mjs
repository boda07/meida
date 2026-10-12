// Teste do `/api/proxy`: o que o proxy RESPONDE tem de bater certo com o que
// o site de cima respondeu.
//
// O bug que apanha: o ramo das playlists reescrevia o texto mas nao copiava o
// `status`. Um 404 do fornecedor voltava como 200, com a pagina de erro do site
// aos bocados "como playlist" — e o `hls.js` aceitava aquilo em silencio em vez
// de dizer que o episodio nao existe.
//
// O teste chama o `handleProxy` com `req`/`res` falsos (nao ha' porque levantar
// o Express), mas o site de cima e' um servidor HTTP a serio: e' o status real
// que interessa.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD = path.join(RAIZ, "server", "src", "services", "proxy.js");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) {
    ok++;
    console.log("  OK    " + nome);
  } else {
    falhou++;
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
  }
}

const { handleProxy } = await import(
  "file:///" + MOD.replace(/\\/g, "/") + "?v=" + Date.now()
);

// ---- o site de cima --------------------------------------------------------
// `/bom.m3u8` responde 200 com uma playlist de verdade; `/falso.m3u8` responde
// 404 com a pagina de erro do site (HTML, como os sites de video devolvem).
const CIMA = http.createServer((req, res) => {
  if (req.url === "/bom.m3u8") {
    res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
    res.end("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nbaixo.m3u8\n");
  } else if (req.url === "/falso.m3u8") {
    res.writeHead(404, { "content-type": "text/html" });
    res.end("<html><body>Error - MegaPlay</body></html>");
  } else if (req.url === "/proibido.m3u8") {
    res.writeHead(403, { "content-type": "application/vnd.apple.mpegurl" });
    res.end("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nproibido720.m3u8\n");
  } else {
    res.writeHead(500);
    res.end("erro interno");
  }
});
await new Promise((r) => CIMA.listen(0, "127.0.0.1", r));
const porta = CIMA.address().port;
// O `unref` e' para o servidor de teste NAO segurar o event loop: nas
// sub-testes de mutacao o `process.exit` da cauda acontece com o servidor ainda
// aberto, e sem isto o Node rebenta com "Assertion failed: !(handle->flags &
// UV_HANDLE_CLOSING)" ao sair. Era o teste que rebentava, nao o codigo.
CIMA.unref();

// ---- chamar o handler com req/res falsos -----------------------------------
async function perguntar(caminho, extra = {}) {
  const alvo = `http://127.0.0.1:${porta}${caminho}`;
  const req = { query: { url: alvo, ref: "https://megaplay.buzz/", ...extra }, headers: {} };
  // O que o Express faria por omissao: 200. E' exactamente o que o bug
  // devolvia num 404 — por isso o teste pega nele.
  const r = { estado: 200, corpo: undefined, cabecalhos: {} };
  const cab = r.cabecalhos;
  await handleProxy(req, {
    status: (n) => { r.estado = n; return this; },
    setHeader: (k, v) => { cab[k.toLowerCase()] = v; return this; },
    json: (c) => { r.corpo = c; return this; },
    send: (c) => { r.corpo = c; return this; },
    pipe: () => r,
    set: () => r,
    end: () => r,
  });
  return { estado: r.estado, corpo: r.corpo === undefined ? null : String(r.corpo), cabecalhos: cab };
}

console.log("");
console.log("  1) O status do site de cima vem connosco");
{
  const bom = await perguntar("/bom.m3u8");
  ok_("uma playlist que existe responde 200", bom.estado === 200, "veio " + bom.estado);

  const falso = await perguntar("/falso.m3u8");
  // ESTE e' o bug. Antes devolvia 200.
  ok_("uma playlist que NAO existe responde 404 (nao 200)", falso.estado === 404, "veio " + falso.estado);

  const proibido = await perguntar("/proibido.m3u8");
  ok_("uma playlist proibida responde 403 (nao 200)", proibido.estado === 403, "veio " + proibido.estado);
}

console.log("");
console.log("  2) O 404 nao e' servido como se fosse uma playlist");
{
  const falso = await perguntar("/falso.m3u8");
  ok_("o corpo do erro nao virou uma playlist", !/EXT-X-STREAM-INF/.test(falso.corpo), falso.corpo.slice(0, 90));
  ok_("o corpo do erro nao foi todo reescrito para /api/proxy", !/api\/proxy\?url=http/.test(falso.corpo), falso.corpo.slice(0, 90));
}

console.log("");
console.log("  3) A playlist a serio continua a ser reescrita");
{
  const bom = await perguntar("/bom.m3u8");
  ok_("o content-type e' o de playlist", /mpegurl/.test(bom.cabecalhos["content-type"] || ""), bom.cabecalhos["content-type"]);
  ok_("as linhas # continuam intactas", bom.corpo.startsWith("#EXTM3U"));
  ok_("a variante passa a apontar para o /api/proxy", bom.corpo.includes("/api/proxy?url="));
  ok_("o referer e' preservado no proxy", bom.corpo.includes("ref="));
  ok_("o CORS e' liberado", (bom.cabecalhos["access-control-allow-origin"] || "") === "*");
}

console.log("");
console.log("  4) Um 404 tem de ser dito logo, nao mais tarde");
{
  // Um 200 com texto de erro faria o `hls.js` aceitar a "playlist" e falhar
  // muito mais tarde, sem dizer nada. Um 404 e' dito logo — e' a razao do bug.
  const falso = await perguntar("/falso.m3u8");
  ok_("nao ha' nenhum caminho que transforme um 404 em 200", falso.estado === 404, "veio " + falso.estado);
}

/* ---------- MUTACOES ---------- */

console.log("");
console.log("  MUTACOES (partir o codigo de proposito)");

// O quarto campo: o texto a procurar tem de ser EXATAMENTE como esta no
// ficheiro, com a mesma indentacao — por isso esta string e' o que torna a
// mutacao aplicavel (ou nao) e o harness avisa quando nao aplica.
const MUTACOES = [
  [
    "o status do site de cima e' ignorado nas playlists (o bug)",
    "    res.status(upstream.status);\n\n    // E um erro NAO se reescreve",
    "    // E um erro NAO se reescreve",
  ],
  [
    "o status e' forcado a 200",
    "    res.status(upstream.status);\n\n    // E um erro NAO se reescreve",
    "    res.status(200);\n\n    // E um erro NAO se reescreve",
  ],
  [
    "a pagina de erro volta a ser reescrita 'como playlist'",
    "    if (!upstream.ok) {",
    "    if (false) {",
  ],
];

const CAUDA = `
console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);
`;

// Normaliza as quebras de linha. O `proxy.js` esta' em CRLF e as strings de
// mutacao acima estao escritas com `\n` — sem isto nenhuma das duas aplicava e
// o harness/reportava "mutacao nao aplica" (que e' uma FALHA, para nao passar
// despercebido). A copia mutada sai com LF, o que ao Node tanto lhe faz.
const original = fs.readFileSync(MOD, "utf8").replace(/\r\n/g, "\n");

for (const [nome, de, para] of MUTACOES) {
  if (!original.includes(de)) {
    ok_("MUTACAO " + nome + " (o codigo mudou, a mutacao nao aplica)", false);
    continue;
  }

  // A pasta tem de ficar AO LADO do original: o `proxy.js` importa `./legendas.js`,
  // que por sua vez importa o pacote `subtitle` de `server/node_modules`. Com a
  // pasta fora do repo, o sub-teste rebentava com "Cannot find package" e o
  // harness dizia "mutacao nao apanhada" sem ser verdade.
  const dirMut = fs.mkdtempSync(path.join(RAIZ, "server", "src", "services", ".mutproxy-"));
  const modMut = path.join(dirMut, "proxy.js");
  fs.writeFileSync(modMut, original.replace(de, para));
  fs.copyFileSync(path.join(RAIZ, "server", "src", "services", "legendas.js"), path.join(dirMut, "legendas.js"));

  const testeMut = path.join(dirMut, "t.mjs");
  const corpo = fs
    .readFileSync(path.join(RAIZ, "scripts", "testar-proxy.mjs"), "utf8")
    .split("/* ---------- MUTACOES ---------- */")[0]
    .replace(/const RAIZ = [^\n]+;/, "const RAIZ = " + JSON.stringify(RAIZ) + ";")
    .replace(/const MOD = [^\n]+;/, "const MOD = " + JSON.stringify(modMut) + ";");
  fs.writeFileSync(testeMut, corpo + CAUDA);

  const r = spawnSync(process.execPath, [testeMut], { encoding: "utf8" });
  const saida = (r.stdout || "") + (r.stderr || "");
  const apanhou = r.status !== 0 && /FALHA/.test(saida);
  ok_("MUTACAO apanhada: " + nome, apanhou);
  if (!apanhou) {
    console.log(
      "        (status " + r.status + ") " +
        saida.split(/\r?\n/).filter((l) => l.includes("FALHA")).slice(0, 3).join(" | ").slice(0, 170)
    );
  }
  fs.rmSync(dirMut, { recursive: true, force: true });
}

CIMA.close();
console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);