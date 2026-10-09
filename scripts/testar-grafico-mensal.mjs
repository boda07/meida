// Testa a serie temporal das estatisticas do perfil (o grafico de meses).
//
// Porquê um teste a serio e nao "corrigi e vi que ficou bem": sao duas coisas que
// so' se veem com dados falsos — os meses vazios e a escala. Um mes sem actividade
// e' o caso normal (ninguem mexe em 12 titulos em cada um dos 12 meses), e e'
// exactamente o la onde um grafico pode mentir: ou a coluna desaparece e o eixo
// mente, ou a barra cresce contra o total em vez de crescer contra o maior.
//
// A serie e' logica pura (`serieMensal`), por isso testa-se sem DOM. O desenho do
// SVG verifica-se renderizando o componente, como no `testar-comentarios-render`.
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const RAIZ = resolve(process.argv[2] || ".");
const req = createRequire(join(RAIZ, "web", "package.json"));

let n = 0, mau = 0;
function ok(rotulo, cond, extra = "") {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo + (extra ? "  ->  " + extra : "")); }
}

/* ---------- 1) A serie: logica pura, sem DOM ---------- */

const stats = await import(
  "file://" + join(RAIZ, "web/src/components/profileStats.js").replace(/\\/g, "/")
);

/** Um item com `updatedAt` no mes indicado ("AAAA-MM", sem dia). */
const emMes = (chave, extra = {}) => ({
  type: "movie", externalId: 1, title: "x", watched: true,
  score: 80, genres: [], updatedAt: `${chave}-15T10:00:00Z`, ...extra,
});

const agora = new Date();
const chaveDoMes = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const mesActual = chaveDoMes(agora);
const mesAnterior = chaveDoMes(new Date(agora.getFullYear(), agora.getMonth() - 1, 1));
const doisMesesAtras = chaveDoMes(new Date(agora.getFullYear(), agora.getMonth() - 2, 1));

// 1) A forma: 12 meses, do mais antigo ao mes corrente, sem buracos.
const serie = stats.serieMensal([], 12);
ok("devolve 12 meses", serie.length === 12, "veio " + serie.length);
ok("o ultimo mes e' o mes corrente", serie[11].chave === mesActual,
   `veio ${serie[11].chave}, esperado ${mesActual}`);
ok("o primeiro e' onze meses atras", serie[0].chave === chaveDoMes(new Date(agora.getFullYear(), agora.getMonth() - 11, 1)));
ok("as chaves estao por ordem", serie.every((p, i) => i === 0 || p.chave > serie[i - 1].chave));
ok("cada mes tem rotulo em portugues", serie.every((p) => typeof p.rotulo === "string" && p.rotulo.length >= 2));

// 2) Contagem.
const comDados = stats.serieMensal([
  emMes(mesActual), emMes(mesActual), emMes(mesActual),
  emMes(mesAnterior),
  emMes(doisMesesAtras), emMes(doisMesesAtras),
]);
ok("conta os titulos de cada mes", comDados[11].n === 3 && comDados[10].n === 1 && comDados[9].n === 2,
   `actual=${comDados[11].n} anterior=${comDados[10].n} ha2=${comDados[9].n}`);

// 3) O CASO IMPORTANTE: meses vazios ficam a zero, nao desaparecem.
const esparsos = stats.serieMensal([emMes(mesActual), emMes(mesAnterior)]);
ok("um mes sem actividade fica a 0 e continua no serie", esparsos.length === 12 && esparsos[11].n === 1 && esparsos[10].n === 1);
ok("os meses sem nada tem mesmo 0", esparsos[5].n === 0, "mes no meio: " + esparsos[5].n);

// 4) Datas inuteis nao contam nem rebentam.
const sujos = stats.serieMensal([
  emMes(mesActual),
  { ...emMes(mesActual), updatedAt: null },
  { ...emMes(mesActual), updatedAt: "sem data" },
  { ...emMes(mesActual), updatedAt: "" },
  { ...emMes(mesActual), updatedAt: "1999-01-01T00:00:00Z" }, // fora da janela
  undefined,
  null,
]);
ok("datas invalidas ou fora da janela nao contam", sujos[11].n === 1, "contou " + sujos[11].n);
ok("e nao rebenta com item undefined", Array.isArray(sujos) && sujos.length === 12);

