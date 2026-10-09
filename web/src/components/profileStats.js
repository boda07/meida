// Estatisticas do perfil, calculadas no frontend a partir dos itens que a API
// ja devolve (a biblioteca completa chega em /users/:username/library).
//
// Porquê no cliente e nao no servidor: os dados ja cá estao todos, nao ha
// contagens novas a trazer. Um pedido extra ao servidor seria trabalho sem
// ganho.
//
// Os numeros que interessam, e porque:
//   - titulos: quantos estao na biblioteca (o total da pessoa)
//   - vistos: os que ela acabou (estado "completed")
//   - aVer: os que ela quer ver (estado "plan", a watchlist)
//   - emPausa / abandonados: os que ela comecou e parou, ou deitou fora
//   - media: a media das notas pessoais (0-100), so de quem puso nota
//
// "aVer" e' a lista de "para ver", NAO "o que a pessoa esta a ver agora". Em
// portugues as duas coisas chamam-se quase igual e e' por aqui que nasce a
// confusao: o diario tem um status "watching" que e' mesmo "a ver agora" (so
// existe depois de comecar), enquanto a watchlist e' a intencao. Por isso a
// etiqueta na UI diz "para ver" e o "a ver agora" vem do diario (ver
// UserProfile.jsx).
//
// Separar "titulos" de "vistos + aVer" conta cada titulo uma vez so: um titulo
// marcado como visto E na watchlist conta 1 em "titulos", nao 2.

/**
 * Estado final de um item da biblioteca. E' a MESMA regra que `estadoDe()` no
 * servidor (`server/src/store.js`), reescrita aqui de proposito: o frontend nao
 * pode importar o store do servidor — essa cadeia traz o SQLite
 * (`db/index.js`) e abriria uma base de dados dentro do browser.
 *
 * Sao oito linhas. Para que as duas versoes nao voltem a divergir (foi essa
 * divergencia que fez o perfil contar 389 "para ver" quando a pessoa via 2),
 * `scripts/testar-estados.mjs` verifica que concordam.
 */
export function estadoDe(e) {
  if (!e) return "none";
  if (e.status === "paused") return "paused";
  if (e.status === "dropped") return "dropped";
  if (e.watched) return "completed";
  if (e.watchlist) return "plan";
  return "none";
}

/** Calcula as quatro estatisticas a partir dos itens da biblioteca. */
export function statsFrom(items) {
  const lista = Array.isArray(items) ? items : [];
  let vistos = 0;
  let aVer = 0;
  let soma = 0;
  let comNota = 0;

  let emPausa = 0;
  let abandonados = 0;

  for (const it of lista) {
    // Conta-se pelo ESTADO, nao pelas flags cruas. Era assim que um titulo
    // "em pausa" ou "abandonado" acabava contado como "para ver" — e o perfil
    // mostrava 389 quando a pessoa via 2 (2026-10-07).
    const estado = estadoDe(it);
    if (estado === "completed") vistos++;
    else if (estado === "plan") aVer++;
    else if (estado === "paused") emPausa++;
    else if (estado === "dropped") abandonados++;
    if (typeof it.score === "number" && it.score > 0) {
      soma += it.score;
      comNota++;
    }
  }

  return {
    total: lista.length,
    vistos,
    aVer,
    emPausa,
    abandonados,
    // Media arredondada. Sem notas e' null, para a UI poder esconder em vez de
    // mostrar 0 (que e' diferente de "nota media zero").
    media: comNota ? Math.round(soma / comNota) : null,
  };
}

// ---------------------------------------------------------------------------
// Estatisticas da aba "Estatisticas": mais do que quatro numeros.
//
// Aqui ja nao e' so contar -- e' agrupar a biblioteca para responder a "que tipo
// de pessoa ve isto": que generos, que formatos, e como distribui as notas.
//
// O que NAO se calcula, e porquê: ano de estreia, temporada, estudio, duracao e
// numero de episodios. Nada disso esta' guardado na tabela `library` (ver
// `toApi()` em server/src/store.js: so' ha tipo, generos e nota). Prometer um
// grafico por ano com dados que nao existem daria sempre zero. Se um dia
// passarmos a guardar `air_date`/`genres` da/details, e' aqui que o grafico
// entra -- nao noutro sitio.
//
// As contagens sao de titulos, nao de generos: um anime de accao com fantasia
// conta 1 em "titulos" e 1 em cada um dos dois generos. E' por isso que a soma
// dos generos passa largamente o total -- e o correcto.
const ROTULO_TIPO = { anime: "Anime", movie: "Filmes", tv: "Series" };

