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

const CHAVE_IDIOMA = "meida:idioma";

/**
 * O idioma escolhido, sem React.
 *
 * A escolha vive no `localStorage` (e' o `I18nProvider` que escreve la), por
 * isso qualquer modulo fora de um componente consegue le'-la. Se ainda nao ha
 * escolha, segue o que o browser pede.
 *
 * E' a MESMA regra do `t()` do contexto — os dois lados tem de ler a mesma
 * chave, senao um texto num componente sai em portugues e o mesmo texto numa
 * funcao auxiliar sai em ingles.
 */
export function idiomaAtual() {
  let guardado = null;
  try {
    guardado = localStorage.getItem(CHAVE_IDIOMA);
  } catch {
    /* modo privado sem localStorage */
  }
  if (guardado && IDIOMAS.includes(guardado)) return guardado;
  const nav = typeof navigator !== "undefined" ? navigator.languages || [] : [];
  for (const l of nav) {
    const curto = String(l).slice(0, 2).toLowerCase();
    if (IDIOMAS.includes(curto)) return curto;
  }
  return "pt";
}

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
    // Substitui `{nome}` pelo valor. Quando algum valor e' um ELEMENTO REACT
    // (um `<code>`, um `<b>` no meio da frase), o resultado tem de ser um array:
    // `String(<b>x</b>)` daria "[object Object]" no ecra, e o React renderiza
    // um array de strings e elementos sem qualquer trabalho extra.
    //
    // E' o que permite escrever uma frase que ja' tem markup a volta de uma
    // palavra — "Usa o filtro {filtro} na lista" — sem partir a frase em duas
    // traduções, que e' o que obriga a duplicar o texto em dois idiomas.
    const partes = [];
    let temElemento = false;
    let ultimo = 0;
    for (const m of saida.matchAll(/\{(\w+)\}/g)) {
      const v = valores[m[1]];
      partes.push(saida.slice(ultimo, m.index));
      if (v === undefined || v === null) {
        partes.push(m[0]);
      } else if (typeof v === "object") {
        partes.push(v);
        temElemento = true;
      } else {
        partes.push(String(v));
      }
      ultimo = m.index + m[0].length;
    }
    partes.push(saida.slice(ultimo));

    if (temElemento) return partes;
    saida = partes.join("");
  }
  return saida;
}

/**
 * Atalho para os modulos que NAO sao componentes (`lib/tempo.js`,
 * `components/profileStats.js`, `api/client.js`): le' o idioma de `idiomaAtual()`
 * e traduz.
 *
 * Nao se importa isto num componente — la usa-se o `useT()` do contexto, que
 * re-renderiza quando o idioma muda. Este le' o `localStorage` uma vez por
 * chamada: serve para texto gerado no momento (uma data relativa, o nome de um
 * genero), nao para estado que o ecra mostra.
 */
export function t(texto, valores) {
  return traduzir(texto, valores, idiomaAtual());
}