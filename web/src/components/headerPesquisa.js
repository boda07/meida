// Quando a barra de pesquisa abre e quando fecha.
//
// PURE, sem React: e' o que se testa. O `Header.jsx` guarda o texto e o estado
// aberto/fechado; a DECISAO esta' aqui.
//
// A regra que a pessoa pediu: escreve-se o que se quer, e a barra volta ao
// normal — o menu mostra os botoes. O texto **fica**: para voltar a pesquisar
// ou a acertar o que se escreveu basta tocar outra vez na pesquisa. Por isso
// fechar nunca descarta o `query`; so' muda o que se ve.

/**
 * A barra abre sozinha ao montar?
 *
 * @param textoDaUrl         o `?q=` da pagina de pesquisa, ou "" se nao ha
 * @param naPaginaDePesquisa  estamos em `/search`? Fora dela a barra nunca
 *                           nasce aberta, mesmo sem texto.
 * @returns true so' quando estamos la E nao ha texto nenhum.
 *
 * **O segundo argumento nao e' opcional e por razao.** A primeira versao so'
 * aceitava o texto, e abria em *todas* as paginas: fora de `/search` o `?q=`
 * nao existe, o texto e' sempre `""`, e "sem texto" devolvia `true`. Medido no
 * browser em 2026-10-14 — a barra aparecia aberta em `/` antes de a pessoa tocar
 * em nada.
 *
 * **Com texto, a barra fica fechada** — que e' o mesmo que acontece logo
 * depois de escrever. Se abrir, um F5 na pagina de resultados volta a
 * esconder os botoes, e a pessoa acaba de usar "escrevi, o menu voltou ao
 * normal" duas vezes com resultados diferentes.
 *
 * **Sem texto, abre**: `/search` sem `?q=` diz "escreve algo na pesquisa", e
 * uma caixa fechada a convidar a escrever e' uma porta fechada.
 */
export function abreAoMontar(textoDaUrl, naPaginaDePesquisa) {
  if (!naPaginaDePesquisa) return false;
  return !String(textoDaUrl || "").trim();
}

/**
 * Perder o foco do campo fecha a barra?
 *
 * @param relatedTarget  para onde foi o foco (`null` = para o nada)
 * @param form          o `<form>` da pesquisa
 * @returns true se fecha
 *
 * O `relatedTarget` e' o que separa "a pessoa foi-se embora" de "tocou no
 * botao da propria pesquisa". Sem ele, tocar no icone com o campo em foco
 * disparava `blur` (fecha) e logo a seguir `click` (abre) — a barra a
 * oscilar no mesmo toque, sem dar lugar a nada.
 */
export function fechaNoBlur(relatedTarget, form) {
  // `null`: clique fora da pagina, Tab para o fim, ou o elemento seguinte a
  // sair. Perdeu-se o foco de vez — fecha.
  if (!relatedTarget) return true;
  // O foco foi para dentro do proprio form (o botao do icone): fica aberta, o
  // `click` e' que decide.
  if (!form || typeof form.contains !== "function") return true;
  return !form.contains(relatedTarget);
}

/**
 * O texto que fica escrito quando se fecha, para a proxima vez.
 *
 * Nao descarta nada: e' o `query` tal e qual. Existe para deixar a decisao
 * num sitio so — e porque ha um caso subtil. Se a pessoa corrigiu o que
 * escreveu com espacos a mais ("  one piece  ") e fechou, o que fica para a
 * proxima e' o **aparado**: reescrever a mesma pesquisa com espacos na ponta
 * da URL nao muda nada, e um `%20` a mais no URL parece que a app apanha.
 */
export function textoParaGuardar(valor) {
  return String(valor || "").trim();
}