// O cartao de partilha: a geometria, o encaixe do texto e as datas.
//
// PURE: `web/src/components/cartao.js` e o `melhoresDoAno` do servidor nao tocam
// em canvas nem em base de dados, por isso correm em Node.
//
// O que este ficheiro protege, por ordem de gravidade:
//
//   1. **A fonte.** O canvas cai para a fonte do sistema EM SILENCIO se o peso
//      nao estiver carregado. Medido: `Archivo 700` e `Archivo 900` estavam
//      `unloaded` enquanto `Archivo 800` estava `loaded`. Se o desenho usar um
//      peso que nao e' pedido, o cartao sai errado e ninguem ve.
//
//   2. **O "tainted".** Um `drawImage` de um host sem CORS suja o canvas e o
//      `toBlob` lanca `SecurityError`. O `crossOrigin` tem de estar no `img`
//      ANTES do `src`; posto depois, o browser ignora.
//
//   3. **O retina.** Um canvas de 1080 px num ecra de dpr 1.25 sai com 1080
//      pixis e 81% do tamanho a que se pretende.

import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CARTAO_L,
  CARTAO_A,
  escalaRetina,
  tamanhoQueCabe,
  nomeDoFicheiro,
  mesesDoAno,
  mesMaisOcupado,
  alturasDosMeses,
  FAMILIAS,
  fonteDe,
} from "../web/src/components/cartao.js";
import { melhoresDoAno, anoDe } from "../server/src/metas.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) o canvas e' criado no tamanho certo (retina)");
{
  ok_("o cartao e' 1080x1350 em px de CSS", CARTAO_L === 1080 && CARTAO_A === 1350);
  const d1 = escalaRetina(CARTAO_L, 1);
  ok_("num ecra normal o canvas tem o tamanho do cartao", d1.largura === 1080 && d1.escala === 1);
  const d2 = escalaRetina(CARTAO_L, 2);
  ok_("num ecra retina o canvas dobra", d2.largura === 2160 && d2.altura === 2700 && d2.escala === 2);
  // **O que se mediu:** este ecra tem dpr 1.25. Um canvas de 1080 daria 1080
  // pixis e sairia a 81% do tamanho pretendido.
  const d125 = escalaRetina(CARTAO_L, 1.25);
  ok_("com dpr 1.25 o canvas fica a 1350 (e nao a 1080)", d125.largura === 1350, "=" + d125.largura);
  ok_("e a escala devolve o dpr para o `ctx.scale`", d125.escala === 1.25);
  // O tecto de 3: num ecra de dpr 4 um canvas de 1080 dava 4320 = 23 megapixeis.
  const d4 = escalaRetina(CARTAO_L, 4);
  ok_("um dpr absurdo trava em 3 (memoria)", d4.escala === 3 && d4.largura === 3240, "=" + d4.largura);
  ok_("um dpr de 0 ou negativo nao da um canvas de 0", escalaRetina(CARTAO_L, 0).escala === 1 && escalaRetina(CARTAO_L, -2).escala === 1);
  ok_("um dpr que nao e' numero assume 1", escalaRetina(CARTAO_L, "x").escala === 1);
}

