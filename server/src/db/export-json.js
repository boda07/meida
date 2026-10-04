// Exporta a base SQLite para o formato JSON antigo (server/data/data.json),
// incluindo as partes sociais (seguir, comentarios, gostos). Serve para migrar
// os dados deste computador para o servidor partilhado ("dados na nuvem"):
//
//   npm --prefix server run export:json -- "remote-seed.json"
//   curl -X POST https://<servidor>/api/admin/seed \
//        -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
//        --data-binary @remote-seed.json
//
// Sem argumento escreve o JSON no stdout (redireccionavel com >).
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "./index.js";

const args = process.argv.slice(2);
const outArg = args.find((a) => !a.startsWith("--"));

function parseJson(s, fallback) {
  if (s == null) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

const users = db
  .prepare("SELECT id, username, password_hash, avatar, created_at, bio, is_public FROM users")
  .all()
  .map((u) => {
    const out = {
      id: u.id,
      username: u.username,
      password_hash: u.password_hash,
      avatar: u.avatar,
      created_at: u.created_at,
      bio: u.bio,
      is_public: u.is_public,
    };
    for (const t of db
      .prepare("SELECT provider, payload FROM user_tokens WHERE user_id = ?")
      .all(u.id)) {
      out[t.provider] = parseJson(t.payload, null);
    }
    return out;
  });

const library = db
  .prepare("SELECT * FROM library")
  .all()
  .map((r) => ({
    user_id: r.user_id,
    media_type: r.media_type,
    tmdb_id: r.external_id,
    title: r.title,
    title_en: r.title_en,
    title_romaji: r.title_romaji,
    poster: r.poster,
    genres: parseJson(r.genres, []),
    watched: r.watched,
    watchlist: r.watchlist,
    score: r.score,
    rating: r.rating,
    updated_at: r.updated_at,
  }));

const progress = db
  .prepare("SELECT * FROM progress")
  .all()
  .map((r) => ({
    user_id: r.user_id,
    type: r.media_type,
    tmdb_id: r.external_id,
    title: r.title,
    poster: r.poster,
    season: r.season,
    episode: r.episode,
    position: r.position,
    duration: r.duration,
    provider: r.provider,
    started_at: r.started_at,
    finished_at: r.finished_at,
    status: r.status,
    updated_at: r.updated_at,
  }));

const lists = db
  .prepare("SELECT id, user_id, name, created_at FROM lists")
  .all()
  .map((l) => ({
    user_id: l.user_id,
    name: l.name,
    created_at: l.created_at,
    items: db
      .prepare(
        "SELECT media_type AS type, external_id AS tmdb_id, title, poster, added_at FROM list_items WHERE list_id = ?"
      )
      .all(l.id),
  }));

const follows = db.prepare("SELECT follower_id, followee_id, created_at FROM follows").all();

const comments = db
  .prepare(
    `SELECT id, user_id, media_type, external_id, season, episode, parent_id, body,
            at_seconds, created_at, updated_at, deleted_at
       FROM comments`
  )
  .all();

const commentLikes = db
  .prepare("SELECT comment_id, user_id, created_at FROM comment_likes")
  .all();

const out = {
  meta: { scoreScale: 100, exportedAt: new Date().toISOString() },
  users,
  library,
  progress,
  lists,
  follows,
  comments,
  commentLikes,
};

const json = JSON.stringify(out, null, 2);
if (outArg) {
  const dest = resolve(outArg);
  writeFileSync(dest, json, "utf8");
  console.error(
    `Exportado para ${dest}: ${users.length} utilizadores, ${library.length} biblioteca, ` +
      `${progress.length} diario, ${comments.length} comentarios, ${follows.length} seguir.`
  );
} else {
  process.stdout.write(json);
}
