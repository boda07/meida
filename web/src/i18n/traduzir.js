// A funcao pura de traducao, fora do componente React.
//
// PORQUE ESTE FICHEIRO E' SEPARADO: `web/src/api/client.js` precisa de traduzir
// a mensagem de erro que o servidor devolve (que vem sempre em portugues, porque
// o servidor nao sabe o idioma do pedido), mas nao e' um componente — nao pode
// usar o hook `useT()`. Este modulo resolve isso: e' a MESMA funcao que o
// `I18nContext` usa, so' que sem o contexto.
//
// Se o `t()` ganhasse um comportamento novo (interpolacao nova, plural novo), e'
// aqui que se mexe e os dois lados ficam iguais. A alternativa — duplicar a
// funcao no `client.js` — foi o que me fez hesitar: qualquer mudanca tinha de
// ser feita duas vezes, e as duas podiam divergir sem dar erro.
import { DICIONARIO, IDIOMAS } from "./traducoes.js";

/**
 * Traduz `texto` para o idioma pedido.
 *
 * O mesmo contrato do `t()` do contexto:
 *   traduzir("Início", null, "en")                    -> "Home"
 *   traduzir("Viste {n} filmes", { n: 3 }, "en")      -> "You watched 3 films"
 *
 * Se a chave nao existir nesse idioma, devolve o que recebeu. E' de proposito:
 * a alternativa (devolver `undefined` ou um `chave`) punha um `undefined` no
 * ecra, que e' pior do que texto em portugues.
 */
export function traduzir(texto, valores, idioma) {
  const base = String(texto ?? "");
  const lang = idioma && IDIOMAS.includes(idioma) ? idioma : "pt";
  const dicionario = DICIONARIO[lang];

  let saida = base;
  // so' traduz se o texto nao vier ja' de uma traducao.
  if (dicionario && lang !== "pt") {
    saida = dicionario[base] || base;
  }

  if (valores) {
    saida = saida.replace(/\{(\w+)\}/g, (todo, nome) =>
      valores[nome] !== undefined ? String(valores[nome]) : todo
    );
  }
  return saida;
}