console.log("");
console.log("  2) o texto cabe — e isto mede-se, nao se estima");
{
  ok_("um ano de 4 digitos fica com o tamanho de base", tamanhoQueCabe("2026", 900, 190) === 190);
  // 2125: o proximo ano que nao e' palindromo desde 2112. Com 5 digitos e' o
  // caso em que o numero passava do meio do cartao.
  // "2125" tem QUATRO digitos e ocupa ~441 px a 190 px. O cartao tem 900
  // disponiveis: cabe com folga. Encolhe-se quando a caixa e' mais estreita.
  ok_("quatro digitos que cabem ficam no tamanho de base", tamanhoQueCabe("2125", 900, 190, 90) === 190);
  // 4 x 190 x 0.58 = ~441 px. Em 450 cabe; em 400 nao.
  ok_("os mesmos quatro digitos cabem em 450", tamanhoQueCabe("2125", 450, 190, 90) === 190);
  const t5 = tamanhoQueCabe("2125", 400, 190, 90);
  ok_("em 400 ja nao cabem e encolhem", t5 === 172, "=" + t5);
  ok_("mas nunca abaixo do minimo", tamanhoQueCabe("2125", 50, 190, 90) === 90);
  // 15 caracteres ainda nao chegam ao chao (103 px); 30 ja chegam.
  ok_("um numero enorme ainda encolhe mas nao vai ao chao", tamanhoQueCabe("123456789012345", 900, 190, 90) === 103, "=" + tamanhoQueCabe("123456789012345", 900, 190, 90));
  ok_("um numero muito longo vai ao minimo", tamanhoQueCabe("1".repeat(30), 900, 190, 90) === 90);
  ok_("texto vazio nao encolhe nada", tamanhoQueCabe("", 900, 190) === 190);
  ok_("null e' como texto vazio", tamanhoQueCabe(null, 900, 190) === 190);
  ok_("uma largura zero nao divide por zero", Number.isFinite(tamanhoQueCabe("2026", 0, 190, 20)));
  // O minimo e' um CHAO, nao um alvo: um texto que cabe fica com o tamanho de
  // base, mesmo que essa base seja menor que o minimo.
  ok_("o minimo e' um chao, nao um alvo (cabe -> fica na base)", tamanhoQueCabe("2125", 900, 40, 90) === 40);
}

console.log("");
console.log("  3) o nome do ficheiro e' sempre valido");
{
  ok_("e' meida-<ano>.png", nomeDoFicheiro(2026) === "meida-2026.png");
  // O nome de utilizador nao entra: pode ter barras, acentos e emojis, e o
  // Windows recusa. Descobrir isso a tentar guardar e' pior do que o ficheiro se
  // chamar so pelo ano.
  ok_("sem o nome de utilizador (que pode ter barras e acentos)", !/utilizador|username|@/.test(nomeDoFicheiro(2026)));
  ok_("sem ano nenhum usa o ano corrente", /^meida-\d{4}\.png$/.test(nomeDoFicheiro()));
  ok_("termina em .png (o que o toBlob devolve)", nomeDoFicheiro(2026).endsWith(".png"));
}

console.log("");
console.log("  4) os 12 meses, e o ano certo");
{
  const dias = [
    { dia: "2026-03-04", n: 3 },
    { dia: "2026-03-09", n: 2 },
    { dia: "2026-07-01", n: 5 },
    { dia: "2025-12-31", n: 9 }, // de outro ano: nao entra
    { dia: "2027-01-01", n: 9 }, // tambem nao
  ];
  const m = mesesDoAno(dias, 2026);
  ok_("sempre 12 meses", m.length === 12);
  ok_("Março tem 5 (3+2 somados)", m[2].n === 5, "=" + m[2].n);
  ok_("Julho tem 5", m[6].n === 5);
  ok_("Dezembro de 2025 NAO entra em 2026", m[11].n === 0);
  ok_("os rotulos sao os 12 meses em portugues", m.map((x) => x.rotulo).join(" ") === "Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez");
  ok_("sem dias, 12 meses a zero", mesesDoAno([], 2026).every((x) => x.n === 0));
  ok_("sem lista nenhuma tambem", mesesDoAno(null, 2026).length === 12);
  ok_("uma data malformada e' saltada, nao rebenta", mesesDoAno([{ dia: "x", n: 1 }, { dia: null, n: 2 }], 2026).every((x) => x.n === 0));
  ok_("um mes 13 nao escreve fora do array", mesesDoAno([{ dia: "2026-13-01", n: 5 }], 2026).every((x) => x.n === 0));

  ok_("o mes mais ocupado e' o indice", mesMaisOcupado(m) === 2 || mesMaisOcupado(m) === 6, "=" + mesMaisOcupado(m));
  ok_("sem nada nenhum e' -1", mesMaisOcupado(mesesDoAno([], 2026)) === -1);
  ok_("com tudo a zero e' -1 (para nao apontar para meses)", mesMaisOcupado(mesesDoAno([], 2026)) === -1);
}

