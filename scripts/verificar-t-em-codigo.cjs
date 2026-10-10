// Percorre todos os ficheiros de interface a procura de `t()` em sitio onde nao
// e' JSX valido. O tradutor automatico mete `t("...")` onde antes estava
// `"..."`, e isso parte quando a string estava DENTRO de uma expressao (por
// exemplo `setMsg({ "x": 1 })`, que nao e' uma string solta).
//
// Em vez de corrigir um a um pelo log do build, este script le o codigo e diz
// onde ha' `{t(` dentro de codigo (nao JSX).
const fs = require("node:fs");
const path = require("node:path");

const PASTAS = ["web/src/pages", "web/src/components", "web/src/settings", "web/src/library"];
const ficheiros = [];
for (const p of PASTAS) {
  if (!fs.existsSync(p)) continue;
  for (const nome of fs.readdirSync(p)) {
    if (/\.jsx?$/.test(nome)) ficheiros.push(path.join(p, nome));
  }
}

// O que realmente parte o build nao e' `t()` em JSX — e' o PADRAO que o
// tradutor deixou: `{t("...")` onde o `{` foi posto no sitio errado.
//
// Os dois casos que quebram:
//   1) ternario:  cond ? t("A") : {t("B")}   → o `: {t(...)}` e' invalido
//   2) chamada com objecto: setMsg({t("X")})  → as chaves nao sao de JSX
//
// Procuro o `{` seguido de `t("` QUANDO NAO esta' em posicao de JSX, o que se
// descobre olhando o que ha' atras: em JSX o `{` vem depois de `>`, `}`, `(` de
// atributo, ou no inicio. A regra pratica: se o que vem antes do `{` nao
// termina em `>`, `}`, ou espacos depois de `>`, e' codigo.
const suspeitas = [];
for (const rel of ficheiros) {
  const linhas = fs.readFileSync(rel, "utf8").split(/\r?\n/);
  linhas.forEach((linha, i) => {
    // `: {t(` e' o caso do ternario partido.
    if (/:\s*\{t\(/.test(linha)) {
      suspeitas.push({ rel, linha: i + 1, texto: linha.trim().slice(0, 100), why: "ternario" });
      return;
    }
    // `({t(` — chamada cujo argumento comecou por chave.
    if (/\(\s*\{t\(/.test(linha)) {
      suspeitas.push({ rel, linha: i + 1, texto: linha.trim().slice(0, 100), why: "argumento" });
      return;
    }
    // `setMsg({ t("` com o `{` separado.
    if (/\(\{\s*t\(/.test(linha)) {
      suspeitas.push({ rel, linha: i + 1, texto: linha.trim().slice(0, 100), why: "argumento" });
    }
  });
}

if (!suspeitas.length) {
  console.log("  nenhum t() partido");
} else {
  console.log("  " + suspeitas.length + " linhas com t() partido:");
  for (const s of suspeitas) {
    console.log("    " + s.rel + " L" + s.linha + " (" + s.why + "): " + s.texto);
  }
}
process.exit(suspeitas.length ? 1 : 0);