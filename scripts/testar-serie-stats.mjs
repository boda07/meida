// As series dos graficos de `/stats`: as decadas, e sobretudo a giragem do
// fuso horario.
//
// A giragem e' o que dá bug. Um histograma de 24 horas tem de virar de forma
// EXACTA — o mesmo `n` noutro balde, o total igual, os zeros a dar a volta
// certa — e um `%` mal feito em JavaScript da' `-1` num indice, que e' um
// balde `undefined` e uma hora a mais no grafico sem dar erro nenhum.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { giraPorFuso, fusoEmHoras, serieDecadas, indicesRotulados } from "../web/src/components/serieStats.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

const baldes = (vals) => vals.map((n, hora) => ({ hora, n }));

console.log("");
console.log("  1) sem fuso (UTC), a serie sai igual");
{
  const b = baldes([...Array(23).fill(0), 5]); // so' a hora 23 tem 5
  const s = giraPorFuso(b, 0);
  ok_("sao 24 barras", s.length === 24);
  ok_("o 5 continua na hora 23", s[23].n === 5);
  ok_("o total nao muda", s.reduce((a, d) => a + d.n, 0) === 5);
}

console.log("");
console.log("  2) UTC+1 (Lisboa no verao): o que era 22h passa a 23h");
{
  const b = baldes([...Array(24).fill(0)]);
  b[22].n = 7;
  const s = giraPorFuso(b, 1);
  ok_("o balde 22 (UTC) esta' na hora 23 (local)", s[23].n === 7);
  ok_("e a hora 22 (local) esta' vazia", s[22].n === 0);
  ok_("o total nao muda", s.reduce((a, d) => a + d.n, 0) === 7);
}

console.log("");
console.log("  3) UTC-5: o balde 2 (UTC) passa a 21h do dia anterior");
{
  const b = baldes([...Array(24).fill(0)]);
  b[2].n = 3;
  const s = giraPorFuso(b, -5);
  ok_("o balde 2 (UTC) esta' na hora 21 (local)", s[21].n === 3);
  ok_("o total nao muda", s.reduce((a, d) => a + d.n, 0) === 3);
}

console.log("");
console.log("  4) o caso que parte o '%' de JavaScript");
{
  // Com fuso -5, a hora local 0 vem do balde UTC 5: (0 - (-5)) = 5, ok.
  // Mas com fuso +5, a hora local 0 vem do balde UTC 19: (0 - 5) % 24 = -5 em
  // JS — um indice negativo, que devolve `undefined`. E' o bug que esta funcao
  // existe para evitar.
  const b = baldes([...Array(24).fill(0)]);
  b[19].n = 4;
  const s = giraPorFuso(b, 5);
  ok_("nenhum balde fica `undefined`", s.every((d) => typeof d.n === "number"), JSON.stringify(s.filter((d) => typeof d.n !== "number")));
  ok_("o balde 19 (UTC) esta' na meia-noite local", s[0].n === 4);
  ok_("o total nao mudou", s.reduce((a, d) => a + d.n, 0) === 4);
}

console.log("");
console.log("  5) fuzes grandes: +14, -12 e valores absurdos");
{
  const b = baldes([...Array(24).fill(0)]);
  b[10].n = 1;
  const grande = giraPorFuso(b, 14);
  // Com fuso +14, o balde 10 (UTC) fica na hora local 0: `10 + 14 = 24 = 0`.
  ok_("o balde 10 (UTC) fica a meia-noite local", grande[0].n === 1, "posicao " + grande.findIndex((d) => d.n === 1));

  const menos = giraPorFuso(b, -12);
  ok_("fuso -12 nao parte", menos.every((d) => typeof d.n === "number") && menos.reduce((a, d) => a + d.n, 0) === 1);
  ok_("o balde 10 (UTC) fica as 22h locais", menos[22].n === 1);

  // Um fuso de +15 nao existe, mas um `undefined` que chegue aqui daria NaN e
  // o modulo de NaN e' NaN — o indice do balde ficaria `undefined` outra vez.
  const semFuso = giraPorFuso(b, undefined);
  ok_("sem fuso dado, assume UTC", semFuso[10].n === 1);
  ok_("fuso nao numerico assume UTC", giraPorFuso(b, NaN)[10].n === 1);
  // +26 normaliza para +2, logo o balde 10 (UTC) fica na hora 12.
  ok_("fuso +26 e' o mesmo que +2 (o fuso da culpa volta a dar a volta)", giraPorFuso(b, 26)[12].n === 1, "posicao " + giraPorFuso(b, 26).findIndex((d) => d.n === 1));
}