console.log("");
console.log("  5) a faixa de meses: um mes vazio continua visivel");
{
  const m = mesesDoAno([{ dia: "2026-01-01", n: 1 }, { dia: "2026-05-01", n: 8 }], 2026);
  const h = alturasDosMeses(m);
  ok_("12 alturas", h.length === 12);
  ok_("o mes mais cheio chega a 1", h[4] === 1);
  // Acima do piso, a barra segue a razao. 6 de 8 e' 0.75.
  ok_("acima do piso, a barra segue a razao", Math.abs(h[0] - 1 / 8) < 1e-9 ? true : Math.abs(alturasDosMeses(mesesDoAno([{ dia: "2026-01-01", n: 6 }, { dia: "2026-05-01", n: 8 }], 2026))[0] - 0.75) < 1e-9, "1 de 8 = " + h[0]);
  // E ABAIXO do piso o valor e' o piso, nao a razao: 1 de 8 daria 0.125, e uma
  // barra a um oitavo do topo parece "quase nada" quando o mes teve atividade.
  ok_("abaixo do piso, a barra fica no piso e nao na razao", h[0] === 0.25, "1 de 8 deu " + h[0]);
  // **O minimo e' 0.25 e nao 0**, como no `GraficoMensal`: um zero e'
  // informacao ("nao mexeste em Marco"), nao ausencia.
  ok_("um mes sem nada NAO desaparece (0.25)", h[2] === 0.25, "=" + h[2]);
  ok_("nunca ha uma barra a zero", h.every((x) => x > 0));
  ok_("nenhuma passa de 1", Math.max(...h) <= 1);
  const sozinhos = alturasDosMeses(mesesDoAno([{ dia: "2026-01-01", n: 3 }], 2026));
  ok_("com um mes so, esse e' o topo e os outros ficam no minimo", sozinhos[0] === 1 && sozinhos[5] === 0.25);
}

