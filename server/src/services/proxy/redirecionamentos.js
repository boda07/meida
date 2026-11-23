// Seguir os redirecionamentos do upstream **um salto de cada vez**.
//
// Nem `redirect: "follow"` (reintroduzia o SSRF: um 302 para `169.254.169.254`
// seria buscado sem validacao) nem "nao seguir nada" (devolvia um 302 sem
// `Location`, um beco sem saida).
import { alvoSeguro, segurancaDesligada } from "./ssrf.js";

// Quantos redirecionamentos se seguem antes de desistir. Um CDN pode ter
// `origem -> CDN` e mais um salto para o token; 5 chega com folga e impede
// `a -> b -> a -> b -> ...` de correr infinitamente.
const MAX_SALTOS_REDIRECT = 5;
const ESTADOS_REDIRECT = new Set([301, 302, 303, 307, 308]);

// Erro com `status` para o `handleProxy` responder com esse codigo (o handler
// de erros do Express usa o mesmo campo).
export class ErroProxy extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

/**
 * Segue os redirecionamentos do upstream um a um, revalidando **cada** destino
 * com `alvoSeguro` antes de o buscar. Devolve a resposta final e o URL final —
 * o URL final e' o que serve de base a `rewritePlaylist`, porque os segmentos
 * de uma playlist sao quase sempre relativos.
 */
export async function seguirRedirectos(urlInicial, headers) {
  let url = urlInicial;
  let resposta = await fetch(url, { headers, redirect: "manual" });

  for (let salto = 0; salto < MAX_SALTOS_REDIRECT; salto++) {
    if (!ESTADOS_REDIRECT.has(resposta.status)) return { resposta, url };

    const localizacao = resposta.headers.get("location");
    // Um 3xx sem `Location` nao tem onde ir: devolve-se tal e qual.
    if (!localizacao) return { resposta, url };

    let destino;
    try {
      destino = new URL(localizacao, url).toString();
    } catch {
      return { resposta, url };
    }

    // **Cada salto passa por `alvoSeguro`.** E' isto que permite seguir sem
    // reabrir o SSRF: o `redirect: "follow"` do `fetch` buscaria o destino sem
    // nunca o ver. O modo de teste desliga o portao todo, como no alvo inicial.
    if (!segurancaDesligada()) {
      const seguro = await alvoSeguro(destino);
      if (!seguro.ok) {
        throw new ErroProxy(`redirecionamento bloqueado (${seguro.motivo}): ${destino}`, 403);
      }
    }

    url = destino;
    // O corpo do 3xx nao interessa e fica preso na ligacao se nao for solto.
    try { await resposta.body?.cancel(); } catch { /* ja fechado */ }
    resposta = await fetch(url, { headers, redirect: "manual" });
  }

  if (ESTADOS_REDIRECT.has(resposta.status)) {
    throw new ErroProxy(`demasiados redirecionamentos (${MAX_SALTOS_REDIRECT})`, 502);
  }
  return { resposta, url };
}