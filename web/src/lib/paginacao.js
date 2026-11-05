// Janela de numeros de pagina da paginacao.
//
// Fica fora do componente (e sem React) de proposito: e' a unica parte com
// regra — primeira, ultima e uma janela a' volta da atual — e assim pode ser
// testada sem montar nada.

/**
 * @param {number} atual  pagina atual (1-based)
 * @param {number} total  numero total de paginas
 * @param {number} [raio] quantas paginas de cada lado da atual
 * @returns {Array<number|null>} paginas a mostrar; `null` significa reticencias
 *
 * `null` e nao a string "..." porque a lista tambem tem numeros como chave e
 * "..." nunca e' uma pagina — a distincao fica no proprio tipo.
 */
export function paginasVisiveis(atual, total, raio = 2) {
  const vistas = new Set([1, total]);
  for (let p = atual - raio; p <= atual + raio; p += 1) {
    if (p >= 1 && p <= total) vistas.add(p);
  }
  const ordenadas = [...vistas].sort((a, b) => a - b);
  const saida = [];
  for (const p of ordenadas) {
    const anterior = saida[saida.length - 1];
    if (typeof anterior === "number" && p - anterior > 1) saida.push(null);
    saida.push(p);
  }
  return saida;
}
