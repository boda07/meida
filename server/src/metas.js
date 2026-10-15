// As metas e os desafios de `/achievements`.logica pura, sem base de dados e
// sem HTTP — e' o que se testa.
//
// A razao de este ficheiro existir: o que se pode prometer a alguem com estes
// numeros e' uma questao de honesta, e nao de codigo. Escreve-se uma vez, com a
// limitacao escrita ao lado, e os testes conferem que a limitacao se mantem.
//
// ---------------------------------------------------------------------------------
// O QUE "FILMES ESTE ANO" NAO E'
// ---------------------------------------------------------------------------------
// **A biblioteca nao tem data em que viste.** Ver a migracao 1: `library` tem
// `updated_at`, e `updated_at` e' a ULTIMA VEZ que tocaste na linha. Nao ha
// outra data, nem em `progress` (que e' por episodio, para series e animes).
//
// Por isso a meta conta, honestamente, o seguinte:
//
//     filmes que MARCASTE COMO VISTOS e que marcaste NESTE ANO
//
// E nao "filmes que viste este ano". A diferenca e' real e aparece em tres
// casos que a app nao distingue:
//
//   - puseste 50 filmes na watchlist hoje: contam ZERO, porque `watched` e' 0.
//     Isto e' o que salva a conta de ser mentira.
//
//   - deste nota hoje a um filme que viste em 1998: conta como marcado hoje.
//     A app nao sabe quando o viste, so quando lhe disseste que sim.
//
//   - tocaste num filme para lhe mexer numa imagem, sem o ter visto agora: conta.
//
// Por isso **todos os textos da interface dizem "marcaste"**, nunca "viste". Um
// "viste 32 filmes este ano" sem qualifieria seria falso para quem reordenou a
// lista ontem, e a pessoa nao tem como saber que o numero e' generoso.
//
// ---------------------------------------------------------------------------------
// O ANO E' DO UTILIZADOR, E O SERVIDOR PODE ESTAR EM UTC
// ---------------------------------------------------------------------------------
// O Render e o FadeHost correm em UTC. As 00:30 de 1 de Janeiro, em Lisboa, o
// servidor ainda diz que e' ano novo-1. Se o servidor decidisse o ano, a meta
// reiniciava na hora errada.
//
// A solucao e' o mesmo truque das horas em `stats.js`: o servidor devolve a
// contagem **por ano, em UTC**, e o cliente escolhe o ano com o relogio dele.
// Para o cliente nunca faltar o ano, o servidor manda tres: o anterior, o
// actual e o seguinte. Tres numeros cobrem qualquer fuso (-12 a +14) porque
// ninguem atravessa a virada do ano com mais de 14 horas de diferenca.

/**
 * Le a coluna `meta` dos utilizadores.
 *
 * **Esta funcao e' pura e vive aqui, e nao no `store.js`, por uma razao concreta:**
 * o `store.js` importa a base de dados, e por isso nao se pode importar num
 * teste sem arrancar o servidor todo. Com o `try/catch` la dentro, mudar so' o
 * `return {}` nao era apanhado por nada — a mutacao passava com zero falhas.
 * Aqui corre em Node, sem nada mais, e o teste carrega-lhe o `meta` corrompido
 * um a um.
 *
 * @param texto o valor cru da coluna, ou null
 * @returns {object} sempre um objeto. `{}` para null, para JSON partido, e para
 *   um JSON valido que nao seja objeto (um numero, uma lista).
 */
export function leMeta(texto) {
  if (!texto) return {};
  try {
    const v = JSON.parse(texto);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    // Uma preferencia corrompida nao pode levar a pagina em baixo.
    return {};
  }
}

/**
 * Os titulos que melhor avaliaste NESTE ANO.
 *
 * E' o que dá contenido a um cartao de partilha: dois numeros e uma faixa de
 * meses nao contam uma historia, tres cartazes conta. Por isso o `/api/stats`
 * devolve tambem estes — e devolve-os **do ano**, para o cartao poder ser todo
 * dele sem misturar "este ano" com "de sempre".
 *
 * @param linhas  as linhas da biblioteca (formato de `listLibrary`)
 * @param ano     o ano civil, em UTC (ver `contaFilmesPorAno` para o porque do fuso)
 * @param quantos quantos devolver
 * @returns [{titulo, poster, score, tipo}] por ordem de nota, sem os que nao
 *   tem titulo (um cartao sem nome e' pior do que um cartao com menos cartazes).
 */
export function melhoresDoAno(linhas, ano, quantos = 3) {
  const anoAlvo = Number.isInteger(ano) ? ano : new Date().getUTCFullYear();
  const candidatos = [];
  for (const l of linhas || []) {
    if (!l || !l.title) continue;
    // So' conta o que MARCASTE como visto, pelo mesmo motivo da meta: o que
    // esta' na watchlist nao foi visto.
    if (l.watched !== 1 && l.watched !== true) continue;
    // **So' filmes**, e nao por esquecimento: o cartao diz "N titulos marcados
    // como vistos" em cima, e essa conta e' de filmes. Mostrar um cartaz de uma
    // serie ao lado de um numero que nao a inclui e' o cartao a contar uma coisa
    // e mostrar outra — e o cartaz nao tem legenda que diga o que e'. As series
    // ficam de fora do cartao ate haver uma linha a dizer quantas sao.
    if (l.type !== "movie") continue;
    if (anoDe(l.updatedAt) !== anoAlvo) continue;
    if (l.score == null || Number.isFinite(Number(l.score)) === false) continue;
    candidatos.push({
      titulo: l.title,
      poster: l.poster || null,
      score: Number(l.score),
      tipo: l.type || "movie",
    });
  }
  candidatos.sort((a, b) => (b.score === a.score ? 0 : b.score - a.score));
  return candidatos.slice(0, Math.max(0, quantos));
}