console.log("");
console.log("  6) os cartazes do ano, ordenados e sem o que nao se viu");
{
  const linhas = [
    { type: "movie", title: "O melhor", poster: "https://image.tmdb.org/a.jpg", score: 98, watched: 1, updatedAt: "2026-05-01T10:00:00.000Z" },
    { type: "movie", title: "O segundo", poster: null, score: 90, watched: 1, updatedAt: "2026-06-01T10:00:00.000Z" },
    { type: "movie", title: "Terceiro", poster: "https://image.tmdb.org/c.jpg", score: 70, watched: 1, updatedAt: "2026-07-01T10:00:00.000Z" },
    { type: "movie", title: "Quarto", poster: "d.jpg", score: 60, watched: 1, updatedAt: "2026-08-01T10:00:00.000Z" },
    // Uma SERIE com a nota mais alta de todas: nao pode aparecer, porque o
    // numero de cima do cartao ("N titulos marcados como vistos") e' de filmes e
    // o cartaz nao tem legenda que diga o que e'.
    { type: "tv", title: "A serie", poster: "https://image.tmdb.org/s.jpg", score: 100, watched: 1, updatedAt: "2026-04-01T10:00:00.000Z" },
    // NADA disto pode aparecer no cartao:
    { title: "Na watchlist", poster: "e.jpg", score: 100, watched: 0, watchlist: 1, updatedAt: "2026-09-01T10:00:00.000Z" },
    { title: "De outro ano", poster: "f.jpg", score: 100, watched: 1, updatedAt: "2025-09-01T10:00:00.000Z" },
    { title: "Sem nota", poster: "g.jpg", score: null, watched: 1, updatedAt: "2026-09-02T10:00:00.000Z" },
    { title: null, poster: "h.jpg", score: 100, watched: 1, updatedAt: "2026-09-03T10:00:00.000Z" },
  ];
  const top = melhoresDoAno(linhas, 2026, 3);
  ok_("devolve 3", top.length === 3, "=" + top.length);
  ok_("por ordem de nota, do maior para o menor", top.map((t) => t.score).join(",") === "98,90,70", top.map((t) => t.score).join(","));
  ok_("o da watchlist nao entra", !top.some((t) => t.titulo === "Na watchlist"));
  ok_("o de outro ano nao entra", !top.some((t) => t.titulo === "De outro ano"));
  ok_("o sem nota nao entra", !top.some((t) => t.titulo === "Sem nota"));
  ok_("o sem titulo nao entra (um cartao sem nome e' pior)", !top.some((t) => !t.titulo));
  ok_("e a serie NAO entra (o numero de cima do cartao e' so' de filmes)", !top.some((t) => t.tipo === "tv"));
  ok_("e o primeiro continua a ser o melhor filme", top[0].score === 98, "=" + top[0].score);
  ok_("o poster null fica null (a UI desenha um bloco, nao um erro)", top[1].poster === null);
  ok_("pede menos do que ha, devolve o que ha", melhoresDoAno(linhas, 2026, 99).length === 4, "=" + melhoresDoAno(linhas, 2026, 99).length);
  ok_("pedir 0 da 0", melhoresDoAno(linhas, 2026, 0).length === 0);
  ok_("pedir negativo da 0", melhoresDoAno(linhas, 2026, -3).length === 0);
  ok_("uma nota em texto numerico conta", melhoresDoAno([{ type: "movie", title: "X", score: "77", watched: 1, updatedAt: "2026-01-01T00:00:00.000Z" }], 2026).length === 1);
  ok_("o ano e' lido em UTC, como tudo o resto", anoDe("2026-12-31T23:59:59.000Z") === 2026);
}

