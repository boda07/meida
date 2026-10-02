// Testes da camada de dados (SQLite).
//
// O primeiro teste existe por causa de um bug real: um `/* ===== Biblioteca
// =====` esqueceu o `*/` e engoliu 150 linhas de codigo. `node --check` e o
// ESLint passavam (um comentario e' sintaxe valida), mas as funcoes da
// biblioteca desapareciam do modulo e o backend falhava a arranjar com um erro
// confuso de "does not provide an export named 'upsertLibrary'". A superficie de
// exports fica entao verificada explicitamente.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Base isolada por ficheiro de teste (o node --test corre cada ficheiro num
// processo separado). Tem de estar definido ANTES do import do store, porque a
// base e' aberta no momento em que o modulo e' avaliado.
process.env.DB_DIR = mkdtempSync(join(tmpdir(), "meida-test-"));

const store = await import("../src/store.js");

// Todos os nomes que as rotas e os servicos importam de store.js.
const ESPERADOS = [
  "addComment",
  "addListTitle",
  "canViewProfile",
  "clearWatchlist",
  "createList",
  "createUser",
  "deleteComment",
  "deleteLibrary",
  "deleteList",
  "deleteProgress",
  "finishProgress",
  "followCounts",
  "followUser",
  "getAnilistTokens",
  "getComment",
  "getDebrid",
  "getLetterboxd",
  "getLibraryItem",
  "getList",
  "getMalTokens",
  "getProfileByUsername",
  "getProgress",
  "getUserById",
  "getUserByUsername",
  "importProgress",
  "isFollowing",
  "likeComment",
  "listComments",
  "listFollowers",
  "listFollowing",
  "listLibrary",
  "listLists",
  "listProgress",
  "removeListTitle",
  "renameList",
  "searchUsers",
  "setAnilistTokens",
  "setDebrid",
  "setLetterboxd",
  "setLibraryGenres",
  "setLibraryRating",
  "setMalTokens",
  "setProgressPosition",
  "setUserAvatar",
  "setUserProfile",
  "startProgress",
  "unfollowUser",
  "unlikeComment",
  "updateProgress",
  "upsertLibrary",
  "upsertLibrarySafe",
];

test("store.js expoe todas as funcoes que as rotas importam", () => {
  const faltam = ESPERADOS.filter((n) => typeof store[n] !== "function");
  assert.deepEqual(faltam, [], `store.js nao expoe: ${faltam.join(", ")}`);
});

test("o utilizador do token nao leva a password_hash", () => {
  const u = store.createUser("boda", "hash-falso");
  assert.equal(typeof u.id, "number");
  assert.equal(u.username, "boda");
  assert.ok(!("password_hash" in u), "getUserById nao pode devolver password_hash");
  // O login precisa da hash, por isso getUserByUsername devolve a linha crua.
  assert.equal(store.getUserByUsername("boda").password_hash, "hash-falso");
});

test("biblioteca: grava, le, actualiza e apaga", () => {
  const u = store.createUser("ana", "h");
  store.upsertLibrary({
    userId: u.id, tmdbId: 550, type: "movie",
    title: "Fight Club", poster: "p.jpg", watched: true, watchlist: false, score: 90,
  });
  const [it] = store.listLibrary(u.id);
  assert.equal(it.tmdbId, 550);
  assert.equal(it.title, "Fight Club");
  assert.equal(it.watched, 1); // booleano guardado como 0/1
  assert.equal(it.watchlist, 0);
  assert.equal(it.score, 90);

  // Actualizar nao pode perder o que nao foi mandado.
  store.upsertLibrary({ userId: u.id, tmdbId: 550, type: "movie", title: "Fight Club", poster: "p.jpg", watched: true, watchlist: false, score: 95 });
  assert.equal(store.getLibraryItem(u.id, 550, "movie").score, 95);
  assert.equal(store.listLibrary(u.id).length, 1, "nao duplica o item");

  store.deleteLibrary(u.id, 550, "movie");
  assert.equal(store.listLibrary(u.id).length, 0);
});

test("anime: o id do MAL nao colide com um id do TMDB igual", () => {
  const u = store.createUser("bruno", "h");
  store.upsertLibrary({ userId: u.id, tmdbId: 21, type: "movie", title: "Filme TMDB 21", watched: true });
  store.upsertLibrary({ userId: u.id, tmdbId: 21, type: "anime", title: "Anime MAL 21", watchlist: true });
  const items = store.listLibrary(u.id);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => i.type).sort(), ["anime", "movie"]);
});

