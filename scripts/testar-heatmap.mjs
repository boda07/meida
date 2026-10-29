// O mapa de calor: a matematica, sem DOM.
//
// O desenho nao da bug — um `<rect>` desenha-se ou nao se desenha. O que da
// bug e' a DATA: uma chave errada mete o quadradinho na coluna errada, e num
// mapa de 7 linhas isso significa que o dia aparece na quarta-feira quando foi
// na quinta. Nos ecrans isso nao se ve — so se descobre contando as datas, que
// e' exactamente o que este ficheiro faz.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  chaveDia,
  dataDe,
  somarDias,
  diaDaSemana,
  dataNumerica,
  semanasDoMapa,
  maximo,
  nivel,
  textoDoDia,
  ROTULOS_DIA,
  ABREVIATURA_DIA,
  PERIODOS,
  PERIODO_OMISSAO,
  semanasAte,
  DIAS_SEMANA,
  NIVEIS,
} from "../web/src/components/heatmap.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) chaveDia e' o dia LOCAL, nao o UTC");
{
  // `toISOString()` daria UTC e no UTC+1 isto seria o dia anterior. E' o erro
  // que mete o quadradinho na coluna ao lado.
  ok_("meio-dia em Lisboa (UTC+1) da-se 15 de julho", chaveDia(new Date(2026, 6, 15, 12, 0)) === "2026-07-15");
  ok_("uma hora da manha em Lisboa (UTC+1) ainda e' o dia 15", chaveDia(new Date(2026, 6, 15, 0, 30)) === "2026-07-15");
  ok_("a meia-noite e' o proprio dia", chaveDia(new Date(2026, 6, 15, 0, 0)) === "2026-07-15");
  ok_("tem dois digitos nos meses", chaveDia(new Date(2026, 0, 5)).endsWith("-01-05"));
  ok_("uma data invalida da' null", chaveDia("lixo") === null);
}

console.log("");
console.log("  2) somarDias atravessa meses, anos e o ano bissexto");
{
  ok_("31 de dezembro + 1 = 1 de janeiro", somarDias("2026-12-31", 1) === "2027-01-01");
  ok_("1 de janeiro - 1 = 31 de dezembro do ano anterior", somarDias("2027-01-01", -1) === "2026-12-31");
  // 2024 e' bissexto, 2026 nao. Um `new Date(2026, 1, 29)` da-se a 1 de
  // marco — e se o mapa correr esse dia, o dia seguinte salta um.
  ok_("29 de fevereiro de 2024 existe", dataDe("2024-02-29") !== null);
  ok_("o dia a seguir a 28 de fev de 2024 e' 29", somarDias("2024-02-28", 1) === "2024-02-29");
  ok_("o dia a seguir a 28 de fev de 2026 e' 1 de marco", somarDias("2026-02-28", 1) === "2026-03-01");
  ok_("voltar 7 dias dá o mesmo dia da semana", somarDias(somarDias("2026-03-11", 7), -7) === "2026-03-11");
}

console.log("");
console.log("  3) diaDaSemana: domingo = 0, como o GitHub");
{
  // 2026-03-15 e' um domingo.
  ok_("domingo da semana de 15 de marco", diaDaSemana("2026-03-15") === 0);
  ok_("segunda-feira", diaDaSemana("2026-03-16") === 1);
  ok_("sabado", diaDaSemana("2026-03-21") === 6);
  ok_("uma chave invalida da' null", diaDaSemana("nao-e-um-dia") === null);
}

