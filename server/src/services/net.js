// Deteção de rede para a app funcionar offline (ex.: "A minha lista").
// Conta falhas de REDE consecutivas dos fetchs externos (TMDB/Jikan/Letterboxd/
// MAL/AniList). Erros HTTP 4xx/5xx NAO contam — a rede está bem, a API é que
// falhou. Após 3 falhas consecutivas a rede é marcada offline durante 60s:
// durante esse periodo os fetchs falham imediatamente (sem esperar timeouts),
// o que torna as rotas (ex.: /api/library) instantâneas sem internet. No fim
// da janela faz-se uma tentativa real; se suceder, a rede volta a online.

const MAX_FAILS = 3;
const RETRY_WINDOW_MS = 60 * 1000;

let online = true;
let failCount = 0;
let offlineUntil = 0;

export function isOnline() {
  return online;
}

/**
 * Corre `fn` sobre `arr` com concorrencia limitada.
 *
 * Vive aqui, e nao em `library.js`, porque as rotas nao se importam entre si e o
 * `tmdb.js` — que e' quem busca os titulos localizados — precisa disto tanto
 * como a biblioteca, para o preenchimento em segundo plano.
 *
 * Nao apanha erros: quem chama e' que tem de os tratar.
 */
export async function pMap(arr, concorrencia, fn) {
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concorrencia, arr.length) },
    async () => {
      while (idx < arr.length) {
        const cur = idx++;
        await fn(arr[cur]);
      }
    }
  );
  await Promise.all(workers);
}

// Wrapper do fetch que acompanha o estado da rede. Devolve a Response normal
// (o chamador trata !ok como dava antes); atira o mesmo erro do fetch quando a
// rede falha.
export async function netFetch(url, opts = {}) {
  // Janela offline: falhar já, sem tocar na rede (as rotas respondem em ms).
  if (Date.now() < offlineUntil) {
    failCount = MAX_FAILS;
    throw new TypeError("Sem rede (offline)");
  }
  try {
    const res = await fetch(url, opts);
    if (!online || failCount > 0) {
      online = true;
      failCount = 0;
      offlineUntil = 0;
    }
    return res;
  } catch (err) {
    failCount++;
    if (failCount >= MAX_FAILS) {
      online = false;
      offlineUntil = Date.now() + RETRY_WINDOW_MS;
    }
    throw err;
  }
}
