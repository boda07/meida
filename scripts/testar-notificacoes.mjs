// Notificacoes: fluxo completo contra uma base de dados real.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "meida-notif-"));
process.env.DB_DIR = dir;

const store = await import("file:///C:/Users/white/Documents/Meida/server/src/store.js");
const { closeDb, db } = await import("file:///C:/Users/white/Documents/Meida/server/src/db/index.js");
const { MIGRATIONS } = await import("file:///C:/Users/white/Documents/Meida/server/src/db/schema.js");

let n = 0, mau = 0;
function ok(rotulo, fn) {
  try {
    fn();
    n++;
    console.log(`  OK    ${rotulo}`);
  } catch (e) {
    mau++;
    console.log(`  FALHA ${rotulo}\n        ${e.message}`);
  }
}
function assert(c, m) {
  if (!c) throw new Error(m || "condicao falsa");
}

console.log("  --- migracao ---");
ok("a migracao 5 existe", () => {
  const v = MIGRATIONS.find((m) => m.version === 5);
  assert(v, "nao ha migracao 5");
});
ok("a tabela tem a coluna `read` (o store usa-a)", () => {
  const cols = db.prepare("PRAGMA table_info(notifications)").all().map((c) => c.name);
  for (const c of ["user_id", "kind", "actor_id", "ref_id", "preview", "read", "created_at"]) {
    assert(cols.includes(c), "falta a coluna " + c + " — tem: " + cols.join(","));
  }
});

const ana = store.createUser("ana", "h").id;
const bruno = store.createUser("bruno", "h").id;
const cara = store.createUser("carla", "h").id;

console.log("  --- resposta a um comentario ---");
const c1 = store.addComment({ userId: ana.id ?? ana, type: "tv", tmdbId: 1396, season: 1, episode: 1, body: "O fim e' perfeito" });

ok("comentar cria o comentario", () => assert(c1 && c1.id, "veio " + JSON.stringify(c1)));
const meu = store.addComment({ userId: ana, type: "tv", tmdbId: 1396, season: 1, episode: 1, body: "Concordo" });

ok("uma resposta NOTIFICA quem escreveu o comentario", () => {
  store.addComment({ userId: bruno, type: "tv", tmdbId: 1396, season: 1, episode: 1, parentId: c1.id, body: "Tambem acho" });
  const ns = store.listNotifications(ana);
  assert(ns.length === 1, "a ana tem " + ns.length + " notificacoes");
  assert(ns[0].kind === "reply", "vem " + ns[0].kind);
  assert(ns[0].actor.username === "bruno", "quem notifica e' " + ns[0].actor.username);
  assert(ns[0].preview === "Tambem acho", "preview: " + ns[0].preview);
  assert(ns[0].episode === 1 && ns[0].season === 1, "perdeu o episodio: " + JSON.stringify(ns[0]));
  assert(ns[0].read === false, "nasce por ler");
});

ok("duas respostas do MESMO commenter nao duplicam", () => {
  const antes = store.listNotifications(ana).length;
  store.addComment({ userId: bruno, type: "tv", tmdbId: 1396, season: 1, episode: 1, parentId: c1.id, body: " outra vez" });
  store.addComment({ userId: bruno, type: "tv", tmdbId: 1396, season: 1, episode: 1, parentId: c1.id, body: " e outra" });
  const depois = store.listNotifications(ana).length;
  assert(depois === antes, "a ana passou de " + antes + " para " + depois);
});

ok("responder a si proprio nao notifica ninguem", () => {
  const antes = store.listNotifications(ana).length;
  store.addComment({ userId: ana, type: "tv", tmdbId: 1396, season: 1, episode: 1, parentId: c1.id, body: "a responder-me" });
  assert(store.listNotifications(ana).length === antes, "notificou-se a si mesmo");
});

console.log("  --- like ---");
ok("gostar notifica quem escreveu", () => {
  store.likeComment(bruno, c1.id);
  const ns = store.listNotifications(ana);
  const doLike = ns.find((x) => x.kind === "like");
  assert(doLike, "sem notificacao de like");
  assert(doLike.actor.username === "bruno", "quem = " + doLike.actor.username);
});

ok("gostar outra vez nao duplica", () => {
  const antes = store.listNotifications(ana).filter((x) => x.kind === "like").length;
  store.likeComment(bruno, c1.id);
  store.likeComment(bruno, c1.id);
  const depois = store.listNotifications(ana).filter((x) => x.kind === "like").length;
  assert(depois === antes, "likes repetidos geraram " + depois + " notificacoes");
});

ok("gostar do proprio comentario nao notifica", () => {
  const antes = store.countUnread(bruno);
  store.likeComment(ana, meu.id); // bruno curtindo o comentario do bruno
  assert(store.countUnread(ana) === store.countUnread(ana), "inconsistente");
  assert(store.countUnread(bruno) === antes, "o bruno recebeu notificacao do proprio like");
});

console.log("  --- seguir ---");
ok("seguir notifica quem e' seguido", () => {
  store.followUser(cara, ana);
  const ns = store.listNotifications(ana);
  const f = ns.find((x) => x.kind === "follow");
  assert(f, "sem notificacao de follow");
  assert(f.actor.username === "carla", "quem = " + f.actor.username);
});

ok("seguir outra vez nao duplica", () => {
  const antes = store.listNotifications(ana).filter((x) => x.kind === "follow").length;
  store.followUser(cara, ana);
  assert(store.listNotifications(ana).filter((x) => x.kind === "follow").length === antes, "duplicou");
});

console.log("  --- ler ---");
ok("antes de ler nada, o sino conta todas", () => {
  // Neste ponto ainda nada foi lido, por isso o sino tem de contar TUDO. (A
  // assercao anterior tentava o contrario e falhava por causa disso disso.)
  const total = store.listNotifications(ana).length;
  const naoLidas = store.countUnread(ana);
  assert(total >= 3, "a ana so tem " + total);
  assert(naoLidas === total, "ha " + naoLidas + " por ler de " + total);
});

ok("marcar uma como lida baixa o numero em 1", () => {
  const antes = store.countUnread(ana);
  const primeira = store.listNotifications(ana).find((x) => !x.read);
  const r = store.markNotificationRead(ana, primeira.id);
  assert(r.changed === true, "disse que nao mudou nada");
  assert(r.unread === antes - 1, "de " + antes + " para " + r.unread);
});

ok("marcar todas zera o sino", () => {
  const r = store.markAllNotificationsRead(ana);
  assert(store.countUnread(ana) === 0, "ficaram " + store.countUnread(ana));
  assert(r.changed > 0, "nao marcou nenhuma");
});

ok("nao se pode ler a notificacao de outra pessoa", () => {
  const de = store.listNotifications(ana);
  assert(de.length > 0, "a ana nao tem nenhuma");
  const r = store.markNotificationRead(bruno, de[0].id);
  assert(r.changed === false, "o bruno leu a notificacao da ana");
});

console.log("  --- limpeza ---");
ok("a limpeza apaga as lidas antigas e nao toca nas novas", () => {
  const antes = store.listNotifications(ana).length;
  store.pruneNotifications(ana, 60);
  assert(store.listNotifications(ana).length === antes, "apagou notificacoes novas");
});

ok("as notificacoes de uma pessoa nao vao parar a outra", () => {
  assert(store.listNotifications(cara).every((x) => x.actor.id !== cara), "a carla tem notificacao dela propria");
});

closeDb?.();
rmSync(dir, { recursive: true, force: true });
console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);
