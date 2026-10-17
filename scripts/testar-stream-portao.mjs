// O PORTAO DOS TORRENTS: `/api/stream` deixou de ser um portal aberto.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **So' entra um torrent que a busca deu.** Nao pela forma do hash (isso e' o
// filtro) — pelo facto de o hash ter vindo do `/torrents` (isso e' o portao).
//
// Antes, `/api/stream/<o-que-quisesse>` aceitava o parametro cru e metia-o
// num `magnet:?xt=urn:btih:<parametro>`. Isso dava tres coisas de graca:
//   - qualquer pessoa mandava o servidor descargar o torrent que quisesse
//     (largura de banda e disco de um alojamento gratis);
//   - um `&tr=` codificado no URL entrava no magnet como tracker;
//   - um `&ws=` como servidor WebSocket.
//
// E o `/stream/active` era publico: qualquer pessoa sabia o que toda a gente
// estava a ver. O `DELETE` tambem: dava para matar as descargas dos outros.
//
// Este teste arranca o servidor DE VERDADE e faz-lhe os pedidos. Nao le o
// codigo para ver se a expressao parece certa — le o que o servidor responde.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
// Import ESTATICO e relativo: um `import()` com caminho absoluto do Windows da'
// `ERR_UNSUPPORTED_ESM_URL_SCHEME` (o loader so aceita `file:`), que e' o que
// acontecem se tentar montar o URL a mao.
import {
  infoHashValido,
  magnetConhecido,
  rememberMagnet,
} from "../server/src/services/torrentEngine.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// ---------------------------------------------------------------------------
// 1) A forma do hash — a parte pura, sem rede
// ---------------------------------------------------------------------------
console.log("");
console.log("  1) a forma do hash");

ok_("um infoHash de verdade (40 hex) passa",
  infoHashValido("0123456789abcdef0123456789abcdef01234567"));
ok_("maiusculas tambem (o frontend pode mandar assim)",
  infoHashValido("0123456789ABCDEF0123456789ABCDEF01234567"));

// **O caso que interessa**: sem isto, um parametro com `&tr=` ou `&ws=` dentro
// entrava no magnet. E' a razao de a forma ser verificada ANTES de tocar em
// qualquer cache.
const injecoes = [
  "0123456789abcdef0123456789abcdef01234567&tr=http://exemplo/x",
  "0123456789abcdef0123456789abcdef01234567&ws=exemplo",
  "0123456789abcdef0123456789abcdef01234567#f",
  "..%2f..%2fetc%2fpasswd",
];
for (const inj of injecoes) {
  ok_("rejeita a injeccao: " + inj.slice(0, 46), !infoHashValido(inj));
}
for (const caico of ["", "abc", "g".repeat(40), "0".repeat(39), "0".repeat(41), null, undefined, 123]) {
  ok_("rejeita: " + JSON.stringify(caico), !infoHashValido(caico));
}