console.log("");
console.log("  6) entradas estragadas nao rebentam");
{
  ok_("sem serie, da' vazio", giraPorFuso(null, 1).length === 0);
  ok_("serie com 12 baldes (errada) da' vazio", giraPorFuso(baldes(new Array(12).fill(0)), 1).length === 0);
  ok_("serie com 25 baldes da' vazio", giraPorFuso(baldes(new Array(25).fill(0)), 1).length === 0);
}

console.log("");
console.log("  7) fusoEmHoras tem o sinal certo");
{
  // ATENCAO ao sinal: `getTimezoneOffset()` da POSITIVO a oeste de Greenwich.
  // Lisboa (UTC+1) da -60, e nao +60 — escrevi o contrario na primeira
  // versao deste teste e o codigo estava certo. O comment no `serieStats.js`
  // diz o mesmo, e aqui estava escrito ao contrario.
  ok_("Lisboa (offset -60) da' +1 hora", fusoEmHoras({ getTimezoneOffset: () => -60 }) === 1);
  ok_("New York (offset +300) da' -5", fusoEmHoras({ getTimezoneOffset: () => 300 }) === -5);
  ok_("um fuso de 0 (UTC) da' 0", fusoEmHoras({ getTimezoneOffset: () => 0 }) === 0);
  // A India e' UTC+5:30 (offset -330). Nao ha' meia hora no grafico, por isso
  // arredonda: 5 e' o mais perto e o que nao engana ninguem.
  ok_("meia hora (India, offset -330) arredonda para 5", fusoEmHoras({ getTimezoneOffset: () => -330 }) === 5);
}

console.log("");
console.log("  8) serieDecadas");
{
  const s = serieDecadas([{ decada: 2010, n: 5 }, { decada: 1990, n: 9 }, { decada: 2000, n: 2 }]);
  ok_("vem ordenada por decada", s.map((d) => d.rotulo).join(",") === "1990,2000,2010", s.map((d) => d.rotulo).join(","));
  ok_("cada barra tem chave", s.every((d) => typeof d.chave === "string" && d.chave.length > 0));
  // Ordenadas: 1990 (9), 2000 (2), 2010 (5). O maior e' logo o primeiro.
  ok_("o rotulo e' a decada completa (nao '90s')", s[0].rotulo === "1990", s[0].rotulo);
}

console.log("");
console.log("  9) o servidor conta em UTC, com 24 baldes sempre");
{
  const stats = fs.readFileSync(path.join(RAIZ, "server", "src", "stats.js"), "utf8");
  ok_("exporta `contaPorHora` (para o teste)", /export function contaPorHora/.test(stats));
  ok_("usa `getUTCHours` (nao `getHours`, que depende do fuso do servidor)", /getUTCHours\(\)/.test(stats));
  ok_("devolve sempre 24 baldes", /new Array\(24\)\.fill\(0\)/.test(stats) && /Array\.from\(\{ length: 24 \}|porHora\.map/.test(stats));
  ok_("manda `horasUtc` no retorno", /horasUtc:\s*contaPorHora\(datas\)/.test(stats));
  // Sao TRES parenteses a fechar depois de `getTime`: o da propria chamada, o do
// `isNaN` e o do `if`. Com dois, o teste falha e eu culpo o codigo. (Foi o que
// aconteceu na primeira vez.)
ok_("ignora datas invalidas sem rebentar", /Number\.isNaN\(d\.getTime\(\)\)\)\s*continue/.test(stats));
  // E a ligacao com o mapa de calor: as DUAS contagens tem de sair das MESMAS
  // datas, senao o mapa diz uma coisa e o grafico das horas outra.
  ok_("as datas do mapa e das horas sao a mesma lista", /const datas = \[\]/.test(stats) && /datas\.push\(r\.updated_at\)/.test(stats));
}

