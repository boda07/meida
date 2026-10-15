// As seis estatisticas da pagina /stats.
//
//PORQUE ESTA AQUI E NAO NO FRONTEND: cinco das seis ja se podiam calcular no
// cliente a partir da biblioteca que o perfil ja traz (`profileStats.js` faz
//exactly isso para os generos e para as notas). So' DUAS nao davam:
//
//   - o tempo total visto vive na tabela `progress`, que o perfil nao pede (e' o
//     diario, que e' privado);
//   - a decada favorite precisa de agrupar por ano, e o perfil so' traz a lista
//     sem qualquer consulta.
//
// E o calculo do histograma e' melhor no servidor: 736 linhas a contar e a
// agrupar sao uma passage, e devolve-se so' o histograma ja' pronto em vez de
// mandar os dados todos para o browser.
//
// Devolve sempre as CHAVES, mesmo vazias ({} ou []). A UI precisa de distinguir
// "zero" de "nao medido": `tempoVisto: 0` e' a verdade quando a app ainda nao
// media, e a pagina tem de dizer isso em vez de esconder a figura sem explicacao.
import { db } from "./db/index.js";
import { toApi } from "./store.js";
import { contaFilmesPorAno, melhoresDoAno } from "./metas.js";

const parseGenres = (json) => {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/**
 * As seis figuras. Tudo numa leitura da biblioteca e uma do diario.
 *
 * @param userId
 * @returns {{
 *   titulos:number, vistos:number, paraVer:number, comNota:number,
 *   notaMaisAlta:number|null, notaMaisBaixa:number|null, media:number|null,
 *   mediana:number|null,
 *   tempoVisto:number, temposComMedida:number,
 *   generoFavorito:{nome:string,n:number}|null,
 *   decadaFavorita:{decada:number,n:number,comAno:number}|null,
 *   histogram:{de:number,a:number,largura:number,barras:{de:number,a:number,n:number}[]},
 *   decadas:{decada:number,n:number}[],
 *   dias:{dia:string,n:number}[],
 * }}
 */
/**
 * Quantas coisas por HORA DO DIA, em 24 baldes.
 *
 * PURE, e por isso exportado para o teste — e' a logica nova deste bloco.
 *
 * **As horas sao em UTC, e o cliente roda o histograma.** E' o mesmo cuidado do
 * `dayOf` acima, mas mais visivel: no mapa de calor um dia fora de sitio muda
 * uma coluna, aqui mudaria a hora de um pico de "as 22h" para as 23h — e o
 * Render e o FadeHost estao em UTC enquanto o utilizador nao. Rodar um
 * histograma e' exacto (nao e' uma media nem uma aproximacao) e custa 24
 * numeros em vez de milhares de datas.
 *
 * @param isos  as datas a contar
 * @returns {{hora:number,n:number}[]} sempre 24 baldes, do 0 ao 23
 */
export function contaPorHora(isos) {
  const porHora = new Array(24).fill(0);
  for (const iso of isos || []) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    // `getUTCHours()` e' o que casa com a chave do `dayOf`, que tambem e' UTC.
    porHora[d.getUTCHours()]++;
  }
  return porHora.map((n, hora) => ({ hora, n }));
}

/** "YYYY-MM-DD" a partir de um ISO. Igual ao do `routes/achievements.js`:
 *  as duas rachas e o mapa de calor têm de concordar nas chaves. */
function dayOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function statsFor(userId) {
  const linhas = db
    .prepare("SELECT * FROM library WHERE user_id = ?")
    .all(userId);
  // `linhas` sao as linhas CRUAS do SQLite (`media_type`, `updated_at`), e o
  // resto deste ficheiro conta nelas assim. As funcoes de `metas.js`, ao
  // contrario, esperam a forma de `listLibrary` (`type`, `updatedAt`) porque o
  // `/api/goals` lhes passa essa.
  //
  // **Esta linha resolve a diferenca, e sem ela a meta do cartao de partilha
  // dava sempre zero.** Foi o que aconteceu na primeira versao: `l.type` era
  // `undefined`, o `continue` comecava a correr e `filmesPorAno`/`topDoAno`
  // voltavam vazios — com o build e os testes todos a passar, porque nenhum
  // teste chega a executar o SQL. `melhoresDoAno` e `contaFilmesPorAno` tambem
  // leem `l.watched`, `l.score`, `l.title` e `l.poster`, que so' existem com
  // este mapeamento.
  const emApi = linhas.map((r) => toApi(r));

  // ---- contagens, notas, generos, anos ------------------------------------
  const generos = new Map();
  const decadas = new Map();
  const notas = [];
  let vistos = 0;
  let paraVer = 0;
  let soma = 0;

  for (const r of linhas) {
    if (r.watched) vistos++;
    else if (r.watchlist) paraVer++;

    if (typeof r.score === "number" && r.score > 0) {
      notas.push(r.score);
      soma += r.score;
    }

    for (const g of parseGenres(r.genres)) {
      const nome = String(g || "").trim();
      if (nome) generos.set(nome, (generos.get(nome) || 0) + 1);
    }

    // A DECADA e' do titulo (ano de estreia), nao do ano em que a pessoa o viu.
    // Sao coisas diferentes: um anime de 2011 visto em 2026 e' da decada de 2010.
    if (r.year) {
      const d = Math.floor(r.year / 10) * 10;
      decadas.set(d, (decadas.get(d) || 0) + 1);
    }
  }

  // A mediana ordena uma copia: `notas.sort()` mudaria a ordem da lista de
  // entrada e o maisAlta/maisBaixa sairam trocados.
  const ordenadas = [...notas].sort((a, b) => a - b);
  const comNota = notas.length;
  const mediana = comNota
    ? ordenadas.length % 2
      ? ordenadas[(ordenadas.length - 1) / 2]
      : Math.round((ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2)
    : null;

  // ---- tempo visto --------------------------------------------------------
  // Uma consulta, e o store e' quem poe os segundos (ver `setProgressPosition`).
  const tempos = db
    .prepare(
      `SELECT COALESCE(SUM(seconds_watched), 0) AS total,
              SUM(CASE WHEN seconds_watched > 0 THEN 1 ELSE 0 END) AS medidos
         FROM progress WHERE user_id = ?`
    )
    .get(userId);

  // ---- o histograma das notas ---------------------------------------------
  // Dez barras de 10 pontos. E' a leitura que um "nota mais alta: 94" nao da: o
  // histograma mostra se a pessoa Nota tudo a 90 ou se espalha.
  //
  // A faixa e' `floor(nota / 10)`, e nao `(nota - 1) / 10`. A diferenca e' o
  // limite: com a primeira, a nota 10 cai em "10-20" e a 70 em "70-80", que e'
  // como se lê. Com a segunda, a 10 caia em "0-10" e a 70 em "60-70" — e os
  // rotulos ficavam a mentir sobre as notas que neles cabiam.
  //
  // A ultima faixa (90-100) e' onde cai tambem o 100, que de outra forma ia
  // parar a um indice 10 que nao existe.
  const barras = Array.from({ length: 10 }, (_, i) => ({ de: i * 10, a: i * 10 + 10, n: 0 }));
  for (const n of notas) {
    const i = Math.min(9, Math.floor(n / 10));
    barras[i].n++;
  }

  // ---- atividade por dia (o mapa de calor) --------------------------------
  // Um dia por chave "YYYY-MM-DD", com o numero de coisas que nesse dia
  // aconteceram. E' a MESMA contagem que a racha usa (`routes/achievements.js`):
  // `library.updated_at` e os tres campos de data do `progress`. Escolhi as
  // mesmas de proposito — se o heatmap contasse outra coisa, a racha que se
  // ve aqui embaixo nao bateria com os quadradinhos, e um dos dois estaria
  // errado sem ninguem ver.
  //
  // Aviso honesto: `updated_at` tambem muda quando se edita um titulo, e nao so
  // quando se ve. Um titulo visto em janeiro cuja nota se mexeu em marco conta
  // como atividade em marco. E' o mesmo que a racha ja faz, e e' o que torna os
  // dois numeros coerentes entre si.
  // Um dia por chave "YYYY-MM-DD", com o numero de coisas que nesse dia
  // aconteceram. E' a MESMA contagem que a racha usa (`routes/achievements.js`):
  // `library.updated_at` e os tres campos de data do `progress`. Escolhi as
  // mesmas de proposito — se o heatmap contasse outra coisa, a racha que se ve
  // em `/achievements` nao bateria com os quadradinhos, e um dos dois estaria
  // errado sem ninguem ver.
  //
  // Aviso honesto: `updated_at` tambem muda quando se edita um titulo, e nao so
  // quando se ve. Um titulo visto em janeiro cuja nota se mexeu em marco conta
  // como atividade em marco. E' o mesmo que a racha ja faz, e e' o que torna os
  // dois numeros coerentes entre si.

  // As datas do diario. Sao tres colunas so (inicio, fim, actualizacao), e o
  // que interessa e' QUANTAS vezes cada dia aparece — por isso vem agrupado do
  // servidor e nao linha a linha.
  const porDia = new Map();
  const somaDia = (dia) => {
    if (!dia) return;
    porDia.set(dia, (porDia.get(dia) || 0) + 1);
  };
  // As duas contagens leem a MESMA linha, por isso basta um passe: o dia para o
  // mapa e a hora para o grafico, sem uma segunda leitura da biblioteca.
  const datas = [];
  for (const r of linhas) {
    somaDia(dayOf(r.updated_at));
    datas.push(r.updated_at);
  }

  const datasProgresso = db
    .prepare(
      `SELECT started_at, finished_at, updated_at FROM progress WHERE user_id = ?`
    )
    .all(userId);
  for (const p of datasProgresso) {
    somaDia(dayOf(p.started_at));
    somaDia(dayOf(p.finished_at));
    somaDia(dayOf(p.updated_at));
    datas.push(p.started_at, p.finished_at, p.updated_at);
  }

  // ---- o "melhor" de cada: desempate por nome ------------------------------
  // Desempate alfabetico, como no `perfil`: sem isso dois generos com 12 titulos
  // trocavam de sitio entre dois carregamentos e o numero parecia saltar.
  //
  // O segundo argumento que esta funcao aceitava (`chave`) nunca foi usado — o
  // desempate e' sempre sobre o nome da chave, em qualquer um dos dois mapas —
  // e aparecia como aviso de lint.
  const melhor = (m) => {
    let best = null;
    for (const [nome, n] of m) {
      if (!best || n > best.n || (n === best.n && String(nome).localeCompare(String(best.nome), "pt") < 0)) {
        best = { nome, n };
      }
    }
    return best;
  };

  const gen = melhor(generos);
  const dec = melhor(decadas);
  const comAno = [...decadas.values()].reduce((a, b) => a + b, 0);

  return {
    titulos: linhas.length,
    vistos,
    paraVer,
    comNota,
    notaMaisAlta: comNota ? Math.max(...notas) : null,
    notaMaisBaixa: comNota ? Math.min(...notas) : null,
    media: comNota ? Math.round(soma / comNota) : null,
    mediana,

    tempoVisto: Number(tempos?.total || 0),
    // Quantos progressos TEM medicao. Serve para a UI dizer "isto e' do que foi
    // medido desde ontem" em vez de presenting um total parcial como se fosse
    // completo — o mesmo cuidado que a legenda do grafico de meses.
    temposComMedida: Number(tempos?.medidos || 0),

    generoFavorito: gen,
    // `comAno` diz quantos titulos entraram na contagem. Se for muito menos que a
    // biblioteca, a decada e' "dos que tem ano" e nao de tudo — e a pagina tem de
    // dizer isso, senao o numero parece mais firme do que e'.
    decadaFavorita: dec
      ? { decada: dec.nome, n: dec.n, comAno }
      : null,
    decadas: [...decadas.entries()]
      .map(([decada, n]) => ({ decada, n }))
      .sort((a, b) => a.decada - b.decada),

    // 24 baldes de HORA, em UTC — quem mostra e' o cliente, que roda pelo fuso
    // do utilizador. Vem sempre com os 24, mesmo vazios: o grafico precisa de
    // a linha toda para as horas a serio se lerem como horas.
    horasUtc: contaPorHora(datas),

    // Os 3 titulos que melhor avaliaste NESTE ANO — o que dá conteudo a um
    // cartao de partilha. Escopado ao ano de proposito: o cartao tem de ser todo
    // "deste ano", e nao metade deste ano e metade de sempre.
    topDoAno: melhoresDoAno(emApi, new Date().getUTCFullYear(), 3),

    // A MESMA contagem que `/api/goals` devolve, pela MESMA funcao pura e com
    // o MESMO argumento — e por isso que as duas nao podem divergir. Repete-se
    // aqui para o cartao de partilha nao obrigar a `/stats` a fazer um segundo
    // pedido so' para saber quantos titulos marcaste este ano.
    filmesPorAno: contaFilmesPorAno(emApi, new Date().getUTCFullYear()),

    histogram: { de: 1, a: 100, largura: 10, barras },

    // So' os dias QUE TIVERAM atividade, ordenados. Mandar os 365 dias todos,
    // com os zeros, seria 4 KB de JSON para o browser preencher com zeros — e o
    // desenho do heatmap faz isso na mesma.
    dias: [...porDia.entries()]
      .map(([dia, n]) => ({ dia, n }))
      .sort((a, b) => (a.dia < b.dia ? -1 : 1)),
  };
}