console.log("");
console.log("  4) semanasDoMapa: 53 colunas de 7, alinhadas no domingo");
{
  const dias = [{ dia: "2026-03-11", n: 3 }, { dia: "2026-03-12", n: 1 }];
  const cols = semanasDoMapa(dias, { semanas: 53, fim: "2026-03-18" });

  ok_("sao 53 semanas", cols.length === 53, String(cols.length));
  ok_("cada semana tem 7 celulas", cols.every((c) => c.length === DIAS_SEMANA));

  // A propriedade que importa: a PRIMEIRA celula de cada coluna e' sempre um
  // domingo. Sem isto, o mapa inteiro desloca-se uma linha para cada coluna.
  ok_(
    "a primeira celula de todas as semanas e' domingo",
    cols.every((c) => diaDaSemana(c[0].dia) === 0),
    cols.map((c, i) => (diaDaSemana(c[0].dia) === 0 ? null : "col" + i)).filter(Boolean).join(",")
  );

  // A ultima coluna tem de conter o dia `fim`.
  const ultima = cols[cols.length - 1];
  ok_("a ultima semana contem o dia pedido", ultima.some((c) => c.dia === "2026-03-18"));

  // As celulas de uma semana sao dias seguidos (nada de pulos).
  let seguidos = true;
  for (const col of cols) {
    for (let i = 1; i < col.length; i++) {
      if (somarDias(col[i - 1].dia, 1) !== col[i].dia) seguidos = false;
    }
  }
  ok_("dentro de cada semana os dias sao seguidos", seguidos);

  // O total de celulas e' 53x7, sem buracos nem repeticoes.
  const todas = cols.flat().map((c) => c.dia);
  ok_("sao 371 dias, todos diferentes", todas.length === 371 && new Set(todas).size === 371, String(new Set(todas).size));
}

console.log("");
console.log("  5) os dias com atividade ficam na casa certa");
{
  const dias = [
    { dia: "2026-03-11", n: 5 },
    { dia: "2026-03-12", n: 1 },
  ];
  const cols = semanasDoMapa(dias, { semanas: 53, fim: "2026-03-18" });
  const todas = cols.flat();

  const d11 = todas.find((c) => c.dia === "2026-03-11");
  const d12 = todas.find((c) => c.dia === "2026-03-12");
  ok_("o dia 11 tem a contagem certa", d11 && d11.n === 5, d11 && String(d11.n));
  ok_("o dia 12 tem a contagem certa", d12 && d12.n === 1, d12 && String(d12.n));

  // E o mais importante: o dia 11 (quarta) esta' na LINHA 3 (0=domingo).
  const linhaDoDia11 = todas.indexOf(d11) % DIAS_SEMANA;
  ok_("11 de marco (quarta) esta' na linha 3", linhaDoDia11 === 3, "linha " + linhaDoDia11);

  ok_("um dia sem atividade da' 0, e nao undefined", todas.find((c) => c.dia === "2026-03-10").n === 0);
}

console.log("");
console.log("  6) dias de fora ficam marcados");
{
  // A semana que ainda nao chegou nao pode parecer "dia sem atividade".
  const cols = semanasDoMapa([], { semanas: 10, fim: "2026-03-18" });
  const todas = cols.flat();
  ok_("ha' dias marcados como fora", todas.some((c) => c.fora));
  ok_("todos os dias depois do fim sao 'fora'", todas.filter((c) => c.dia > "2026-03-18").every((c) => c.fora));
  ok_("todos os dias antes do inicio sao 'fora'", todas.filter((c) => c.dia > "2026-03-18").every((c) => c.fora === true));
  ok_("o proprio dia de fim nao e' 'fora'", todas.find((c) => c.dia === "2026-03-18").fora === false);
  ok_("o dia 18 (o fim) conta como dia de hoje, nao de fora", todas.find((c) => c.dia === "2026-03-18").fora === false);
}

console.log("");
console.log("  7) o nivel de cor, com degraus e nao proporcional");
{
  ok_("zero e' nivel 0", nivel(0, 10) === 0);
  // Se o maximo do mapa e' 1, esse dia e' O dia mais cheio — tem de ser a cor
  // mais forte, nao a mais fraca. (Escrevi este teste a espera de nivel 1 e
  // falhou: o codigo estava certo e a expectativa errada.)
  ok_("o dia que E' o maximo fica na cor mais forte", nivel(1, 1) === NIVEIS, "nivel " + nivel(1, 1));
  ok_("maximo e' nivel 4", nivel(10, 10) === NIVEIS);
  ok_("nivel nunca passa do maximo", nivel(100, 4) === NIVEIS);
  // O caso que justifica os degraus: max 30 e quase tudo 1-2. Com escala
  // linear quase o mapa inteiro ficava da cor mais fraca.
  ok_("com max 30, um dia com 2 nao e' o maximo", nivel(2, 30) === 1, "nivel " + nivel(2, 30));
  ok_("com max 30, um dia com 20 e' nivel 3", nivel(20, 30) === 3, "nivel " + nivel(20, 30));
  ok_("sem maximo, nao rebenta", nivel(1, 0) >= 0);
  ok_("valores nao numericos nao rebentam", nivel(undefined, 10) === 0);
}

