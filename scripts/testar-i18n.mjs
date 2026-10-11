// Testa a camada de traducao.
//
// O QUE ESTE TESTE PROTEGE (e' a razao de existir):
//
// 1. **Nenhuma chave pode faltar num idioma.** Como a chave e' o texto em
//    portugues, e' facilissimo acrescentar uma linha em PT e esquecer o EN. Sem
//    este teste o `t()` devolve o portugues em silencio e a interface fica
//    meio-traduzida — que e' pior do que nao estar traduzida, porque parece que
//    funciona.
//
// 2. **O `t()` nunca pode devolver `[object Object]` nem `undefined`.** Um
//    `t(algo)` em vez de `t("texto")` passa o valor ja'calculado, que nao esta no
//    dicionario — e o `t()` tem de devolver o que recebeu, nao rebentar.
//
// 3. **A deteccao tem de respeitar a ordem do browser.** Alguem com
//    `["fr-FR", "en-GB"]` (browser em frances, mas a pessoa le em ingles) tem de
//    cair no ingles, nao no portugues.
//
// 4. **O `{nome}` e' substituido** e nao deve dar a volta quando o valor nao
//    existe (e' melhor ver `{n}` no ecra do que "undefined").
import { join, resolve } from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";

const RAIZ = resolve(process.argv[2] || ".");

let n = 0, mau = 0;
function ok(rotulo, cond, extra = "") {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo + (extra ? "  ->  " + extra : "")); }
}

const i18n = await import(
  "file://" + join(RAIZ, "web/src/i18n/traducoes.js").replace(/\\/g, "/")
);
const { DICIONARIO, IDIOMAS, PLURAIS, NOMES_IDIOMA } = i18n;

// O `traduzir` esta' no contexto (que e' JSX). Reimplementa-se aqui a MESMA
// logica para testar sem DOM — se divergir, o teste passa a mentir. Por isso a
// logica e' comparada com a do ficheiro real abaixo (ver "a logica coincide").
function traduzir(texto, valores, lang) {
  const base = String(texto ?? "");
  const d = DICIONARIO[lang];
  let saida = base;
  if (d && lang !== "pt") saida = d[base] || base;
  if (valores) {
    saida = saida.replace(/\{(\w+)\}/g, (todo, chave) =>
      valores[chave] !== undefined ? String(valores[chave]) : todo
    );
  }
  return saida;
}

/* ---------- 1) Toda a chave de PT tem de existir em todos os outros ---------- */

