// A timeline da biblioteca: ordenar por data de visionamento e agrupar em linhas
// cronologicas.
//
// PURE, sem React: e' o que se testa.
//
// ---------------------------------------------------------------------------------
// "QUANDO VISTE" E' DUAS COISAS DIFERENTES, E A TIMELINE DIZ QUAL
// ---------------------------------------------------------------------------------
// A biblioteca tem DUAS datas e so uma delas e' a data de visionamento:
//
//   - `watchedAt` — a data em que a pessoa MARCOU o titulo como visto. Foi o que
//     a migracao 9 passou a gravar. E' exacta.
//   - `updatedAt` — a ULTIMA vez que tocaste na linha: dar nota, mudar o estado,
//     reordenar a lista. Nao e' a data de visionamento.
//
// Para tudo o que ja estava visto antes da migracao, `watchedAt` e' NULL: nao se
// sabe, e a app nao finge o contrario. **Esse e' o `exata: false`** de baixo, e a
// interface escreve "sem data" em vez de mostrar um mes que ninguem affirmed.
//
// Mostrar a `updatedAt` como se fosse a data de visionamento seria uma mentira
// pequena e comum: o filme que viste em Janeiro aparece no mes em que lhe deste
// nota. E' por isso que a timeline NAO cai no `updatedAt` por omissao — mostra
// "sem data", que e' a verdade e nao custa nada ao utilizador.

/**
 * A data que vai na timeline de um item, e se ela e' exacta.
 *
 * @returns {{data: string|null, exata: boolean}}
 */
export function dataDaTimeline(item) {
  if (!item) return { data: null, exata: false };
  if (item.watchedAt) return { data: item.watchedAt, exata: true };
  // Sem `watchedAt` nao se sabe. Devolve `null` e NAO o `updatedAt`: a data do
  // ultimo toqueXe' a mesma coisa que a timeline e' feita para substituir.
  return { data: null, exata: false };
}

/** "YYYY-MM-DD" a partir de um ISO. `null` para o que nao e' data. */
export function diaDe(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** O ano e o mes de um "YYYY-MM-DD", ou null. */
export function mesDe(dia) {
  const d = diaDe(dia);
  if (!d) return null;
  return { ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) };
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "março de 2026", ou null. O rotulo que vai no lado esquerdo da linha. */
export function rotuloDoMes(ano, mes) {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  return MESES[mes - 1] + " de " + ano;
}

/**
 * Comparador de `Array.sort`: **negativo = `a` vem primeiro**.
 *
 * "Mais recente primeiro" quer dizer isto — negativo quando `a` e' mais recente.
 * Inverter o sinal daria a lista do avesso, e sem qualquer erro: o `sort` aceita
 * os dois sentidos. Por isso o contrato esta' aqui escrito.
 *
 * Sem data ao FIM: e' o grupo "sem data", e nao se mistura no meio com um mes
 * que ninguem affirmou.
 */
export function maisRecentePrimeiro(a, b) {
  const da = diaDe(a);
  const db = diaDe(b);
  if (da && db) return da < db ? 1 : da > db ? -1 : 0;
  // Sem data vai para o fim: e' a secao "sem data", e nao se mistura no meio.
  if (da) return -1;
  if (db) return 1;
  return 0;
}

/**
 * Os grupos da timeline, do mais recente para o mais antigo.
 *
 * @param itens  os titulos ja filtrados (a timeline so mostra vistos)
 * @returns [{chave, ano, mes, rotulo, itens:[…], comData:boolean}]
 *   O ultimo grupo e' sempre o de "sem data", se houver. Fica **separado** e nao
 *   misturado num mes: um mes com "3 titulos" onde dois nao tem data seria uma
 *   contagem errada.
 */
export function gruposDaTimeline(itens) {
  const lista = (Array.isArray(itens) ? itens : [])
    .map((i) => ({ item: i, ...dataDaTimeline(i), dia: diaDe(i && i.watchedAt) }))
    .sort((a, b) => maisRecentePrimeiro(a.dia, b.dia));

  const grupos = [];
  let atual = null;
  for (const linha of lista) {
    if (!linha.dia) {
      if (!atual || atual.comData) {
        atual = { chave: "sem-data", ano: null, mes: null, rotulo: null, itens: [], comData: false };
        grupos.push(atual);
      }
      atual.itens.push(linha.item);
      continue;
    }
    const m = mesDe(linha.dia);
    const chave = m.ano + "-" + String(m.mes).padStart(2, "0");
    if (!atual || atual.chave !== chave) {
      atual = { chave, ano: m.ano, mes: m.mes, rotulo: rotuloDoMes(m.ano, m.mes), itens: [], comData: true };
      grupos.push(atual);
    }
    atual.itens.push(linha.item);
  }
  return grupos;
}

/**
 * Quantos titulos vao para "sem data".
 *
 * E' separado porque e' o numero que diz o quanto a timeline esta' a
 * mentir por omissao — e o que a interface mostra ao lado do link, para a pessoa
 * saber que aquilo e' um limite dos dados e nao um esquecimento dela.
 */
export function quantosSemData(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  return lista.filter((i) => !dataDaTimeline(i).data).length;
}