console.log("");
console.log("  8) maximo() e dataLonga()");
{
  ok_("max() acha o maior", maximo([{ n: 2 }, { n: 9 }, { n: 5 }]) === 9);
  ok_("max() de lista vazia e' 0", maximo([]) === 0);
  ok_("max() ignora entradas sem n", maximo([{ dia: "x" }, { n: 3 }]) === 3);
  // **Numeros, barras, ordem de Portugal.** O nome do mes ("de outubro") num
  // quadradinho de 11 px era quase sempre a mesma coisa e so' ocupava espaco.
  ok_("dataNumerica escreve dd/mm/aaaa", dataNumerica("2026-10-14") === "14/10/2026", dataNumerica("2026-10-14"));
  ok_("com dia e mes de um digito leva zero", dataNumerica("2026-01-05") === "05/01/2026", dataNumerica("2026-01-05"));
  ok_("uma chave estragada nao rebenta", typeof dataNumerica("nada") === "string", dataNumerica("nada"));
  ok_("e devolve a chave como estava quando nao a percebe", dataNumerica("nada") === "nada", dataNumerica("nada"));
  // E ja nao ha a data por extenso: nao e' para mais nada e nao pode
  // desaparecer em silencio sem o teste dar por isso.
  const FONTE = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "heatmap.js"), "utf8");
  ok_("a data por extenso foi embora", !FONTE.includes("dataLonga"), "ainda la esta");
  // E o texto usa mesmo a numerica — `textoDoDia` pode estar a chamar a outra.
  const FONTE_TEXTO = FONTE.slice(FONTE.indexOf("export function textoDoDia"));
  ok_("o texto do dia usa a data numerica",
    /dataNumerica\(c\.dia\)/.test(FONTE_TEXTO) && !/dataLonga/.test(FONTE_TEXTO));
}

console.log("");
console.log("  9) o servidor conta o mesmo que a racha");
{
  const stats = fs.readFileSync(path.join(RAIZ, "server", "src", "stats.js"), "utf8");
  const ach = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "achievements.js"), "utf8");
  // As DUAS rotas tem de usar o mesmohelper de dia, senao as chaves nao batem
  // e o heatmap e a racha mostram dias diferentes.
  // As DUAS rotas tem de usar o MESMO helper de dia, senao as chaves nao
  // batem e o heatmap e a racha mostram dias diferentes. Antes cada uma tinha a
  // sua copia em UTC; agora vem de `services/dias.js`, que e' o que garante que
  // nao voltam a divergir — e o `?tz` do cliente entra pelas duas.
  const temHelper =
    /import \{[^}]*dayOf[^}]*\} from "\.\/services\/dias\.js"/.test(stats) &&
    /import \{[^}]*dayOf[^}]*\} from "\.\.\/services\/dias\.js"/.test(ach);
  ok_("as duas rotas importam o `dayOf` do modulo partilhado", temHelper);
  ok_("o heatmap conta o `updated_at` da biblioteca", /dayOf\(r\.updated_at, tz\)/.test(stats));
  ok_("o heatmap conta as tres datas do diario", /dayOf\(p\.started_at, tz\)/.test(stats) && /dayOf\(p\.finished_at, tz\)/.test(stats) && /dayOf\(p\.updated_at, tz\)/.test(stats));
  ok_("devolve `dias` ordenados", /dias:\s*\[\.\.\.porDia\.keys\(\)\]/.test(stats) && /a\.dia < b\.dia \? -1 : 1/.test(stats));
  // A reparticao que o texto do rato mostra: quantos titulos e quantos
  // episodios nesse dia. Sai de `watched_at` (a data em que marcaste) e de
  // `finished_at` (o dia em que acabaste o episodio) — e NAO de `updated_at`,
  // que tambem muda quando se mexe na nota.
  ok_("manda a reparticao de filmes e series", /filmes:/.test(stats) && /series:/.test(stats));
  ok_("os filmes vem de `watched_at` (e nao do ultimo toque)", /watched_at FROM library/.test(stats));
  // **A assercao que faltava.** Bastava o `SELECT` dizer `watched_at` para o
  // teste passar — e `SELECT updated_at AS watched_at` tambem diz, e passa, e
  // volta a mentir sobre quando viste as coisas. Tem de NAO citar `updated_at`.
  const queryFilmes = (stats.match(/SELECT[^`]*FROM library[^`]*/g) || []).find((q) => /watched_at/.test(q) && !/updated_at/.test(q));
  const comUpdated = (stats.match(/SELECT[^`]*FROM library[^`]*/g) || []).some((q) => /watched_at/.test(q) && /updated_at/.test(q));
  ok_("o SELECT dos filmes nao cita o `updated_at`", !!queryFilmes && !comUpdated, comUpdated ? "le o ultimo toque, nao a data em que viste" : "nao encontrei o SELECT");
  ok_("as series vem de `finished_at`", /dayOf\(p\.finished_at, tz\), "series"/.test(stats));
  // o `n` que a racha partilha NAO pode ter mudado de significado: e' o mesmo
  // numero que `/achievements` conta, e divergir era o bug que o aviso do
  // `stats.js` descreve.
  ok_("o `n` continua a ser a contagem da racha (nao a reparticao)",
    /n: porDia\.get\(dia\)/.test(stats));
}

