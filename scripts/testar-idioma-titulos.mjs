// O idioma dos titulos tem de ser o que a pessoa escolheu — em TODO o lado.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **Escolher a lingua da interface tem de mudar os titulos. Nao pode haver nenhum
// sitio onde o titulo guardado seja devolvido tal e qual.**
//
// Eram duas falhas que nao davam erro nenhum — a app mostrava um titulo, so que
// o titulo errado:
//
//  1. **O omissao nao seguia a interface.** `titleLang` era `"en"`. A interface e
//     o titulo sao duas definicoes, e so a segunda mandava no catalogo: quem
//     punha a interface em portugues via nenhuma parte notar nos titulos. Agora o
//     omissao e' `"auto"`, que se resolve para o idioma da interface no cliente
//     (`titleLangEfetivo`) — o servidor nao sabe o idioma da interface de ninguem,
//     e se "auto" chegasse ao servidor o `resolveLang` caia no seu fallback, que
//     e' `en-US`. Ia para ingles, que e' o defeito.
//  2. **O titulo gravado era devolvido como estava.** `progress`, `library`,
//     `list_items` e as tabelas do `progress` guardam o titulo **no momento em
//     que o titulo foi visto**. Depois de mudar o idioma, esses sítios mostravam
//     o titulo antigo para sempre. Agora `localizarTitulos` troca o titulo pelo
//     do idioma pedido em todas as rotas que devolvem itens.
//
// A segunda e' a que e' facil de deixar passar: **`GET /api/library` ja o fazia**,
// o que fazia a biblioteca parecer funcionar e as listas e o "Continua a ver"
// parecerem ter outra causa. E' por isso que o teste olha para as QUATRO rotas
// e nao so para a funcao.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

/* ---------- 0) localStorage de mentira, e a cache do servidor em pasta temp ---------- */
// Tem de ser ANTES de qualquer import do `client.js` e do `cache.js`: ambos leem
// o `localStorage`/`DB_DIR` no momento em que sao carregados.
const DIRS = new Map();
globalThis.localStorage = {
  getItem: (k) => (DIRS.has(k) ? DIRS.get(k) : null),
  setItem: (k, v) => { DIRS.set(k, String(v)); },
  removeItem: (k) => { DIRS.delete(k); },
  clear: () => DIRS.clear(),
};

const DB_TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "meida-titlang-"));
process.env.DB_DIR = DB_TEMP;

const { cacheSet } = await import("../server/src/services/cache.js");
const { localizarTitulos } = await import("../server/src/services/tmdb.js");
const { settingsStore, migrarTitleLang, titleLangEfetivo, DEFAULT_SETTINGS } = await import(
  "../web/src/api/client.js"
);

/* ---------- 1) A migracao: "en" guardado passa a "auto", UMA vez ---------- */
console.log("");
console.log("  1) a migracao do titleLang guardado");
{
  ok_('"en" guardado passa a "auto"', migrarTitleLang("en", false) === "auto");
  ok_('"pt" guardado fica "pt" (nao mexemos)', migrarTitleLang("pt", false) === "pt");
  ok_('"auto" fica "auto"', migrarTitleLang("auto", false) === "auto");
  ok_("sem valor guardado nao se inventa nada", migrarTitleLang(undefined, false) === undefined);
  // O ponto do teste: a migracao corre UMA vez. Sem isto, quem escolhesse
  // "Ingles" a proposito via-se a "auto" em cada arranque, sem forma de parar.
  ok_('ja migrado: "en" guardado RESPEITA-SE', migrarTitleLang("en", true) === "en");

  ok_('o omissao novo e\' "auto"', DEFAULT_SETTINGS.titleLang === "auto");
}

console.log("");
console.log("  2) a migracao corre mesmo, uma vez so, no sitio certo");
{
  const KEY = "streamapp_settings";
  const MARCA = "streamapp_migrou_titlang";

  DIRS.clear();
  DIRS.set(KEY, JSON.stringify({ titleLang: "en", cardW: 200 }));
  let s = settingsStore.get();
  ok_("um 'en' guardado passa a 'auto' ao ler", s.titleLang === "auto", "veio " + s.titleLang);
  ok_("e as outras definicoes ficam como estavam", s.cardW === 200);
  ok_("a marca da migracao fica escrita", DIRS.get(MARCA) === "1");
  ok_("e o valor migrado e gravado", JSON.parse(DIRS.get(KEY)).titleLang === "auto");

  // O utilizador escolhe ingles DEPOIS da migracao. Tem de ser respeitado.
  DIRS.set(KEY, JSON.stringify({ titleLang: "en", cardW: 200 }));
  s = settingsStore.get();
  ok_('escolher "Ingles" depois da migracao e\' respeitado', s.titleLang === "en", "veio " + s.titleLang);

  // E sem a migracao corrida, um "en" volta a virar "auto".
  DIRS.delete(MARCA);
  DIRS.set(KEY, JSON.stringify({ titleLang: "en" }));
  ok_("sem a marca, volta a migrar", settingsStore.get().titleLang === "auto");

  // Um valor desconhecido nao e' tocado.
  DIRS.delete(MARCA);
  DIRS.set(KEY, JSON.stringify({ titleLang: "pt-PT" }));
  ok_('um valor assim (ex.: "pt-PT") fica como esta', settingsStore.get().titleLang === "pt-PT");
}

