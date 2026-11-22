// Notificações.
//
// Três eventos: resposta a um comentário, gosto num comentário, e
// "começou a seguir-te". Não há mais — notificações que se podem desligar e
// notificações de coisas que ninguém pediu são as que fazem as pessoas
// silenciar tudo.
//
// Duas regras que o store garante e que a UI não pode:
//
// 1. Nunca notificar a pessoa de si própria. Não interessa "gostaste do teu
//    próprio comentário" — e notificar faz o sino mexer sozinho, que é
//    exactamente o que faz a pessoa deixar de olhar para ele.
//
// 2. Nunca duplicar. O índice único (user, kind, ref, actor) faz o INSERT
//    falhar em duplicado e a notificação não é criada outra vez. Sem isto,
//    carregar no like várias vezes enche o sino de ruído.
import { db } from "../db/index.js";
import { now } from "./util.js";

/**
 * Cria uma notificação, se fizer sentido. Devolve sempre { ok } — falhar em
 * silêncio é aceitável porque uma notificação perdida não pode estragar o
 * que a pessoa estava a fazer (um comentário, um like).
 */
export function criarNotificacao({
  userId,
  kind,
  actorId,
  refId = null,
  type = null,
  tmdbId = null,
  season = null,
  episode = null,
  preview = null,
}) {
  if (!userId || !kind) return { ok: false, error: "faltam userId/kind" };
  // Regra 1: nada de notificar-se a si proprio.
  if (actorId != null && Number(actorId) === Number(userId)) return { ok: false, skipped: "proprio" };

  // O comentario tem de existir e estar visivel. Sem isto, uma resposta a um
  // comentario apagado criava uma notificacao para nada.
  if (refId != null) {
    const ref = db
      .prepare(
        `SELECT id, user_id, media_type, external_id, season, episode, body
         FROM comments WHERE id = ? AND deleted_at IS NULL`
      )
      .get(Number(refId));
    if (!ref) return { ok: false, skipped: "alvo inexistente" };
    // Nao se compara `ref.user_id` com `userId`: o destinatario e' de facto o
    // autor do comentario, e' esse o objectivo. O unico caso a evitar — o actor
    // a mexer no comentario dele — ja fellou na regra 1 acima, porque nesse caso
    // actor == userId.
    type = type ?? ref.media_type;
    tmdbId = tmdbId ?? ref.external_id;
    season = season ?? ref.season;
    episode = episode ?? ref.episode;
    if (!preview) preview = String(ref.body || "").slice(0, 120);
  }

  try {
    db.prepare(
      `INSERT INTO notifications
         (user_id, kind, actor_id, ref_id, media_type, external_id, season, episode, preview, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      kind,
      actorId ?? null,
      refId ?? null,
      type ?? null,
      tmdbId ?? null,
      season ?? null,
      episode ?? null,
      preview ? String(preview).slice(0, 120) : null,
      now()
    );
    return { ok: true };
  } catch (e) {
    // A unica falha esperada e' o indice unico (duplicado). Qualquer outra e'
    // um bug de verdade, mas nao vale a pena rebentar o pedido do utilizador.
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

/** As notificacoes de uma pessoa, mais recentes primeiro. */
export function listNotifications(userId, limite = 40) {
  return db
    .prepare(
      `SELECT n.*, u.username AS actor_username, u.avatar AS actor_avatar
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ?`
    )
    .all(userId, limite)
    .map(toApiNotification);
}

export function toApiNotification(r) {
  return {
    id: r.id,
    kind: r.kind,
    refId: r.ref_id,
    preview: r.preview,
    read: Boolean(r.read),
    createdAt: r.created_at,
    at: r.at,
    type: r.media_type,
    tmdbId: r.external_id,
    season: r.season,
    episode: r.episode,
    actor: r.actor_id
      ? { id: r.actor_id, username: r.actor_username || "?" }
      : null,
  };
}

/** Quantas nao lidas. E' o numero do sino. */
export function countUnread(userId) {
  return db
    .prepare("SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId).c;
}

/** Marca uma como lida (ou varias). */
export function markNotificationRead(userId, id) {
  const r = db
    .prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?")
    .run(userId, Number(id));
  return { ok: true, changed: r.changes > 0, unread: countUnread(userId) };
}

/** Marca todas como lidas. E' o que acontece ao abrir o painel. */
export function markAllNotificationsRead(userId) {
  const r = db
    .prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0")
    .run(userId);
  return { ok: true, changed: r.changes, unread: 0 };
}

/** Apaga as notificacoes com mais de N dias. Para a base nao crescer sem fim. */
export function pruneNotifications(userId, dias = 60) {
  const r = db
    .prepare(
      `DELETE FROM notifications
       WHERE user_id = ? AND read = 1 AND created_at < datetime('now', ?)`
    )
    .run(userId, "-" + dias + " days");
  return r.changes;
}