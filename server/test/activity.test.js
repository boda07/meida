// Testes do feed de atividade (migracao 10).
//
// O que tem de ficar provado:
//   * o episodio registado e' o que ACABOU, nao o seguinte para onde o
//     progresso avanca;
//   * concluir o mesmo episodio duas vezes nao duplica a linha;
//   * um filme de anime (sem temporada/episodio) nao vira "episodio 0";
//   * o feed so' mostra perfis publicos que se seguem, alem do proprio;
//   * a paginacao respeita `hasMore`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "meida-atividade-"));
process.env.DB_DIR = dir;

const store = await import("../src/store.js");
const { db } = await import("../src/db/index.js");
const { MIGRATIONS } = await import("../src/db/schema.js");

test("a migracao 10 cria a tabela de atividade", () => {
  const m = MIGRATIONS.find((x) => x.version === 10);
  assert.ok(m, "nao ha migracao 10");
  const cols = db.prepare("PRAGMA table_info(activity)").all().map((c) => c.name);
  for (const c of [
    "user_id",
    "media_type",
    "external_id",
    "title",
    "poster",
    "season",
    "episode",
    "kind",
    "watched_at",
    "created_at",
  ]) {
    assert.ok(cols.includes(c), "falta a coluna " + c + " — tem: " + cols.join(","));
  }
});

const ana = store.createUser("ana_atividade", "h").id;
const bruno = store.createUser("bruno_atividade", "h").id;
const carla = store.createUser("carla_atividade", "h").id;

test("concluir uma serie regista o episodio que acabou, nao o seguinte", () => {
  store.finishProgress({
    userId: ana,
    type: "tv",
    tmdbId: 1000,
    title: "Serie",
    season: 2,
    episode: 3,
    nextSeason: 2,
    nextEpisode: 4,
  });
  const { items } = store.listUserActivity(ana);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "episode");
  assert.equal(items[0].season, 2);
  assert.equal(items[0].episode, 3, "o progresso avancou para o 4, o feed tem de dizer 3");
  assert.equal(items[0].user.username, "ana_atividade");
});

test("concluir o mesmo episodio outra vez nao duplica", () => {
  store.finishProgress({
    userId: ana,
    type: "tv",
    tmdbId: 1000,
    title: "Serie",
    season: 2,
    episode: 4,
    nextSeason: 2,
    nextEpisode: 5,
  });
  store.finishProgress({
    userId: ana,
    type: "tv",
    tmdbId: 1000,
    title: "Serie",
    season: 2,
    episode: 4,
    nextSeason: 2,
    nextEpisode: 5,
  });
  const { items } = store.listUserActivity(ana);
  const doEpisodio4 = items.filter((i) => i.season === 2 && i.episode === 4);
  assert.equal(doEpisodio4.length, 1, "o episodio 4 apareceu duas vezes");
});

test("um filme normal e um filme de anime sao `movie`, nao episodio 0", () => {
  store.finishProgress({ userId: ana, type: "movie", tmdbId: 603, title: "Matrix" });
  store.finishProgress({ userId: ana, type: "anime", tmdbId: 77, title: "Filme Anime" });
  const { items } = store.listUserActivity(ana);
  for (const id of [603, 77]) {
    const it = items.find((x) => x.tmdbId === id);
    assert.ok(it, "falta o filme " + id);
    assert.equal(it.kind, "movie");
    assert.equal(it.season, null);
    assert.equal(it.episode, null);
  }
});

test("anime episodico fica sem temporada, mas com episodio", () => {
  store.finishProgress({
    userId: ana,
    type: "anime",
    tmdbId: 88,
    title: "Anime",
    season: null,
    episode: 12,
    nextSeason: null,
    nextEpisode: null,
  });
  const it = store.listUserActivity(ana).items.find((x) => x.tmdbId === 88);
  assert.ok(it, "falta o anime");
  assert.equal(it.kind, "episode");
  assert.equal(it.season, null);
  assert.equal(it.episode, 12);
});

test("uma serie sem numero de episodio e' serie, nao filme", () => {
  store.finishProgress({
    userId: ana,
    type: "tv",
    tmdbId: 5000,
    title: "Serie Sem Episodio",
    season: null,
    episode: null,
  });
  const it = store.listUserActivity(ana).items.find((x) => x.tmdbId === 5000);
  assert.ok(it, "falta a serie");
  assert.equal(it.kind, "series");
  assert.equal(it.season, null);
  assert.equal(it.episode, null);
});

test("o feed inclui o proprio e quem se segue (perfil publico)", () => {
  store.followUser(bruno, ana);
  const { items } = store.listFeedActivity(bruno);
  assert.ok(items.some((i) => i.user.username === "ana_atividade"));
  // Carla nao segue ninguem: so' ve o que e' dela.
  const carlaFeed = store.listFeedActivity(carla);
  assert.equal(carlaFeed.items.length, 0);
});

test("perfil privado nao entra no feed de quem o segue", () => {
  store.setUserProfile(ana, { isPublic: false });
  const { items } = store.listFeedActivity(bruno);
  assert.equal(items.filter((i) => i.user.username === "ana_atividade").length, 0);
  // O proprio continua a ver a sua atividade.
  const propria = store.listFeedActivity(ana);
  assert.ok(propria.items.length > 0);
});

test("um filme de anime marcado na biblioteca conta como filme", () => {
  // O `type` na biblioteca e' "anime" para filmes e series: quem decide e' a
  // marca `isMovie` que o cliente manda (as listas de filmes de anime levam-na).
  assert.equal(store.eFilme("movie"), true);
  assert.equal(store.eFilme("movie", false), true, "um filme e' sempre um filme");
  assert.equal(store.eFilme("anime", true), true, "filme de anime e' filme");
  assert.equal(store.eFilme("anime"), false, "sem a marca, e' uma serie");
  assert.equal(store.eFilme("anime", false), false);
  assert.equal(store.eFilme("tv", true), false, "uma serie nao vira filme por engano");
});

test("paginacao devolve hasMore e nao repete", () => {
  store.setUserProfile(ana, { isPublic: true });
  const primeira = store.listUserActivity(ana, { limit: 2, offset: 0 });
  assert.equal(primeira.items.length, 2);
  assert.equal(primeira.hasMore, true);
  const segunda = store.listUserActivity(ana, { limit: 2, offset: 2 });
  assert.ok(segunda.items.length > 0);
  const ids = new Set(primeira.items.map((i) => i.id));
  assert.ok(segunda.items.every((i) => !ids.has(i.id)), "as duas paginas repetiram itens");
});
