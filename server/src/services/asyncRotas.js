// Um handler `async` que lanca devolve uma promessa. O Express 4 chama o
// handler e **ignora o que ele devolve** (`express/lib/router/layer.js`:
// `fn(req, res, next)` sem `await`), pelo que a rejeicao fica sem dono e o
// Node mata o processo a um `unhandledRejection`.
//
// Ou seja: **um unico pedido derruba o servidor**. Foi o que aconteceu com um
// `sig` nao-hexadecimal em `/api/proxy` (o `RangeError` do `timingSafeEqual`
// ver `proxy.js`): um GET sem autenticacao matou o processo do backend.
//
// Este modulo envolve o ponto do Express que chama o handler para tambem
// escutar a promessa. A rejeicao passa a chegar ao middleware de erro do
// `index.js`, que responde 500 e o servidor continua a vivo. E' a abordagem do
// pacote `express-async-errors`, e a unica que fica certa sem mexer nas 29+
// registos de rotas um a um: **os routers ja estao preenchidos no momento em
// que sao importados**, portanto envolver os *metodos* do router a partir do
// `index.js` chegaria tarde demais.
//
// Importado pelo `index.js` por efeito de borda. O `Layer` e' um singleton do
// modulo `express`, por isso a correcao vale para qualquer router, criado
// antes ou depois deste import.
import Layer from "express/lib/router/layer.js";
import { log } from "./log.js";

const original = Layer.prototype.handle_request;

if (!original.__asyncRotas) {
  Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle;

    // Handler de erro (4 argumentos) ou nao-function: comportamento normal.
    if (typeof fn !== "function" || fn.length > 3) return original.call(this, req, res, next);

    // `passou` diz se o handler ja avancou a cadeia (chamou `next()`). Sem isto,
    // um handler que faz `next()` e so depois lanca chamava `next(err)` numa
    // cadeia ja terminada — o Express queixa-se e o erro desaparece na mesma.
    let passou = false;
    const seguir = (err) => {
      passou = true;
      next(err);
    };

    // Erro depois da resposta ja ter saido: nao ha pedido nenhum a que
    // responder. Sem esta guarda, `next(err)` leva o middleware de erro a
    // chamar `res.status().json()` e rebenta com `ERR_HTTP_HEADERS_SENT` — que
    // e' ruido que esconde o erro verdadeiro (e o pedido tinha sucesso).
    const semDestino = (err, quando) => {
      if (passou || res.headersSent) {
        log.error("backend", `handler async ${quando} a resposta: ${erroTexto(err)}`);
        return true;
      }
      return false;
    };

    try {
      const retorno = fn(req, res, seguir);
      if (retorno && typeof retorno.then === "function") {
        retorno.then(
          () => {},
          (err) => {
            if (!semDestino(err, "lancou depois de next() ou de responder")) next(err);
          }
        );
      }
    } catch (err) {
      // `throw` sincrono. O Express original ja faz isto; mantem-se porque a
      // guarda acima e' o que impede a corrida.
      if (!semDestino(err, "lancou depois de next() ou de responder")) next(err);
      return undefined;
    }
    return undefined;
  };
  Layer.prototype.handle_request.__asyncRotas = true;
  original.__asyncRotas = true;
}

function erroTexto(err) {
  if (!err) return "erro desconhecido";
  return typeof err === "string" ? err : (err.message || String(err));
}

/** Verdadeiro se a proteccao contra rejeicoes de handlers async esta' activa. */
export function proteccaoActiva() {
  return Boolean(Layer.prototype.handle_request.__asyncRotas);
}

export default proteccaoActiva;