// Genero em ingles -> rotulo em portugues (para mostrar). A BD guarda ingles
// porque e' assim que vem da TMDB/AniList; a UI fala portugues. O que nao
// estiver aqui aparece tal e qual — termos como "Isekai" ou "Shounen" nao tem
// traducao usavel e troca-los so' confundia.
export const ROTULO_GENERO = {
  Action: "Ação",
  Adventure: "Aventura",
  Animation: "Animação",
  Comedy: "Comédia",
  Crime: "Crime",
  Documentary: "Documentário",
  Drama: "Drama",
  Family: "Família",
  Fantasy: "Fantasia",
  History: "História",
  Horror: "Terror",
  Music: "Música",
  Música: "Música",
  Mystery: "Mistério",
  Romance: "Romance",
  "Science Fiction": "Ficção Científica",
  "Sci-Fi": "Ficção Científica",
  Thriller: "Thriller",
  War: "Guerra",
  Western: "Faroeste",
};

/** Nome do genero para mostrar: traduz quando sabemos, senao devolve igual. */
export function rotuloGenero(nome) {
  return ROTULO_GENERO[nome] || nome;
}

// Ordem fixa, para as barras sairem sempre iguais (e nao por ordem de contagem,
// que mudaria a cada titulo novo).
const ORDEM_TIPO = ["anime", "movie", "tv"];

// Quantos generos mostrar. Oito enche uma coluna sem ficar um muro de barras, e
// cobre praticamente tudo: um genero que fica sempre de fora e' porque so' duas
// ou tres pessoas o tem.
const MAX_GENEROS = 8;

/**
 * As estatisticas da aba. Devolve sempre as tres listas, mesmo vazias, para a
 * UI poder dizer "ainda nao ha notas" em vez de nao mostrar nada.
 *
 * @param items  a biblioteca completa
 */
export function detalheStats(items) {
  const lista = Array.isArray(items) ? items : [];

  const generos = new Map();
  const tipos = new Map(ORDEM_TIPO.map((t) => [t, 0]));
  const notas = [];
  let soma = 0;

  let vistos = 0;
  let aVer = 0;
  let emPausa = 0;
  let abandonados = 0;

  for (const it of lista) {
    const estado = estadoDe(it);
    // `vistos` e `aVer` eram calculados so' por `statsFrom()`, que a aba nao
    // chama — por isso a aba mostrava as linhas com o numero em branco, e' o
    // "falta o a ver" do perfil de outra pessoa (desde a 1.3.2). Aqui sao do
    // mesmo estadoDe, sobre a MESMA lista (logo, sobre o filtro de genero).
    if (estado === "completed") vistos++;
    else if (estado === "plan") aVer++;
    else if (estado === "paused") emPausa++;
    else if (estado === "dropped") abandonados++;

    if (it.type && tipos.has(it.type)) tipos.set(it.type, tipos.get(it.type) + 1);

    for (const g of Array.isArray(it.genres) ? it.genres : []) {
      const nome = String(g || "").trim();
      if (nome) generos.set(nome, (generos.get(nome) || 0) + 1);
    }

    if (typeof it.score === "number" && it.score > 0) {
      notas.push(it.score);
      soma += it.score;
    }
  }

  // Desempate pela media mais alta; seemn empate, o titulo mais recente (a API
  // ordena por updated_at) -- o mesmo criterio que a capa usava.
  const comNota = notas.length;
  notas.sort((a, b) => b - a);
  const media = comNota ? Math.round(soma / comNota) : null;
  const mediana = comNota
    ? (comNota % 2
        ? notas[(comNota - 1) / 2]
        : Math.round((notas[comNota / 2 - 1] + notas[comNota / 2]) / 2))
    : null;

  // Ordenar por contagem e, em empate, alfabeticamente -- para o resultado ser
  // igual sempre. Sem o desempate, dois generos com 12 titulos trocavam de lugar
  // conforme a ordem da base de dados.
  const listaGeneros = [...generos.entries()]
    .map(([nome, n]) => ({ nome, n }))
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt"))
    .slice(0, MAX_GENEROS);

  return {
    total: lista.length,
    vistos,
    aVer,
    emPausa,
    abandonados,
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
    // Quantos generos distintos tem a biblioteca toda, para o "8 de 24" ao lado
    // do titulo dizer que a lista esta cortada.
    totalGeneros: generos.size,
  };
}

