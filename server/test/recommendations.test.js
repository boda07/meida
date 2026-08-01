// Testes de recomendacoes: getAnimeRecommendations (MAL) e getSimilar (TMDB),
// com o fetch global mockado. node:test, sem dependencias.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DB_DIR = mkdtempSync(join(tmpdir(), "meida-test-rec-"));
process.env.TMDB_API_KEY = "teste"; // assertTmdbConfigured

const { getAnimeRecommendations } = await import("../src/services/jikan.js");
const { getSimilar } = await import("../src/services/tmdb.js");

function restoreFetch(realFetch) {
  globalThis.fetch = realFetch;
}

test("getAnimeRecommendations: devolve os titulos do MAL (entry)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://api.jikan.moe/v4/anime/12/episodes")) {
      return new Response(JSON.stringify({ data: [], pagination: { last_visible_page: 1 } }), { status: 200 });
    }
    // /anime/{id}/recommendations
    return new Response(
      JSON.stringify({
        data: [
          { entry: { mal_id: 1, title: "Outro anime", title_english: "Other anime", score: 8.5, year: 2021, images: { jpg: { large_image_url: "x.jpg" } } }, votes: 10 },
          { entry: { mal_id: 2, title: "Outro anime 2", score: 7, year: 2020, images: { jpg: { image_url: "y.jpg" } } }, votes: 5 },
        ],
      }),
      { status: 200 }
    );
  };
  try {
    const items = await getAnimeRecommendations(52991);
    assert.equal(items.length, 2);
    assert.equal(items[0].type, "anime");
    assert.equal(items[0].id, 1);
    assert.equal(items[0].title, "Other anime");
    assert.equal(items[0].rating, 8.5);
    assert.ok(items[0].poster);
  } finally {
    restoreFetch(realFetch);
  }
});

test("getSimilar (movie): normaliza resultados do TMBD", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/movie/557/similar")) {
      return new Response(
        JSON.stringify({
          results: [
            { id: 101, title: "Filme similar 1", poster_path: "/a.jpg", release_date: "2004-01-01", vote_average: 7.5 },
            { id: 102, title: "Filme similar 2", poster_path: "/b.jpg", release_date: "2010-05-05", vote_average: 6.2 },
          ],
        }),
        { status: 200 }
      );
    }
    return new Response("not found", { status: 404 });
  };
  try {
    const items = await getSimilar("movie", 557);
    assert.equal(items.length, 2);
    assert.equal(items[0].type, "movie");
    assert.equal(items[0].id, 101);
    assert.equal(items[0].title, "Filme similar 1");
    assert.equal(items[0].year, "2004");
    assert.equal(items[0].rating, 7.5);
    assert.ok(items[0].poster);
  } finally {
    restoreFetch(realFetch);
  }
});

process.on("exit", () => {
  try {
    rmSync(process.env.DB_DIR, { recursive: true, force: true });
  } catch {
    /* ignora */
  }
});