console.log("");
console.log("  10) o texto do rato: quantos titulos e em quantas series");
{
  // O `t` de mentira tem de SUBSTITUIR as chaves, como o de verdade
  // (`traduzir(texto, valores)`). Um duende que devolvesse o texto tal e qual
  // faria o teste passar com `{n} {o}` no ecra — que e' exactamente o bug que
  // esta seccao existe para apanhar.
  const t = (chave, valores) =>
    String(chave).replace(/\{(\w+)\}/g, (todo, k) =>
      valores && valores[k] !== undefined ? String(valores[k]) : todo
    );
  const semNada = textoDoDia({ dia: "2026-10-14", n: 0, filmes: 0, episodios: 0 }, t);
  ok_("um dia sem nada diz 'sem atividade'", semNada.includes("sem atividade"), semNada);

  // **A regra.** So' se escreve a parte que NAO e' zero. Um dia em que so viste
  // um episodio nao pode dizer "0 titulos, 1 episodio": o zero e' ruido, e o
  // rato ja' diz que o dia teve atividade.
  const umaSerie = textoDoDia({ dia: "2026-10-14", n: 1, filmes: 0, series: 1 }, t);
  ok_("so' uma serie escreve so' a serie", umaSerie.includes("1") && !/\b0\b/.test(umaSerie), umaSerie);
  ok_("e diz quantas", umaSerie.includes("série"), umaSerie);

  const umFilme = textoDoDia({ dia: "2026-10-14", n: 1, filmes: 1, episodios: 0 }, t);
  ok_("so' um filme escreve so' o filme", umFilme.includes("título"), umFilme);
  ok_("e nao fala de series", !/série/.test(umFilme), umFilme);

  const osDois = textoDoDia({ dia: "2026-10-14", n: 4, filmes: 2, series: 3 }, t);
  ok_("os dois aparecem juntos", osDois.includes("título") && osDois.includes("série"), osDois);
  ok_("e com os numeros certos", osDois.includes("2") && osDois.includes("3"), osDois);
  // **O separador.** `/` e' uma fracao; um ponto lia-se como fim de frase.
  ok_("as duas partes sao separadas por ` / `", osDois.includes(" / "), osDois);
  ok_("e nao por um ponto (que lia-se como fim de frase)", !osDois.includes(" · "), osDois);

  ok_("uma celula sem reparticao nao rebenta", typeof textoDoDia({ dia: "2026-10-14" }, t) === "string");
  ok_("uma celula sem dia nao rebenta", typeof textoDoDia({}, t) === "string");
}

