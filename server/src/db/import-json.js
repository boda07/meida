// Importa a base antiga em JSON (server/data/data.json) para a base SQLite.
// Corre uma vez so; depois disto e' seguro nao voltar a correr (ver --force).
//
//   npm --prefix server run import:json
//
// Sem argumentos usa server/data/data.json. Para um ficheiro do computador
// antigo:  npm --prefix server run import:json -- "C:/caminho/data.json"
//
// A logica de importacao vive em ./seed.js (partilhada com o endpoint remoto
// POST /api/admin/seed, usado para migrar os dados para o servidor partilhado).
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { seedFromJson } from "./seed.js";

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

let raw;
try {
  raw = JSON.parse(readFileSync(SRC, "utf8"));
} catch (err) {
  console.error(`Nao consegui ler o JSON: ${err.message}`);
  process.exit(1);
}

let counts;
let scoreScale;
try {
  ({ counts, scoreScale } = seedFromJson(raw, { force }));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(`Importado de ${SRC} (notas em escala 1-${scoreScale} -> 0-100):`);
console.log(`  utilizadores: ${counts.users}`);
console.log(`  biblioteca:   ${counts.library}`);
console.log(`  diario:       ${counts.progress}`);
console.log(`  listas:       ${counts.lists} (${counts.listItems} titulos)`);
console.log(`  tokens:       ${counts.tokens}`);
console.log("Fim.");
