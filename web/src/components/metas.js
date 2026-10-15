// A geometria do anel de progresso, e a escolha do ano.
//
// PURE, sem React: e' o que se testa. O desenho esta' em `AnelMeta.jsx`.
//
// E' um `<circle>` com `stroke-dasharray`/`stroke-dashoffset`, sem biblioteca —
// a mesma razao do `GraficoMensal` e do heatmap: um anel e' uma circunferencia
// MATH.PI*2 e nada mais.

/** A circunferencia de um circulo. `Math.PI * 2 * raio`. */
export function circunferencia(raio) {
  const r = Number(raio);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return 2 * Math.PI * r;
}

/**
 * O que o `<circle>` precisa para desenhar a fraccao preenchida.
 *
 * @param percent  0 a 1. Acima de 1 e' IGUAL a 1 — um anel que dá a volta
 *                 quando se passa do alvo parece um bug, e o `stroke-dashoffset`
 *                 negativo desenharia o arco ao contrario.
 * @param raio     o raio do circulo
 * @returns {d, circunferencia, traco, folga}
 *   - `d`: o `stroke-dasharray`
 *   - `traco`: o comprimento desenhado
 *   - `folga`: o `stroke-dashoffset` (quanto falta "apagar")
 *
 * Nao leva a espessura: ela nao entra em lado nenhum desta matematica, e um
 * parametro que se ignora e' pior do que nao o ter.
 */
export function anel(percent, raio) {
  const circ = circunferencia(raio);
  const p = Math.max(0, Math.min(1, Number(percent) || 0));
  const traco = circ * p;
  return {
    circunferencia: circ,
    traco,
    // Redondo para evitar o `0.9999999` que deixa um ponto de buraco no anel
    // cheio em alguns browsers.
    folga: Math.round((circ - traco) * 1000) / 1000,
    d: `${Math.round(circ * 1000) / 1000} ${Math.round(circ * 1000) / 1000}`,
  };
}

/**
 * O ano da meta, o do relogio de quem ve.
 *
 * O servidor pode estar em UTC (Render e FadeHost), e as 00:30 de 1 de Janeiro em
 * Lisboa o servidor ainda diz que e' ano novo-1. Por isso quem decide o ano e' o
 * cliente, com o relogio de casa.
 *
 * @param filmesPorAno [{ano, n}] como o servidor mandou
 * @param agora         a data do cliente (parametro para o teste poder passar
 *                      qualquer dia do ano)
 * @returns o nomevel desse ano, 0 se o servidor nao mandou esse ano — que e' o
 *   caso normal a 1 de Janeiro: ainda nao ha nada marcado em UTC.
 */
export function anoDaMeta(filmesPorAno, agora) {
  const lista = Array.isArray(filmesPorAno) ? filmesPorAno : [];
  const ano = Number.isInteger(agora) ? agora : (agora || new Date()).getFullYear();
  const achado = lista.find((x) => x && x.ano === ano);
  return achado && Number.isFinite(achado.n) && achado.n > 0 ? Math.round(achado.n) : 0;
}

/**
 * O texto do anel quando a meta esta' cumprida.
 *
 * "0" quando falha, e o numero real quando passa. Passar o alvo nao e' um erro
 * que a app deva esconder: o anel fecha a 100% e o numero real aparece ao lado.
 * Esconder o "120 de 50" para parecer mais perto do objetivo seria mentira —
 * e o objetivo e' do utilizador, nao nosso.
 */
export function numeroDoAnel(atingidos, alvo) {
  const n = Math.max(0, Number(atingidos) || 0);
  const a = Math.max(1, Number(alvo) || 0);
  return n >= a ? n : 0;
}