console.log("");
console.log("  11) os dias da semana ao lado, e so' tres");
{
  ok_("sao segunda, quarta e sexta", JSON.stringify(ROTULOS_DIA) === "[1,3,5]", JSON.stringify(ROTULOS_DIA));
  ok_("a abreviatura da segunda e' seg", ABREVIATURA_DIA[1] === "seg", ABREVIATURA_DIA[1]);
  ok_("a abreviatura da quarta e' qua", ABREVIATURA_DIA[3] === "qua", ABREVIATURA_DIA[3]);
  ok_("a abreviatura da sexta e' sex", ABREVIATURA_DIA[5] === "sex", ABREVIATURA_DIA[5]);
  ok_("ha uma abreviatura por dia da semana", ABREVIATURA_DIA.length === 7, String(ABREVIATURA_DIA.length));
}

console.log("");
console.log("  12) mais de um ano, sem encolher o mapa");
{
  ok_("o omissao e' um ano", PERIODO_OMISSAO === 53, String(PERIODO_OMISSAO));
  ok_("ha mais periodos que um ano", PERIODOS.some((p) => p.semanas > 53));
  ok_("os periodos estao por ordem", PERIODOS.every((p, i, a) => i === 0 || p.semanas > a[i - 1].semanas));

  // "Tudo" tem de cobrir a historia e nunca encolher abaixo do omissao: com meia
  // semana de atividade, "tudo" dava uma coluna e o mapa encolhia para um
  // quadradinho, que e' pior do que mostrar um ano.
  ok_("sem dados, 'tudo' e' o periodo por omissao", semanasAte([]) === PERIODO_OMISSAO, String(semanasAte([])));
  const mes = semanasAte([{ dia: "2026-10-01", n: 1 }], { fim: "2026-10-16" });
  ok_("com poucos dias nao encolhe", mes >= PERIODO_OMISSAO, String(mes));
  const antigo = semanasAte([{ dia: "2020-01-05", n: 3 }, { dia: "2026-10-01", n: 1 }], { fim: "2026-10-16" });
  ok_("com seis anos de historico cobre tudo", antigo > 300, String(antigo));
  ok_("o omissao nunca e' menos que um ano", semanasAte([{ dia: "2026-10-16", n: 9 }], { fim: "2026-10-16" }) >= 53);
}

console.log("");
console.log("  13) a reparticao chega a cada celula");
{
  const cols = semanasDoMapa([{ dia: "2026-10-14", n: 3, filmes: 2, series: 5 }], {
    semanas: 2,
    fim: "2026-10-16",
  });
  const todas = cols.flat();
  const alvo = todas.find((c) => c.dia === "2026-10-14");
  ok_("a celula do dia traz os filmes", alvo && alvo.filmes === 2, alvo ? String(alvo.filmes) : "dia nao encontrado");
  ok_("a celula do dia traz as series", alvo && alvo.series === 5, alvo ? String(alvo.episodios) : "-");
  ok_("e o n da racha nao mudou", alvo && alvo.n === 3, alvo ? String(alvo.n) : "-");
  const vazio = todas.find((c) => c.dia === "2026-10-15");
  ok_("um dia sem dados traz zeros, nao undefined",
    vazio && vazio.filmes === 0 && vazio.series === 0,
    vazio ? JSON.stringify({ f: vazio.filmes, s: vazio.series }) : "-");
}

