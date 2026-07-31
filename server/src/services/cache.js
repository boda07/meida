// Cache em disco (JSON) para respostas do Jikan/Tenrai. Objetivo: quando ambas
// as APIs estiverem em baixo, catalogo/pesquisa/detalhes abrem com os ultimos
// dados conhecidos em vez de vazios. Um ficheiro por chave (hash sha1) em
// <dataDir>/cache/. A pasta data esta no .gitignore; no Electron empacotado
// aponta para app.getPath("userData") via DB_DIR (igual ao store.js).
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DB_DIR
  ? resolve(process.env.DB_DIR)
  : resolve(__dirname, "../../data");
const cacheDir = resolve(dataDir, "cache");
mkdirSync(cacheDir, { recursive: true });

const fileFor = (key) =>
  resolve(cacheDir, createHash("sha1").update(key).digest("hex") + ".json");

export function cacheGet(key) {
  try {
    const f = fileFor(key);
    if (!existsSync(f)) return null;
    const entry = JSON.parse(readFileSync(f, "utf8"));
    return entry?.value ?? null;
  } catch {
    return null;
  }
}

export function cacheSet(key, value) {
  try {
    writeFileSync(fileFor(key), JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* best-effort: falha em silencio */
  }
}

// Limpa entradas antigas (14 dias) no arranque, para a pasta nao crescer sem fim.
export function pruneCache(maxAgeMs = 14 * 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    for (const f of readdirSync(cacheDir)) {
      try {
        if (now - statSync(resolve(cacheDir, f)).mtimeMs > maxAgeMs)
          unlinkSync(resolve(cacheDir, f));
      } catch {
        /* ignora este ficheiro */
      }
    }
  } catch {
    /* ignora */
  }
}

pruneCache();
