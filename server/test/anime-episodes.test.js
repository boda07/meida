// Testes dos episódios de anime por temporada: agrupamento por cour (13 eps)
// com quebra por pausa longa, e getAnimeEpisodes com o fetch mockado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DB_DIR = mkdtempSync(join(tmpdir(), "meida-test-anime-"));

const { groupEpisodesBySeason, getAnimeEpisodes } = await import(
  "../src/services/jikan.js"
);

const DAY = 24 * 60 * 60 * 1000;
// n episódios com `days` dias entre estreias, a partir de `start`.
function makeEps(n, days = 7, start = Date.UTC(2023, 3, 1)) {
  return Array.from({ length: n }, (_, i) => ({
    episodeNumber: i + 1,
    name: `Episódio ${i + 1}`,
    aired: start + i * days * DAY,
    filler: false,
    recap: false,
  }));
}

function countPerSeason(seasons) {
  return seasons.map((s) => s.episodes.length);
}

test("12 episodios (1 cour): uma so temporada", () => {
  const seasons = groupEpisodesBySeason(makeEps(12));
  assert.equal(seasons.length, 1);
  assert.equal(seasons[0].episodeCount ?? seasons[0].episodes.length, 12);
  assert.equal(countPerSeason(seasons)[0], 12);
});

test("24 episodios semanais (2 cours): duas temporadas de ~13", () => {
  const seasons = groupEpisodesBySeason(makeEps(24));
  assert.equal(seasons.length, 2);
  assert.deepEqual(countPerSeason(seasons), [13, 11]);
  assert.equal(seasons[0].label, "Temporada 1");
  assert.equal(seasons[1].label, "Temporada 2");
  assert.equal(seasons[0].episodes[0].episodeNumber, 1);
  assert.equal(seasons[1].episodes[0].episodeNumber, 14);
});

test("pausa longa (split-cour): quebra a temporada mais cedo", () => {
  const eps = makeEps(10);
  // Episodio 11 estreia 90 dias depois (pausa de 3 meses).
  const paused = [...eps, ...makeEps(3, 7, eps[9].aired + 90 * DAY)];
  const seasons = groupEpisodesBySeason(paused);
  assert.deepEqual(countPerSeason(seasons), [10, 3]);
});

test("sem datas de estreia: cai nos blocos de 13", () => {
  const eps = makeEps(30).map((e) => ({ ...e, aired: null }));
  const seasons = groupEpisodesBySeason(eps);
  assert.deepEqual(countPerSeason(seasons), [13, 13, 4]);
});

test("getAnimeEpisodes: fetch real (mock) e agrupa por temporada", async () => {
  const realFetch = globalThis.fetch;
  const aired = Date.UTC(2023, 3, 1);
  // Sem campo `episode` (como o espelho Tenrai): o numero vem no mal_id.
  const data = Array.from({ length: 15 }, (_, i) => ({
    mal_id: i + 1,
    title: i === 5 ? "Episodio especial" : "",
    aired: new Date(aired + i * 7 * DAY).toISOString(),
    filler: i === 5,
    recap: false,
  }));
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith("https://api.tenrai.org/v1/anime/21/episodes")) {
      return new Response(
        JSON.stringify({ data, pagination: { last_visible_page: 1 } }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  try {
    const seasons = await getAnimeEpisodes(21);
    assert.equal(seasons.length, 2);
    assert.equal(countPerSeason(seasons)[0], 13);
    assert.equal(seasons[1].episodes[0].episodeNumber, 14);
    assert.equal(seasons[0].episodes[5].name, "Episodio especial");
    assert.equal(seasons[0].episodes[5].filler, true);
    assert.ok(seasons[0].episodes[0].aired > 0, "tem data de estreia");
  } finally {
    globalThis.fetch = realFetch;
  }
});

process.on("exit", () => {
  try {
    rmSync(process.env.DB_DIR, { recursive: true, force: true });
  } catch {
    /* ignora */
  }
});
