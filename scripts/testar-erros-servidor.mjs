// Testa que as mensagens de erro do SERVIDOR tem traducao.
//
// PORQUE ISTO E' UM TESTE E NAO UMA CONVERSA: o servidor responde sempre em
// portugues (nao sabe o idioma do pedido), e a traducao acontece no cliente, com
// a CHAVE = a propria mensagem. Isso torna o mecanismo barato, mas tambem
// fragil: se alguem mudar uma palavra numa mensagem do servidor, a traducao
// deixa de bater certo — e nao da erro nenhum, a pessoa ve o erro em portugues
// e pronto. E' a mesma razao do `testar-i18n.mjs` existir.
//
// Este teste fecha esse buraco: le as mensagens do servidor do codigo-fonte (que
// e' a fonte de verdade) e confirma que cada uma tem traducao no ingles.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let n = 0, mau = 0;
function ok(rotulo, cond, extra = "") {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo + (extra ? "  ->  " + extra : "")); }
}

const { DICIONARIO, IDIOMAS } = await import(
  "file://" + path.join(RAIZ, "web/src/i18n/traducoes.js").replace(/\\/g, "/")
);

/* ---------- 1) Extrai as mensagens do servidor ---------- */

const CODIGO_INTERNO = /^(notfound|self|empty|long|forbidden|parent|off|already)$/i;

function mensagensDoServidor() {
  const achadas = new Map();
  const andar = (dir) => {
    for (const nome of fs.readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (fs.statSync(p).isDirectory()) andar(p);
      else if (/\.js$/.test(nome)) {
        const linhas = fs.readFileSync(p, "utf8").split(/\r?\n/);
        linhas.forEach((linha, i) => {
          for (const m of linha.matchAll(/error:\s*"([^"]{3,140})"/g)) regista(m[1], p, i + 1);
          for (const m of linha.matchAll(/httpError\(\s*\d+\s*,\s*"([^"]{3,140})"/g)) {
            regista(m[1], p, i + 1);
          }
          function regista(texto, ficheiro, linha) {
            const t = texto.trim();
            // O que NAO aparece ao utilizador: codigos internos (o servidor
            // converte-os noutra mensagem), cor de consola, caminhos, e o que
            // so' o developer ve (falta um parametro).
            if (CODIGO_INTERNO.test(t)) return;
            if (/^\x1b|\[\d+m/.test(t)) return;
            if (/^[a-z_]+$/.test(t)) return;
            if (!/\s/.test(t)) return;
            if (/^[.\/\\]/.test(t)) return;
            if (t.length > 120) return;
            // As de "falta <parametro>" so' chegam ao developer: um cliente
            // nunca as ve porque a chamada e' do proprio site.
            if (/^faltam? /.test(t)) return;
            // Campos `error` que nao sao mensagens de erro HTTP, mas estado
            // interno que vai para o log e para o painel de providers (ver
            // `providerHealth.js`). Nao chegam nunca ao utilizador como erro.
            if (t === "certificado (ignorado)") return;
            if (!achadas.has(t)) achadas.set(t, { ficheiro: path.basename(ficheiro), linha });
          }
        });
      }
    }
  };
  andar(path.join(RAIZ, "server/src"));
  return achadas;
}

const mensagens = mensagensDoServidor();

ok("o extractor encontra mensagens do servidor", mensagens.size > 20, `apenas ${mensagens.size}`);

/* ---------- 2) Todas as que o utilizador ve tem traducao ---------- */

const semTraducao = [];
for (const [msg, { ficheiro, linha }] of mensagens) {
  for (const lang of IDIOMAS) {
    if (lang === "pt") continue;
    if (!(msg in (DICIONARIO[lang] || {}))) {
      semTraducao.push({ msg, lang, ficheiro, linha });
    }
  }
}

ok(
  "toda a mensagem do servidor tem traducao",
  semTraducao.length === 0,
  semTraducao.length
    ? semTraducao
        .slice(0, 6)
        .map((x) => `${x.msg} (${x.ficheiro}:${x.linha})`)
        .join(" | ")
    : ""
);

console.log("  (" + mensagens.size + " mensagens de erro do servidor, todas com traducao)");

/* ---------- 3) A traducao tem de mudar mesmo o texto ---------- */

// Uma traducao que devolve o portugues nao traduz nada. Salvo os nomes
// proprios e as mensagens que sao tecnicas.
const IGUAIS = new Set(["Room e client sao obrigatorios."]);
const semMudanca = [];
for (const msg of mensagens.keys()) {
  if (IGUAIS.has(msg)) continue;
  for (const lang of IDIOMAS) {
    if (lang === "pt") continue;
    const v = DICIONARIO[lang]?.[msg];
    if (v !== undefined && v === DICIONARIO.pt?.[msg]) semMudanca.push(msg);
  }
}

ok(
  "as mensagens do servidor mudam mesmo no ingles",
  semMudanca.length === 0,
  semMudanca.length ? semMudanca.slice(0, 5).join(" | ") : ""
);

/* ---------- 4) O cliente traduz mesmo ---------- */

// O `handle()` do `api/client.js` e' o que traduz. Confirma-se que ele chama a
// funcao de traducao — se alguem a removesse, a interface voltava a Portugues
// sem erro nenhum.
const client = fs.readFileSync(path.join(RAIZ, "web/src/api/client.js"), "utf8");
ok("o cliente importa a funcao de traducao", client.includes("traduzir.js"));
ok("o cliente traduz a mensagem do servidor", /traduzir\(body\.error/.test(client));
ok(
  "o cliente so' traduz quando o idioma nao e' portugues",
  /lang !== "pt"/.test(client),
  "sem esta guarda, o portugues ia passar pelo dicionario"
);

/* ---------- 5) O contexto e o cliente usam a MESMA funcao ---------- */

// Duas copias da funcao divergem sem dar erro: uma pode ter um bug que a outra
// nao tem, e o `t()` e a traducao do erro dao resultados diferentes para o
// mesmo texto.
const ctx = fs.readFileSync(path.join(RAIZ, "web/src/i18n/I18nContext.jsx"), "utf8");
ok(
  "o I18nContext importa a funcao partilhada (nao a reimplementa)",
  ctx.includes('from "./traduzir.js"'),
  "se reimplementar, os dois lados podem divergir sem erro"
);

console.log("");
console.log(mau === 0 ? "  " + n + " verificacoes, todas OK" : "  " + n + " ok, " + mau + " FALHAS");
process.exit(mau === 0 ? 0 : 1);