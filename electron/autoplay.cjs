// Respeita a definicao "Autoplay desligado" mesmo quando o provider ignora o
// parametro do URL.
//
// Porque e' preciso
// -----------------
// A app ja faz duas coisas para nao arrancar sozinha (ver Player.jsx):
//   1. tira `autoplay` do atributo `allow` do iframe;
//   2. acrescenta `?autoplay=false&autoPlay=false` ao URL.
//
// A (1) so e' uma DELEGACAO: pode dar permissao, nunca tirar. E a (2) depende de
// o provider aceitar o parametro — e o MegaPlay nao aceita. Medido a 2026-10-07
// no HTML do player (megaplay.buzz/stream/ani/<id>/<ep>/<audio>):
//
//   window.settings = { time: 0, autoPlay: "1", ... }   // fixo, sempre "1"
//   // o unico parametro lido da query string e' ?time= e ?unix=
//
// Ou seja, para o MegaPlay nao ha parametro que faca o player nao arrancar. A
// unica coisa que o trava e' a politica de autoplay do proprio browser, e essa
// e' dominada pelo Media Engagement Index: depois de semanas a ver anime com
// som nesse sitio, o Chromium passa a permitir autoplay nessa origem sem
// depender da delegacao do pai. Por isso o defeito aparece so no MegaPlay (o
// provider de anime principal) e nao nos outros.
//
// A correcao e' ao nivel do browser e vale para todos os providers: quando o
// autoplay esta desligado, acrescenta-se `Permissions-Policy: autoplay=()` a
// resposta do documento. Isso e' uma politica por documento, avaliada ANTES do
// Media Engagement Index, portanto ganha-lhe.
//
// So se mexe em documentos (mainFrame/subFrame): injectar o cabecalho num .js ou
// num segmento de video nao faria sentido e gastaria memoria sem ser preciso.
//
// Este modulo nao faz `require("electron")`: recebe a sessao como parametro, o
// que o torna carregavel num script node normal (para testes).
const TIPOS_DOCUMENTO = new Set(["mainFrame", "subFrame"]);

// Devolve os cabecalhos a meter numa resposta. Separado da instalacao para
// poder ser testado sem electron.
function headersFor(headers, ligado) {
  const out = { ...(headers || {}) };

  // Uma resposta pode ja trazer uma politica (raro, mas acontece). So se tira a
  // DIRECTIVA do autoplay: mexer nas outras (geolocation, camera, fullscreen)
  // seria OURDO num site de terceiro, que precisa delas para o que faz.
  let chaveDaPolitica = null;
  for (const chave of Object.keys(out)) {
    if (chave.toLowerCase() === "permissions-policy") {
      chaveDaPolitica = chave;
      break;
    }
  }
  const restantes = [];
  if (chaveDaPolitica) {
    for (const d of String(out[chaveDaPolitica] || "").split(",")) {
      const dir = d.trim();
      if (dir && !/^autoplay\b/i.test(dir)) restantes.push(dir);
    }
    delete out[chaveDaPolitica];
  }

  // Desligado: `autoplay=()` e' uma politica explicita de "nesta pagina o
  // autoplay nao esta permitido". E' avaliada ANTES do Media Engagement Index,
  // por isso ganha-lhe.
  if (!ligado) restantes.push("autoplay=()");
  // Ligado: nao forcamos nada. Declarar `autoplay=(self)` num documento servido
  // por um terceiro seria uma falha se esse site precisar de autoplay para
  // alguma coisa interna.

  if (restantes.length) out["Permissions-Policy"] = restantes.join(", ");
  return out;
}

let estado = null; // true = autoplay ligado, false = desligado
let registo = null; // callback opcional para diagnostico

/**
 * Liga ou desliga a politica. `ligado = true` deixa passar tudo (o
 * comportamento normal do browser). Idempotente quanto a instalacao: o hook e'
 * posto uma vez e depois so muda o valor guardado.
 */
function definirAutoplay(winSession, ligado, logger) {
  if (!winSession || !winSession.webRequest) return false;
  estado = Boolean(ligado);
  if (logger) registo = logger;

  if (!winSession.__meidaAutoplay) {
    winSession.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, (details, callback) => {
      // So documentos. Um iframe de provider e' sempre um subFrame.
      if (!TIPOS_DOCUMENTO.has(details.resourceType)) {
        return callback({ responseHeaders: details.responseHeaders });
      }
      const headers = headersFor(details.responseHeaders, estado);
      registo?.(
        `${details.resourceType} ${estado ? "deixa" : "BLOQUEIA"} autoplay`,
        String(details.url || "").slice(0, 90),
        "->",
        headers["Permissions-Policy"] || "(sem politica)"
      );
      callback({ responseHeaders: headers });
    });
    winSession.__meidaAutoplay = true;
  }
  return true;
}

module.exports = { definirAutoplay, headersFor };
