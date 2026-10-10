// Extrai as mensagens de erro que o SERVIDOR manda ao frontend.
//
// Estas nao passam por `t()`: o servidor nao sabe o idioma do pedido, e por isso
// responde sempre em portugues. A traducao acontece no cliente, onde o `t()`
// existe — e a chave e' a propria mensagem do servidor, o mesmo principio de
// todo o resto do i18n.
//
// So' interessa o que o utilizador VE. As entradas como `notfound` ou `self`
// sao codigos internos: o servidor converte-as numa frase antes de responder
// (ver `comments.js` e `social.js`), e por isso nao entram aqui.
//
// COMO CORRER: node scripts/extrair-erros-servidor.cjs
const fs = require("node:fs");
const path = require("node:path");

const PASTAS = ["server/src"];
const ficheiros = [];
(function anda(dir) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) anda(p);
    else if (/\.js$/.test(nome)) ficheiros.push(p);
  }
})(PASTAS[0]);

// Palavras que indicam um codigo interno e nao uma frase para o utilizador.
const CODIGO_INTERNO = /^(notfound|self|empty|long|forbidden|parent|off|already)$/i;

const achadas = new Map(); // mensagem -> {ficheiros:Set, linhas:Set}

for (const rel of ficheiros) {
  const linhas = fs.readFileSync(rel, "utf8").split(/\r?\n/);

  // 1) `{ error: "..." }` nos corpos de resposta
  linhas.forEach((linha, i) => {
    for (const m of linha.matchAll(/error:\s*"([^"]{3,140})"/g)) {
      regista(m[1], rel, i + 1);
    }
  });

  // 2) `httpError(400, "...")` e `httpError(404, "...")`
  linhas.forEach((linha, i) => {
    for (const m of linha.matchAll(/httpError\(\s*\d+\s*,\s*"([^"]{3,140})"/g)) {
      regista(m[1], rel, i + 1);
    }
  });

  function regista(texto, ficheiro, linha) {
    const t = texto.trim();
    // Filtros: o que nao e' para o utilizador ver.
    if (CODIGO_INTERNO.test(t)) return;
    if (/^\x1b|\[\d+m/.test(t)) return;                    // cor de consola
    if (/^[a-z_]+$/.test(t)) return;                       // identificador solto
    if (!/\s/.test(t)) return;                             // palavra unica sem espaco
    if (/^[.\/\\]/.test(t)) return;                        // caminho
    if (t.length > 120) return;                            // demasiado longo: nao e' mensagem
    if (!achadas.has(t)) achadas.set(t, { ficheiros: new Set(), linhas: new Set() });
    achadas.get(t).ficheiros.add(ficheiro);
    achadas.get(t).linhas.add(linha);
  }
}

// Ordena: primeiro as de auth/registo (as que mais se veem), depois por
// frequencia.
const lista = [...achadas.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt"));

for (const [msg, { ficheiros: fs2, linhas }] of lista) {
  const onde = [...linhas].sort((a, b) => a - b)[0];
  console.log(String(onde).padStart(5) + "  " + path.basename([...fs2][0]) + "  " + msg);
}
console.log("");
console.log("  " + lista.length + " mensagens de erro do servidor");