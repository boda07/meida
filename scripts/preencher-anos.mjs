// Preenche o ano dos titulos da biblioteca que ainda nao o tem.
//
// PORQUE ISTO EXISTE: a "decada favorita" da pagina /stats precisa dos anos, e
// so' 0 dos 736 titulos da biblioteca os tinham (a coluna `library.year` nasceu na
// migracao 6, em 2026-10-09). Ha tres maneiras de os encher e este e' a
// terceira: perguntar ao catalogo.
//
//   1) Abrir a ficha do titulo -> guarda o ano (feito, em Details.jsx)
//   2) Importar do MAL ou do Letterboxd -> o ano vem no proprio import (feito)
//   3) ISTE SCRIPT: pergunta a cada titulo em falta
//
// So' o que falta e' preenchido. Um titulo que ja tem ano nao e' perguntado — e'
// por isso que correr o script duas vezes nao custa a segunda.
//
// E' LENTO de proposito: 6 pedidos por segundo, com uma pausa de vez em quando.
// 736 titulos sao ~2 minutos. Mais rapido bateria o TMDB com limites de taxa e
// perdia-se o essencial.
//
//   node scripts/preencher-anos.mjs            # todos os utilizadores
//   node scripts/preencher-anos.mjs --user 6   # so' um
//   node scripts/preencher-anos.mjs --limite 20  # so' 20, para experimentar
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

// Absoluto desde o inicio: um `import` de `file://./server/...` resolve para
// `file://./server` e o Node recusa ("Invalid URL"). Com `resolve` fica um
// caminho de disco a serio.
const RAIZ = resolve(process.argv[2] || ".");
const args = process.argv.slice(3);

const arg = (nome, def) => {
  const i = args.indexOf(nome);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const LIMITE = Number(arg("--limite", "0")) || 0;
const SO_USER = arg("--user", "") ? Number(arg("--user", "")) : null;

const { setLibraryYear, listLibrary } = await import(
  "file://" + RAIZ + "/server/src/store.js"
);
const { getDetails } = await import("file://" + RAIZ + "/server/src/services/tmdb.js");
const { getAnimeDetails } = await import(
  "file://" + RAIZ + "/server/src/services/jikan.js"
);

const db = new DatabaseSync(RAIZ + "/server/data/meida.db");

// Le da propria base, e nao de `listLibrary`: o store tem a sua propria ligacao e
// aqui so' se precisa de uma lista de (tipo, id) sem ano. E mais rapido.
const filtro = SO_USER ? "AND user_id = " + Number(SO_USER) : "";
const pendentes = db
  .prepare(
    `SELECT user_id, media_type, external_id, title FROM library
      WHERE year IS NULL ${filtro}
      ORDER BY user_id, media_type, external_id`
  )
  .all();

const alvo = LIMITE > 0 ? pendentes.slice(0, LIMITE) : pendentes;

console.log(`  titulos sem ano: ${pendentes.length}`);
if (LIMITE > 0) console.log(`  a processar os primeiros ${alvo.length}`);
if (!alvo.length) {
  console.log("  nada a fazer");
  process.exit(0);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let semAno = 0;
let falhou = 0;
const inicio = Date.now();

for (let i = 0; i < alvo.length; i++) {
  const it = alvo[i];
  try {
    // O catalogo tem caminhos separados para anime (MAL/Jikan) e para
    // filme/serie (TMDB). O id e' do MAL para anime e do TMDB para o resto —
    // ver o comentario sobre `external_id` em schema.js.
    const d =
      it.media_type === "anime"
        ? await getAnimeDetails(it.external_id)
        : await getDetails(it.media_type, it.external_id);
    const ano = Number(d?.year);
    if (Number.isFinite(ano) && ano > 0) {
      setLibraryYear(it.user_id, it.external_id, it.media_type, ano);
      ok++;
    } else {
      semAno++;
    }
  } catch {
    falhou++;
  }

  // 6 por segundo = 167 ms entre pedidos. Ha uma pausa maior a cada 60, para
  // nao andar sempre no limite.
  if (i % 60 === 59) await dormir(1200);
  else await dormir(167);

  if ((i + 1) % 25 === 0 || i === alvo.length - 1) {
    const pct = Math.round(((i + 1) / alvo.length) * 100);
    console.log(
      `  ${i + 1}/${alvo.length} (${pct}%)  com ano: ${ok}  sem ano: ${semAno}  falharam: ${falhou}`
    );
  }
}

const seg = Math.round((Date.now() - inicio) / 1000);
console.log("");
console.log(`  preenchidos: ${ok}   sem ano no catalogo: ${semAno}   falharam: ${falhou}   (${seg}s)`);

const restantes = db
  .prepare(`SELECT COUNT(*) c FROM library WHERE year IS NULL${SO_USER ? " AND user_id = " + SO_USER : ""}`)
  .get().c;
console.log(`  ainda sem ano: ${restantes}`);

process.exit(falhou > alvo.length / 2 ? 1 : 0);