test("upsertLibrarySafe nao apaga o que o import nao traz", () => {
  const u = store.createUser("carla", "h");
  store.upsertLibrary({ userId: u.id, tmdbId: 7, type: "tv", title: "S", watched: true, score: 80 });
  // Import so com a nota: watched e o titulo tem de sobreviver.
  store.upsertLibrarySafe({ userId: u.id, tmdbId: 7, type: "tv", score: 60 });
  const it = store.getLibraryItem(u.id, 7, "tv");
  assert.equal(it.score, 60);
  assert.equal(it.watched, 1);
  assert.equal(it.title, "S");
});

test("clearWatchlist tira a flag e apaga o que fica vazio", () => {
  const u = store.createUser("dave", "h");
  store.upsertLibrary({ userId: u.id, tmdbId: 1, type: "movie", title: "So watchlist", watchlist: true });
  store.upsertLibrary({ userId: u.id, tmdbId: 2, type: "movie", title: "Visto", watchlist: true, watched: true });
  const n = store.clearWatchlist(u.id, "movie");
  assert.equal(n, 2);
  const left = store.listLibrary(u.id);
  assert.equal(left.length, 1, "o item so com watchlist desapareceu");
  assert.equal(left[0].title, "Visto");
});

test("progresso: mudar de episodio limpa a posicao de retoma", () => {
  const u = store.createUser("eva", "h");
  store.setProgressPosition(u.id, "tv", 99, { position: 300, season: 1, episode: 2 });
  let p = store.getProgress(u.id, "tv", 99);
  assert.equal(p.position, 300, "guardou a posicao a meio");

  // Mesmo episodio: retoma a meio.
  store.startProgress({ userId: u.id, type: "tv", tmdbId: 99, season: 1, episode: 2 });
  assert.equal(store.getProgress(u.id, "tv", 99).position, 300);

  // Episodio novo: a posicao antiga tem de ir para o chao.
  store.startProgress({ userId: u.id, type: "tv", tmdbId: 99, season: 1, episode: 3 });
  p = store.getProgress(u.id, "tv", 99);
  assert.equal(p.position, null);
  assert.equal(p.episode, 3);
});

test("finishProgress avanca para o episodio seguinte", () => {
  const u = store.createUser("filipe", "h");
  store.finishProgress({ userId: u.id, type: "tv", tmdbId: 5, season: 1, episode: 4, nextSeason: 1, nextEpisode: 5 });
  const p = store.getProgress(u.id, "tv", 5);
  assert.equal(p.status, "watching", "com proximo episodio continua 'a ver'");
  assert.equal(p.episode, 5);

  store.finishProgress({ userId: u.id, type: "tv", tmdbId: 5, season: 1, episode: 5 });
  assert.equal(store.getProgress(u.id, "tv", 5).status, "finished");
});

test("importProgress com null limpa a data", () => {
  const u = store.createUser("gui", "h");
  store.importProgress({ userId: u.id, type: "movie", tmdbId: 3, startedAt: "2020-01-01", finishedAt: "2020-01-02" });
  assert.equal(store.getProgress(u.id, "movie", 3).startedAt, "2020-01-01");
  // Reimportar sem dia exato: o dia 1 inventado tem de desaparecer.
  store.importProgress({ userId: u.id, type: "movie", tmdbId: 3, startedAt: null, finishedAt: "2020-02-05" });
  const p = store.getProgress(u.id, "movie", 3);
  assert.equal(p.startedAt, null, "startedAt a null limpa a data");
  assert.equal(p.finishedAt, "2020-02-05");
});

test("listas: criar, adicionar (sem duplicar) e remover", () => {
  const u = store.createUser("helena", "h");
  const l = store.createList(u.id, "Para ver");
  assert.equal(l.count, 0);
  store.addListTitle(u.id, l.id, { tmdbId: 11, type: "movie", title: "A" });
  store.addListTitle(u.id, l.id, { tmdbId: 11, type: "movie", title: "A" }); // repetido
  store.addListTitle(u.id, l.id, { tmdbId: 12, type: "tv", title: "B" });
  assert.equal(store.getList(u.id, l.id).items.length, 2, "titulo repetido nao duplica");
  assert.equal(store.listLists(u.id)[0].count, 2);
  assert.equal(store.removeListTitle(u.id, l.id, 11, "movie"), true);
  assert.equal(store.getList(u.id, l.id).items.length, 1);
});

