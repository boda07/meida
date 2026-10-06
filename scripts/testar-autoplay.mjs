// Testes de electron/autoplay.cjs — a politica de autoplay que respeita a
// definicao "Autoplay desligado" contra providers que ignoram o parametro.
//
// Existe por causa de um bug medido a 2026-10-07: o MegaPlay tem
// `autoPlay: "1"` fixo no HTML do player e nao le nenhum parametro de autoplay
// da query string, por isso a unica forma de o travar e' a politica do browser.
// Como e' uma correcao ao nivel de cabecalhos, um erro aqui seria invisible ate
// um provider deixar de arrancar sozinho sem ninguem perceber porque — ou, pior,
// o inverso: apagarmos a `Permissions-Policy` de um site de terceiro e
// partirmos features que nada têm a ver (foi o que a 1a versao fazia).
//
// `headersFor` e' uma funcao pura, por isso isto corre em Node normal.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { headersFor, definirAutoplay } = require_("../electron/autoplay.cjs");

let n = 0;
function ok(rotulo, fn) {
  try {
    fn();
    n++;
    console.log(`  OK    ${rotulo}`);
  } catch (e) {
    console.log(`  FALHA ${rotulo}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

const sem = { "content-type": "text/html" };

ok("desligado: acrescenta autoplay=()", () => {
  const h = headersFor(sem, false);
  assert.equal(h["Permissions-Policy"], "autoplay=()");
  assert.equal(h["content-type"], "text/html", "nao pode perder os outros cabecalhos");
});

ok("ligado: nao mete nada", () => {
  assert.equal(headersFor(sem, true)["Permissions-Policy"], undefined);
});

ok("desligado: tira uma politica que a resposta ja traga", () => {
  // Uma politica sem `autoplay` nao a autoriza, mas a que traga `autoplay=(self)`
  // sim. Nunca pode ficar essa.
  const h = headersFor({ ...sem, "permissions-policy": "autoplay=(self)" }, false);
  assert.equal(h["permissions-policy"], undefined);
  assert.equal(h["Permissions-Policy"], "autoplay=()");
});

ok("ligado tambem limpa uma politica de autoplay herdada", () => {
  const h = headersFor({ ...sem, "Permissions-Policy": "autoplay=(self)" }, true);
  assert.equal(h["Permissions-Policy"], undefined, "com o autoplay ligado nao se deve Forcar autoplay num site terceiro");
});

ok("ligado: nao apaga politicas que nao sejam de autoplay", () => {
  // Se o site precisar de outra coisa (camera, geolocalizacao), mexer nisso
  // seria OURDO. So autoplay e' nosso.
  const h = headersFor({ ...sem, "Permissions-Policy": "geolocation=(self)" }, false);
  assert.match(h["Permissions-Policy"], /geolocation/);
  assert.match(h["Permissions-Policy"], /autoplay=\(\)/);
});

ok("so mexemos em chaves de cabecalho normais", () => {
  assert.deepEqual(Object.keys(headersFor(sem, false)).sort(), [
    "Permissions-Policy",
    "content-type",
  ]);
});

ok("o header e' exactamente o que trava o player", () => {
  // Chromium le a politica de autoplay do documento ANTES do Media Engagement
  // Index. Sem o espaco em volta do parentesis, `autoplay=()` e' o valor correcto.
  assert.equal(headersFor(sem, false)["Permissions-Policy"], "autoplay=()");
});

// O hook de instalacao, com uma sessao falsa.
let instalado = null;
const sessao = {
  webRequest: {
    onHeadersReceived(filtro, handler) {
      instalado = { filtro, handler };
    },
  },
};

function responder(details) {
  let saida;
  instalado.handler(details, (r) => {
    saida = r;
  });
  return saida;
}

ok("instala o hook uma vez so", () => {
  definirAutoplay(sessao, true);
  assert.ok(instalado, "o hook ficou posto");
  const primeiro = instalado.handler;
  definirAutoplay(sessao, false);
  assert.equal(instalado.handler, primeiro, "repor o valor nao pode reinstalar o hook");
});

ok("um documento do iframe leva a politica", () => {
  definirAutoplay(sessao, false);
  const r = responder({ resourceType: "subFrame", responseHeaders: { "content-type": "text/html" } });
  assert.equal(r.responseHeaders["Permissions-Policy"], "autoplay=()");
});

ok("a janela principal tambem (util no modo web)", () => {
  definirAutoplay(sessao, false);
  const r = responder({ resourceType: "mainFrame", responseHeaders: {} });
  assert.equal(r.responseHeaders["Permissions-Policy"], "autoplay=()");
});

ok("um .js NAO e' tocado", () => {
  definirAutoplay(sessao, false);
  const headers = { "content-type": "application/javascript" };
  const r = responder({ resourceType: "script", responseHeaders: headers });
  assert.equal(r.responseHeaders["Permissions-Policy"], undefined);
  assert.equal(r.responseHeaders["content-type"], "application/javascript");
});

ok("um segmento de video NAO e' tocado", () => {
  definirAutoplay(sessao, false);
  const r = responder({ resourceType: "media", responseHeaders: { "content-type": "video/mp2t" } });
  assert.equal(r.responseHeaders["Permissions-Policy"], undefined);
});

ok("ligar o autoplay remove a politica a partir da hora seguinte", () => {
  definirAutoplay(sessao, false);
  assert.equal(
    responder({ resourceType: "subFrame", responseHeaders: {} }).responseHeaders["Permissions-Policy"],
    "autoplay=()"
  );
  definirAutoplay(sessao, true);
  assert.equal(
    responder({ resourceType: "subFrame", responseHeaders: {} }).responseHeaders["Permissions-Policy"],
    undefined
  );
});

ok("sem sessao nao rebenta (devolve false)", () => {
  assert.equal(definirAutoplay(null, true), false);
  assert.equal(definirAutoplay({}, true), false);
});

console.log(process.exitCode ? "\n  ha falhas acima" : `\n  ${n} verificacoes passam`);
