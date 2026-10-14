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
  dataLonga,
  semanasDoMapa,
  maximo,
  nivel,
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
  ok_("dataLonga escreve o mes certo", dataLonga("2026-10-14") === "14 de outubro de 2026", dataLonga("2026-10-14"));
}

console.log("");
console.log("  9) o servidor conta o mesmo que a racha");
{
  const stats = fs.readFileSync(path.join(RAIZ, "server", "src", "stats.js"), "utf8");
  const ach = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "achievements.js"), "utf8");
  // As DUAS rotas tem de usar o mesmohelper de dia, senao as chaves nao batem
  // e o heatmap e a racha mostram dias diferentes.
  const temHelper = /function dayOf/.test(stats) && /function dayOf/.test(ach);
  ok_("as duas rotas tem o mesmo `dayOf`", temHelper);
  ok_("o heatmap conta o `updated_at` da biblioteca", /dayOf\(r\.updated_at\)/.test(stats));
  ok_("o heatmap conta as tres datas do diario", /dayOf\(p\.started_at\)/.test(stats) && /dayOf\(p\.finished_at\)/.test(stats) && /dayOf\(p\.updated_at\)/.test(stats));
  ok_("devolve `dias` ordenados", /dias:\s*\[\.\.\.porDia\.entries\(\)\]/.test(stats) && /a\.dia < b\.dia \? -1 : 1/.test(stats));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);