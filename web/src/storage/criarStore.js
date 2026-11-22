// Uma chave do `localStorage`, com uma API pequena e à prova de falhas.
//
// PORQUE EXISTE: meia-dúzia de componentes lia e escrevia o `localStorage`
// directamente, cada um com o seu `try/catch`. Três problemas:
//   1. um `JSON.parse` sem protecção entope o arranque (a app fica branca);
//   2. modo privado e quota cheia rebentam de maneiras diferentes em cada sítio;
//   3. não há onde testar a regra sem um browser.
// A fábrica concentra isso. O `storage` é injectável para poder ser testado em
// Node com um objeto falso (ver `scripts/testar-store-local.mjs`).
//
// `json: false` para texto simples (token, nick, versão vista).
// `fallback` é o que se devolve quando não há nada guardado ou está corrupto.
export function criarStore(chave, { json = true, fallback = null, storage } = {}) {
  const area = () => storage ?? (typeof localStorage !== "undefined" ? localStorage : null);

  /** O texto guardado, ou null. Nunca atira (modo privado). */
  function raw() {
    try {
      return area()?.getItem(chave) ?? null;
    } catch {
      return null;
    }
  }

  function get() {
    const cru = raw();
    if (cru == null) return fallback;
    if (!json) return cru;
    try {
      return JSON.parse(cru);
    } catch {
      return fallback;
    }
  }

  /** `true` se gravou; `false` em quota cheia, modo privado ou valor inválido. */
  function set(valor) {
    if (valor === undefined) return false;
    let texto;
    if (json) {
      try {
        texto = JSON.stringify(valor);
      } catch {
        return false; // valor com referência circular
      }
    } else {
      texto = String(valor);
    }
    try {
      const a = area();
      if (!a) return false;
      a.setItem(chave, texto);
      return true;
    } catch {
      return false;
    }
  }

  function remove() {
    try {
      area()?.removeItem(chave);
    } catch {
      /* modo privado: não há nada a limpar */
    }
  }

  return { get, set, remove, raw };
}