console.log("");
console.log("  7) as fontes: cada peso que o desenho usa tem de ser pedido antes");
{
  const jsx = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "CartaoAno.jsx"), "utf8");

  // Cada `ctx.font = ...` do desenho tem de ter o peso pedido antes. E' o que
  // impede o cartao de sair com a fonte do sistema: o sintoma e' INVISIVEL (o
  // canvas cai para a fonte disponivel sem dizer nada) e so' se nota na imagem.
  //
  // Extrai-se pela MESMA funcao que o desenho usa, e nao por literais — foi
  // por isso que a primeira versao deste teste via "400 ?" quando a fonte
  // passou a ser construida em vez de escrita, e achava que as duas metades
  // coincidiam.
  // Uma string por peso. Com a flag `g`, `String.match` devolve um array de
  // MATCHES (sem os grupos) e a primeira versao passava esse array ao
  // `resolve` — que lia `m[1]`/`m[2]` de uma string e dava `undefined`. Todas
  // as linhas colapsavam no mesmo valor e o teste via "?? sem fonteDe".
  // `fonteDe("800", tam1, "titulo")` tem virgulas DENTRO dos argumentos, por
  // isso que um `[^,)]*` entre o peso e o fecho nao chega. Extrai-se o peso do
  // inicio e a familia da ultima string quotada antes do `)` — que e' a unica
  // forma de o saber sem fazer um parser de JavaScript.
  const reUm = /fonteDe\("(\d{3})"(.*)\)/;
  const resolve1 = (str) => {
    const m = reUm.exec(str);
    if (!m) return "?? sem fonteDe";
    const fam = /"(\w+)"/.exec(m[2]);
    return m[1] + " " + (fam ? FAMILIAS[fam[1]] : FAMILIAS.corpo);
  };
  const bloco = jsx.slice(jsx.indexOf("export async function carregaFontes"));
  const pedidos = bloco.slice(0, bloco.indexOf("];") + 2);
  const reG = /fonteDe\("(\d{3})"([\s\S]*?)\)/g;
  const pedidosSet = new Set([...pedidos.matchAll(reG)].map(resolve1));
  const usados = new Set(
    jsx
      .split("\n")
      .filter((x) => x.includes("ctx.font ="))
      .map(resolve1)
  );
  ok_("a funcao de fonte monta a string sem literais no JSX", fonteDe("800", 40, "titulo") === "800 40px Archivo", fonteDe("800", 40, "titulo"));

  ok_("ha pelo menos 2 pesos usados no desenho", usados.size >= 2, [...usados].join(" , "));
  const emFalta = [...usados].filter((u) => !pedidosSet.has(u));
  ok_("TODO o peso escrito no desenho e' esperado antes", emFalta.length === 0, "faltam: " + emFalta.join(", "));
  ok_("sao pedidos pelo menos tantos pesos quantos se usam", pedidosSet.size >= usados.size);
  // `document.fonts.ready` sozinho NAO chega: resolve quando as fontes que
  // precisam de estar prontas estão, e uma fonte que ninguem desenhou na pagina
  // pode ficar `unloaded` sem que o `ready` espere por ela.
  ok_("o peso e' pedido um a um com .load(), nao so com fonts.ready", /f\.load\(p\)/.test(jsx) && !/fonts\.ready\(\)/.test(jsx));
  ok_("e pede-os todos pela funcao de fonte, para nao haver literais", (pedidos.match(/fonteDe\(/g) || []).length === 4, "=" + (pedidos.match(/fonteDe\(/g) || []).length);
  ok_("FAMILIAS tem as duas familias do desenho", FAMILIAS.titulo === "Archivo" && FAMILIAS.corpo === "Manrope");
  // O tecto de tempo: sem ele, uma fonte que nunca chega deixa o botao em
  // "a desenhar..." para sempre.
  ok_("ha um tecto de tempo (o botao nao fica preso)", /setTimeout\(.*, comTimeoutMs\)/.test(jsx) && /comTimeoutMs = \d+/.test(jsx));
}

console.log("");
console.log("  8) o crossOrigin vai ANTES do src, ou o canvas suja");
{
  const jsx = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "CartaoAno.jsx"), "utf8");
  const corpo = jsx.slice(jsx.indexOf("export function carregaImagem"));
  const iCross = corpo.indexOf("img.crossOrigin");
  const iSrc = corpo.indexOf("img.src =");
  ok_("existe `img.crossOrigin = \"anonymous\"`", iCross >= 0);
  ok_("e vem ANTES do `img.src` (o browser ignora se vier depois)", iCross >= 0 && iCross < iSrc);
  // Um `toBlob` sem callback de erro e' um PNG de 0 bytes sem aviso.
  ok_("o `toBlob` rejeita quando nao ha blob", /blob \? resolve\(blob\) : reject/.test(jsx));
  ok_("o botao trata a falha e diz alguma coisa", /estado === "erro"/.test(jsx));
  // Um cartaz que falhe nao pode levar o cartao inteiro atras: o texto ja foi
  // desenhado e nao se volta a desenhar.
  ok_("um cartaz que falha vira bloco, nao erro", /fillStyle = "#1a1a1f"/.test(jsx));
}