// ---------------------------------------------------------------------------
// 2) A origem do hash — a parte que fecha o portal
// ---------------------------------------------------------------------------
console.log("");
console.log("  2) so' passa o que a busca deu");
ok_("um hash com a forma certa, mas que ninguem pediu, NAO passa",
  !magnetConhecido("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  "e' o caso do portal de torrents");

const hashBom = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
ok_("antes de o registar, tambem nao passa", !magnetConhecido(hashBom));
rememberMagnet(hashBom, "magnet:?xt=urn:btih:" + hashBom + "&tr=http://exemplo/t");
ok_("depois de o registar, passa", magnetConhecido(hashBom));
ok_("e nao passa noutro com a forma certa", !magnetConhecido("cccccccccccccccccccccccccccccccccccccccc"));
// A forma tem de continuar a contar: registar um hash invalido nao o torna bom.
rememberMagnet("nao-e-um-hash", "magnet:?xt=urn:btih:lixo");
ok_("registar um hash mal formado nao o torna conhecido", !magnetConhecido("nao-e-um-hash"));
// Minusculas: o motor trabalha em minusculas, e o frontend pode mandar maiusculas.
rememberMagnet("DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "magnet:?xt=urn:btih:x");
ok_("o registo e' insensivel a maiusculas (como o motor)",
  magnetConhecido("dddddddddddddddddddddddddddddddddddddddd"));

// ---------------------------------------------------------------------------
// 3) O cache nao cresce sem teto
// ---------------------------------------------------------------------------
console.log("");
console.log("  3) o cache dos magnets tem tecto");
{
  const antes = fs.readFileSync(path.join(RAIZ, "server", "src", "services", "torrentEngine.js"), "utf8");
  const temTecto = /MAGNET_CACHE_MAX/.test(antes);
  ok_("ha um limite declarado", temTecto);
  const limite = Number((antes.match(/MAGNET_CACHE_MAX = (\d+)/) || [])[1]);
  ok_("e um numero usavel (nao `Infinity`, nao 0)", Number.isFinite(limite) && limite > 0 && limite < 100000,
    String(limite));
  // Enche-o a serio e confirma que nao cresce sem limite. 2100 entradas e'
  // acima do tecto de 2000: e' o teste que um `while` mal escrito falha.
  const ITENS = 2100;
  for (let n = 0; n < ITENS; n++) {
    rememberMagnet(n.toString(16).padStart(40, "0"), "magnet:?xt=urn:btih:" + n);
  }
  ok_("as primeiras entradas sao as que saem", !magnetConhecido(hashBom),
    "deviam ter saido do cache: entrou uma a serio depois delas");
  ok_("as ultimas continuam la", magnetConhecido((ITENS - 1).toString(16).padStart(40, "0")));
}

// ---------------------------------------------------------------------------
// 4) O servidor DE VERDADE
// ---------------------------------------------------------------------------
console.log("");
console.log("  4) o que o servidor responde mesmo");

const PORTA = 5400 + (process.pid % 90);
const dbDir = fs.mkdtempSync(path.join(RAIZ, "..", "meida-test-stream-"));
const { spawn } = await import("node:child_process");
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
const mortes = [];
filho.on("exit", (codigo) => { if (codigo !== 0 && !filho.saiuLimpo) mortes.push(codigo); });

try {
  // Espera pelo /api/health. Se o processo morrer, diz isso — em vez de
  // esperar pelo timeout e reportar tudo como falha sem dizer porquê.
  let acordou = false;
  for (let n = 0; n < 60 && !acordou; n++) {
    if (filho.saiuLimpo) break;
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(1000) });
      acordou = r.ok;
    } catch { /* ainda nao esta' a la */ }
    if (!acordou) await new Promise((r) => setTimeout(r, 250));
  }
  ok_("o servidor arranca e responde a /api/health", acordou, mortes.length ? "o processo morreu com " + mortes[0] : "");

  if (acordou) {
    const pedir = (p, opcoes = {}) =>
      fetch(`http://127.0.0.1:${PORTA}${p}`, { signal: AbortSignal.timeout(8000), ...opcoes });

    // O que o relatório diz que estava aberto, uma coisa de cada vez.
    const semToken = (p, nome, opcoes = {}) =>
      pedir(p, opcoes).then((r) => ok_(nome, r.status === 401, "respondeu " + r.status));

    console.log("");
    console.log("  5) o que antes era publico e devia pedir login");
    await semToken("/api/stream/active", "`/stream/active` exige login (dava para ver o que toda a gente via)");
    await semToken("/api/torrents?type=movie&imdb=tt0137523", "`/torrents` exige login (dava para gastar a busca de toda a gente)");
    await semToken(
      "/api/stream/" + encodeURIComponent(hashBom),
      "`DELETE /stream/:hash` exige login (dava para matar as descargas)",
      { method: "DELETE" }
    );
    // Confirma que o metodo conta: o mesmo caminho em GET tem de ser diferente.
    const emGet = await pedir("/api/stream/active");
    ok_("o `GET /stream/active` e' o que exige login, nao a rota toda",
      emGet.status === 401, "status " + emGet.status);

    console.log("");
    console.log("  6) o video tem de continuar a dar (e a parar injections)");
    // O `<video src>` nao leva o Authorization. Se isto exigisse login, o
    // video deixava de reproduzir e nao havia teste que salvasse.
    const injecao = await pedir("/api/stream/" + encodeURIComponent("0123456789abcdef0123456789abcdef01234567&tr=http://exemplo/x"));
    ok_("um `&tr=` no URL da' 400, nao 500", injecao.status === 400, "status " + injecao.status);

    const fora = await pedir("/api/stream/naoeumhash");
    ok_("um hash mal formado da' 400", fora.status === 400, "status " + fora.status);

    // Hash com a forma certa mas que ninguem pediu. Aqui o que tem de
    // responder e' 404 (nao esta' no cache), e nao 401 — porque este pedido
    // genuinamente nao pode levar token.
    const desconhecido = await pedir("/api/stream/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    ok_("um hash de 40 hex que ninguem pediu da' 404, nao 401",
      desconhecido.status === 404, "status " + desconhecido.status);
    const corpo = await desconhecido.json().catch(() => ({}));
    ok_("e a mensagem explica que se procure outra vez",
      /pesquisa/i.test(corpo.error || ""), JSON.stringify(corpo));
  }
} finally {
  filho.saiuLimpo = true;
  filho.kill();
  try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch { /* ja foi */ }
}

