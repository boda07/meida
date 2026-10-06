// Estatisticas do perfil, calculadas no frontend a partir dos itens que a API
// ja devolve (a biblioteca completa chega em /users/:username/library).
//
// Porquê no cliente e nao no servidor: os dados ja cá estao todos, nao ha
// contagens novas a trazer. Um pedido extra ao servidor seria trabalho sem
// ganho.
//
// Os numeros que interessam, e porque:
//   - titulos: quantos estao na biblioteca (o total da pessoa)
//   - vistos: os que ela acabou (watched)
//   - a ver: os que quer ver (watchlist e ainda nao vistos)
//   - media: a media das notas pessoais (0-100), so de quem puso nota
//
// Separar "titulos" de "vistos + a ver" conta cada titulo uma vez so: um titulo
// marcado como visto E na watchlist conta 1 em "titulos", nao 2.

/** Calcula as quatro estatisticas a partir dos itens da biblioteca. */
export function statsFrom(items) {
  const lista = Array.isArray(items) ? items : [];
  let vistos = 0;
  let aVer = 0;
  let soma = 0;
  let comNota = 0;

  for (const it of lista) {
    if (it.watched) vistos++;
    else if (it.watchlist) aVer++;
    if (typeof it.score === "number" && it.score > 0) {
      soma += it.score;
      comNota++;
    }
  }

  return {
    total: lista.length,
    vistos,
    aVer,
    // Media arredondada. Sem notas e' null, para a UI poder esconder em vez de
    // mostrar 0 (que e' diferente de "nota media zero").
    media: comNota ? Math.round(soma / comNota) : null,
  };
}

// ---------------------------------------------------------------------------
// Estatisticas da aba "Estatisticas": mais do que quatro numeros.
//
// Aqui ja nao e' so contar — e' agrupar a biblioteca para responder a "que tipo
// de pessoa ve isto": que generos, que formatos, e como distribui as notas.
//
// O que NAO se calcula, e porquê: ano de estreia, temporada, estudio, duracao e
// numero de episodios. Nada disso esta' guardado na tabela `library` (ver
// `toApi()` em server/src/store.js: so' ha tipo, generos e nota). Prometer um
// grafico por ano com dados que nao existem daria sempre zero. Se um dia
// passarmos a guardar `air_date`/`genres` da/details, e' aqui que o grafico
// entra — nao noutro sitio.
//
// As contagens sao de titulos, nao de generos: um anime de accao com fantasia
// conta 1 em "titulos" e 1 em cada um dos dois generos. E' por isso que a soma
// dos generos passa largamente o total — e o correcto.
const ROTULO_TIPO = { anime: "Anime", movie: "Filmes", tv: "Series" };

// Ordem fixa, para as barras sairem sempre iguais (e nao por ordem de contagem,
// que mudaria a cada titulo novo).
const ORDEM_TIPO = ["anime", "movie", "tv"];

// Faixas de nota. Cinco e' o sweet spot: com menos, perde-se a forma da
// distribuicao; com mais, as barras ficam com dois pixels de altura e nao se
// leem.
const FAIXAS_NOTA = [
  { ate: 20, rotulo: "ate 20" },
  { ate: 40, rotulo: "21 a 40" },
  { ate: 60, rotulo: "41 a 60" },
  { ate: 80, rotulo: "61 a 80" },
  { ate: 100, rotulo: "81 a 100" },
];

// Quantos generos mostrar. Oito enche uma coluna sem ficar um muro de barras, e
// cobre praticamente tudo: um genero que fica sempre de fora e' porque so' duas
// ou tres pessoas o tem.
const MAX_GENEROS = 8;

/**
 * As estatisticas da aba. Devolve sempre as tres listas, mesmo vazias, para a
 * UI poder dizer "ainda nao ha notas" em vez de nao mostrar nada.
 */
export function detalheStats(items) {
  const lista = Array.isArray(items) ? items : [];

  const generos = new Map();
  const tipos = new Map(ORDEM_TIPO.map((t) => [t, 0]));
  const faixas = FAIXAS_NOTA.map((f) => ({ ...f, n: 0 }));
  const notas = [];
  let soma = 0;

  for (const it of lista) {
    if (it.type && tipos.has(it.type)) tipos.set(it.type, tipos.get(it.type) + 1);

    for (const g of Array.isArray(it.genres) ? it.genres : []) {
      const nome = String(g || "").trim();
      if (nome) generos.set(nome, (generos.get(nome) || 0) + 1);
    }

    if (typeof it.score === "number" && it.score > 0) {
      notas.push(it.score);
      soma += it.score;
      for (const f of faixas) {
        if (it.score <= f.ate) {
          f.n++;
          break;
        }
      }
    }
  }

  // Desempate pela media mais alta; seemn empate, o titulo mais recente (a API
  // ordena por updated_at) — o mesmo criterio que a capa usava.
  const comNota = notas.length;
  notas.sort((a, b) => b - a);
  const media = comNota ? Math.round(soma / comNota) : null;
  const mediana = comNota
    ? (comNota % 2
        ? notas[(comNota - 1) / 2]
        : Math.round((notas[comNota / 2 - 1] + notas[comNota / 2]) / 2))
    : null;

  // Ordenar por contagem e, em empate, alfabeticamente — para o resultado ser
  // igual sempre. Sem o desempate, dois generos com 12 titulos trocavam de lugar
  // conforme a ordem da base de dados.
  const listaGeneros = [...generos.entries()]
    .map(([nome, n]) => ({ nome, n }))
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt"))
    .slice(0, MAX_GENEROS);

  return {
    total: lista.length,
    comNota,
    media,
    mediana,
    maisAlta: comNota ? notas[0] : null,
    maisBaixa: comNota ? notas[notas.length - 1] : null,
    generos: listaGeneros,
    // So' os tipos que a pessoa tem: mostrar "Series 0" e' ruido.
    tipos: ORDEM_TIPO.filter((t) => tipos.get(t) > 0).map((t) => ({
      nome: ROTULO_TIPO[t],
      n: tipos.get(t),
    })),
    faixas,
    // Quantos generos distintos tem a biblioteca toda, para o "8 de 24" ao lado
    // do titulo dizer que a lista esta cortada.
    totalGeneros: generos.size,
  };
}