test("tokens de servicos externos nao se baralham entre users", () => {
  const a = store.createUser("ia", "h");
  const b = store.createUser("joao", "h");
  store.setMalTokens(a.id, { accessToken: "tok-a" });
  store.setDebrid(b.id, { token: "rd-b" });
  assert.equal(store.getMalTokens(a.id).accessToken, "tok-a");
  assert.equal(store.getMalTokens(b.id), null, "o Joao nao tem token do MAL");
  assert.equal(store.getDebrid(b.id).token, "rd-b");
  assert.equal(store.getDebrid(a.id), null);
});

test("generos guardam-se como array e voltam como array", () => {
  const u = store.createUser("kika", "h");
  store.upsertLibrary({ userId: u.id, tmdbId: 1, type: "anime", title: "X", genres: ["Ação", "Aventura"] });
  assert.deepEqual(store.getLibraryItem(u.id, 1, "anime").genres, ["Ação", "Aventura"]);
  store.setLibraryGenres(u.id, 1, "anime", ["Drama"]);
  assert.deepEqual(store.getLibraryItem(u.id, 1, "anime").genres, ["Drama"]);
});

test("perfil: bio e privacidade guardam-se e voltam", () => {
  const u = store.createUser("luna", "h");
  assert.equal(u.isPublic, true, "conta nova comeca publica");
  assert.equal(u.bio, null);

  const p = store.setUserProfile(u.id, { bio: "  vejo tudo  ", isPublic: false });
  assert.equal(p.bio, "vejo tudo");
  assert.equal(p.isPublic, false);

  // Actualizar so a bio nao pode estragar a privacidade ja' definida.
  const p2 = store.getProfileByUsername("luna");
  assert.equal(p2.bio, "vejo tudo");
  assert.equal(p2.isPublic, false);

  // Mandar avatar undefined nao mexe; null limpa.
  store.setUserProfile(u.id, { avatar: "emoji:🦊" });
  assert.equal(store.getProfileByUsername("luna").avatar, "emoji:🦊");
  store.setUserProfile(u.id, { avatar: null });
  assert.equal(store.getProfileByUsername("luna").avatar, null);
});

test("seguir: nao duplica, nao deixa seguir-se e conta os dois lados", () => {
  const a = store.createUser("mia", "h");
  const b = store.createUser("nuno", "h");
  const c = store.createUser("olga", "h");

  assert.deepEqual(store.followUser(a.id, a.id), { ok: false, error: "self" });
  assert.equal(store.followUser(a.id, b.id).ok, true);
  store.followUser(a.id, b.id); // repetido: nao duplica
  store.followUser(c.id, b.id);
  store.followUser(a.id, c.id);

  assert.equal(store.isFollowing(a.id, b.id), true);
  assert.equal(store.isFollowing(b.id, a.id), false);
  assert.deepEqual(store.followCounts(b.id), { followers: 2, following: 0 });
  assert.deepEqual(store.followCounts(a.id), { followers: 0, following: 2 });

  assert.deepEqual(
    store.listFollowers(b.id).map((u) => u.username).sort(),
    ["mia", "olga"]
  );
  assert.deepEqual(
    store.listFollowing(a.id).map((u) => u.username).sort(),
    ["nuno", "olga"]
  );

  assert.equal(store.unfollowUser(a.id, b.id).removed, true);
  assert.equal(store.unfollowUser(a.id, b.id).removed, false, "deixar de seguir 2x nao rebenta");
  assert.deepEqual(store.followCounts(b.id), { followers: 1, following: 0 });
});

test("privacidade: perfil privado so o proprio ve; publico todos veem", () => {
  const owner = store.createUser("paula", "h");
  const other = store.createUser("quim", "h");
  const priv = store.setUserProfile(owner.id, { isPublic: false });

  assert.equal(store.canViewProfile(owner.id, priv), true);
  assert.equal(store.canViewProfile(other.id, priv), false);
  assert.equal(store.canViewProfile(null, priv), false);

  const pub = store.setUserProfile(owner.id, { isPublic: true });
  assert.equal(store.canViewProfile(other.id, pub), true);
  assert.equal(store.canViewProfile(null, pub), true);
});

test("pesquisa de utilizadores", () => {
  store.createUser("rita_silva", "h");
  store.createUser("rui_santos", "h");
  store.createUser("sofia", "h");
  assert.deepEqual(store.searchUsers("silva").map((u) => u.username), ["rita_silva"]);
  assert.deepEqual(store.searchUsers("santos").map((u) => u.username), ["rui_santos"]);
  assert.deepEqual(store.searchUsers(""), []);
});

