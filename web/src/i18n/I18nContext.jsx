// A camada de traducao da interface.
//
// PORQUE ISTO EXISTE (2026-10-10): a app era toda em portugues hardcoded, o que
// deixava de fora qualquer pessoa que so' falasse ingles. Este modulo e' a
// infrastructure que falta: deteta o idioma, guarda a escolha e traduz.
//
// COMO FUNCIONA — tres pecas:
//   1. `DICIONARIO` (em `traducoes.js`) tem as duas linguas. O portugues e' a
//      lingua de origem: a chave e' o proprio texto em portugues.
//   2. `detectarIdioma()` le o que o browser pede (`navigator.language`).
//   3. `I18nProvider` (aqui) junta as duas e da o `t()` a toda a app.
//
// A CHAVE E' O PROPRIO TEXTO EM PORTUGUES, e nao um identificador tipo "nav.home".
// Parece menos limpo, mas e' o que torna isto barato e impossible de errar: se a
// chave nao existe no ingles, o `t()` devolve o portugues — a interface nunca
// fica com um `nav.home` a nu no ecra. O preco e' que se um dia se mudar uma
// palavra no interface sem mudar a chave, essa linha volta ao portugues; por isso
// o `testar-i18n.mjs` avisa quando um texto em portugues nao tem traducao.
//
// SO' INGLES E PORTUGUES de momento. Acrescentar uma terceira e' meter um bloco
// novo em `traducoes.js` e o codigo do pais em `detectarIdioma` — mais nada.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICIONARIO, IDIOMAS } from "./traducoes.js";

const I18nContext = createContext(null);

const CHAVE_IDIOMA = "meida:idioma";

/**
 * O idioma pedido pelo browser. `navigator.language` vem tipo "en-GB" ou
 * "pt-PT"; so interessa a parte antes do "-".
 *
 * O que o browser pede NAO e' o que a pessoa prefere necessarily (alguem com o
 * browser em portugues a ver series em ingles), por isso isto e' so' o ponto de
 * partida — e' por isso que a escolha fica guardada e ganha a este valor.
 */
export function detectarIdioma() {
  if (typeof navigator === "undefined") return "pt";
  // `languages` e' a lista por ordem de preferencia; o primeiro que a app sabe
  // e' o melhor palpite. O `language` e' o fallback para browsers antigos.
  const lista =
    Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ""];
  for (const bruto of lista) {
    const curto = String(bruto || "").slice(0, 2).toLowerCase();
    if (IDIOMAS.includes(curto)) return curto;
  }
  return "pt";
}

/** O idioma guardado, ou o do browser se nunca houve escolha. */
export function idiomaSalvo() {
  try {
    const g = localStorage.getItem(CHAVE_IDIOMA);
    if (g && IDIOMAS.includes(g)) return g;
  } catch {
    /* modo privado sem localStorage */
  }
  return detectarIdioma();
}

/**
 * Traduz `texto` para o idioma actual.
 *
 * Deve ser chamado SEMPRE com um literal em portugues:
 *     t("Início")           -> "Home"      (em ingles)
 *     t("Página inexistente") -> "Página inexistente"  (ainda nao traduzida)
 *
 * O segundo argumento e' para quando o texto ja vem montado:
 *     t("Viste {n} filmes", { n: 12 })  -> "You watched 12 films"
 * Os `{nome}` sao substituidos pela ordem, sem depender do idioma (o ingles nao
 * inverte a ordem das palavras num `printf`, e nao ha casos em que precise).
 */
export function traduzir(texto, valores, idioma) {
  const base = String(texto ?? "");
  const lang = idioma || "pt";
  const dicionario = DICIONARIO[lang];
  let saida = base;

  // so' procura traducao se o texto nao vier ja de uma traducao (evita o
  // duplo-t: traduzir o que ja esta em ingles nao faz sentido).
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

export function I18nProvider({ children }) {
  const [idioma, definirIdioma] = useState(() => idiomaSalvo());

  function mudarIdioma(novo) {
    if (!IDIOMAS.includes(novo)) return;
    definirIdioma(novo);
    try {
      localStorage.setItem(CHAVE_IDIOMA, novo);
    } catch {
      /* modo privado sem localStorage: o idioma dura so' esta sessao */
    }
    // O `lang` do <html> e' o que o leitor de ecra usa para escolher a voz, e
    // o que o browser usa para `spellcheck`. Sem isto, o texto english ficava
    // com a pronuncia portuguesa.
    document.documentElement.lang = novo;
  }

  // Apanha o idioma logo a abrir, antes do primeiro render util: sem este efeito
  // havia um instante com a interface em portugues e depois em ingles.
  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  // O valor e' um objecto novo de cada vez que o idioma muda, para os
  // componentes que so' usam `t()` re-renderizarem. O `t` e' memoizado para nao
  // mudar de identidade a cada render (isso rebateria a app inteira).
  const valor = useMemo(() => {
    const t = (texto, valores) => traduzir(texto, valores, idioma);
    t.idioma = idioma;
    t.mudarIdioma = mudarIdioma;
    t.linguas = IDIOMAS;
    return t;
  }, [idioma]);

  return <I18nContext.Provider value={valor}>{children}</I18nContext.Provider>;
}

/** Atalho: `const t = useT()` e depois `t("Início")`. */
export function useT() {
  return useContext(I18nContext);
}