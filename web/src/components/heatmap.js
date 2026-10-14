// A matematica do mapa de calor, sem React e sem DOM.
//
// Sao tres coisas que dao bug e que nao se veem a olhar para o desenho:
//   - a CHAVE do dia, porque `toISOString()` e' UTC e o utilizador ve o dia
//     local (aDiferenca de horas vira um quadradinho na coluna errada);
//   - o ALINHAMENTO das semanas, porque a primeira semana esta' meio vazia e se
//     nao se encher com dias de fora o mapa inteiro desloca-se uma linha;
//   - o NIVELE de cor, porque as datas do GitHub usam quatro degraus e um
//     "quanto maior o dia mais claro" linear fica com 90% do mapa igual.
//
// PURE como o resto do modulo: a UI desenha, aqui decide-se.

// ---- dias -----------------------------------------------------------------

/** "YYYY-MM-DD" do dia LOCAL (nao UTC, como o `toISOString` daria). */
export function chaveDia(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Uma data a partir de "YYYY-MM-DD", a MEIA-NOITE local. */
export function dataDe(chave) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(chave || ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `iso` mais `n` dias. Devolve a chave, nao a data. */
export function somarDias(chave, n) {
  const d = dataDe(chave);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return chaveDia(d);
}

/** 0 = domingo ... 6 = sabado. E' a ordem que o GitHub usa. */
export function diaDaSemana(chave) {
  const d = dataDe(chave);
  return d ? d.getDay() : null;
}

/**
 * A data por extenso, para o texto que aparece ao passar o rato.
 *
 * Recebe o `t` em vez de ter a lingua aqui dentro: sao 12 meses e o "de", e
 * escrever "14 de outubro de 2026" afiado no codigo faria a tooltip sair em
 * portugues mesmo com a app em ingles — que foi o que a auditoria apanhou.
 * Chamada sem `t` (como no teste), fica em portugues.
 */
export function dataLonga(chave, t) {
  const d = dataDe(chave);
  if (!d) return chave;
  const mes = (t ? t(MESES_LONGOS[d.getMonth()]) : MESES_LONGOS[d.getMonth()]);
  const de = t ? t("{dia} de {mes} de {ano}") : "{dia} de {mes} de {ano}";
  return de
    .replace("{dia}", String(d.getDate()))
    .replace("{mes}", mes)
    .replace("{ano}", String(d.getFullYear()));
}
const MESES_LONGOS = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ---- o mapa ---------------------------------------------------------------

export const DIAS_SEMANA = 7;

/**
 * As semanas do mapa, cada uma com DIAS_SEMANA celulas (domingo a sabado).
 *
 * Termina na semana de `fim` e recua `semanas` colunas. A primeira coluna
 * pode bringar dias de antes do inicio: sem eles, os quadradinhos de uma semana
 * ficariam a encaixar na linha errada — e o mapa inteiro descia meio palmo.
 * Espera-se que venham marcados como `fora: true`; quem desenha decide se os
 * pinta.
 */
export function semanasDoMapa(dias, { semanas = 53, fim = null } = {}) {
  const chave = fim || chaveDia(new Date());
  if (!chave || !Number.isFinite(semanas) || semanas < 1) return [];

  // O inicio e' o DOMINGO da primeira coluna.
  //
  // O que alinha isto e' o domingo da semana de `fim`, nao o sabado: 52 semanas
  // sao 364 dias, e 364 e' multiplo de 7, por isso subtrair 52 semanas ao
  // SABADO de uma semana da outra SABADO — e o mapa inteiro descentrava uma
  // linha (o dia de quarta-feira aparecia na quinta). O teste apanhou.
  const domingoDaSemana = somarDias(chave, -diaDaSemana(chave));
  const primeiroDia = somarDias(domingoDaSemana, -(semanas - 1) * DIAS_SEMANA);

  const mapa = new Map();
  for (const d of dias || []) {
    if (d && d.dia) mapa.set(d.dia, d.n);
  }

  const cols = [];
  let cursor = primeiroDia;
  for (let s = 0; s < semanas; s++) {
    const col = [];
    for (let i = 0; i < DIAS_SEMANA; i++) {
      const antes = cursor < primeiroDia;
      const depois = cursor > chave;
      col.push({
        dia: cursor,
        n: mapa.get(cursor) || 0,
        // Antes do inicio, ou depois de hoje: nao existe, e pintar com "0"
        // pareceria uma semana sem atividade quando e' uma semana que ainda
        // nao chegou.
        fora: antes || depois,
      });
      cursor = somarDias(cursor, 1);
    }
    cols.push(col);
  }
  return cols;
}

/**
 * O nivel de cor (0 a 4) de um dia, dado o maximo do mapa.
 *
 * Quatro degraus e nao "proporcional ao maximo": se o maximo for 30 e quase
 * tudo for 1 ou 2, a escala linear pinta quase o mapa inteiro da cor mais
 * fraca e nao se ve nada. Os degraus sao as fracoes do maximo, que e' o que o
 * GitHub faz, e o que rende um mapa legivel com qualquer distribuicao.
 */
export const NIVEIS = 4;
export function nivel(n, max) {
  const v = Number(n) || 0;
  if (v <= 0) return 0;
  const m = Math.max(1, Number(max) || 0);
  // 1 -> nivel 1, 2 -> nivel 1 (a primeira fracao), e assim por diante.
  const frac = v / m;
  if (frac <= 0.25) return 1;
  if (frac <= 0.5) return 2;
  if (frac <= 0.75) return 3;
  return 4;
}

/** O maior numero do mapa — o que os niveis sao calculados contra. */
export function maximo(dias) {
  let m = 0;
  for (const d of dias || []) if (d && d.n > m) m = d.n;
  return m;
}