console.log("");
console.log("  10) que colunas levam rotulo no eixo X");
{
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((rotulo, i) => ({
    rotulo,
    ano: 2026,
    mes: i + 1,
    n: 1,
  }));
  const idx = indicesRotulados(meses);
  // 6, nao 7: com indices pares, de 12 colunas saem 6 rotulos. A versao partida
  // dava 7 — e' por isso que contar sozinho nao prova nada.
  ok_("12 meses sao 6 rotulos", idx.length === 6, idx.join(","));
  // O bug: com `i % 2 === 1` saiam 0, 1, 3, 5 — "Jan Fev Abr", dois colados e
  // um salto de Fev para Abr.
  ok_("o primeiro mes leva rotulo", idx[0] === 0);
  ok_("o SEGUNDO nao (esta' colado com o primeiro)", idx[1] !== 1, "rotulos " + idx.join(","));
  ok_("e' de dois em dois, sem buracos", idx.every((v, k) => v === k * 2), idx.join(","));
  ok_("le-se Jan Mar Mai Jul Set Nov", idx.map((i) => meses[i].rotulo).join(" ") === "Jan Mar Mai Jul Set Nov", idx.map((i) => meses[i].rotulo).join(" "));

  // 24 horas: o mesmo bug dava "00 01 03 05", com o 00 e o 01 por cima.
  const horas = Array.from({ length: 24 }, (_, h) => ({ rotulo: ("0" + h).slice(-2), n: 1 }));
  const ih = indicesRotulados(horas, false);
  ok_("24 horas sao 12 rotulos", ih.length === 12, ih.length + "");
  ok_("horas leem-se 00 02 04 ... 22", ih.map((i) => horas[i].rotulo).join(" ") === "00 02 04 06 08 10 12 14 16 18 20 22", ih.map((i) => horas[i].rotulo).join(" "));

  // Quando muda o ano, esse mes leva rotulo mesmo sendo impar.
  const doisAnos = [
    ...meses.slice(0, 6),
    ...meses.slice(6).map((m, k) => ({ ...m, ano: 2027, mes: k + 1 })),
  ];
  const ia = indicesRotulados(doisAnos);
  ok_("o primeiro mes do ano novo (indice 6) leva rotulo", ia.includes(6), ia.join(","));
  ok_("os outros impares continuam de fora", !ia.includes(7) && !ia.includes(9), ia.join(","));

  ok_("sem serie, nenhum rotulo", indicesRotulados(null).length === 0);
  ok_("serie de 1 coluna leva rotulo", indicesRotulados([{ n: 1 }]).join(",") === "0");
}

console.log("");
console.log("  11) o `GraficoMensal` usa a funcao, e nao a regra escrita a la dentro");
{
  // Tira os comentarios ANTES de procurar a regra antiga: o comentario que
  // explica o bug cita-a de proposito, e sem isto o teste acusa-se a ele proprio.
  const soCodigo = (ficheiro) =>
    fs
      .readFileSync(path.join(RAIZ, ...ficheiro), "utf8")
      .split(/\r?\n/)
      .filter((x) => !/^\s*(\/\/|\/\*|\*)/.test(x))
      .join("\n");

  const gm = soCodigo(["web", "src", "components", "GraficoMensal.jsx"]);
  const ss = soCodigo(["web", "src", "components", "serieStats.js"]);
  ok_("importa `indicesRotulados`", /import \{ indicesRotulados \} from "\.\/serieStats\.js"/.test(gm));
  ok_("consulta o Set e nao recalcula", /!indiceRotulo\.has\(i\) \? null :/.test(gm));
  // A regra antiga, escrita dentro do JSX, e' a que produzia o bug. Se alguem a
  // voltar a escrever como codigo, este teste tem de apanhar — mas o comentario
  // que a cita nao conta.
  ok_("a regra antiga `i % 2 === 1` nao voltou como codigo no GraficoMensal", !/i % 2 === 1/.test(gm));
  ok_("nem no serieStats.js", !/i % 2 === 1/.test(ss));
  ok_("o comentario que explica o bug continua la (leitura para quem vier depois)", /i % 2 === 1/.test(fs.readFileSync(path.join(RAIZ, "web", "src", "components", "serieStats.js"), "utf8")));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);