/* ===== Serie temporal =====================================================
   As estatisticas todas acima sao CATEGORICAS: contam ("12 accao"),
   distribuem ("genero mais visto"), resumem ("nota mais alta"). Nenhuma
   responde a "quanto tenho visto ultimamente" — que e' a pergunta que um perfil
   perguntado a si proprio coloca ao fim de um mes.

   Este bloco preenche essa lacuna. E' o que o projecto antigo (ProdSound)
   mostra com `.pa-chart`: colunas por mes, seis meses. Aqui sao 12, porque um
   ano mostra o ciclo e seis meses esconde a pergunta "ainda vou a tempo?".

   A data vem do campo `updatedAt` que a biblioteca ja' traz. NÃO e' a data em
   que a pessoa viu a coisa: e' a ultima vez que esse item mudou (meteu-se na
   biblioteca, deu-lhe nota, marcou como visto). O grafico mede ACTIVIDADE, nao
   visionamento — e o texto da legenda diz isso, para ninguem ler mais do que
   esta escrito. (Para visionamento a serio seria preciso o historico do
   `progress`, que a API do perfil nao traz.)

   Por omissao devolve uma serie vazia: a UI esconde o bloco, em vez de mostrar
   um eixo vazio. */

const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/**
 * Chave "AAAA-MM" de uma data, ou null se nao der para ler. Aceita o que a API
 * devolve (ISO com ou sem horas) e tambem so "AAAA-MM" — a biblioteca pode ter
 * datas assim vindas da importacao.
 */
function chaveMes(valor) {
  const m = /^(\d{4})-(\d{2})/.exec(String(valor || ""));
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Titulos mexidos por mes, nos ultimos `meses` meses, incluindo o mes corrente.
 *
 * @param items  a biblioteca (o mesmo array que o resto de `detalheStats`)
 * @param meses  quantos meses para tras; por omissao 12
 * @returns {{chave:string, rotulo:string, n:number, mes:number, ano:number}[]}
 *          sempre com `meses` entradas, para o eixo nunca ter buracos
 */
export function serieMensal(items, meses = 12) {
  const agora = new Date();
  // Os ultimos N meses, do mais antigo ao mes corrente. Constroi-se a partir do
  // ano/mes e nao de "agora - 30 dias", para o eixo cair sempre em meses
  // inteiros: um grafico com o ultimo corte a meio do mes e' um mes e' meio.
  const chaves = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    chaves.push({
      chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      rotulo: MESES_PT[d.getMonth()],
      mes: d.getMonth(),
      ano: d.getFullYear(),
      n: 0,
    });
  }

  const pos = new Map(chaves.map((c, i) => [c.chave, i]));
  for (const it of Array.isArray(items) ? items : []) {
    const k = chaveMes(it && (it.updatedAt ?? it.updated_at));
    if (k === null) continue;
    // Uma data fora da janela conta para o mes certo (se existir) ou e' ignorada.
    // `pos` tem so' as chaves da janela, por isso o `if` e' o filtro.
    const i = pos.get(k);
    if (i !== undefined) chaves[i].n++;
  }
  return chaves;
}

/** Rotulo do eixo quando muda o ano: "Jan 25". Sem mudanca: so' "Jan". */
export function rotuloEixo(ponto, mostrarAno) {
  return mostrarAno ? `${ponto.rotulo} ${String(ponto.ano).slice(2)}` : ponto.rotulo;
}