console.log("");
console.log("  14) o desenho: a coluna dos dias nao desliza com o mapa");
{
  const JSX = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "HeatmapAtividade.jsx"), "utf8");
  const CSS = fs.readFileSync(path.join(RAIZ, "web", "src", "styles.css"), "utf8");
  const DESTAQUE = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "useHeatmapDestaque.js"), "utf8");
  const JSX_TUDO = JSX + "\n" + DESTAQUE;
  ok_("a coluna dos dias existe", /className="heatmap-lateral"/.test(JSX));
  ok_("e escreve as tres abreviaturas", /ROTULOS_DIA\.map/.test(JSX));
  // **O que importa:** o rotulo tem de estar FORA do contentor que desliza, senao
  // o "seg" sai do ecra mal se mexe no mapa.
  const lateral = JSX.indexOf('className="heatmap-lateral"');
  const scroll = JSX.indexOf('className="heatmap-scroll"');
  ok_("os rotulos vem ANTES do contentor que desliza", lateral >= 0 && scroll >= 0 && lateral < scroll);
  ok_("o scroll esta no contentor do mapa, nao na figura toda",
    /\.heatmap-scroll\s*\{[\s\S]{0,160}overflow-x:\s*auto/.test(CSS));
  // E a figura nao pode deslizar: se deslizar, os rotulos dos dias vao com ela e o
  // "seg" sai do ecra — que e' o defeito que a coluna fixa resolve.
  //
  // **Todas** as regras, nao a primeira: uma segunda regra `.heatmap` mais abaixo
  // (um `overflow-x` acrescentado depois) faria o teste passar se ele so olhasse
  // para a primeira — e foi exactamente assim que a mutacao escapou.
  const regrasHeatmap = CSS.match(/\.heatmap\s*\{[\s\S]*?\}/g) || [];
  ok_("a figura tem pelo menos uma regra (o teste esta' a ver o ficheiro)", regrasHeatmap.length > 0, String(regrasHeatmap.length));
  ok_("nenhuma regra da figura tem scroll (senao os rotulos saem com ela)",
    !regrasHeatmap.some((r) => /overflow-x/.test(r)),
    regrasHeatmap.filter((r) => /overflow-x/.test(r)).map((r) => r.replace(/\s+/g, " ").slice(0, 50)).join(" | "));
  ok_("a figura e' uma grelha de duas colunas",
    /\.heatmap\s*\{[\s\S]{0,240}grid-template-columns:\s*auto/.test(CSS));
  ok_("o topo dos meses ja nao tem min-width fixo", !/\.heatmap-topo\s*\{[\s\S]{0,240}min-width/.test(CSS));
  ok_("o texto do rato vem da funcao pura", /textoDoDia\(/.test(JSX));
  ok_("ha selector de periodo", /heatmap-periodos/.test(JSX) && /setEscolhido/.test(JSX));

  // **O acoplamento que deu uma linha errada.** O rotulo do dia tem de cair na
  // MESMA linha da celula que nomeia: `seg` na segunda, `qua` na quarta. Com o
  // rotulo posicionado a partir do topo da figura e sem somar a linha de meses, o
  // "seg" alinhava com o domingo — e parece correcto, que e' o que o torna pior
  // do que nao ter rotulo nenhum.
  //
  // A garantia nao e' comparar dois numeros escritos a mao (que divergem no
  // primeiro refactor): e' que o CSS NAO tenha numeros proprios. `--topo` e
  // `--passo` sao posto pelo componente e as duas colunas leem-nos.
  ok_("o componente define a altura da linha de meses", /const ALTURA_TOPO = \d+/.test(JSX));
  ok_("e passa as medidas ao CSS", /"--passo": PASSO \+ "px"/.test(JSX) && /"--topo": ALTURA_TOPO \+ "px"/.test(JSX));
  ok_("a coluna dos dias usa essas medidas, nao numeros proprios",
    /\.heatmap-lateral\s*\{[\s\S]{0,800}grid-template-rows:\s*var\(--topo\) repeat\(7, var\(--passo\)\)/.test(CSS),
    "a coluna escreve o numero no CSS e pode divergir do JSX");
  ok_("a linha de meses usa a MESMA medida",
    /\.heatmap-topo\s*\{[\s\S]{0,240}height:\s*var\(--topo/.test(CSS));
  ok_("o rotulo vai por linha de grelha, e nao por `top` em pixels",
    /gridRow: li \+ 2/.test(JSX) && !/style=\{\{ top: /.test(JSX));
  // Uma caixa cujos filhos sao `absolute` mede zero, e a coluna ficava com 0 px
  // de largura com o "seg" por cima da primeira coluna do mapa.
  ok_("a coluna dos dias nao e' so' filhos `absolute` (que mediriam zero)",
    !/\.heatmap-lateral span\s*\{[\s\S]{0,140}position:\s*absolute/.test(CSS));
  // A propria coluna: `position: absolute` nela tira-a da grelha da figura e o
  // mapa perde a coluna. O teste so olhava para os filhos e passava por cima.
  //
  // **Sem comentarios.** O comentario que explica o CSS diz, ele proprio,
  // "e nao `position: absolute`" — e a assercao lia essa frase como se fosse a
  // propriedade. E' o mesmo que happened com `testar-acento.mjs`.
  const cssLimpo = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const regraLateral = (cssLimpo.match(/\.heatmap-lateral\s*\{[\s\S]*?\}/) || [""])[0];
  ok_("a coluna dos dias e' uma grelha",
    /display:\s*grid/.test(regraLateral), regraLateral.replace(/\s+/g, " ").slice(0, 60));
  ok_("a coluna dos dias nao esta' `position: absolute` (sairia da grelha da figura)",
    !/position:\s*absolute/.test(regraLateral), regraLateral.replace(/\s+/g, " ").slice(0, 60));
}

console.log("");
console.log("  15) o texto do dia esta' NO DOM, e funciona ao toque");
{
  const JSX = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "HeatmapAtividade.jsx"), "utf8");
  const CSS = fs.readFileSync(path.join(RAIZ, "web", "src", "styles.css"), "utf8");
  const DESTAQUE = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "useHeatmapDestaque.js"), "utf8");
  const JSX_TUDO = JSX + "\n" + DESTAQUE;

  // **A razao de ser disto tudo.** O `<title>` do SVG e' um tooltip do browser:
  // aparece com o rato e NUNCA com o dedo, e vive fora do DOM onde nenhum teste
  // o alcanca. A app usa-se muito ao toque, portanto um dia que so'`title` nao
  // mostra o numero a quem toca no quadradinho.
  // Sem comentarios: o codigo explica que NAO usa `<title>`, e a frase aparecia
  // no teste como se fosse o elemento. (Ja aconteceu duas vezes, com o CSS.)
  const jsxLimpo = JSX.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok_("as celulas NAO usam `<title>`", !/<title>/.test(jsxLimpo), "ainda ha um <title> no codigo");
  ok_("o texto e' um elemento no DOM", /className="heatmap-dica"/.test(JSX));
  ok_("e usa a funcao pura", /textoDoDia\(destaque, t\)/.test(JSX));

  ok_("o rato mostra o texto", /onMouseEnter=\{\(ev\) => mostrar\(celula, false, ev\)\}/.test(JSX_TUDO));
  ok_("e o toque tambem", /onClick=\{\(ev\) => mostrar\(celula, true, ev\)\}/.test(JSX_TUDO));
  ok_("o teclado tambem", /onFocus=\{\(ev\) => mostrar/.test(JSX_TUDO) && /onBlur=\{\(\) => soltar/.test(JSX_TUDO));
  ok_("Esc fecha o que ficou preso", /e.key === "Escape"/.test(JSX_TUDO));

  // Um toque prende o texto; o fundo so' existe nesse caso, senao ficava um painel
  // invisivel por cima do mapa a comer os cliques.
  ok_("o fundo so' aparece depois de um toque",
    /destaque && destaque\.preso && \([\s\S]{0,160}heatmap-fundo/.test(JSX));

  // `fixed`, nao `absolute`: as coordenadas vem do ecra. Com `absolute` o texto
  // prendia-se a figura e as colunas do mapa que desliza (que vao alem da figura)
  // punham o texto longe do dia.
  const cssLimpo = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  ok_("o texto e' `position: fixed` (senao prende-se a figura)",
    /\.heatmap-dica\s*\{[\s\S]{0,200}position:\s*fixed/.test(cssLimpo));
  ok_("e o fundo nao tapa o mapa sem ser preciso",
    /\.heatmap-fundo\s*\{[\s\S]{0,200}background:\s*transparent/.test(cssLimpo));

  // A posicao mede a largura real do texto em vez de adivinhar uma margem fixa.
  ok_("a margem usa a largura medida do texto",
    /const meia = el\.offsetWidth \/ 2/.test(JSX_TUDO) && /Math\.max\(meia, Math\.min\(destaque\.x/.test(JSX_TUDO));
  ok_("e nao volta a ter um numero fixo na mao", !/Math\.max\(100, Math\.min/.test(JSX_TUDO));

  // O numero tambem fica dentro do quadradinho, para se ler sem passar o rato.
  ok_("o dia seleccionado escreve o numero dentro da celula",
    /className="heatmap-leitura"/.test(JSX));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);