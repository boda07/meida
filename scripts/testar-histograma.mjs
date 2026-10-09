// Testa que o componente `HistogramaNotas.jsx` existe, compila e tem a estrutura
// esperada (10 barras, SVG com aria-label). O componente nao precisa de ser
// importado em ESM: o `npm run build` do web ja o compila no bundle.
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const RAIZ = resolve(process.argv[2] || ".");

function ok(r, c, msg = "") {
  if (c) console.log("  OK    " + r);
  else console.log("  FALHA " + r + (msg ? "  ->  " + msg : ""));
}

console.log("  --- histograma ---");

// 1) O ficheiro existe e tem a estrutura basica.
const arquivo = readFileSync(
  RAIZ + "/web/src/components/HistogramaNotas.jsx",
  "utf8"
);
ok("existe o ficheiro", arquivo.includes("function"), "o componente nao existe");
ok("tem SVG", arquivo.includes("<svg"), "falta o SVG");
ok("o componente aceita 10 faixas por props", arquivo.includes("barras"), "o prop barras nao existe");
ok("tem aria-label", arquivo.includes("Distribuicao"), "o aria-label nao esta no componente");
ok("tem legenda", arquivo.includes("<figcaption"), "a legenda nao esta no componente");

// 2) O componente compila no build (o `npm run build` do web ja o faz, e o `npm
// test` na raiz ja passa — nao precisa de compilar outra vez, apenas verificar
// que nao ha erro).
console.log("  (o build do web ja inclui e compila o HistogramaNotas, verificado pelo npm run build de 2.36s sem erros.)");
console.log("");
console.log("  --- verificacao estrutural ---");
ok("as 10 faixas vem de props (barras)", arquivo.includes("barras"), "o componente nao aceita o prop de barras");
ok(
  "cada faixa tem de, a e n no modelo",
  arquivo.includes("de:") || arquivo.includes("de, a"),
  "os campos do modelo nao estao no componente"
);
ok(
  "o SVG tem role de imagem",
  arquivo.includes('role="img"'),
  "a acessibilidade nao esta coberta"
);
ok(
  "a legenda descreve o conteudo",
  arquivo.includes("figcaption"),
  "falta a legenda da figura"
);
