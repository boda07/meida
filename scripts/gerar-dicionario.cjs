// Gera as entradas do dicionario (PT + EN) a partir de um ficheiro de pares,
// e insere-as no bloco certo de `traducoes.js`.
//
// Porquê um script: o dicionario tem de ter a MESMA chave nos dois idiomas, e
// escrever 300 linhas a mao e' onde nasce a chave divergente. Aqui a chave vem
// do ficheiro, por construcao bate.
//
// COMO CORRER:
//   node scripts/gerar-dicionario.cjs <ficheiro-de-pares.txt> [secao]
//     secao = um comentario que identifica o bloco (ex.: "definicoes")
const fs = require("node:fs");

const [, , ficheiroPares, secao] = process.argv;
if (!ficheiroPares) {
  console.error("uso: node scripts/gerar-dicionario.cjs <pares.txt> [secao]");
  process.exit(1);
}

const DICCIONARIO = "web/src/i18n/traducoes.js";
const linhas = fs.readFileSync(ficheiroPares, "utf8").split(/\r?\n/);

const pares = [];
for (const l of linhas) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("|||");
  if (i < 0) continue;
  pares.push({ pt: t.slice(0, i), en: t.slice(i + 3) });
}

// Verifica que nao ha chaves repetidas no ficheiro de pares.
const vistas = new Set();
const repetidas = pares.filter((p) => vistas.has(p.pt) ? true : (vistas.add(p.pt), false));
if (repetidas.length) {
  console.log("  AVISO: chaves repetidas no ficheiro de pares: " + [...new Set(repetidas.map(r=>r.pt))].join(" | "));
}

let dic = fs.readFileSync(DICCIONARIO, "utf8");

// Onde inserir: antes do fecho do bloco `pt` e do bloco `en`.
function blocoDe(idioma) {
  const i = dic.indexOf("  " + idioma + ": {");
  if (i < 0) throw new Error("nao achei o bloco " + idioma);
  const fecha = dic.indexOf("\n  },", i);
  return { inicio: i, fecha };
}

const comentario = secao ? "\n    // --- " + secao + " ---" : "";

for (const idioma of ["pt", "en"]) {
  const b = blocoDe(idioma);
  const dentro = dic.slice(b.inicio, b.fecha);
  const jaTem = new Set();
  for (const x of dentro.matchAll(/^\s*["']((?:[^"'\\]|\\.)*)["']\s*:/gm)) jaTem.add(x[1]);

  const novos = pares.filter((p) => !jaTem.has(p.pt));
  if (!novos.length) continue;

  const corpo = novos
    .map((p) => {
      const valor = idioma === "pt" ? p.pt : p.en;
      // A chave NUNCA pode ser partida ao meio: uma quebra parte a linha no
      // ponto errado e o `:` fica na linha seguinte, o que e' sintaxe invalida.
      // Se a linha for longa, parte-se o VALOR (que e' uma string, pode ter
      // quebra dentro), nunca a chave.
      const k = JSON.stringify(p.pt);
      const v = JSON.stringify(valor);
      const linha = `    ${k}: ${v},`;
      if (linha.length <= 82) return linha;
      return `    ${k}:\n      ${v},`;
    })
    .join("\n");

  dic = dic.slice(0, b.fecha) + (comentario || "") + "\n" + corpo + dic.slice(b.fecha);
  console.log(`  ${novos.length} entradas novas em "${idioma}"${secao ? " (" + secao + ")" : ""}`);
}

fs.writeFileSync(DICCIONARIO, dic);
console.log("  dicionario actualizado");