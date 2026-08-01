// Logger estruturado (JSONL) para o backend.
// - file: grava em <dataDir>/logs/YYYY-MM-DD.log (persistente para debug).
// - console: também escreve no processo (visivel no terminal em dev/self-host;
//   no app desktop o server roda sem terminal, logo não aparece mas não dói).
// Best-effort: um erro de escrita nunca parti a app.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DB_DIR
  ? resolve(process.env.DB_DIR)
  : resolve(__dirname, "../../data");
const logDir = resolve(dataDir, "logs");

let dirOk = false;
try {
  mkdirSync(logDir, { recursive: true });
  dirOk = true;
} catch {
  /* sem permissão: logging cai em silêncio */
}

const C = { info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", _reset: "\x1b[0m" };

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, "0")}`;
}

function consoleFn(level) {
  return level === "warn" ? console.warn : level === "error" ? console.error : console.log;
}

function write(level, tag, message, meta) {
  const entry = { t: stamp(), level, tag, msg: String(message) };
  if (meta) entry.meta = meta;
  const line = JSON.stringify(entry);
  try {
    consoleFn(level)(`${C[level]}[${tag}] ${message}${meta ? " " + JSON.stringify(meta) : ""}${C._reset}`);
  } catch {
    /* console pode nao existir (ex.: redirect de stdio) */
  }
  if (dirOk) {
    try {
      appendFileSync(resolve(logDir, `${stamp().slice(0, 10)}.log`), line + "\n", "utf8");
    } catch {
      /* disco cheio/ read-only: silently drop */
    }
  }
}

export const log = {
  info: (tag, message, meta) => write("info", tag, message, meta),
  warn: (tag, message, meta) => write("warn", tag, message, meta),
  error: (tag, message, meta) => write("error", tag, message, meta),
};