test("comentarios: thread com respostas, gostos e apagar", () => {
  const a = store.createUser("tina", "h");
  const b = store.createUser("ugo", "h");

  const raiz = store.addComment({
    userId: a.id, type: "tv", tmdbId: 100, season: 1, episode: 2,
    body: "Que episodio!", atSeconds: 120,
  });
  assert.equal(raiz.body, "Que episodio!");
  assert.equal(raiz.atSeconds, 120);
  assert.deepEqual(raiz.replies, []);

  const resp = store.addComment({
    userId: b.id, type: "tv", tmdbId: 100, season: 1, episode: 2,
    parentId: raiz.id, body: "Concordo",
  });
  assert.equal(resp.parentId, raiz.id);

  // Responder a uma resposta cola na raiz (um nivel so').
  const resp2 = store.addComment({
    userId: a.id, type: "tv", tmdbId: 100, season: 1, episode: 2,
    parentId: resp.id, body: "Mesmo",
  });
  assert.equal(resp2.parentId, raiz.id, "resposta a resposta fica pendurada na raiz");

  let thread = store.listComments({ type: "tv", tmdbId: 100, season: 1, episode: 2, viewerId: b.id });
  assert.equal(thread.length, 1, "so' um comentario raiz");
  assert.equal(thread[0].replies.length, 2);

  // Gostos.
  store.likeComment(b.id, raiz.id);
  store.likeComment(a.id, raiz.id);
  store.likeComment(b.id, raiz.id); // repetido nao conta
  thread = store.listComments({ type: "tv", tmdbId: 100, season: 1, episode: 2, viewerId: b.id });
  assert.equal(thread[0].likes, 2);
  assert.equal(thread[0].likedByMe, true);
  assert.equal(thread[0].replies[1].likedByMe, false);
  store.unlikeComment(b.id, raiz.id);
  assert.equal(store.listComments({ type: "tv", tmdbId: 100, season: 1, episode: 2, viewerId: b.id })[0].likes, 1);

  // So o autor apaga. A raiz e o resp2 sao da tina; o resp e' do ugo.
  assert.deepEqual(store.deleteComment(b.id, raiz.id), { ok: false, error: "forbidden" });
  assert.deepEqual(store.deleteComment(a.id, resp.id), { ok: false, error: "forbidden" });
  assert.deepEqual(store.deleteComment(a.id, resp2.id), { ok: true });
  assert.equal(store.listComments({ type: "tv", tmdbId: 100, season: 1, episode: 2, viewerId: a.id })[0].replies.length, 1);
});

test("comentario com respostas fica como apagado (a thread sobrevive)", () => {
  const a = store.createUser("vera", "h");
  const b = store.createUser("xavier", "h");
  const raiz = store.addComment({ userId: a.id, type: "movie", tmdbId: 7, body: "Original" });
  store.addComment({ userId: b.id, type: "movie", tmdbId: 7, parentId: raiz.id, body: "Resposta" });

  store.deleteComment(a.id, raiz.id);
  const thread = store.listComments({ type: "movie", tmdbId: 7, viewerId: b.id });
  assert.equal(thread.length, 1, "a raiz fica como apagada, nao desaparece");
  assert.equal(thread[0].deleted, true);
  assert.equal(thread[0].body, null, "o texto sai");
  assert.equal(thread[0].replies.length, 1, "as respostas sobrevivem");

  // Sem respostas, o comentario sai mesmo.
  const solto = store.addComment({ userId: a.id, type: "movie", tmdbId: 7, body: "Sozinho" });
  store.deleteComment(a.id, solto.id);
  assert.equal(store.getComment(solto.id, a.id), null);
});

test("comentarios separam-se por episodio e por tipo", () => {
  const u = store.createUser("yara", "h");
  store.addComment({ userId: u.id, type: "tv", tmdbId: 9, season: 1, episode: 1, body: "T1E1" });
  store.addComment({ userId: u.id, type: "tv", tmdbId: 9, season: 1, episode: 2, body: "T1E2" });
  store.addComment({ userId: u.id, type: "movie", tmdbId: 9, body: "Filme" });
  // O id 9 do TMDB como serie e como filme nao se misturam.
  assert.equal(store.listComments({ type: "tv", tmdbId: 9, season: 1, episode: 1 }).length, 1);
  assert.equal(store.listComments({ type: "tv", tmdbId: 9, season: 1, episode: 2 })[0].body, "T1E2");
  assert.equal(store.listComments({ type: "movie", tmdbId: 9 })[0].body, "Filme");
  // Corpo vazio e' rejeitado.
  assert.deepEqual(store.addComment({ userId: u.id, type: "tv", tmdbId: 9, body: "   " }), { error: "empty" });
});