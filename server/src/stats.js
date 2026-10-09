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
 * }}
 */
export function statsFor(userId) {
  const linhas = db
    .prepare("SELECT * FROM library WHERE user_id = ?")
    .all(userId);

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

  // ---- o "melhor" de cada: desempate por nome ------------------------------
  // Desempate alfabetico, como no `perfil`: sem isso dois generos com 12 titulos
  // trocavam de sitio entre dois carregamentos e o numero parecia saltar.
  const melhor = (m, chave) => {
    let best = null;
    for (const [nome, n] of m) {
      if (!best || n > best.n || (n === best.n && String(nome).localeCompare(String(best.nome), "pt") < 0)) {
        best = { nome, n };
      }
    }
    return best;
  };

  const gen = melhor(generos, "nome");
  const dec = melhor(decadas, "decada");
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

    histogram: { de: 1, a: 100, largura: 10, barras },
  };
}