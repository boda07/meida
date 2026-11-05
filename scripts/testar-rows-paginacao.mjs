// A lista completa de uma row do catalogo (o "Ver todos") e a paginacao.
//
// O que este teste guarda, e que mais nada guarda:
//
//  1. `paginasVisiveis` — a janela de numeros (primeira, ultima e as da volta da
//     atual). E' a unica regra da paginacao e vive fora do componente para poder
//     ser testada assim, sem montar React.
//  2. O CONTRATO das rows: todo o id que o catalogo produz tem uma fonte em
//     `catalogRows`. Uma row nova sem fonte da' um "Ver todos" que abre um 404 —
//     e o link no ecra parece perfeitamente bom. A lista abaixo e' intencional:
//     quem acrescentar uma row ao catalogo tem de a ligar aqui.
//  3. A rota `/api/rows/:id` e' servida pelo `catalogRouter` e ele e' montado
//     ANTES dos routers com `requireAuth` global. Se for depois, um pedido a uma
//     rota desconhecida cai no `libraryRouter` e responde 401 — que parece um
//     problema de login e nao uma rota em falta.
//  4. `/api/rows` esta' na lista de rotas LOCAIS do cliente. Com os dados na
//     nuvem (o caso normal no Electron), uma rota que falte nessa lista vai para
//     o servidor remoto, onde nao existe: 401.
//  5. Os links: Home e Categoria passam `/all/<id>`; a pesquisa e a ficha nao
//     tem uma lista completa equivalente e por isso nao mostram o link.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { paginasVisiveis } from "../web/src/lib/paginacao.js";
import { isLocalApiPath } from "../web/src/api/client.js";
import { ROWS_TMDB, ROWS_ANIME } from "../server/src/services/catalogRows.js";

const RAIZ = resolve(process.argv[2] || ".");
const ler = (rel) => readFileSync(resolve(RAIZ, rel), "utf8");

let n = 0;
let falhou = 0;
function ok(nome, cond, extra = "") {
  if (cond) {
    n += 1;
    console.log("  OK    " + nome);
  } else {
    falhou += 1;
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
  }
}

/* ---------- 1) Janela de paginas ---------- */

console.log("  1) paginasVisiveis");
const v = (atual, total) => JSON.stringify(paginasVisiveis(atual, total));

ok("uma pagina so'", v(1, 1) === "[1]", v(1, 1));
ok("no inicio, a ultima aparece e a janela corta a direita", v(1, 500) === "[1,2,3,null,500]", v(1, 500));
ok("perto do inicio, os dois lados da janela cabem", v(2, 500) === "[1,2,3,4,null,500]", v(2, 500));
ok("no meio, ha' reticencias dos dois lados", v(250, 500) === "[1,null,248,249,250,251,252,null,500]", v(250, 500));
ok("no fim, a janela corta a esquerda", v(500, 500) === "[1,null,498,499,500]", v(500, 500));
ok("sem buracos nao ha' reticencias", v(1, 3) === "[1,2,3]", v(1, 3));
ok("a propria pagina aparece sempre na janela", paginasVisiveis(47, 500).includes(47));
ok("nunca ha' duas reticencias seguidas", (() => {
  for (let p = 1; p <= 500; p += 1) {
    const lista = paginasVisiveis(p, 500);
    for (let i = 1; i < lista.length; i += 1) {
      if (lista[i] === null && lista[i - 1] === null) return false;
    }
  }
  return true;
})());
ok("os numeros estao ordenados e sem repetidos", (() => {
  for (let p = 1; p <= 500; p += 1) {
    const nums = paginasVisiveis(p, 500).filter((x) => x !== null);
    for (let i = 1; i < nums.length; i += 1) if (nums[i] <= nums[i - 1]) return false;
  }
  return true;
})());

/* ---------- 2) Todo o id de row tem fonte ---------- */

console.log("  2) contrato das rows");
const HOME = ["trending", "popular-movies", "popular-tv", "top-rated"];
const FILMES = ["m-trending", "m-popular", "m-top", "m-now", "m-anime"];
const SERIES = ["t-trending", "t-popular", "t-top", "t-air"];
const ANIME = ["a-top", "a-season", "a-airing", "a-movies"];

for (const id of HOME) ok(`Home: "${id}" tem fonte`, Boolean(ROWS_TMDB[id]));
for (const id of FILMES.filter((x) => x !== "m-anime")) {
  ok(`Filmes: "${id}" tem fonte`, Boolean(ROWS_TMDB[id]));
}
for (const id of SERIES) ok(`Series: "${id}" tem fonte`, Boolean(ROWS_TMDB[id]));
for (const id of ANIME) ok(`Anime: "${id}" tem fonte`, Boolean(ROWS_ANIME[id]));