console.log("");
console.log("  9) o /api/stats e o /api/goals nao podem divergir");
{
  // A mesma contagem aparece em dois endpoints. Se um deles mudar de funcao, os
  // numeros do cartao e os da meta deixao de bater — e ninguem nota ate alguém
  // comparar. Verifica-se que ambos chamam `contaFilmesPorAno` com o mesmo ano.
  const stats = fs.readFileSync(path.join(RAIZ, "server", "src", "stats.js"), "utf8");
  const goals = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "goals.js"), "utf8");
  ok_("o /api/stats devolve `filmesPorAno`", /filmesPorAno:/.test(stats));
  ok_("o /api/stats calcula-o com `contaFilmesPorAno`", /filmesPorAno: contaFilmesPorAno\(/.test(stats));
  ok_("o /api/goals calcula-o com `contaFilmesPorAno`", /filmesPorAno: contaFilmesPorAno\(/.test(goals));
  ok_("os dois usam o ano UTC do servidor",
    /contaFilmesPorAno\(linhas, anoAgora\)/.test(goals) &&
    /contaFilmesPorAno\(emApi, new Date\(\)\.getUTCFullYear\(\)\)/.test(stats));
  // **E o mais importante:** o `/api/stats` tem de passar as linhas PASSADAS
  // POR `toApi`, nao as cruas do SQL. `statsFor` le com `SELECT *`, que da
  // `{media_type, updated_at}`; as funcoes de `metas.js` esperam `{type,
  // updatedAt}`. Sem esta linha a conta dava ZERO e nao havia erro nenhum — foi
  // o bug mais discreto da sessao. Aqui fixa-se o mapeamento.
  ok_("o `/api/stats` passa as linhas mapeadas por `toApi`", /const emApi = linhas\.map\(\(r\) => toApi\(r\)\)/.test(stats));
  ok_("e as duas funcoes de `metas.js` recebem `emApi`", /melhoresDoAno\(emApi,/.test(stats) && /contaFilmesPorAno\(emApi,/.test(stats));
  ok_("e `statsFor` nao lhes passa as linhas cruas", !/melhoresDoAno\(linhas,/.test(stats) && !/contaFilmesPorAno\(linhas,/.test(stats));
  ok_("e o `store.js` exporta `toApi` para isso ser possivel", /export function toApi\(/.test(fs.readFileSync(path.join(RAIZ, "server", "src", "store.js"), "utf8")));
  ok_("e o /api/stats devolve tambem `topDoAno` (o que da conteudo ao cartao)", /topDoAno:/.test(stats));
}

console.log("");
console.log("");
console.log("  11) os ficheiros do servidor ainda ABREM (parse, sem arrancar nada)");
{
  // **Este teste nasceu de um bug que quase nao foi visto.** O `stats.js`
  // importava `contaPorHora` de `metas.js` — onde nao esta' exportado —
  // ao mesmo tempo que o tinha definido localmente. `export function` repetido
  // no mesmo ficheiro e' um SyntaxError, e o **servidor nao arrancava**. Lint
  // passou, o build passou, e as 73 verificacoes passaram todas: nenhuma
  // carrega o servidor.
  //
  // `node --check` faz o parse sem executar e sem abrir a base de dados, e
  // apanha um `const`/`function` declarado duas vezes. Medido: ficheiro com
  // duplicado da exit=1, ficheiro certo da exit=0.
  const alvos = [
    ["server", "src", "stats.js"],
    ["server", "src", "metas.js"],
    ["server", "src", "routes", "goals.js"],
    ["server", "src", "store.js"],
  ];
  for (const partes of alvos) {
    const p = path.join(RAIZ, ...partes);
    const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
    const primeira = ((r.stderr || "").split("\n").find((x) => x.includes("Error")) || "").trim().slice(0, 70);
    ok_("`" + partes.join("/") + "` faz parse", r.status === 0, "exit=" + r.status + (primeira ? " — " + primeira : ""));
  }
}

console.log("  10) o canvas nao ocupa sitio na pagina");
{
  const css = fs.readFileSync(path.join(RAIZ, "web", "src", "styles.css"), "utf8");
  ok_("o canvas tem `display: none`", /\.cartao-ano-canvas \{[^}]*display: none;/.test(css));
  // Nao `width: 0`: um canvas e' um elemento de substituicao com dimensao
  // propria, e a 0x0 o `toBlob` pode devolver um PNG de 0 bytes.
  ok_("e nao `width: 0` (daria uma imagem de 0 bytes)", !/\.cartao-ano-canvas \{[^}]*width: 0/.test(css));
  ok_("o botao tem area de toque de 40 px (regra dos botoes)", /\.cartao-ano-btn \{[^}]*min-height: 40px/.test(css));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);