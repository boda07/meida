import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// No app empacotado a pasta de recursos e so-leitura; o Electron passa DB_DIR
// (pasta de dados do utilizador, gravavel). Em dev usa server/data.
const dataDir = process.env.DB_DIR
  ? resolve(process.env.DB_DIR)
  : resolve(__dirname, "../data");
mkdirSync(dataDir, { recursive: true });

// SQLite embutido no Node 24 (node:sqlite) — sem dependencias nativas.
export const db = new DatabaseSync(resolve(dataDir, "app.db"));
db.exec("PRAGMA journal_mode = WAL");

// Esquema. `library` guarda uma linha por (utilizador, titulo): se ja viu
// (watched) e a nota (score 1-10, opcional).
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT,
    poster TEXT,
    watched INTEGER NOT NULL DEFAULT 0,
    watchlist INTEGER NOT NULL DEFAULT 0,
    score INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, tmdb_id, media_type),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migracao: garante a coluna watchlist em DBs criadas antes desta feature.
const cols = db.prepare("PRAGMA table_info(library)").all().map((c) => c.name);
if (!cols.includes("watchlist")) {
  db.exec("ALTER TABLE library ADD COLUMN watchlist INTEGER NOT NULL DEFAULT 0");
}

// Migracao: coluna avatar dos utilizadores (emoji predefinido ou URL de imagem).
const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userCols.includes("avatar")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
}