ok_("o servidor nao morreu a meio do teste", mortes.length === 0, mortes.join(", "));

// ---------------------------------------------------------------------------
// 7) O frontend: o botao de parar tem de levar o token
// ---------------------------------------------------------------------------
console.log("");
console.log("  7) o frontend nao volta a mentir sobre o \"parar\"");
{
  const VP = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "VideoPlayer.jsx"), "utf8");
  const CLI = fs.readFileSync(path.join(RAIZ, "web", "src", "api", "client.js"), "utf8");

  ok_("o `api` expoe `stopTorrent`", /stopTorrent:/.test(CLI));
  ok_("**e usa `del`** (que manda o `Authorization`), nao `get` ou `post`",
    /stopTorrent: \(infoHash\) => del\(/.test(CLI), "sem token: o servidor responde 401");
  ok_("o `del` do cliente manda o cabecalho de autenticacao",
    /method: "DELETE", headers: authHeaders\(\)/.test(CLI));

  ok_("o `VideoPlayer` usa o cliente em vez de `fetch` cru",
    /api\s*\n?\s*\.stopTorrent\(infoHash\)/.test(VP));
  ok_("**nao ha `fetch(..., { method: \"DELETE\" })` cru**",
    !/method:\s*"DELETE"/.test(VP),
    "sem o cabecalho de autenticacao: o botao parava de funcionar");
  // A mentira silenciosa: o `onRemoved` no `finally` corria mesmo com o 401.
  const corpo = VP.slice(VP.indexOf("const stop ="), VP.indexOf("const stop =") + 900);
  ok_("`onRemoved()` so' corre depois do servidor dizer que parou",
    /\.then\(\(\) => \{[\s\S]{0,200}onRemoved/.test(corpo) && !/finally\([\s\S]{0,200}onRemoved/.test(corpo),
    "no `finally`, o botao diz \"parado\" com o torrent ainda a descarregar");
  ok_("o erro do `DELETE` e' mostrado em vez de engolido",
    /\.catch\(\(e\) => [\s\S]{0,800}setErroParar/.test(corpo));
  // A prova de que o `catch` nao e' vazio esta acima: chama `setErroParar`.
  // (O comentario dentro deste proprio `catch` contem literalmente
  // `catch(() => {})`, e uma regex que procurasse esse padrao daria falso
  // positivo nesse comentario — na confio nela.)

}
// ---------------------------------------------------------------------------
console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);