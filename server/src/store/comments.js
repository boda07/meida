// Comentários por episódio.
//
// Chave: (media_type, external_id, season, episode). Para filmes e comentários
// do titulo inteiro, season e episode sao NULL. As respostas (parent_id) fazem
// um fio de profundidade livre: responder a uma resposta pendura nela, como no
// `CodCP_Pai` do projeto antigo. A UI limita a indentacao e cita quem se
// responde, que e' o que torna o fio legivel quando ja vai fundo.
import { db } from "../db/index.js";
import { usernamesMencionados } from "../services/mencoes.js";
import { getUserByUsername } from "./users.js";
import { criarNotificacao } from "./notifications.js";
import { now } from "./util.js";

function commentLikes(id) {
  return db.prepare("SELECT COUNT(*) c FROM comment_likes WHERE comment_id = ?").get(id).c;
}

export function toApiComment(r, viewerId) {
  return {
    id: r.id,
    tmdbId: r.external_id,
    type: r.media_type,
    season: r.season ?? null,
    episode: r.episode ?? null,
    parentId: r.parent_id ?? null,
    body: r.deleted_at ? null : r.body,
    atSeconds: r.at_seconds ?? null,
    deleted: Boolean(r.deleted_at),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
    author: { id: r.user_id, username: r.username },
    likes: commentLikes(r.id),
    likedByMe: Boolean(
      viewerId &&
        db
          .prepare("SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?")
          .get(r.id, viewerId)
    ),
    replies: [],
  };
}

// entry: { userId, type, tmdbId, season, episode, parentId, body, atSeconds }
// Devolve o comentario criado, ou { error } quando o corpo e' vazio / o parent
// nao existe.
export function addComment(entry) {
  const body = String(entry.body || "").trim();
  if (!body) return { error: "empty" };
  if (body.length > 2000) return { error: "long" };

  let parentId = null;
  if (entry.parentId != null) {
    const p = db.prepare("SELECT id FROM comments WHERE id = ? AND deleted_at IS NULL").get(entry.parentId);
    if (!p) return { error: "parent" };
    // Aninhamento real: responder a uma resposta e' responder A ESSA resposta.
    //
    // Antes isto era `p.parent_id ?? p.id`, que colava a resposta na raiz. Era
    // deliberado ("aninhamento a um nivel") e a UI afectava, porque o formulario
    // de resposta so' sabia desenhar ao nivel de topo: o botao "Responder"
    // aparecia nas respostas e nao acontecia nada ao clicar. Agora que o
    // formulario desce com o fio, o limite nao tem razao de ser. O mesmo que o
    // `CodCP_Pai` do projeto antigo (RAI PAP / ProdSound).
    //
    // Ciclo e' impossivel: o pai tem de existir antes de lhe responder, e uma
    // resposta nunca muda de pai. Ainda assim `listComments` corta a recursao
    // pela profundidade, para um dia um bug de dados nao prender o browser.
    parentId = p.id;
  }

  const r = db
    .prepare(
      `INSERT INTO comments
         (user_id, media_type, external_id, season, episode, parent_id, body, at_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.userId,
      entry.type,
      entry.tmdbId,
      entry.season ?? null,
      entry.episode ?? null,
      parentId,
      body,
      entry.atSeconds != null ? Math.max(0, Math.floor(entry.atSeconds)) : null,
      now()
    );

  const novoId = Number(r.lastInsertRowid);

  // Se e' uma resposta, avisar quem escreveu o comentario pai — mas so' se o
  // pai ainda for de outra pessoa (e se fosse nosso, a regra do store corta).
  if (parentId != null) {
    try {
      const pai = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(parentId);
      if (pai) {
        criarNotificacao({
          userId: pai.user_id,
          kind: "reply",
          actorId: entry.userId,
          refId: parentId,
          preview: body,
        });
      }
    } catch {
      /* a notificacao nunca pode impedir o comentario */
    }
  }

  // "@mencoes": avisar quem foi citado no texto. Corre mesmo que a pessoa nao
  // esteja a responder a ninguem — e' esse o ponto de escrever "@fulano".
  //
  // `criarNotificacao` ja corta duas situacoes por nos: notificar-se a si
  // proprio, e nao duplicar (a regra e' por destinatario + kind + ref, por isso
  // o mesmo "@fulano @fulano" so avisa uma vez).
  try {
    for (const nome of usernamesMencionados(body)) {
      const alvo = getUserByUsername(nome);
      if (!alvo) continue;
      criarNotificacao({
        userId: alvo.id,
        kind: "mention",
        actorId: entry.userId,
        refId: novoId,
        preview: body,
      });
    }
  } catch {
    /* a notificacao nunca pode impedir o comentario */
  }

  const row = db
    .prepare(
      `SELECT c.*, u.username FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(novoId);
  return toApiComment(row, entry.userId);
}

// Lista a thread: comentarios raiz por ordem cronologica, cada um com as suas
// respostas. Uma so' consulta; a arvore e' montada em memoria.
export function listComments({ type, tmdbId, season, episode, viewerId }) {
  const rows = db
    .prepare(
      `SELECT c.*, u.username FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.media_type = ? AND c.external_id = ? AND c.season IS ? AND c.episode IS ?
       ORDER BY c.created_at ASC`
    )
    .all(type, tmdbId, season ?? null, episode ?? null);

  const byId = new Map();
  for (const r of rows) byId.set(r.id, toApiComment(r, viewerId));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).replies.push(c);
    else roots.push(c);
  }
  return roots;
}

export function getComment(id, viewerId) {
  const r = db
    .prepare(
      `SELECT c.*, u.username FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(id);
  return r ? toApiComment(r, viewerId) : null;
}

// So o autor apaga. Se tiver respostas, apaga-se o texto mas a linha fica
// (para a thread nao perder as respostas); se nao tiver, sai de vez.
export function deleteComment(userId, id) {
  const r = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(id);
  if (!r) return { ok: false, error: "notfound" };
  if (Number(r.user_id) !== Number(userId)) return { ok: false, error: "forbidden" };
  const replies = db.prepare("SELECT COUNT(*) c FROM comments WHERE parent_id = ?").get(id).c;
  if (replies === 0) {
    db.prepare("DELETE FROM comments WHERE id = ?").run(id);
  } else {
    db.prepare("UPDATE comments SET deleted_at = ?, updated_at = ?, body = '' WHERE id = ?").run(
      now(),
      now(),
      id
    );
  }
  return { ok: true };
}

export function likeComment(userId, id) {
  const r = db
    .prepare("SELECT id, user_id FROM comments WHERE id = ? AND deleted_at IS NULL")
    .get(id);
  if (!r) return { ok: false, error: "notfound" };
  const guard = db
    .prepare(
      `INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(comment_id, user_id) DO NOTHING`
    )
    .run(id, userId, now());

  // Só notifica se o like foi MESMO novo. Carregar outra vez no mesmo like nao
  // e' novidade nenhuma — e notificar ai era o caminho mais curto para a pessoa
  // silenciar o sino.
  if (guard.changes > 0) {
    try {
      criarNotificacao({ userId: r.user_id, kind: "like", actorId: userId, refId: id });
    } catch {
      /* nunca rebenta o like por causa de uma notificacao */
    }
  }
  return { ok: true, likes: commentLikes(id) };
}

export function unlikeComment(userId, id) {
  db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(id, userId);
  return { ok: true, likes: commentLikes(id) };
}