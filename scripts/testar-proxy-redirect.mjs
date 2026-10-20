// O proxy devolvia um 302 SEM `Location` ao cliente.
//
// `redirect: "manual"` (posto na 1.5.5 para travar o SSRF) nao seguia o
// redirecionamento, e a resposta so' copiava content-type/length/range/
// accept-ranges — sem `Location`. O cliente ficava com um 302 sem destino:
// qualquer provider que redirecione a playlist ou os segmentos deixava de dar
// video.
//
// A correccao segue os saltos UM A UM, passando cada destino por `alvoSeguro`.
// Este teste prova as duas metades: que os redirecionamentos passam a ser
// seguidos, e que o SSRF nao voltou com essa porta aberta.
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const SEGREDO = "teste-redirect-13579";
process.env.MEIDA_PROXY_SECRET = SEGREDO;
// Os ganchos de teste do `proxy.js` so' funcionam com `NODE_ENV=test` (2026-10-19):
// atiram em vez de desligar a seguranca em silencio.
process.env.NODE_ENV = "test";
// Importado de uma pasta ao lado da original: o `proxy.js` importa `./legendas.js`.
const { handleProxy, buildProxyUrl, __permitirHostsNoTeste } = await import(
  pathToFileURL(path.join(RAIZ, "server", "src", "services", "proxy.js")).href
);
// O upstream deste teste vive em `localhost`, que o filtro passa a bloquear
// (bem: resolve para 127.0.0.1 e ::1). So' `localhost` entra na lista — o
// `127.0.0.1` para onde o upstream manda redirigir NAO entra, e e' por isso que
// a seccao 4 continua a provar que cada salto e' revalidado.
__permitirHostsNoTeste(["localhost"]);

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// ---- o upstream -------------------------------------------------------------
const pedidos = [];
let laco = 0;
let portaInterna = 0;
const servidor = http.createServer((req, res) => {
  pedidos.push(req.url);
  const u = new URL(req.url, "http://localhost");
  switch (u.pathname) {
    case "/redirect.m3u8":
      res.writeHead(302, { Location: "/final.m3u8" });
      return res.end();
    case "/final.m3u8":
      res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
      return res.end("#EXTM3U\n#EXTINF:4,\nseg1.ts\n");

    // Redireccionamento que MUDA O DIRECTORIO: e' o que prova que a base da
    // reescrita e' o URL final e nao o que veio no pedido. Se fosse o pedido,
    // `seg1.ts` viria `/antigo/seg1.ts` em vez de `/novo/dir/seg1.ts`.
    case "/antigo/play":
      res.writeHead(302, { Location: "/novo/dir/final.m3u8" });
      return res.end();
    case "/novo/dir/final.m3u8":
      res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
      return res.end("#EXTM3U\n#EXTINF:4,\nseg1.ts\n");

    // Tres saltos, com um URL sem extensao no fim: o `isPlaylist` tambem tem de
    // olhar para o URL final.
    case "/a": res.writeHead(302, { Location: "/b" }); return res.end();
    case "/b": res.writeHead(302, { Location: "/c" }); return res.end();
    case "/c":
      res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
      return res.end("#EXTM3U\n#EXTINF:4,\nx.ts\n");

    // Video normal (nao e' playlist).
    case "/video":
      res.writeHead(302, { Location: "/video-final.mp4" });
      return res.end();
    case "/video-final.mp4":
      res.writeHead(200, { "content-type": "video/mp4", "content-length": "5" });
      return res.end("hello");

    // Legendas.
    case "/legendas.vtt":
      res.writeHead(302, { Location: "/legendas-final.vtt" });
      return res.end();
    case "/legendas-final.vtt":
      res.writeHead(200, { "content-type": "text/vtt" });
      return res.end("WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nOla\n");

    // SSRF: um IP literal bloqueado.
    case "/para-interno":
      res.writeHead(302, { Location: `http://127.0.0.1:${portaInterna}/segredo` });
      return res.end();

    // SSRF: endereco de metadados da nuvem.
    case "/para-metadados":
      res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
      return res.end();

    // Laco infinito. O upstream so redireciona 20 vezes: sem este tecto, um
    // proxy com o limite de saltos partido fica a pedir de uma vez para sempre
    // e o TESTE PENDA (foi o que aconteceu na mutacao M5) em vez de falhar.
    // Com o limite certo, o proxy desiste aos 5 e responde 502; com o limite
    // partido, acaba por receber este 200 e a verificacao falha na mesma.
    case "/laco-a":
    case "/laco-b": {
      laco++;
      if (laco > 20) { res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" }); return res.end("#EXTM3U\n"); }
      const outro = u.pathname === "/laco-a" ? "/laco-b" : "/laco-a";
      res.writeHead(302, { Location: outro });
      return res.end();
    }

    // 3xx sem destino: nao ha nada a seguir.
    case "/sem-destino":
      res.writeHead(302);
      return res.end();

    default:
      res.writeHead(404); return res.end("nao");
  }
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
servidor.unref();
const porta = servidor.address().port;

// Para o teste de SSRF: um sitio que, se for buscado, regista o pedido.
const interno = http.createServer((req, res) => {
  pedidos.push("INTERNO " + req.url);
  res.writeHead(200); res.end("segredo");
});
await new Promise((r) => interno.listen(0, "127.0.0.1", r));
interno.unref();
portaInterna = interno.address().port;

// ---- chamar o handler com req/res falsos ------------------------------------
// `status`/`setHeader` devolvem o proprio objeto (e' o que o Express faz). Com
// `return this` numa arrow function, `this` e' `undefined` no modulo e o
// `res.status(403).json(...)` rebenta — foi o que aconteceu na primeira
// simulacao deste bug.
function resFalso(r) {
  const cab = r.cabecalhos;
  const res = {
    status(n) { r.estado = n; return res; },
    setHeader(k, v) { cab[k.toLowerCase()] = v; return res; },
    json(c) { r.corpo = c; return res; },
    send(c) { r.corpo = c; return res; },
    write() { return res; },
    pipe() { return res; },
    set() { return res; },
    end() { return res; },
  };
  return res;
}

async function perguntar(url) {
  // URL assinado pela via de producao, com a seguranca LIGADA (por isso o
  // teste de SSRF abaixo e' real, e nao desligado pelo modo de teste).
  const completo = new URL("http://x" + buildProxyUrl(url, "https://megaplay.buzz/"));
  const req = { query: Object.fromEntries(completo.searchParams), headers: {} };
  req.on = () => req;
  const r = { estado: 200, corpo: undefined, cabecalhos: {} };
  await handleProxy(req, resFalso(r));
  return { estado: r.estado, corpo: r.corpo === undefined ? null : r.corpo, cabecalhos: r.cabecalhos };
}
// `res.json({ error })` guarda um OBJETO. Converter com String() dava
// "[object Object]" e as tres verificacoes de mensagem falhavam sem o codigo
// ter nada de errado.
const msg = (r) => (typeof r.corpo === "string" ? r.corpo : (r.corpo && r.corpo.error) || "");
const BASE = `http://localhost:${porta}`;

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) um 302 do upstream deixa de ser um beco sem saida");
{
  const r = await perguntar(`${BASE}/redirect.m3u8`);
  ok_("responde 200 (antes 302)", r.estado === 200, "veio " + r.estado);
  ok_("e traz o conteudo da playlist", (r.corpo || "").includes("#EXTM3U"), JSON.stringify((r.corpo || "").slice(0, 60)));
  ok_("o 302 nao chega ao cliente sem Location", !(r.estado >= 300 && r.estado < 400), "estado " + r.estado);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  2) os URLs relativos resolvem contra o URL FINAL, nao o pedido");
{
  const r = await perguntar(`${BASE}/antigo/play`);
  ok_("responde 200", r.estado === 200, "veio " + r.estado);
  const reescrito = r.corpo || "";
  ok_("o segmento aponta para /novo/dir/seg1.ts",
    reescrito.includes(encodeURIComponent("/novo/dir/seg1.ts")), reescrito.slice(0, 160));
  ok_("e NAO para /antigo/seg1.ts (a base antiga)",
    !reescrito.includes(encodeURIComponent("/antigo/seg1.ts")), "resolveu contra o pedido");
  ok_("e o segmento vai assinado pelo proxy",
    /\/api\/proxy\?url=/.test(reescrito) && /sig=[0-9a-f]{64}/.test(reescrito), reescrito.slice(0, 160));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  3) varios saltos, e um URL final sem extensao no pedido");
{
  const r = await perguntar(`${BASE}/a`);
  ok_("tres saltos chegam a 200", r.estado === 200, "veio " + r.estado);
  ok_("e a playlist final foi reescrita", /\/api\/proxy\?url=/.test(r.corpo || ""), JSON.stringify((r.corpo || "").slice(0, 80)));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  4) SSRF: cada salto e' revalidado (isto e' o que nao pode ceder)");
{
  const antes = pedidos.filter((p) => p.startsWith("INTERNO")).length;
  const r = await perguntar(`${BASE}/para-interno`);
  ok_("redirecionar para 127.0.0.1 da 403", r.estado === 403, "veio " + r.estado);
  const depois = pedidos.filter((p) => p.startsWith("INTERNO")).length;
  ok_("e o destino NAO foi buscado", depois === antes, "foi buscado " + (depois - antes) + " vez(es)");
  ok_("e o erro diz que foi um redirecionamento", /redirecionamento bloqueado/.test(msg(r)), msg(r));
}
{
  const r = await perguntar(`${BASE}/para-metadados`);
  ok_("redirecionar para 169.254.169.254 da 403", r.estado === 403, "veio " + r.estado);
  ok_("e o corpo menciona o endereco interno", /endereco interno/.test(msg(r)), msg(r));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  5) laco de redirecionamentos nao corre para sempre");
{
  const r = await perguntar(`${BASE}/laco-a`);
  ok_("da 502 em vez de ficar pendurado", r.estado === 502, "veio " + r.estado);
  ok_("e diz que foram demasiados", /demasiados redirecionamentos/.test(msg(r)), msg(r));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  6) um 3xx sem Location e' devolvido tal e qual (nao ha nada a fazer)");
{
  const r = await perguntar(`${BASE}/sem-destino`);
  ok_("devolve o 302 do upstream", r.estado === 302, "veio " + r.estado);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  7) video e legendas tambem seguem");
{
  const r = await perguntar(`${BASE}/video`);
  ok_("video redirecionado da 200", r.estado === 200, "veio " + r.estado);
  ok_("com o content-type do final", r.cabecalhos["content-type"] === "video/mp4", JSON.stringify(r.cabecalhos));
  const l = await perguntar(`${BASE}/legendas.vtt`);
  ok_("legendas redirecionadas dao 200", l.estado === 200, "veio " + l.estado);
  ok_("e sao servidas como text/vtt", /text\/vtt/.test(l.cabecalhos["content-type"] || ""), JSON.stringify(l.cabecalhos));
  ok_("com o conteudo certo", (l.corpo || "").includes("WEBVTT"), JSON.stringify((l.corpo || "").slice(0, 40)));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  8) higiene");
{
  const t = fs.readFileSync(path.join(RAIZ, "server/src/services/proxy.js"), "utf8");
  ok_("proxy.js sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(t));
  ok_("proxy.js sem caractere de substituicao", !t.includes("\uFFFD"));
  // `fetch(` tambem aparece escrito em COMENTARIOS (o ficheiro explica o `fetch`
// antigo num comentario), por isso contar `/fetch\(/` dava 4 contra 3 e esta
// verificacao falhava sem o codigo ter nada de errado. Conta-se a forma exacta.
const nFetch = (t.match(/await fetch\(/g) || []).length;
const nManual = (t.match(/await fetch\(url, \{ headers, redirect: "manual" \}\)/g) || []).length;
ok_("todo o fetch segue os redirecionamentos a mao (nenhum em automatico)",
  nFetch === nManual, "await fetch=" + nFetch + " com manual=" + nManual);
  ok_("e o limite de saltos existe", /MAX_SALTOS_REDIRECT = \d+/.test(t));
}

servidor.close();
interno.close();
console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;