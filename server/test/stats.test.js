// Testes da pagina /stats: o histograma, a decada, e sobretudo o CONTADOR DE
// TEMPO VISTO, que tem regras que so' se provam com dados.
//
// PORQUE ISTO MERECE TESTE A SERIO: o contador de tempo decide o que se conta
// como "visto". Um bug ai distorce a figura principal da pagina e nao da erro
// nenhum — apenas um numero mayor do que devia. E a regra do salto e' o oposto
// do que se espera a primeira vista (saltar para a frente NAO conta), por isso
// vale a pena fixa-la em codigo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Base isolada por ficheiro de teste (o `node --test` corre cada um num
// processo). Tem de estar ANTES do import do store.
process.env.DB_DIR = mkdtempSync(join(tmpdir(), "meida-stats-"));

const store = await import("../src/store.js");
const { statsFor } = await import("../src/stats.js");

/* ===== O contador de tempo visto ========================================= */

// Cria a biblioteca minima e devolve o id do utilizador.
function novoUtilizador(nome) {
  return store.createUser(nome, "h").id;
}

/**
 * Avanca a posicao `passos` vezes, de `salto` em `salto` segundos.
 * `duration` fixo, para a regra do salto nao ficar aPraise.
 */
function ver(userId, type, tmdbId, { passos = 0, salto = 20, duration = 1440, de = 0 }) {
  for (let k = 1; k <= passos; k++) {
    store.setProgressPosition(userId, type, tmdbId, {
      position: de + k * salto,
      duration,
    });
  }
}

test("tempo visto: soma o avanco de cada gravacao", () => {
  const u = novoUtilizador("tempo1");
  // 30 passos de 20 s = 600 s, MENOS o primeiro (nao ha posicao anterior).
  ver(u, "tv", 1, { passos: 30 });
  assert.equal(store.getProgress(u, "tv", 1).secondsWatched, 29 * 20);
});

test("tempo visto: o primeiro passo nao conta (nao se sabe o intervalo)", () => {
  const u = novoUtilizador("tempo2");
  store.setProgressPosition(u, "tv", 2, { position: 100, duration: 1440 });
  assert.equal(
    store.getProgress(u, "tv", 2).secondsWatched,
    0,
    "uma unica gravacao nao prova que se viu seja o que for"
  );
});

test("tempo visto: saltar para a frente NAO conta", () => {
  const u = novoUtilizador("tempo3");
  ver(u, "tv", 3, { passos: 5 }); // 100 s
  const antes = store.getProgress(u, "tv", 3).secondsWatched;
  // Salto de 1000 s: ninguem viu os 1000 segundos que saltou.
  store.setProgressPosition(u, "tv", 3, { position: 1500, duration: 1440 });
  assert.equal(store.getProgress(u, "tv", 3).secondsWatched, antes, "o salto inflava o total");
});

test("tempo visto: recuar para ver de novo NAO conta (e' o que evita contar 3x)", () => {
  const u = novoUtilizador("tempo4");
  ver(u, "tv", 4, { passos: 5 });
  const antes = store.getProgress(u, "tv", 4).secondsWatched;
  store.setProgressPosition(u, "tv", 4, { position: 100, duration: 1440 });
  assert.equal(store.getProgress(u, "tv", 4).secondsWatched, antes, "o delta negativo foi contado");
});

test("tempo visto: recuar e avancar devolve o mesmo tempo, nao mais", () => {
  const u = novoUtilizador("tempo5");
  ver(u, "tv", 5, { passos: 10 }); // 180 s
  const antes = store.getProgress(u, "tv", 5).secondsWatched;
  // Volta a ver 20 s e segue em diante: o avanco e' o mesmo 20 s de uma vez.
  store.setProgressPosition(u, "tv", 5, { position: 80, duration: 1440 });
  store.setProgressPosition(u, "tv", 5, { position: 100, duration: 1440 });
  assert.equal(store.getProgress(u, "tv", 5).secondsWatched, antes + 20);
});

test("tempo visto: sem duration nao se conta nada", () => {
  const u = novoUtilizador("tempo6");
  store.setProgressPosition(u, "tv", 6, { position: 100 });
  store.setProgressPosition(u, "tv", 6, { position: 120 });
  // Sem `duration` nao se sabe se um salto de 20 s e' ver 20 s ou recuar 80.
  assert.equal(store.getProgress(u, "tv", 6).secondsWatched, 0);
});

