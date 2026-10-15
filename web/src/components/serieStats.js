// A serie que alimenta o `GraficoMensal` (barras verticais em SVG), e a
// giragem do fuso horario.
//
// PURE, sem React: e' o que se testa. O grafico em si ja existe e e' generico
// (so' precisa de `[{chave, rotulo, n}]`), por isso decades e horas usam o
// mesmo desenho em vez de um ficheiro novo cada um.

/** O deslocamento do fuso do utilizador, em horas. Lisboa da +1, o Havai -10. */
export function fusoEmHoras(date) {
  const d = date || new Date();
  // `getTimezoneOffset` e' o inverso do sinal: em Lisboa da +60 (=+1h), no
  // Havai da +600 (=+10h atras). E' o unico metodo que funciona sem ajustes.
  return -Math.round(d.getTimezoneOffset() / 60);
}

/**
 * Roda um histograma de 24 horas para o fuso de quem ve.
 *
 * Rodar um histograma e' EXACTO — nao e' media nem aproximacao, porque e' a
 * mesma contagem noutra origem. Um `n` que estava no balde 22 (UTC) passa para
 * o balade 23 quando o utilizador esta' em UTC+1, e o total nunca muda.
 *
 * @param baldes [{hora, n}] em UTC, como o servidor devolve
 * @param horas  o deslocamento em horas (positivo = a este)
 * @returns [{chave, rotulo, n}] os mesmos numeros, na ordem local
 */
export function giraPorFuso(baldes, horas) {
  const dados = Array.isArray(baldes) ? baldes : [];
  if (dados.length !== 24) return [];
  const desloca = Number.isFinite(horas) ? Math.round(horas) : 0;
  // Um fuso de +13 ou -12 rebenta a aritmetica de `%`: e' por isso que se
  // normaliza para 0..23 ANTES de aplicar.
  const passo = ((desloca % 24) + 24) % 24;
  const saida = [];
  for (let h = 0; h < 24; h++) {
    const utc = ((h - passo) % 24 + 24) % 24;
    const n = dados[utc]?.n ?? 0;
    saida.push({ chave: "h" + h, rotulo: String(h).padStart(2, "0"), n });
  }
  return saida;
}

/** As decadas do servidor viram a mesma forma de serie. */
export function serieDecadas(decadas) {
  const lista = Array.isArray(decadas) ? decadas : [];
  return lista
    .map((d) => ({ chave: "d" + d.decada, rotulo: String(d.decada), n: d.n }))
    .sort((a, b) => (a.rotulo < b.rotulo ? -1 : 1));
}

/**
 * QUE COLUNAS LEVAM ROTULO NO EIXO X.
 *
 * De dois em dois, comecando na primeira. E' a regra que o `GraficoMensal` usa,
 * tirada para ca para o teste a poder apanhar — estava escrita la dentro do
 * `.map()` do JSX, onde nada a alcanca.
 *
 * O erro que isto evita: `i === 0 || i % 2 === 1` da os indices 0, 1, 3, 5 —
 * dois rotulos **colados** no principio ("00 01 03 05" / "Jan Fev Abr Jun") e o
 * `i === 0` a mais. Nos meses, um salto de Fev para Abr; nas horas, `00` e `01`
 * por cima uma da outra.
 *
 * @param serie    [{ano}] — so' o `ano` interessa, e so' quando muda
 * @param rotulaAno  o ano entra no rotulo quando muda (os meses; as horas nao
 *                   tem ano e ficam com o `mostrarAno` a false)
 * @returns number[] os indices a rotular, por ordem
 */
export function indicesRotulados(serie, rotulaAno = true) {
  const lista = Array.isArray(serie) ? serie : [];
  const muda = rotulaAno && new Set(lista.map((d) => d.ano)).size > 1;
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const mudaAqui = muda && i > 0 && lista[i - 1].ano !== lista[i].ano;
    if (i % 2 === 0 || mudaAqui) saida.push(i);
  }
  return saida;
}