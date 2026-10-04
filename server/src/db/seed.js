// Semeia a base SQLite a partir do formato JSON antigo (server/data/data.json).
//
// Usado em dois sitios:
//  - CLI:  npm --prefix server run import:json [-- ficheiro.json] [--force]
//  - Remoto: POST /api/admin/seed (ver routes/admin.js), para migrar a base do
//    computador do utilizador para o servidor partilhado "dados na nuvem".
//
// NOTA sobre as notas: a versao 0.9.9 multiplicou as notas por 10 (0-10 -> 0-100)
// e marcou isso em meta.scoreScale. Se o JSON ainda tiver scoreScale != 100,
// as notas sao multiplicadas aqui para nao ficarem 10x baixas.
import { db, tx } from "./index.js";

const now = () => new Date().toISOString();

// `raw` = objeto do data.json. `force` = importar por cima de uma base com users.
// Devolve { counts, scoreScale }.
export function seedFromJson(raw, { force = false } = {}) {
  if (!raw || typeof raw !== "object") throw new Error("JSON invalido.");

  const already = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  if (already > 0 && !force) {
    const e = new Error(
      `A base ja tem ${already} utilizador(es). Volta a tentar com force para importar por cima.`
    );
    e.status = 409;
    throw e;
  }

  const scoreScale = raw.meta?.scoreScale ?? 10; // <100 => notas ainda em 0-10
  const bumpScore = (s) => (s == null ? s : Math.round(Number(s) * (scoreScale < 100 ? 10 : 1)));

  const counts = {
    users: 0,
    library: 0,
    progress: 0,
    lists: 0,
    listItems: 0,
    tokens: 0,
    follows: 0,
    comments: 0,
    commentLikes: 0,
  };

  tx(() => {
    /* --- Utilizadores --- */
    // Mapeia o id antigo -> id novo (o AUTOINCREMENT pode dar ids diferentes).
    const idMap = new Map();
    const insUser = db.prepare(
      "INSERT INTO users (username, password_hash, avatar, created_at, bio, is_public) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const u of raw.users || []) {
      // username tem UNIQUE COLLATE NOCASE: se o JSON tiver "Boda" e "boda"
      // (impossivel de acontecer, mas nao custa guarding), o segundo e' ignorado.
      const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(u.username);
      if (exists) {
        idMap.set(u.id, exists.id);
        continue;
      }
      const r = insUser.run(
        u.username,
        u.password_hash,
        u.avatar ?? null,
        u.created_at || now(),
        u.bio ?? null,
        u.is_public ?? 1
      );
      idMap.set(u.id, Number(r.lastInsertRowid));
      counts.users++;

      for (const [provider, payload] of [
        ["mal", u.mal],
        ["anilist", u.anilist],
        ["letterboxd", u.letterboxd],
        ["debrid", u.debrid],
      ]) {
        if (!payload) continue;
        db.prepare(
          "INSERT OR REPLACE INTO user_tokens (user_id, provider, payload, updated_at) VALUES (?, ?, ?, ?)"
        ).run(r.lastInsertRowid, provider, JSON.stringify(payload), now());
        counts.tokens++;
      }
    }

    /* --- Biblioteca --- */
    const insLib = db.prepare(
      `INSERT OR REPLACE INTO library
         (user_id, media_type, external_id, title, title_en, title_romaji, poster,
          genres, watched, watchlist, score, rating, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of raw.library || []) {
      const uid = idMap.get(r.user_id);
      if (uid == null) continue;
      insLib.run(
        uid,
        r.media_type,
        r.tmdb_id,
        r.title ?? null,
        r.title_en ?? null,
        r.title_romaji ?? null,
        r.poster ?? null,
        Array.isArray(r.genres) ? JSON.stringify(r.genres) : null,
        r.watched ? 1 : 0,
        r.watchlist ? 1 : 0,
        bumpScore(r.score),
        r.rating ?? null,
        r.updated_at || now()
      );
      counts.library++;
    }

    /* --- Progresso / diario --- */
    const insProg = db.prepare(
      `INSERT OR REPLACE INTO progress
         (user_id, media_type, external_id, title, poster, season, episode,
          position, duration, provider, started_at, finished_at, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of raw.progress || []) {
      const uid = idMap.get(r.user_id);
      if (uid == null) continue;
      insProg.run(
        uid,
        r.type,
        r.tmdb_id,
        r.title ?? null,
        r.poster ?? null,
        r.season ?? null,
        r.episode ?? null,
        r.position ?? null,
        r.duration ?? null,
        r.provider ?? null,
        r.started_at ?? null,
        r.finished_at ?? null,
        r.status || "watching",
        r.updated_at || now()
      );
      counts.progress++;
    }

    /* --- Listas --- */
    const insList = db.prepare("INSERT INTO lists (user_id, name, created_at) VALUES (?, ?, ?)");
    for (const l of raw.lists || []) {
      const uid = idMap.get(l.user_id);
      if (uid == null) continue;
      const lr = insList.run(uid, l.name, l.created_at || now());
      counts.lists++;
      const insItem = db.prepare(
        `INSERT OR REPLACE INTO list_items (list_id, media_type, external_id, title, poster, added_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const i of l.items || []) {
        insItem.run(lr.lastInsertRowid, i.type, i.tmdb_id, i.title ?? null, i.poster ?? null, i.added_at ?? null);
        counts.listItems++;
      }
    }

    /* --- Seguir (opcional: so existe em exports mais recentes) --- */
    const insFollow = db.prepare(
      "INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)"
    );
    for (const f of raw.follows || []) {
      const a = idMap.get(f.follower_id);
      const b = idMap.get(f.followee_id);
      if (a == null || b == null || a === b) continue;
      insFollow.run(a, b, f.created_at || now());
      counts.follows++;
    }

    /* --- Comentarios (por episodio) + gostos --- */
    // Ordena por id para os pais serem inseridos antes das respostas (FK).
    const comments = (raw.comments || [])
      .slice()
      .sort((x, y) => Number(x.id || 0) - Number(y.id || 0));
    const commentIdMap = new Map();
    const insComment = db.prepare(
      `INSERT INTO comments
         (id, user_id, media_type, external_id, season, episode, parent_id, body,
          at_seconds, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of comments) {
      const uid = idMap.get(c.user_id);
      if (uid == null) continue;
      const parent = c.parent_id != null ? commentIdMap.get(c.parent_id) ?? null : null;
      insComment.run(
        c.id,
        uid,
        c.media_type,
        c.external_id,
        c.season ?? null,
        c.episode ?? null,
        parent,
        c.body,
        c.at_seconds ?? null,
        c.created_at || now(),
        c.updated_at ?? null,
        c.deleted_at ?? null
      );
      commentIdMap.set(c.id, c.id);
      counts.comments++;
    }

    const insLike = db.prepare(
      "INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)"
    );
    for (const l of raw.commentLikes || []) {
      const cid = commentIdMap.get(l.comment_id);
      const uid = idMap.get(l.user_id);
      if (cid == null || uid == null) continue;
      insLike.run(cid, uid, l.created_at || now());
      counts.commentLikes++;
    }
  });

  return { counts, scoreScale };
}