test("tempo visto: acumula entre gravacoes e nunca substitui", () => {
  const u = novoUtilizador("tempo7");
  ver(u, "tv", 7, { passos: 5 }); // posicoes 20..100; o 1.o passo nao conta -> 80 s
  const meio = store.getProgress(u, "tv", 7).secondsWatched;
  // Segunda volta a partir de 100: agora a posicao anterior ja' e' conhecida, por
  // isso os CINCO passos contam todos (5 x 20 = 100 s), e nao quatro.
  ver(u, "tv", 7, { passos: 5, de: 100 });
  assert.equal(store.getProgress(u, "tv", 7).secondsWatched, meio + 100, "a segunda volta nao substituiu");
});

test("tempo visto: dois titulos diferentes somam no total", () => {
  const u = novoUtilizador("tempo8");
  ver(u, "tv", 8, { passos: 5 });
  ver(u, "tv", 9, { passos: 5 });
  const s = statsFor(u);
  assert.equal(s.tempoVisto, 80 * 2);
  assert.equal(s.temposComMedida, 2, "a pagina diz em quantos titulos foi medido");
});

/* ===== O ano ============================================================== */

test("setLibraryYear guarda o ano e nao repete", () => {
  const u = novoUtilizador("ano1");
  store.upsertLibrary({ userId: u, tmdbId: 100, type: "movie", title: "A", watched: 1 });
  assert.equal(store.getLibraryItem(u, 100, "movie").year, null, "nasce a null");
  assert.equal(store.setLibraryYear(u, 100, "movie", "2005"), true);
  assert.equal(store.getLibraryItem(u, 100, "movie").year, 2005, "aceita string");
  assert.equal(store.setLibraryYear(u, 100, "movie", 2005), false, "repetir nao escreve");
});

test("marcar como visto NAO perde o ano", () => {
  // O `upsertLibrary` faz `year = COALESCE(excluded.year, library.year)`. Sem o
  // COALESCE, qualquer clique em "visto" gravava NULL por cima do ano.
  const u = novoUtilizador("ano2");
  store.upsertLibrary({ userId: u, tmdbId: 101, type: "movie", title: "A", year: 1999 });
  store.upsertLibrary({ userId: u, tmdbId: 101, type: "movie", watched: 1 }); // sem year
  assert.equal(store.getLibraryItem(u, 101, "movie").year, 1999, "o ano foi apagado");
});

test("um ano invalido nao e' guardado", () => {
  const u = novoUtilizador("ano3");
  store.upsertLibrary({ userId: u, tmdbId: 102, type: "movie", title: "A" });
  for (const mau of ["", "abc", null, 0, -5, 1800, 99999]) {
    store.setLibraryYear(u, 102, "movie", mau);
    assert.equal(
      store.getLibraryItem(u, 102, "movie").year,
      null,
      `guardou o ano invalido ${JSON.stringify(mau)}`
    );
  }
});

/* ===== statsFor =========================================================== */

test("histograma: cada nota cai na faixa certa, e a soma bate certo", () => {
  const u = novoUtilizador("hist1");
  const notas = [1, 9, 10, 10, 55, 70, 100, 99];
  for (let i = 0; i < notas.length; i++) {
    store.upsertLibrary({
      userId: u, tmdbId: 200 + i, type: "movie", title: `T${i}`,
      watched: 1, score: notas[i],
    });
  }
  const s = statsFor(u);
  assert.equal(s.comNota, 8);
  const soma = s.histogram.barras.reduce((a, b) => a + b.n, 0);
  assert.equal(soma, 8, "as barras somam o total de notas");
  // 0-10 leva o 1 e o 9; 10-20 os dois 10; 50-60 o 55; 70-80 o 70; 90-100 o 100 e o 99.
  assert.deepEqual(
    s.histogram.barras.map((b) => b.n),
    [2, 2, 0, 0, 0, 1, 0, 1, 0, 2]
  );
  assert.equal(s.notaMaisAlta, 100);
  assert.equal(s.notaMaisBaixa, 1);
});

test("histograma: uma nota de 100 nao cai na faixa seguinte", () => {
  // O limite superior e' exclusivo: 100 tem de ficar em 90-100, nao em "1000-1010".
  const u = novoUtilizador("hist2");
  store.upsertLibrary({ userId: u, tmdbId: 300, type: "movie", title: "A", watched: 1, score: 100 });
  const s = statsFor(u);
  assert.equal(s.histogram.barras[9].n, 1);
  assert.equal(s.histogram.barras.length, 10, "nenhuma barra a mais");
});

