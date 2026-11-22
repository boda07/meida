// Seguir utilizadores, perfis e privacidade.
//
// Cada linha de `follows` e' uma ligacao. O CHECK da tabela impede seguir-se a
// si proprio; aqui voltamos a validar para devolver um erro claro em vez de
// deixar o SQLite explodir.
import { db } from "../db/index.js";
import { getUserById } from "./users.js";
import { criarNotificacao } from "./notifications.js";
import { now } from "./util.js";

function toUserCard(u) {
  return { id: u.id, username: u.username };
}

export { toUserCard };

export function followUser(followerId, followeeId) {
  if (Number(followerId) === Number(followeeId)) return { ok: false, error: "self" };
  if (!getUserById(followeeId)) return { ok: false, error: "notfound" };
  const r = db
    .prepare(
      `INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(follower_id, followee_id) DO NOTHING`
    )
    .run(followerId, followeeId, now());

  // So' se for mesmo um follow novo (o mesmo botao carregado outra vez nao notifica).
  if (r.changes > 0) {
    try {
      // kind "follow": nao ha comentario de referencia, por isso o store avisa
      // quem e' o seguido e guarda o id dele em ref_id, para o link ir ao perfil.
      criarNotificacao({ userId: followeeId, kind: "follow", actorId: followerId, refId: null });
    } catch {
      /* nunca rebata o follow */
    }
  }
  return { ok: true };
}

export function unfollowUser(followerId, followeeId) {
  const r = db
    .prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?")
    .run(followerId, followeeId);
  return { ok: true, removed: r.changes > 0 };
}

export function isFollowing(followerId, followeeId) {
  if (!followerId) return false;
  const r = db
    .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?")
    .get(followerId, followeeId);
  return Boolean(r);
}

export function followCounts(userId) {
  return {
    followers: db.prepare("SELECT COUNT(*) c FROM follows WHERE followee_id = ?").get(userId).c,
    following: db.prepare("SELECT COUNT(*) c FROM follows WHERE follower_id = ?").get(userId).c,
  };
}

export function listFollowers(userId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.avatar FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = ? ORDER BY f.created_at DESC`
    )
    .all(userId)
    .map(toUserCard);
}

export function listFollowing(userId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.avatar FROM follows f
       JOIN users u ON u.id = f.followee_id
       WHERE f.follower_id = ? ORDER BY f.created_at DESC`
    )
    .all(userId)
    .map(toUserCard);
}

export function searchUsers(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  return db
    .prepare("SELECT id, username, avatar FROM users WHERE username LIKE ? ORDER BY username LIMIT ?")
    .all(`%${q}%`, Math.max(1, Math.min(50, Number(limit) || 20)))
    .map(toUserCard);
}

// Quem sugerir para uma "@mencao". A lista e' de toda a gente (como no TikTok e
// no Instagram: escreves @ e aparece qualquer pessoa), mas quem tem ligacao
// connosco sobe para o topo — e' o que torna a lista util em vez de um
// directorio alfabetico.
//
// A ordenacao e' feita aqui, e nao no frontend: "quem comeca por o que
// escreveste" e' assunto deste. O `porPrioridade` do web/src/lib/mencoes.js so
// preserva a ordem que vier.
export function sugerirUsers(query, viewerId, limit = 20) {
  const q = String(query || "").trim();
  // Query vazia e' o caso normal logo apos escrever o "@": tem de aparecer
  // alguem. `searchUsers("")` devolve vazio de proposito (para a pagina de
  // procurar amigos), por isso aqui a lista sem filtro e' a primeira pagina
  // por ordem alfabetica.
  const lista = q
    ? searchUsers(q, limit)
    : db
        .prepare("SELECT id, username, avatar FROM users ORDER BY username LIMIT ?")
        .all(Math.max(1, Math.min(50, Number(limit) || 20)))
        .map(toUserCard);
  if (!viewerId || lista.length === 0) return { users: lista, linked: [] };
  const ids = lista.map((u) => u.id);
  const marcas = new Set();
  // Blocos de 400: o SQLite tem limite de parametros (~999) e uma lista maior
  // rebentava a query em vez de devolver so os primeiros.
  for (let i = 0; i < ids.length; i += 400) {
    const bloco = ids.slice(i, i + 400);
    const marcasSql = bloco.map(() => "?").join(",");
    const linhas = db
      .prepare(
        `SELECT follower_id, followee_id FROM follows
         WHERE (follower_id = ? AND followee_id IN (${marcasSql}))
            OR (followee_id = ? AND follower_id IN (${marcasSql}))`
      )
      .all(viewerId, ...bloco, viewerId, ...bloco);
    for (const l of linhas) {
      marcas.add(Number(l.followee_id === viewerId ? l.follower_id : l.followee_id));
    }
  }
  const dentro = lista.filter((u) => marcas.has(Number(u.id)));
  const fora = lista.filter((u) => !marcas.has(Number(u.id)));
  return { users: [...dentro, ...fora], linked: [...marcas] };
}

// Regra de privacidade: perfil publico -> todos veem; privado -> so o proprio.
// (Seguir nao da' acesso; quem quer partilhar poem o perfil publico.)
export function canViewProfile(viewerId, profile) {
  if (!profile) return false;
  return Boolean(profile.isPublic) || Number(viewerId) === Number(profile.id);
}