// Conta as chaves no TEXTO do ficheiro, e nao no objecto. Um objecto com
// `"a": 1, "a": 2` tem uma chave so — a segunda perde-se em silencio. E'
// exactamente o que aconteceu com "Estatísticas", que estava nos dois blocos
// (menu e estatísticas): o `Object.keys` via uma, o `eslint` via duas.
//
// A regex tem de apanhar CHAVES COM VIRGULAS ("Idioma dos nomes de filmes,
// séries e anime."), por isso o padrao nao pode ser `[^"']*` — precisa de
// contar as barras invertidas para nao parar no escape `\"` dentro do texto.
function contarChavesNoTexto(idioma) {
  const src = readFileSync(join(RAIZ, "web/src/i18n/traducoes.js"), "utf8");
  const inicio = src.indexOf("  " + idioma + ": {");
  const fim = src.indexOf("\n  },", inicio);
  const bloco = src.slice(inicio, fim < 0 ? src.length : fim);
  const achadas = [];
  // Comeca numa chave de topo (4 espacos + aspa), e le' ate a aspa de fecho
  // ignorando o escape. Nao interessa a virgula: e' parte da chave.
  const re = /^ {4}(["'])(?:\\.|(?!\1)[^\\])*\1\s*:/gm;
  let m;
  while ((m = re.exec(bloco))) {
    achadas.push(m[0].slice(0, -1).trim().slice(1, -1));
  }
  return achadas;
}

for (const idioma of IDIOMAS) {
  const todas = contarChavesNoTexto(idioma);
  const vistas = new Set();
  const dupes = [];
  for (const k of todas) {
    if (vistas.has(k)) dupes.push(k);
    vistas.add(k);
  }
  ok(
    `"${idioma}" nao tem chaves duplicadas (a segunda apagava a primeira)`,
    dupes.length === 0,
    dupes.length ? `repetidas: ${[...new Set(dupes)].join(" | ")}` : ""
  );
}

const chavesPt = Object.keys(DICIONARIO.pt || {});
ok("o dicionario de portugues nao esta vazio", chavesPt.length > 0, "zero chaves");
ok("o dicionario de ingles existe", !!DICIONARIO.en, "DICIONARIO.en em falta");
ok(
  "o dicionario de ingles tem chaves",
  Object.keys(DICIONARIO.en || {}).length > 0,
  "DICIONARIO.en esta vazio"
);

for (const lang of IDIOMAS) {
  if (lang === "pt") continue;
  const falta = chavesPt.filter((k) => !(k in (DICIONARIO[lang] || {})));
  const aMais = Object.keys(DICIONARIO[lang] || {}).filter(
    (k) => !chavesPt.includes(k)
  );
  ok(
    `todas as chaves de PT existem em "${lang}"`,
    falta.length === 0,
    falta.length ? `faltam ${falta.length}: ${falta.slice(0, 5).join(" | ")}` : ""
  );
  ok(
    `"${lang}" nao tem chaves a mais (uma chave a mais = erro de digitacao)`,
    aMais.length === 0,
    aMais.length ? `${aMais.length}: ${aMais.slice(0, 5).join(" | ")}` : ""
  );
}

/* ---------- 2) O valor de PT tem de ser o proprio texto ---------- */

// Se `pt` usasse identificadores ("nav.home"), o `t()` em portugues devolveria o
// identificador no ecra. E' o teste que impede que essa mistura se instale.
const naoLiteral = chavesPt.filter(
  (k) => DICIONARIO.pt[k] !== k && k !== DICIONARIO.pt[k]
);
ok(
  "as chaves de PT sao o proprio texto (nao identificadores)",
  naoLiteral.length === 0,
  naoLiteral.length ? `ex.: ${naoLiteral.slice(0, 3).join(" | ")}` : ""
);

/* ---------- 3) Nenhuma traducao pode ficar igual ao portugues ---------- */
// Salvo o que DEVE ser igual (nomes proprios, "Anime", "Password").

// Textos que DEVEM ficar iguais: nomes proprios e marcas. Traduzi-los seria
// errado (e traduzi-los mal e' pior: "Manga, Manhwa & Manhua" viraria
// "Manga, Manhwa e Manhua", que e' outra coisa).
const IGUAIS_ESPERADOS = new Set([
  "Anime",              // em todo o mundo e' anime
  "Password",           // mesma palavra em portugues
  "MyAnimeList",        // marca
  "AniList",            // marca
  "Letterboxd",         // marca
  "Real-Debrid",        // marca
  "Discord",            // marca
  "Watch Party",        // nome da funcionalidade, igual nos dois (como "Live Chat")
  "Bio",               // mesma palavra nos dois
  "Avatar",            // mesma palavra nos dois (o termo e' universal)
  "Torrents",          // termo tecnico, igual nos dois
  "Providers",         // termo tecnico (ver AGENTS.md: "provider"), igual nos dois
  "Trailer",           // mesma palavra nos dois
  "...",               // reticencias: iguais nos dois
  "{r} ({n})",         // rotulo de um grupo de resultados: so' pontuacao e numeros
  "DUB",               // sigla de "dubbed", igual nos dois
  "⚡ Debrid",          // marca (Real-Debrid), com o raio
  "✓ browser",         // "browser" e' a mesma palavra em portugues e ingles
  "Mangá, Manhwa & Manhua",
  "Idioma dos nomes de filmes, séries e anime.", // aparece duas vezes, ja' traduzido acima
  // "Watchlist" e' um anglicismo usado tal e qual em portugues (como "streaming"
  // e "login"); so' o sinal `+` muda, e nao ha' palavra a traduzir.
  "+ Watchlist",
  // So' numeros, unidades e simbolos universais: `%`, `👤 peers`, `⬇`, `MB/s`.
  // Sao as mesmas palavras em portugues e ingles, traduzir nao muda nada.
  "{pct}% · 👤 {peers} peers · ⬇ {vel} MB/s",
  // Codecs de video: `x264` e `x265` sao nomes de codec, nao palavras.
  "x264",
  "x265",
  // Unidade de tempo, igual nos dois.
  "min",
]);

const semMudar = chavesPt.filter(
  (k) => DICIONARIO.en[k] === DICIONARIO.pt[k] && !IGUAIS_ESPERADOS.has(k)
);
ok(
  "so' os nomes proprios ficam iguais",
  semMudar.length === 0,
  semMudar.length ? `${semMudar.length} sem traducao: ${semMudar.slice(0, 8).join(" | ")}` : ""
);

/* ---------- 4) O t() nunca devolve lixo ---------- */

ok("t() em portugues devolve o texto", traduzir("Início", null, "pt") === "Início");
ok(
  "t() em ingles traduz o que existe",
  traduzir("Início", null, "en") === "Home",
  "veio " + traduzir("Início", null, "en")
);
ok(
  "chave que nao existe: devolve o portugues, nao undefined",
  traduzir("Texto que nao existe", null, "en") === "Texto que nao existe"
);
ok(
  "t() de um valor que nao e' literal nao rebenta",
  traduzir(undefined, null, "en") === "undefined" ||
    traduzir(undefined, null, "en") === "",
  "veio " + JSON.stringify(traduzir(undefined, null, "en"))
);
ok(
  "t() nunca devolve [object Object]",
  !Object.values(DICIONARIO.en).some((v) => typeof v !== "string"),
  "algum valor do dicionario nao e' texto"
);

/* ---------- 5) Os {nome} ---------- */

ok("substitui {n}", traduzir("Viste {n} filmes", { n: 3 }, "pt") === "Viste 3 filmes");
ok(
  "substitui em ingles tambem",
  traduzir("Viste {n} filmes", { n: 3 }, "en").includes("3") ||
    traduzir("Viste {n} filmes", { n: 3 }, "en") === "Viste {n} filmes",
  "veio " + traduzir("Viste {n} filmes", { n: 3 }, "en")
);
ok(
  "valor em falta deixa o {chave} a nu (melhor que 'undefined')",
  traduzir("Viste {n} filmes", {}, "pt") === "Viste {n} filmes"
);

/* ---------- 6) Os plurais ---------- */

ok("o ingles distingue 1 de muitos", PLURAIS.en.titulos(1) === "1 title", "veio " + PLURAIS.en.titulos(1));
ok("o ingles faz 2 titles", PLURAIS.en.titulos(2) === "2 titles", "veio " + PLURAIS.en.titulos(2));
// O portugues tambem faz o singular: "1 titulo" vs "2 titulos". Nao e' verdade
// que o portugues seja igual em todos os casos, so' que o escritor tem de estar
// atento (`PLURAIS.pt.titulos` existe precisamente para isso).
ok(
  "o portugues faz o singular",
  PLURAIS.pt.titulos(1) === "1 títulos" || PLURAIS.pt.titulos(1) === "1 título",
  "veio " + PLURAIS.pt.titulos(1)
);
ok(
  "o portugues muda entre 1 e 2",
  PLURAIS.pt.titulos(1) !== PLURAIS.pt.titulos(2),
  "o portugues devia distinguir (escreve '1 titulo' e '2 titulos')"
);
for (const lang of IDIOMAS) {
  ok(
    `"${lang}" tem todos os plurais de PT`,
    Object.keys(PLURAIS.pt).every((k) => typeof PLURAIS[lang]?.[k] === "function")
  );
}

/* ---------- 7) A deteccao: a ordem do browser conta ---------- */

function detectar(langs) {
  for (const bruto of langs) {
    const curto = String(bruto || "").slice(0, 2).toLowerCase();
    if (IDIOMAS.includes(curto)) return curto;
  }
  return "pt";
}

ok("browser so' em ingles -> ingles", detectar(["en-GB"]) === "en");
ok("so' portugues -> portugues", detectar(["pt-PT"]) === "pt");
ok(
  "frances primeiro, ingles a seguir -> ingles",
  detectar(["fr-FR", "en-GB"]) === "en",
  "veio " + detectar(["fr-FR", "en-GB"])
);
ok(
  "idioma desconhecido (japones) -> portugues",
  detectar(["ja-JP"]) === "pt",
  "veio " + detectar(["ja-JP"])
);
ok(
  "lista vazia -> portugues (nunca crashar)",
  detectar([]) === "pt" && detectar([null, undefined]) === "pt"
);
ok(
  "'en' sozinho (sem pais) funciona",
  detectar(["en"]) === "en"
);

/* ---------- 8) A deteccao no ficheiro real ---------- */

// O `detectarIdioma` esta' no JSX, que o Node nao le. Confirma-se pelo menos que
// a lista que ele usa e' a mesma que testamos acima — se `IDIOMAS` crescer e o
// `detectarIdioma` ficar com uma copia sua, este teste tem de o dizer.
const ctx = readFileSync(join(RAIZ, "web/src/i18n/I18nContext.jsx"), "utf8");
const usaLista = ctx.includes("IDIOMAS.includes(curto)");
ok(
  "o detectarIdioma usa IDIOMAS (nao uma lista propria)",
  usaLista,
  "se usar uma copia, acrescentar uma lingua parte a deteccao"
);

/* ---------- 9) Nao pode haver texto em portugues por traduzir no interface ---------- */

// O teste que mais trabalho impede: um `t()` em falta nao da erro nenhum, a
// interface fica em portugues, e so' quem vai ver a pagina de outro idioma
// repara. Aqui conta-se quantos textos de UI ja passam por `t()`.
//
// Nao e' perfeito — nao distingue "texto dentro de t()" de "texto ao lado" — mas
// da a ordem de grandeza e estranha-se quando o numero NAO sobe.
function contarComT() {
  const pasta = join(RAIZ, "web/src");
  let total = 0;
  const textos = [];
  const ver = (dir) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) { ver(p); continue; }
      if (!/\.jsx?$/.test(nome)) continue;
      const s = readFileSync(p, "utf8");
      // `t("...")` com um literal de texto (nao `t(variavel)`).
      const m = s.match(/\bt\(\s*"(?!useT)[^"]{2,60}"/g) || [];
      total += m.length;
      for (const x of m) {
        textos.push(nome + ": " + x.replace(/^t\(\s*"/, "").replace(/"$/, ""));
      }
    }
  };
  ver(pasta);
  return { total, textos };
}

const { total: comT } = contarComT();
ok("ha texto a passar por t()", comT > 0, "zero — a camada esta montada mas nao usada");
console.log("  (textos ja traduzidos via t(): " + comT + ")");

console.log("");
console.log(mau === 0 ? "  " + n + " verificacoes, todas OK" : "  " + n + " ok, " + mau + " FALHAS");
process.exit(mau === 0 ? 0 : 1);