// `m-anime` vem do MAL (getAnimeMovies), nao do TMDB.
ok('Filmes: "m-anime" tem fonte de anime', Boolean(ROWS_ANIME["m-anime"]));
ok("a row dos generos do onboarding nao e' uma lista fixa", (() => {
  const src = ler("server/src/services/catalogRows.js");
  return src.includes('rowId === "ob-generos"') && src.includes("discover(");
})());
ok("uma row desconhecida devolve null (e a rota responde 404)", /return null;/.test(ler("server/src/services/catalogRows.js")));

/* ---------- 3) A rota e a ordem dos routers ---------- */

console.log("  3) rota /api/rows/:id");
const rotas = ler("server/src/routes/catalog.js");
ok("a rota esta' registada", /catalogRouter\.get\("\/rows\/:id"/.test(rotas));
ok("le a pagina do pedido", /req\.query\.page/.test(rotas));
ok("le os generos do pedido", /req\.query\.genres/.test(rotas));
ok("serve a row pelo servico", /getCatalogRow\(/.test(rotas));
ok("row desconhecida responde 404", /status\(404\)/.test(rotas));

const index = ler("server/src/index.js");
const posCatalog = index.indexOf('app.use("/api", catalogRouter)');
const posLibrary = index.indexOf('app.use("/api", libraryRouter)');
ok("o catalogRouter esta' montado", posCatalog > -1);
ok(
  "vem antes do libraryRouter (que exige login a tudo)",
  posCatalog > -1 && posLibrary > -1 && posCatalog < posLibrary,
  `catalog=${posCatalog} library=${posLibrary}`
);

/* ---------- 4) A rota e' LOCAL no cliente ---------- */

console.log("  4) classificacao local/remota no cliente");
ok("/api/rows/popular-movies e' local", isLocalApiPath("/api/rows/popular-movies") === true);
ok("/api/rows (sem id) e' local", isLocalApiPath("/api/rows") === true);
ok("nao apanha /api/rowsxxx por prefixo", isLocalApiPath("/api/rowsxxx") === false);
ok("/api/library continua remota", isLocalApiPath("/api/library") === false);

/* ---------- 5) Os links ---------- */

console.log("  5) de onde se chega a' lista completa");
const home = ler("web/src/pages/Home.jsx");
const categoria = ler("web/src/pages/Category.jsx");
const pesquisa = ler("web/src/pages/Search.jsx");
const ficha = ler("web/src/pages/Details.jsx");

ok("Home: o Ver todos leva a /all/<id>", /href=\{`\/all\/\$\{row\.id\}`\}/.test(home));
ok("Home: a row dos generos leva os generos e o titulo", /\/all\/ob-generos\?genres=/.test(home));
ok("Categoria: o Ver todos leva a /all/<id>", /href=\{`\/all\/\$\{row\.id\}`\}/.test(categoria));
ok("Pesquisa: sem link para uma lista diferente da que se ve", !pesquisa.includes("HREF_POR_TIPO"));
ok("Ficha: sem link para uma lista diferente da que se ve", !ficha.includes("HREF_POR_TIPO"));

const allRow = ler("web/src/pages/AllRow.jsx");
ok("a pagina pede a row ao servidor", /catalogRow\(rowId/.test(allRow));
ok("a pagina tem paginacao", /<Pagination/.test(allRow));
ok("mudar de pagina escreve ?page=", /set\("page"/.test(allRow));

const servico = ler("server/src/services/catalogRows.js");
ok("a pagina chega ao TMDB", /getListPage\(tmdb\.path, page, opts\)/.test(servico));
ok("a pagina chega ao Jikan", /getAnimeListPage\(anime\.path, page, opts\)/.test(servico));
ok("o cliente expoe catalogRow", /catalogRow:/.test(ler("web/src/api/client.js")));

const app = ler("web/src/App.jsx");
ok("a rota /all/:rowId esta' registada", /path="\/all\/:rowId"/.test(app));

/* ---------- 6) A ultima fila da grelha nao fica com um buraco ---------- */

console.log("  6) grelha centrada");
const css = ler("web/src/styles.css");
// Numa grelha (`auto-fill`), uma pagina de 20 titulos num ecra de 8 colunas
// deixava a ultima fila encostada a' esquerda, com metade da largura vazia a'
// direita. Flex + center centra a ultima fila; nas filas cheias o resultado e'
// o mesmo de antes. Os cartoes tem de manter a largura (nao esticar).
const blocoGrid = css.match(/^\.grid\s*\{[^}]*\}/m)?.[0] || "";
ok(
  ".grid usa flex-wrap + justify-content: center",
  /display:\s*flex;/.test(blocoGrid) &&
    /flex-wrap:\s*wrap;/.test(blocoGrid) &&
    /justify-content:\s*center;/.test(blocoGrid),
  blocoGrid.replace(/\s+/g, " ").slice(0, 140)
);
ok(
  "os cartoes mantem a largura fixa (a ultima fila centra, nao estica)",
  /^\.grid\s*>\s*\*\s*\{[^}]*flex:\s*0\s+0\s+var\(--card-w/m.test(css)
);

/* ---------- Resumo ---------- */

console.log(`\n${n} ok, ${falhou} falha(s)`);
process.exitCode = falhou ? 1 : 0;
