// Base de dados SQLite (node:sqlite, sem dependencias externas).
//
// Onde fica o ficheiro: a pasta de dados ja definida por DB_DIR (no app
// empacotado o Electron aponta para uma pasta gravavel do utilizador); em dev
// usa server/data. O nome e' meida.db.
//
// PRAGMAs importantes:
//  - foreign_keys = ON  -> integridade referencial (o ON DELETE CASCADE apaga
//                         os dados derivados quando o utilizador apaga a conta).
//  - journal_mode = WAL -> leitores nao bloqueiam o escritor. Sem isto, um
//                         comentario novo bloqueava a leitura da biblioteca.
//  - busy_timeout       -> esperava 0 ms por defeito, ou seja, dois utilizadores
//                         a escrever ao mesmo tempo davam "SQLITE_BUSY" de
//                         imediato. 5 s dá tempo de esperar em vez de falhar.
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { MIGRATIONS } from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataDir = process.env.DB_DIR
  ? resolve(process.env.DB_DIR)
  : resolve(__dirname, "../../data");
mkdirSync(dataDir, { recursive: true });

export const DB_PATH = process.env.DB_PATH
  ? resolve(process.env.DB_PATH)
  : resolve(dataDir, "meida.db");

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA synchronous = NORMAL");

/* ===== Migracoes ===== */
// Cada migracao e um numero + uma funcao. O numero ja aplicado fica registado
// em schema_migrations, por isso correr duas vezes nao faz nada e da para
// acrescentar schemas novos sem mexer no que ja foi feito.
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
)`);

const applied = new Set(
  db.prepare("SELECT version FROM schema_migrations").all().map((r) => r.version)
);

for (const m of MIGRATIONS) {
  if (applied.has(m.version)) continue;
  db.exec("BEGIN");
  try {
    m.up(db);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
      m.version,
      new Date().toISOString()
    );
    db.exec("COMMIT");
    logInfo(`migracao ${m.version} (${m.name}) aplicada`);
  } catch (err) {
    db.exec("ROLLBACK");
    throw new Error(`migracao ${m.version} (${m.name}) falhou: ${err.message}`, { cause: err });
  }
}

/* ===== Utilitarios ===== */

// Nao usa console.log directo: o backend tem o logger com timestamps.
function logInfo(msg) {
  const line = `[db] ${msg}\n`;
  try {
    process.stdout.write(line);
  } catch {
    /* stdout fechado: nao vale a pena falhar por causa de um log */
  }
}

// Executa `fn` dentro de uma transacao (tudo ou nada). Se a fn lancar, faz
// ROLLBACK e volta a lancar o erro.
export function tx(fn) {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* a transaccao ja tinha sido desfeita */
    }
    throw err;
  }
}

// SQLite guarda inteiros como number (nao BigInt) e null como null, mas os
// booleanos JS nao existem no SQLite: o store converte 0/1 <-> true/false com o
// seu proprio helper, por isso nao ha conversores aqui.
export function closeDb() {
  try {
    db.close();
  } catch {
    /* ja estava fechada */
  }
}