test("decada: agrupa por DEZENA e diz quantos titulos entraram", () => {
  const u = novoUtilizador("dec1");
  // 1980, 1988 e 1989 tem de acabar na MESMA decada, mesmo com anos diferentes
  // dentro dela. E 1975/2019/2020 nao podem entrar na contagem.
  const anos = [1975, 1980, 1988, 1989, 1990, 2005, 2019, 2020];
  for (let i = 0; i < anos.length; i++) {
    store.upsertLibrary({ userId: u, tmdbId: 400 + i, type: "movie", title: `T${i}`, year: anos[i] });
  }
  const s = statsFor(u);
  assert.equal(s.decadaFavorita.decada, 1980, "os anos 1980-1989 tem de ficar juntos");
  assert.equal(s.decadaFavorita.n, 3);
  assert.equal(s.decadaFavorita.comAno, anos.length, "a cobertura diz os 8, nao os da decada");
  assert.deepEqual(
    s.decadas.map((d) => `${d.decada}:${d.n}`),
    ["1970:1", "1980:3", "1990:1", "2000:1", "2010:1", "2020:1"]
  );
});

test("decada: e' o ANO DO TITULO, nao o ano em que a pessoa o viu", () => {
  // Um anime de 2011 visto hoje e' da decada de 2010. Usar `started_at` daria
  // 2020, e a pagina ficaria a dizer uma coisa errada.
  const u = novoUtilizador("dec2");
  store.upsertLibrary({ userId: u, tmdbId: 500, type: "anime", title: "A", year: 2011 });
  const s = statsFor(u);
  assert.equal(s.decadaFavorita.decada, 2010);
});

test("decada: sem ano nenhum, nao inventa", () => {
  const u = novoUtilizador("dec3");
  store.upsertLibrary({ userId: u, tmdbId: 600, type: "movie", title: "A" });
  const s = statsFor(u);
  assert.equal(s.decadaFavorita, null, "inventou uma decada");
  assert.deepEqual(s.decadas, []);
});

test("genero favorito: desempate alfabetico, para nao saltar entre carregamentos", () => {
  const u = novoUtilizador("gen1");
  // Dois generos com a mesma contagem. Sem desempate, o "melhor" dependia da
  // ordem em que o Map devolveu as chaves.
  store.upsertLibrary({ userId: u, tmdbId: 700, type: "movie", title: "A", genres: ["Zebra", "Alfa"] });
  store.upsertLibrary({ userId: u, tmdbId: 701, type: "movie", title: "B", genres: ["Zebra", "Alfa"] });
  const s = statsFor(u);
  assert.equal(s.generoFavorito.nome, "Alfa", "o desempate tem de ser alfabetico");
  assert.equal(s.generoFavorito.n, 2);
});

test("uma biblioteca vazia nao rebenta e diz zero em tudo", () => {
  const u = novoUtilizador("vazia1");
  const s = statsFor(u);
  assert.equal(s.titulos, 0);
  assert.equal(s.comNota, 0);
  assert.equal(s.media, null, "sem notas, media e' null e nao 0");
  assert.equal(s.mediana, null);
  assert.equal(s.notaMaisAlta, null);
  assert.equal(s.generoFavorito, null);
  assert.equal(s.decadaFavorita, null);
  assert.equal(s.tempoVisto, 0);
  assert.equal(s.histogram.barras.length, 10, "as dez faixas existem sempre");
  assert.ok(s.histogram.barras.every((b) => b.n === 0));
});

test("as contas nao se baralham entre utilizadores", () => {
  const a = novoUtilizador("sep1");
  const b = novoUtilizador("sep2");
  store.upsertLibrary({ userId: a, tmdbId: 800, type: "movie", title: "A", watched: 1, score: 90, year: 2001 });
  ver(a, "tv", 801, { passos: 3 });

  store.upsertLibrary({ userId: b, tmdbId: 900, type: "anime", title: "B", watched: 1, score: 50, year: 1995 });

  const sa = statsFor(a);
  const sb = statsFor(b);
  assert.equal(sa.titulos, 1);
  assert.equal(sb.titulos, 1);
  assert.equal(sa.notaMaisAlta, 90);
  assert.equal(sb.notaMaisAlta, 50, "a nota do outro entrou");
  assert.equal(sa.decadaFavorita.decada, 2000);
  assert.equal(sb.decadaFavorita.decada, 1990);
  assert.equal(sa.tempoVisto, 40);
  assert.equal(sb.tempoVisto, 0, "o tempo do outro entrou");
});

test("mediana com numero par e' a media dos dois do meio", () => {
  const u = novoUtilizador("med1");
  [10, 20, 30, 40].forEach((n, i) =>
    store.upsertLibrary({ userId: u, tmdbId: 1000 + i, type: "movie", title: `T${i}`, watched: 1, score: n })
  );
  const s = statsFor(u);
  assert.equal(s.mediana, 25);
  assert.equal(s.media, 25);
  assert.equal(s.notaMaisAlta, 40, "a mediana nao sujou o maximo");
  assert.equal(s.notaMaisBaixa, 10, "a mediana nao sujou o minimo");
});