/* ---------- 3) "auto" resolve-se no cliente, e nao chega ao servidor ---------- */
console.log("");
console.log("  3) 'auto' resolve-se no cliente");
{
  globalThis.localStorage.setItem("meida:idioma", "pt");
  ok_('com a interface em portugues, "auto" -> "pt"', titleLangEfetivo("auto") === "pt");
  globalThis.localStorage.setItem("meida:idioma", "en");
  ok_('com a interface em ingles, "auto" -> "en"', titleLangEfetivo("auto") === "en");
  ok_('"pt" explicito fica "pt"', titleLangEfetivo("pt") === "pt");
  ok_('"en" explicito fica "en"', titleLangEfetivo("en") === "en");
  // O `resolveLang` do servidor, com "auto", daria en-US. E' por isso que isto
  // se resolve aqui e nao la.
  ok_('"auto" nunca e enviado ao servidor', titleLangEfetivo("auto") !== "auto");
  globalThis.localStorage.removeItem("meida:idioma");
}

/* ---------- 4) O titulo guardado e' trocado pelo do idioma pedido ---------- */
console.log("");
console.log("  4) localizarTitulos troca o titulo guardado");
{
  // O 424 e' Schindler's List; o PT so existe se o TMDB o tiver, e o cache e'
  // semeado a mao para o teste nao depender da rede nem da ficha.
  cacheSet("tmeta:movie:424:pt-PT", { title: "A Lista de Schindler", poster: "/pt.jpg" });

  const itens = [
    { type: "movie", tmdbId: 424, title: "Schindler's List", poster: "/en.jpg" },
    { type: "movie", tmdbId: 999999, title: "Sem cache", poster: null },
    { type: "tv", tmdbId: 424, title: "Serie", poster: null },
    { type: "anime", tmdbId: 424, title: "Anime", poster: null },
  ];
  const emFalta = localizarTitulos(itens, "pt");

  ok_("o titulo em cache substitui o guardado", itens[0].title === "A Lista de Schindler", itens[0].title);
  ok_("e o cartaz tambem", itens[0].poster === "/pt.jpg");
  ok_("o que nao tem cache fica como estava", itens[1].title === "Sem cache");
  ok_("e vai para a lista do que falta", emFalta.some((i) => i.tmdbId === 999999));
  ok_("o que ja estava em cache nao", !emFalta.some((i) => i.tmdbId === 424 && i.type === "movie"));
  // O anime tem o seu proprio idioma (`animeTitleLang`): nao se mexe nem e' pedido.
  ok_("o anime fica como esta", itens[3].title === "Anime");
  ok_("e o anime nao vai para a lista do que falta", !emFalta.some((i) => i.type === "anime"));
  ok_("a serie sem cache tambem vai", emFalta.some((i) => i.type === "tv" && i.tmdbId === 424));

  // O idiorma decide a chave: em ingles o mesmo filme da "A Lista de Schindler".
  const emIngles = [{ type: "movie", tmdbId: 424, title: "O que estava", poster: null }];
  localizarTitulos(emIngles, "en");
  ok_("em ingles nao se usa a traducao portuguesa", emIngles[0].title === "O que estava", emIngles[0].title);

  ok_("uma lista vazia nao rebenta", localizarTitulos([], "pt").length === 0);
  ok_("sem lista nenhuma tambem", localizarTitulos(undefined, "pt").length === 0);
}