/** O alvo por omissao, quando a pessoa ainda nao escolheu nenhum. */
export const ALVO_OMISSAO = 50;

/** O ano civil de um ISO, em UTC. `null` para datas que nao sao datas. */
export function anoDe(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

/** A decada de um ano: 1975 -> 1970. `null` quando nao ha ano. */
export function decadaDe(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1800 || y > 2200) return null;
  return Math.floor(y / 10) * 10;
}

/**
 * Filmes marcados como vistos, por ano de marcacao.
 *
 * @param linhas  as linhas da biblioteca, no formato de `listLibrary`
 *                 (`{type, watched, updatedAt, year}`)
 * @param anoBase o ano de referencia (UTC). Vem tres: -1, 0 e +1.
 * @returns [{ano, n}] sempre tres, por ordem. Os anos sem nada vem a 0, e nao
 *          em falta: o cliente procura o ano dele com `find` e um `undefined`
 *          dava "undefined filmes".
 */
export function contaFilmesPorAno(linhas, anoBase) {
  const base = Number.isInteger(anoBase) ? anoBase : new Date().getUTCFullYear();
  const contagem = new Map();
  for (let a = base - 1; a <= base + 1; a++) contagem.set(a, 0);
  for (const l of linhas || []) {
    if (!l || l.watched !== 1 && l.watched !== true) continue;
    if (l.type !== "movie") continue;
    const ano = anoDe(l.updatedAt);
    if (ano === null || !contagem.has(ano)) continue;
    contagem.set(ano, contagem.get(ano) + 1);
  }
  return [...contagem.entries()].map(([ano, n]) => ({ ano, n })).sort((a, b) => a.ano - b.ano);
}

/**
 * As decadas em que ja viste filmes, e as que faltam.
 *
 * Um desafio de "um filme de cada decada" so faz sentido com uma lista de
 * decades sobre as quais se pode falhar. O intervalo vai de **1930** ate a
 * decada corrente: o cinema comeca em 1895, mas a app so tem anos a partir de
 * 1930 porque e' ahi que o TMDB tem catalogo suficiente para a ideia ser util —
 * e uma decada de 1890 que ninguem vai ver e' so' ruido.
 *
 * @param linhas     as linhas da biblioteca
 * @param anoAgora   o ano de referencia, para saber qual e' a decada corrente
 * @returns {cobertas:[{decada,n}], vazias:[decada], semAno:n, total:number}
 *   `semAno` e' a quantidade de filmes vistos SEM ano — ficam de fora das duas
 *   listas, e `total` e' a soma das duas. Sem isto, um filme de 1950 sem ano
 *   guardado faria a decade parecer vazia e o desafio injusto.
 */
export function contaDecadas(linhas, anoAgora) {
  const ano = Number.isInteger(anoAgora) ? anoAgora : new Date().getUTCFullYear();
  const porDecada = new Map();
  let semAno = 0;
  for (const l of linhas || []) {
    if (!l) continue;
    if (l.watched !== 1 && l.watched !== true) continue;
    if (l.type !== "movie") continue;
    const d = decadaDe(l.year);
    if (d === null) {
      semAno++;
      continue;
    }
    porDecada.set(d, (porDecada.get(d) || 0) + 1);
  }
  const primeira = 1930;
  const ultima = decadaDe(ano);
  const cobertas = [...porDecada.entries()]
    .map(([decada, n]) => ({ decada, n }))
    .sort((a, b) => a.decada - b.decada);
  const vazias = [];
  for (let d = primeira; d <= ultima; d += 10) {
    if (!porDecada.has(d)) vazias.push(d);
  }
  return { cobertas, vazias, semAno, total: cobertas.length + vazias.length };
}

/**
 * A meta esta' cumprida?
 *
 * `cumplida` quer dizer "atingiste o alvo", nao "passaste". Passar o alvo e'
 * bom e nao se deve esconder: o anel fecha a 100% e o numero real continua a
 * aparecer ao lado.
 */
export function estadoDaMeta(atingidos, alvo) {
  const n = Math.max(0, Number(atingidos) || 0);
  const a = Math.max(1, Number(alvo) || 0);
  return {
    atingidos: n,
    alvo: a,
    falta: Math.max(0, a - n),
    cumprida: n >= a,
    // 0 a 1. O `Math.min(1, …)` e' o que impede o anel de dar a volta quando se
    // passa do alvo: com 120 de 50 daria 2.4 e o `stroke-dashoffset` viraria
    // negativo, a desenhar o anel ao contrario.
    percent: Math.min(1, n / a),
  };
}