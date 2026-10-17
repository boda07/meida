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
 * A data como "14/10/2026", para o texto do quadradinho.
 *
 * Numeros e nao "14 de outubro de 2026": dentro de um quadradinho de 11 px o
 * nome do mes era quase sempre a mesma coisa e so' ocupava espaco — o texto
 * ficava quase duas vezes mais largo e era preciso puxa-lo para dentro do ecra.
 *
 * **Ordem dd/mm/aaaa**, que e' a de Portugal. A barra e' ambigua em ingles (12/10
 * pode ser 12 de outubro ou 10 de dezembro); quem estiver em ingles e' que le
 * o dia de outra maneira. Aceita a ambiguidade e poupa o texto.
 */
export function dataNumerica(chave) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(chave || ""));
  if (!m) return String(chave || "");
  return `${m[3]}/${m[2]}/${m[1]}`;
}

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
    if (d && d.dia) {
      mapa.set(d.dia, {
        n: d.n,
        filmes: d.filmes || 0,
        series: d.series || 0,
      });
    }
  }

  const cols = [];
  let cursor = primeiroDia;
  for (let s = 0; s < semanas; s++) {
    const col = [];
    for (let i = 0; i < DIAS_SEMANA; i++) {
      const antes = cursor < primeiroDia;
      const depois = cursor > chave;
      const doDia = mapa.get(cursor);
      col.push({
        dia: cursor,
        n: doDia ? doDia.n : 0,
        // A reparticao que o texto do rato mostra. Va com a celula em vez de ir
        // procurada a parte: o mapa ja' esta a percorrer os dias, e o `n` sem
        // o resto obrigaria a um segundo mapa so' para isto.
        filmes: doDia ? doDia.filmes : 0,
        series: doDia ? doDia.series : 0,
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

// ---- o texto que aparece ao passar o rato ----------------------------------

/**
 * O que se le ao passar o rato num quadradinho.
 *
 * O GitHub escreve quantos commits houve no dia. Aqui a pergunta e' quanta coisa
 * se mexeu: quantos titulos marcados e em quantas series viste alguma coisa. Sao
 * duas contagens separadas no servidor (`watched_at` e `finished_at`)
 * precisamente para nao ter de adivinhar a partir do `n`.
 *
 * **Series, nao episodios:** o `progress` guarda uma linha por serie e nao tem
 * historico de episodios. Chamar "episodios" aqui seria um numero que ninguem
 * pode confirmar.
 *
 * **So' escreve as partes que nao sao zero.** Um dia em que so mexeste numa serie
 * diz "1 serie" e nao "0 titulos, 1 serie" — o zero e' ruido, e o rato ja' diz
 * que o dia teve atividade.
 *
 * Recebe `t` porque sao as PALAVRAS ("titulo", "serie", "sem atividade") que
 * mudam entre as linguas. A data ja' vai em numeros.
 */
export function textoDoDia(celula, t) {
  const c = celula || {};
  const quando = dataNumerica(c.dia);
  const partes = [];
  const filmes = Number(c.filmes) || 0;
  const series = Number(c.series) || 0;
  if (filmes > 0) partes.push(t("{n} {o}", { n: filmes, o: filmes === 1 ? t("título") : t("títulos") }));
  if (series > 0) partes.push(t("{n} {o}", { n: series, o: series === 1 ? t("série") : t("séries") }));
  if (!partes.length) return `${quando} — ${t("sem atividade")}`;
  // O separador e' `/` e nao um ponto: "2 titulos / 3 series" le-se como uma
  // fracao, que e' o que e'. O ponto lia-se como fim de frase.
  return `${quando} — ${partes.join(" / ")}`;
}

// ---- os dias da semana ao lado ---------------------------------------------

/**
 * As linhas que llevan rotulo, de cima para baixo: segunda, quarta e sexta.
 *
 * De tres em tres de proposito, como no GitHub. Rotular os sete metia sete
 * palavras ao lado de uma grelha cujas celulas tem 11 px, e o lado esquerdo
 * ficava mais largo do que a grelha toda.
 *
 * O indice e' o do dia da semana (0 = domingo, ver `diaDaSemana`): 1, 3 e 5 sao
 * segunda, quarta e sexta, que e' exactamente o que o GitHub escreve.
 */
export const ROTULOS_DIA = [1, 3, 5];

/** O texto do rotulo, sem `t()`: as abreviaturas sao iguais nas duas linguas. */
export const ABREVIATURA_DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

/**
 * Os periodos que o selector oferece, em semanas.
 *
 * GitHub mostra um ano e tem um selector ao lado. Um ano ja nao cabe num
 * telefone, e empurrar o mapa para fora do ecra e' pior do que mostrar menos.
 */
export const PERIODOS = [
  { semanas: 53, chave: "{n} ano", n: 1 },
  { semanas: 105, chave: "{n} anos", n: 2 },
  { semanas: 156, chave: "{n} anos", n: 3 },
];

/** O periodo por omissao: um ano, como o GitHub. */
export const PERIODO_OMISSAO = PERIODOS[0].semanas;

/**
 * Quantas semanas sao necessarias para ir do primeiro dia com atividade ate
 * hoje. Serve para o botao "tudo": o mapa nao pode ser mais curto do que a
 * historia que tem para mostrar, nem mais longo (uma coluna vazia de 2019 nao
 * e' informacao).
 */
export function semanasAte(dias, { fim = null } = {}) {
  const chave = fim || chaveDia(new Date());
  if (!chave) return PERIODO_OMISSAO;
  let primeiro = null;
  for (const d of dias || []) {
    if (!d || !d.dia) continue;
    if (d.n > 0 && (primeiro === null || d.dia < primeiro)) primeiro = d.dia;
  }
  // Sem nenhum dia com atividade: o periodo por omissao. Sem isto, "tudo"
  // dava 1 coluna e o mapa encolhia para um quadradinho.
  if (!primeiro) return PERIODO_OMISSAO;
  const quantos = Math.max(0, Math.round((dataDe(chave) - dataDe(primeiro)) / 86400000));
  // +1 semana de guarda: as colunas sao semanas completas (domingo a sabado) e
  // o primeiro dia pode ficar a meio de uma.
  const semanas = Math.ceil(quantos / DIAS_SEMANA) + 1;
  return Math.max(PERIODO_OMISSAO, semanas);
}