// 5) Array vazio, null e undefined nao rebentam.
ok("array vazio da 12 meses a zero", stats.serieMensal([]).every((p) => p.n === 0));
ok("null da 12 meses a zero", stats.serieMensal(null).every((p) => p.n === 0));
ok("undefined da 12 meses a zero", stats.serieMensal(undefined).every((p) => p.n === 0));

// 6) O campo `updated_at` (camelCase e' o que a API manda, mas `serieMensal`
// aceita os dois — um dos dois deixar de chegar nao pode partir o grafico).
const comUnderscore = stats.serieMensal([{ ...emMes(mesActual), updatedAt: undefined, updated_at: `${mesActual}-02T00:00:00Z` }]);
ok("aceita tambem updated_at (o nome do outro lado da API)", comUnderscore[11].n === 1);

// 7) Rotulo do eixo: o ano so' aparece quando muda.
const umAno = stats.serieMensal([], 12);
const comAno = stats.rotuloEixo(umAno[0], true);
const semAno = stats.rotuloEixo(umAno[0], false);
ok("sem mudanca de ano o rotulo e' so' o mes", semAno === umAno[0].rotulo, semAno);
ok("com mudanca de ano o rotulo leva o ano", /^[A-Za-zç]+ \d{2}$/.test(comAno), comAno);

/* ---------- 2) O desenho: renderizar e ler o SVG ---------- */

const dir = mkdtempSync(join(tmpdir(), "meida-gm-"));
const entrada = join(dir, "e.mjs");
const saida = join(dir, "s.cjs");

writeFileSync(
  entrada,
  `import GraficoMensal, { escalaBonita } from ${JSON.stringify(join(RAIZ, "web/src/components/GraficoMensal.jsx"))};
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h, Fragment } from "react";
export function render(props) { return renderToStaticMarkup(h(GraficoMensal, props)); }
// DOIS graficos na MESMA arvore. E' o caso real (o \`useId\` so' differentiate
// dentro de uma raiz); renderizar duas vezes em separado daria o mesmo id as
// duas, por isso o teste errado mediria o \`useId\`, nao o componente.
export function renderDois(props) {
  return renderToStaticMarkup(h(Fragment, null, h(GraficoMensal, props), h(GraficoMensal, props)));
}
// A escala e' logica pura mas vive no .jsx, que o Node nao importa. Vem pelo
// bundle — por isso exporta-se aqui em vez de se fazer \`import\` do ficheiro.
export { escalaBonita };
`
);

const { build } = req("esbuild");
await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: saida,
  format: "cjs", // react-dom/server e' CJS e faz require("stream")
  platform: "node",
  jsx: "automatic",
  logLevel: "error",
  absWorkingDir: join(RAIZ, "web"),
  nodePaths: [join(RAIZ, "web", "node_modules")],
});

const { render, renderDois } = req(saida);

// Um serie com a forma que o grafico espera.
const dados = stats.serieMensal([
  emMes(mesActual), emMes(mesActual), emMes(mesActual), emMes(mesActual),
  emMes(mesAnterior), emMes(mesAnterior),
  emMes(doisMesesAtras),
]);

