// Testes do "continua a ver": o que acontece a um titulo quando se acaba um
// episodio.
//
// Existe por causa de um bug real (medido a 2026-10-06, no Dragon Ball): o
// servidor decidia se havia episodio seguinte com
//     e.nextSeason != null && e.nextEpisode != null
// mas no ANIME os episodios sao globais (1..N) e nao ha temporada — o cliente
// manda `nextSeason: null`. Resultado: `hasNext` era SEMPRE falso, o anime
// marcava-se como acabado ao fim de cada episodio e saia do "continua a ver", em
// vez de passar ao seguinte.
//
// E porque e' preciso o teste: series e filmes funcionavam sempre (a temporada
// vem preenchida), por isso o bug passou despercebido durante meses. Qualquer
// regra que dependa de `nextSeason` para decidir se ha proximo tem de ter um
// teste que falhe sem ela.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Base isolada: tem de estar definido ANTES do import do store, porque a base
// e' aberta quando o modulo e' avaliado.
const dir = mkdtempSync(join(tmpdir(), "meida-diario-"));
process.env.DB_DIR = dir;

const store = await import("../src/store.js");
const userId = store.createUser("teste_diario", "hash-falso").id;

test("anime: avanca para o episodio seguinte sem temporada", () => {
  // E' o caso que estava partido: nextSeason = null e mesmo assim ha seguinte.
  store.finishProgress({
    userId,
    type: "anime",
    tmdbId: 100,
    title: "Dragon Ball",
    season: null,
    episode: 6,
    nextSeason: null,
    nextEpisode: 7,
  });
  const p = store.getProgress(userId, "anime", 100);
  assert.equal(p.status, "watching", "tem de continuar a ver, nao ficar acabado");
  assert.equal(p.episode, 7);
});

test("anime: no ultimo episodio publicado sai do 'continua a ver'", () => {
  store.finishProgress({
    userId,
    type: "anime",
    tmdbId: 200,
    title: "Anime Acabado",
    season: null,
    episode: 12,
    nextSeason: null,
    nextEpisode: null,
  });
  const p = store.getProgress(userId, "anime", 200);
  assert.equal(p.status, "finished");
  // O diario guarda o ultimo episodio visto.
  assert.equal(p.episode, 12);
});

test("serie: dentro da mesma temporada passa para o episodio seguinte", () => {
  store.finishProgress({
    userId,
    type: "tv",
    tmdbId: 300,
    season: 2,
    episode: 4,
    nextSeason: 2,
    nextEpisode: 5,
  });
  const p = store.getProgress(userId, "tv", 300);
  assert.equal(p.status, "watching");
  assert.equal(p.season, 2);
  assert.equal(p.episode, 5);
});

test("serie: no fim da temporada salta para a primeira da seguinte", () => {
  store.finishProgress({
    userId,
    type: "tv",
    tmdbId: 400,
    season: 1,
    episode: 10,
    nextSeason: 2,
    nextEpisode: 1,
  });
  const p = store.getProgress(userId, "tv", 400);
  assert.equal(p.status, "watching");
  assert.equal(p.season, 2);
  assert.equal(p.episode, 1);
});

test("serie: na ultima temporada sai do 'continua a ver'", () => {
  store.finishProgress({
    userId,
    type: "tv",
    tmdbId: 500,
    season: 3,
    episode: 8,
    nextSeason: null,
    nextEpisode: null,
  });
  const p = store.getProgress(userId, "tv", 500);
  assert.equal(p.status, "finished");
  // A temporada fica a do episodio que acabou, para o diario.
  assert.equal(p.season, 3);
  assert.equal(p.episode, 8);
});

test("filme: acaba sempre", () => {
  store.finishProgress({ userId, type: "movie", tmdbId: 600, title: "Filme" });
  assert.equal(store.getProgress(userId, "movie", 600).status, "finished");
});

test("avancar apaga a posicao a meio do episodio anterior", () => {
  // Sem isto o cartao no "continua a ver" aparecia com a barra quase cheia do
  // episodio que acabou, no sitio do proximo.
  store.startProgress({ userId, type: "anime", tmdbId: 100, title: "Dragon Ball" });
  store.setProgressPosition(userId, "anime", 100, {
    position: 1200,
    duration: 1440,
    season: null,
    episode: 6,
  });
  store.finishProgress({
    userId,
    type: "anime",
    tmdbId: 100,
    season: null,
    episode: 6,
    nextSeason: null,
    nextEpisode: 7,
  });
  const p = store.getProgress(userId, "anime", 100);
  assert.equal(p.position, null);
  assert.equal(p.episode, 7);
});
