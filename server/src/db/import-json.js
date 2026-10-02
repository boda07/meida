// Importa a base antiga em JSON (server/data/data.json) para a base SQLite.
// Corre uma vez so; depois disto e' seguro nao voltar a correr (ver --force).
//
//   npm --prefix server run import:json
//
// Sem argumentos usa server/data/data.json. Para um ficheiro do computador
// antigo:  npm --prefix server run import:json -- "C:/caminho/data.json"
//
// NOTA sobre as notas: a versao 0.9.9 multiplicou as notas por 10 (0-10 -> 0-100)
// e marcou isso em meta.scoreScale. Se o JSON ainda tiver scoreScale != 100,
// as notas sao multiplicadas aqui para nao ficarem 10x baixas.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { db, tx } from "./index.js";

const args = process.argv.slice(2);
const force = args.includes("--force");
const srcArg = args.find((a) => !a.startsWith("--"));

const SRC = srcArg
  ? resolve(srcArg)
  : resolve(process.env.DB_DIR || "data", "data.json");

if (!existsSync(SRC)) {
  console.error(`Ficheiro nao encontrado: ${SRC}`);
  console.error("Copia o server/data/data.json do computador antigo para ca.");
  process.exit(1);
}

const already = db.prepare("SELECT COUNT(*) c FROM users").get().c;
if (already > 0 && !force) {
  console.error(`A base ja tem ${already} utilizador(es). Nada a fazer.`);
  console.error("Se quiseres importar por cima mesmo assim, usa --force.");
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(readFileSync(SRC, "utf8"));
} catch (err) {
  console.error(`Nao consegui ler o JSON: ${err.message}`);
  process.exit(1);
}

const scoreScale = raw.meta?.scoreScale ?? 10; // <100 => notas ainda em 0-10
const bumpScore = (s) => (s == null ? s : Math.round(Number(s) * (scoreScale < 100 ? 10 : 1)));

const counts = { users: 0, library: 0, progress: 0, lists: 0, listItems: 0, tokens: 0 };
const now = () => new Date().toISOString();

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
});

console.log(`Importado de ${SRC} (notas em escala 1-${scoreScale} -> 0-100):`);
console.log(`  utilizadores: ${counts.users}`);
console.log(`  biblioteca:   ${counts.library}`);
console.log(`  diario:       ${counts.progress}`);
console.log(`  listas:       ${counts.lists} (${counts.listItems} titulos)`);
console.log(`  tokens:       ${counts.tokens}`);
console.log("Fim.");