const html = render({ serie: dados });
ok("o componente renderiza", typeof html === "string" && html.length > 100);
ok("desenha as 12 colunas", (html.match(/class="gm-barra/g) || []).length === 12,
   "desenhou " + (html.match(/class="gm-barra/g) || []).length);
ok("as colunas com 0 NAO sao omitidas (o eixo nao pode mentir)", (html.match(/gm-barra vazia/g) || []).length === 9,
   "vazias: " + (html.match(/gm-barra vazia/g) || []).length);
ok("desenha as guias do eixo", (html.match(/gm-guia/g) || []).length === 3);
ok("desenha os rotulos dos meses", (html.match(/class="gm-rot/g) || []).length >= 6);
ok("a legenda diz o que o grafico mede", html.includes("últimos") && html.includes("meses"),
   "a legenda tem de dizer que conta actividade");
ok("a legenda explica o que e' actividade", html.includes("nota") || html.includes("mexeste"));

// Acessibilidade: o SVG tem de se descrever a si proprio para quem nao o ve.
ok("o SVG tem role=img", html.includes('role="img"'));
ok("o SVG tem aria-label com os numeros", /aria-label="Titulos com actividade por mes/.test(html));
ok("o aria-label diz quantos por mes", html.includes(": 4") && html.includes(": 2") && html.includes(": 1"));

// A escala. A propriedade que importa NAO e' "o topo e' um numero redondo" — e'
// que a barra mais alta ocupa uma parte decente da altura. Com maximo=4 o topo
// antigo dava 5 e a barra ficava a 80%; o defeito real apareceu com maximo=527
// (o perfil verdadeiro), onde o passo escolhido pela mantissa dava 1000 e a
// barra ficava a 53%: metade do grafico vazia.
const barras = [...html.matchAll(/<rect[^>]*class="gm-barra[^"]*"[^>]*>/g)].map((m) => m[0]);
const alturas = barras.map((r) => Number(/height="([\d.]+)"/.exec(r)?.[1]));
const P = 190 - 14 - 26; // a altura util, como no componente
ok("as alturas sao numeros (a escala nunca devolve NaN)", alturas.length === 12 && alturas.every((h2) => h2 > 0),
   "alturas: " + alturas.join(","));
ok("nenhum rect tem atributo vazio ou NaN", !/height="NaN"|y="NaN"|y=""/.test(html));
ok("a barra mais alta usa pelo menos 80% da altura (o grafico nao fica meio vazio)",
   Math.max(...alturas) / P >= 0.8, "altura maxima: " + Math.max(...alturas) + " de " + P);
ok("e nunca ultrapassa a area do grafico", Math.max(...alturas) <= P);
ok("a coluna mais alta e' a do mes com 4", alturas[11] === Math.max(...alturas));
ok("os meses vazios ficam com a altura minima, nao a zero", alturas[0] === 3 && alturas[11] > 100,
   "vazio=" + alturas[0] + " cheio=" + alturas[11]);

// A escala de topo apertado, verificada nos numeros que Rebentaram no perfil real.
//
// Testa-se o TOPO e nao o passo: para 527, o passo 100 e o passo 200 dao ambos
// topo 600, e so' um deles pode ser "o esperado". O que interessa e' que o grafico
// se aproveite — e que o passo seja um numero redondo.
const { escalaBonita } = req(saida);
const casos = [
  // [maximo, topo esperado, rotulo]
  [4, 4],
  [527, 600], // o caso real: nao pode dar 1000 (o grafico ficava a 53%)
  [1000, 1000],
  [1, 1],
  [7, 8],
  [3, 3],
  [23, 25],
  [4999, 5000],
  [2, 2],
];
for (const [max, topoEsperado] of casos) {
  const passo = escalaBonita(max);
  const topo = Math.ceil(max / passo) * passo;
  const degraus = topo / passo;
  ok("escala(" + max + "): topo " + topo + " (degraus " + degraus + ")",
     topo === topoEsperado, `esperava topo ${topoEsperado}, veio ${topo} (passo ${passo})`);
  ok("  e a barra mais alta aproveita pelo menos 80%",
     max / topo >= 0.8, `so a ${Math.round((max / topo) * 100)}% (topo ${topo}, max ${max})`);
}
ok("nunca devolve passo 0, negativo, NaN ou Infinity para valores absurdos",
   [0, -5, NaN, Infinity, -Infinity, 0.5, 1e-9].every((v) => {
     const p = escalaBonita(v);
     return p > 0 && Number.isFinite(p);
   }),
   [0, -5, NaN, Infinity, -Infinity, 0.5, 1e-9].map((v) => `${v}->${escalaBonita(v)}`).join(" "));

// Serie curta demais: nao ha grafico, e' melhor nada do que um eixo com 2 barras.
const curta = render({ serie: stats.serieMensal([]).slice(0, 2) });
ok("uma serie de 2 meses nao desenha nada", curta === "" || curta.length === 0, "veio " + curta.length + " chars");
const vazia = render({ serie: null });
ok("sem serie nao rebenta", vazia === "" || vazia.length === 0);

// A fonte do SVG: o `useId` tem de ser unico entre dois graficos na MESMA
// arvore, senao um recorta o outro (o clipPath partilhado).
const dois = renderDois({ serie: dados });
const ids = [...dois.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
ok("dois graficos na mesma arvore tem clipPath diferentes", ids.length === 2 && ids[0] !== ids[1],
   "ids: " + ids.join(", "));
ok("cada grafico usa o seu proprio clipPath", (dois.match(/url\(#/g) || []).length === 2,
   "usos: " + (dois.match(/url\(#/g) || []).length);

console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);