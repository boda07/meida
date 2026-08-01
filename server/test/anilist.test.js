// Testes do servico AniList (GraphQL). Sem deps: mock do fetch global.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DB_DIR = mkdtempSync(join(tmpdir(), "meida-anilist-test-"));

// Credenciais para o servico detetar que o AniList esta "configurado".
process.env.ANILIST_CLIENT_ID = "test-client-id";
process.env.ANILIST_CLIENT_SECRET = "test-client-secret";
process.env.ANILIST_REDIRECT_URI = "http://localhost:5175/api/anilist/callback";
process.env.JWT_SECRET = "test";

const store = await import("../src/store.js");
const { anilistEnabled, buildAuthUrl, normalizeAnilistEntry, updateEpisode, getAnimeList } =
  await import("../src/services/anilist.js");

const GRAPHQL = "https://graphql.anilist.co";
const TOKEN_URL = "https://anilist.co/api/v1/oauth/token";

let userId;
beforeEach(() => {
  // Cria um utilizador real (setAnilistTokens precisa que o user existe).
  const created = store.createUser("anilisttester", "hash");
  userId = created.id;
  // Simula um user com refresh_token valido (access expirado -> forca refresh).
  store.setAnilistTokens(userId, {
    accessToken: "expired",
    refreshToken: "ref-123",
    expiresAt: Date.now() - 1000,
    username: "KumaTest",
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const originalFetch = globalThis.fetch;

function mockFetch({ tokenBody, graphqlBody, graphqlStatus = 200, tokenStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body });
    if (u === TOKEN_URL) {
      return new Response(JSON.stringify(tokenBody || { access_token: "fresh-token", refresh_token: "ref-123", expires_in: 3600 }), { status: tokenStatus });
    }
    if (u === GRAPHQL) {
      return new Response(JSON.stringify(graphqlBody), { status: graphqlStatus });
    }
    return new Response("not mocked", { status: 404 });
  };
  return calls;
}

test("anilistEnabled responde ao client id configurado", () => {
  assert.equal(anilistEnabled(), true);
});

test("normalizeAnilistEntry devolve null sem media/idMal", () => {
  assert.equal(normalizeAnilistEntry({}), null);
  assert.equal(normalizeAnilistEntry({ media: {} }), null);
});

test("normalizeAnilistEntry converte estado/progresso", () => {
  const row = normalizeAnilistEntry({
    status: "COMPLETED",
    progress: 24,
    numEpisodesWatched: 24,
    score: 87,
    media: {
      idMal: 121,
      title: { english: "Attack on Titan", romaji: "Shingeki..." },
      coverImage: { extraLarge: "https://img/a.jpg" },
      meanScore: 876,
      genres: [{ name: "Action" }, { name: "Drama" }],
    },
  });
  assert.equal(row.tmdbId, 121);
  assert.equal(row.type, "anime");
  assert.equal(row.title, "Attack on Titan");
  assert.equal(row.poster, "https://img/a.jpg");
  assert.equal(row.rating, 9); // 876 -> 9 (0-10 scale)
  assert.equal(row.score, 9); // score pessoal 87 -> 9 (87/10 = 8.7 -> 9)
  assert.equal(row.watched, 1);
  assert.equal(row.watchlist, 0);
  assert.deepEqual(row.genres, ["Action", "Drama"]);
});

test("buildAuthUrl aponta para authorize com client_id e redirect", () => {
  const url = buildAuthUrl("state123");
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://anilist.co/api/v1/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "test-client-id");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("state"), "state123");
  assert.equal(u.searchParams.get("redirect_uri"), "http://localhost:5175/api/anilist/callback");
});

test("getAnimeList pagina e usa bearer token (refresh de access expirado)", async () => {
  const calls = mockFetch({
    graphqlBody: {
      data: {
        Page: {
          pageInfo: { hasNextPage: false },
          mediaListEntry: [
            { media: { idMal: 5, title: { english: "A" } }, progress: 3, numEpisodesWatched: 3, status: "WATCHING", score: 90 },
            { media: { idMal: 9, title: { english: "B" } }, progress: 12, numEpisodesWatched: 12, status: "COMPLETED", score: 80 },
          ],
        },
      },
    },
  });

  const list = await getAnimeList(userId);
  assert.equal(list.length, 2);
  // Primeiro fetch foi o refresh do token expirado.
  assert.equal(calls[0].url, TOKEN_URL);
  // Segundo fetch foi a query GraphQL da lista.
  assert.equal(calls[1].url, GRAPHQL);
  assert.equal(calls[1].method, "POST");
  const body = JSON.parse(calls[1].body);
  assert.ok(/mediaListEntry/.test(body.query), "a query pede a lista do user autenticado");
  assert.equal(list[0].media.idMal, 5);
});

test("updateEpisode faz resolve por idMal e depois scrobble via mutation", async () => {
  let graphqlCall = 0;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u === TOKEN_URL) {
      return new Response(JSON.stringify({ access_token: "fresh", refresh_token: "ref-123", expires_in: 3600 }));
    }
    if (u === GRAPHQL) {
      graphqlCall++;
      const query = JSON.parse(opts.body).query;
      if (query.includes("incrementWatchProgress")) {
        return new Response(JSON.stringify({ data: { incrementWatchProgress: { mediaId: 555, progress: 4 } } }));
      }
      // resolve query (idMal -> anilist id)
      return new Response(JSON.stringify({ data: { Media: { id: 555 } } }));
    }
    return new Response("not mocked", { status: 404 });
  };

  const result = await updateEpisode(userId, 121, 4);
  assert.equal(result.status, "watching");
  assert.equal(result.numEpisodesWatched, 4);
  // 1 resolve + 1 mutation.
  assert.equal(graphqlCall, 2);
});