/* ---------- 5) TODAS as rotas que devolvem itens passam por ai ---------- */
// A biblioteca ja o fazia, e e' isso que fazia as outras parecerem ter outra
// causa. Cada uma e' verificada pelo texto, que e' o que este ficheiro consegue
// garantir sem levantar o servidor.
console.log("");
console.log("  5) todas as rotas que devolvem titulos guardados localizam-nos");
{
  const ROTAS = [
    ["server/src/routes/library.js", 'libraryRouter.get("/library"', true],
    ["server/src/routes/library.js", 'libraryRouter.get("/lists/:id"', true],
    ["server/src/routes/progress.js", 'progressRouter.get("/progress"', true],
    ["server/src/routes/social.js", 'socialRouter.get("/users/:username/library"', true],
    ["server/src/routes/social.js", 'socialRouter.get("/users/:username/lists/:id"', true],
  ];
  const lidos = {};
  for (const [f] of ROTAS) {
    if (!lidos[f]) lidos[f] = fs.readFileSync(path.join(RAIZ, f), "utf8");
  }
  for (const [f, marca] of ROTAS) {
    const src = lidos[f];
    const i = src.indexOf(marca);
    ok_(f.split("/").pop() + " " + marca.replace(/.*get\("/, "/"), i >= 0);
    if (i < 0) continue;
    // O corpo vai da marca ate ao pedido SEGUINTE do mesmo ficheiro. Cortar por
    // uma janela de N caracteres nao serve: `/library` tem backfill, notas e
    // generos, e o `localizarTitulos` esta' a meio.
    const seguinte = src.slice(i + marca.length).search(/\n\w+Router\.(get|post|patch|delete)\(/);
    const fim = seguinte < 0 ? i + 4000 : i + marca.length + seguinte;
    const corpo = src.slice(i, fim);
    ok_("  └─ usa localizarTitulos", /localizarTitulos\(/.test(corpo));
    ok_("  └─ e dispara o preenchimento em segundo plano", /preencherTitulosLocalizados\(|runBackfill\(/.test(corpo));
    ok_("  └─ e le o idioma do pedido", /req\.query\.titleLang/.test(corpo));
  }
}

/* ---------- 6) O cliente manda o idioma em todas essas chamadas ---------- */
console.log("");
console.log("  6) o cliente manda o idioma nessas chamadas");
{
  const client = fs.readFileSync(path.join(RAIZ, "web/src/api/client.js"), "utf8");
  const CHAMADAS = [
    "userLibrary:",
    "userList:",
    "listTitles:",
    "progress: () =>",
    "library: () =>",
  ];
  for (const c of CHAMADAS) {
    const i = client.indexOf(c);
    ok_("existe " + c, i >= 0);
    if (i < 0) continue;
    // Nao se pode olhar so para a LINHA: `userLibrary` e `userList` estão
    // partidos em duas linhas para nao passar do limite de largura.
    const janela = client.slice(i, i + 220);
    ok_("  └─ " + c.slice(0, 24) + " manda langParams()", /langParams\(\)/.test(janela),
      JSON.stringify(janela.slice(0, 90)));
  }
}

/* ---------- 7) As dependencias dos efeitos que carregam o catalogo ---------- */
// Sem `t.idioma`, mudar o idioma da interface nao recarrega nada: `titleLang`
// continua "auto" e so muda o valor de que ele se resolve.
console.log("");
console.log("  7) mudar o idioma da interface recarrega o catalogo");
{
  const PAGINAS = [
    "web/src/pages/Home.jsx",
    "web/src/pages/Search.jsx",
    "web/src/pages/Category.jsx",
    "web/src/pages/Details.jsx",
  ];
  for (const f of PAGINAS) {
    const src = fs.readFileSync(path.join(RAIZ, f), "utf8");
    // Cada dependencia que contenha `titleLang` tem de ter `t.idioma` ao lado.
    const linhas = src.split(/\r?\n/);
    const sem = linhas.filter(
      (l) => l.includes("settings.titleLang") && l.includes("}, [") && !l.includes("t.idioma")
    );
    ok_(f.split("/").pop() + ": todo o efeito com titleLang tem t.idioma", sem.length === 0,
      sem.join(" | "));
  }
  // E o ajuste tem de estar nas Definições, como primeira opcao.
  const def = fs.readFileSync(path.join(RAIZ, "web/src/pages/Settings.jsx"), "utf8");
  const iSec = def.indexOf('{t("Títulos")}');
  ok_('as Definições têm a opção "Igual à interface"', /value="auto"/.test(def.slice(iSec, iSec + 600)));
  ok_('e ela é a primeira', /value="auto"[\s\S]{0,400}value="pt"/.test(def.slice(iSec, iSec + 800)));
}

/* ---------- 8) Higiene ---------- */
console.log("");
console.log("  8) higiene");
{
  const alvos = [
    "server/src/services/tmdb.js",
    "server/src/services/net.js",
    "server/src/routes/progress.js",
    "server/src/routes/library.js",
    "server/src/routes/social.js",
    "web/src/api/client.js",
    "web/src/pages/Settings.jsx",
  ].map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n");
  ok_("sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(alvos));
  ok_("sem caractere de substituicao", !/[\uFFFD]/.test(alvos));
  ok_("o pMap vive uma unica vez", (fs.readFileSync(path.join(RAIZ, "server/src/services/net.js"), "utf8").match(/export async function pMap/g) || []).length === 1);
}

fs.rmSync(DB_TEMP, { recursive: true, force: true });

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);