// Cross-sync: logica pura de decisao (sem rede).
test("computeCrossUpdates empurra o maximo para a conta atrasada", async () => {
  const { computeCrossUpdates } = await import("../src/services/anilist.js");

  const malProgress = new Map([
    [1, 5],   // MAL a 5
    [2, 10],  // MAL a 10, AniList atrasado (3)
    [3, 0],   // ambos 0 -> ignora
  ]);
  const aniProgress = new Map([
    [1, 8],   // AniList a 8, MAL atrasado (5 -> empurra para MAL)
    [2, 3],   // AniList atrasado -> empurra para AniList
    [99, 7],  // só no AniList -> nada no MAL (MAL nao tem)
  ]);

  const result = computeCrossUpdates(malProgress, aniProgress);

  // malId 1: target 8, MAL a 5 -> push 8 para MAL.
  const mal1 = result.toMal.find((x) => x.malId === 1);
  assert.deepEqual(mal1, { malId: 1, ep: 8 });

  // malId 2: target 10, AniList a 3 -> push 10 para AniList.
  const ani2 = result.toAni.find((x) => x.malId === 2);
  assert.deepEqual(ani2, { malId: 2, ep: 10 });

  // malId 99: só no AniList -> target 7, MAL nao tem (0) -> push para MAL tambem.
  const mal99 = result.toMal.find((x) => x.malId === 99);
  assert.deepEqual(mal99, { malId: 99, ep: 7 });

  // malId 3: ambos 0 -> nao aparece em nenhum lado.
  assert.equal(result.toMal.find((x) => x.malId === 3), undefined);
  assert.equal(result.toAni.find((x) => x.malId === 3), undefined);

  // Nenhum caso empurra para tras (sempre o maximo).
  assert.equal(result.toMal.length, 2);
  assert.equal(result.toAni.length, 1);
});

test("computeCrossUpdates nao empurra quando ja estao alinhados", async () => {
  const { computeCrossUpdates } = await import("../src/services/anilist.js");
  const malProgress = new Map([[1, 5], [2, 12]]);
  const aniProgress = new Map([[1, 5], [2, 12]]);
  const result = computeCrossUpdates(malProgress, aniProgress);
  assert.equal(result.toMal.length, 0);
  assert.equal(result.toAni.length, 0);
});
