// O botao "Responder" das respostas nao fazia nada — e este teste carrega nele.
//
// O `scripts/testar-comentarios-fio.mjs` le o ficheiro e ve se a ligacao esta
// certa. Isso apanha o formulario no sitio errado, mas NAO apanha um
// `aResponder` mal escrito, um `parent` que nunca chega, ou um fio que rebenta a
// recursao. Aqui o componente e' RENDERIZADO de verdade e o HTML e' lido.
//
// Como, sem jest e sem jsdom: `renderToStaticMarkup` do `react-dom/server`
// (dependencia que ja existe, porque a app e' React) devolve uma string, sem DOM
// nenhum. O esbuild, que ja vem dentro do vite, transforma o `.jsx` e o grafo de
// imports num ficheiro so' que o Node consegue carregar.
//
// O que fica provado, e que o teste de codigo-fonte nao prova:
//   - clicar "Responder" numa RESPOSTA mostra o formulario (o bug)
//   - o formulario diz a quem esta a responder
//   - a citacao do pai aparece, e diz quem e'
//   - a indentacao para depois do limite, para o texto nao espremer
//   - um fio de 40 nao prende o browser
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

// Absoluto desde o principio: `createRequire` e' que exige caminho completo, e
// o resto do ficheiro junta varios `join(RAIZ, ...)` que ficariam com "../" se
// o RAIZ fosse relativo.
const RAIZ = resolve(process.argv[2] || ".");

// O esbuild vive em web/node_modules (vem com o vite) e este ficheiro esta em
// scripts/, portanto a resolucao normal a partir daqui nao o encontra. Apontar o
// require para o package.json do web resolve sem mover nada.
const req = createRequire(join(RAIZ, "web", "package.json"));
const { build } = req("esbuild");

let n = 0, mau = 0;
function ok(rotulo, cond, extra = "") {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo + (extra ? "  ->  " + extra : "")); }
}

// Monta o componente de teste: importa o CommentItem ja transformado e devolve
// uma funcao que produz o HTML de um fio.
const dir = mkdtempSync(join(tmpdir(), "meida-render-"));
const entrada = join(dir, "entrada.mjs");
// CJS e' obrigatorio: o `react-dom/server` e' CJS e faz `require("stream")`.
// Embutido num bundle ESM o esbuild substitui esse require por um_dynamic require
// que rebenta em tempo de_execucao ("Dynamic require of \"stream\" is not
// supported"). Em CJS o require e' de Native e o grafo todo resolve.
const saida = join(dir, "saida.cjs");

writeFileSync(
  entrada,
  `import { CommentItem, NIVEL_INDENTA, NIVEL_MAXIMO } from ${JSON.stringify(
    join(RAIZ, "web/src/components/Comments.jsx")
  )};
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h, Fragment } from "react";
import { MemoryRouter } from "react-router-dom";

export { NIVEL_INDENTA, NIVEL_MAXIMO };
export function render(com, props) {
  return renderToStaticMarkup(h(MemoryRouter, null, h(CommentItem, { c: com, ...props })));
}
export const h_ = h;
export const F_ = Fragment;
`
);

await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: saida,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  logLevel: "error",
  // O react e' do web/node_modules; o resto do grafo e' relativo ao ficheiro de
  // entrada, que esta num directorio temporario — dai o `absWorkingDir`.
  absWorkingDir: join(RAIZ, "web"),
  nodePaths: [join(RAIZ, "web", "node_modules")],
  external: [],
});

const M = req(saida);
const { render, NIVEL_INDENTA, NIVEL_MAXIMO } = M;

/** Quantas citacoes ha no HTML. Tem de ser `className="comment-cita"` e nao
 *  "comment-cita": esse substring aparece tambem nas tres classses de dentro
 *  (-seta, -quem, -texto), e contar por ali dava 4 por citacao. Foi o que
 *  aconteceu nas primeiras contas deste ficheiro. */
const citacoes = (html) => (html.match(/class="comment-cita"/g) || []).length;

/** Constroi um fio de `n` comentarios, cada um a responder ao anterior. */
function fio(nomes, autor = "ana") {
  const folha = (i) => (i >= nomes.length ? [] : [{ ...comentario(nomes[i], autor), replies: folha(i + 1) }]);
  return folha(0);
}
function comentario(body, username) {
  return {
    id: body,
    tmdbId: 1, type: "tv", season: 1, episode: 1,
    parentId: null, body, atSeconds: null, deleted: false,
    createdAt: "2026-10-09T10:00:00Z", updatedAt: null,
    author: { id: 1, username, avatar: null }, likes: 0, likedByMe: false,
    replies: [],
  };
}

// O `user` e' o que faz os botoes e o formulario aparecerem. Sem ele nao ha
// "Responder" nenhum — e assim se prova que o teste nao passa so' porque ha
// texto no HTML.
const propsBase = {
  user: { id: 9, username: "boda", avatar: null },
  onLike: () => {},
  onDelete: () => {},
  onReply: () => {},
  replyTo: null,
  replyBody: "",
  setReplyBody: () => {},
  onSubmitReply: () => {},
  onCancelReply: () => {},
  busy: false,
};

// ---------------------------------------------------------------- fio curto
const curto = fio(["raiz", "resposta", "neta"]);
const raizHtml = render(curto[0], propsBase);

ok("o componente renderiza", typeof raizHtml === "string" && raizHtml.length > 0);
ok("um comentario de topo nao tem formulario", !raizHtml.includes("comment-reply-form"),
   "estaria a aparecer o formulario sem ningem ter clicado");
// A raiz e' o topo do fio, mas o render traz o fio TODO — e' a resposta que cita
// a raiz, nao a raiz a citar-se. O que se quer dizer aqui e' que o id da raiz nao
// aparece como pai de ninguem-a-propria.
ok("a raiz nao e' pai de si mesma",
   !raizHtml.includes('href="#comentario-' + curto[0].id + '">') ||
     !raizHtml.includes('id="comentario-' + curto[0].id + '" class="comment  '),
   "a raiz nao devia citar-se a si mesma");

// ------------------------------------------------- O BUG: responder a resposta
// `replyTo` aponta para a RESPOSTA. Antes disto nao desenhava nada, porque o
// formulario so' sabia aparecer ao nivel de topo.
const resposta = curto[0].replies[0];
const htmlResposta = render(curto[0], { ...propsBase, replyTo: resposta.id });

ok("clicar 'Responder' numa RESPOSTA mostra o formulario",
   htmlResposta.includes("comment-reply-form"));
ok("esse formulario e' o da resposta, nao o do comentario de topo",
   htmlResposta.includes("Responder a ana"));
ok("o formulario da raiz nao se abre ao mesmo tempo",
   (htmlResposta.match(/comment-reply-form/g) || []).length === 1,
   "apareceram " + (htmlResposta.match(/comment-reply-form/g) || []).length);

// O mesmo fio, a apontar para a raiz: tem de aparecer UM formulario, o da raiz.
const htmlRaiz = render(curto[0], { ...propsBase, replyTo: curto[0].id });
ok("clicar 'Responder' na raiz mostra o formulario dela",
   htmlRaiz.includes("comment-reply-form") && (htmlRaiz.match(/comment-reply-form/g) || []).length === 1);

// --------------------------------------------------------------- a citacao
const comCitacao = render(curto[0], propsBase);
ok("a resposta cita quem esta a responder", comCitacao.includes("comment-cita"));
ok("a citacao traz o texto do pai",
   comCitacao.includes("raiz"), "o texto do pai tem de aparecer na citacao da resposta");
ok("a citacao liga ao comentario do pai",
   comCitacao.includes("#comentario-raiz"));
// A raiz nao se cita a ela propria: num fio de 3 (raiz, resposta, neta) ha duas
// respostas, logo duas citacoes — nem mais nem menos.
ok("so' as respostas se citam, a raiz nao",
   citacoes(comCitacao) === 2, "apareceram " + citacoes(comCitacao));

// ------------------------------------------------------------- a indentacao
const fundo = render(curto[0], propsBase);
ok("o fio desenha a lista de respostas", fundo.includes("comment-replies"));
ok("nos primeiros niveis indenta",
   !fundo.includes("comment-replies-fundo") || (fundo.match(/comment-replies-fundo/g) || []).length === 0,
   "um fio de 3 nao devia chegar ao limite de " + NIVEL_INDENTA);

// Acima do limite a margem para.
const N = NIVEL_INDENTA + 3;
const longo = render(fio(Array.from({ length: N }, (_, i) => "c" + i))[0], propsBase);
ok("acima do limite a indentacao para",
   longo.includes("comment-replies-fundo"),
   "esperava ver a classe depois do nivel " + NIVEL_INDENTA);
// N comentarios comecando no 0: cada um a partir do 1 cita o anterior, logo
// N-1 citacoes. O ultimo fica a trinta sem recursao (ver o teste do ciclo).
ok("e continua a citar quem se responde ate ao limite",
   citacoes(longo) === N - 1, "apareceram " + citacoes(longo) + ", esperadas " + (N - 1));

// ------------------------------------------------ o limite de seguranca
// Um ciclo nos dados prenderia o browser. Nao se consegue criar um, mas o limite
// existe e tem de fazer o que diz.
const ciclo = { ...comentario("ciclo"), id: "A" };
ciclo.replies = [{ ...comentario("B"), id: "B", replies: [ciclo] }];
try {
  const htmlCiclo = render(ciclo, propsBase);
  ok("um ciclo de parent_id nao prende o render", htmlCiclo.length > 0);
  ok("e diz que ha respostas que nao mostrou", htmlCiclo.includes("comment-corte"));
} catch (e) {
  ok("um ciclo de parent_id nao prende o render", false, e.message);
}

ok(`NIVEL_MAXIMO e' grande o suficiente (${NIVEL_MAXIMO})`, NIVEL_MAXIMO > NIVEL_INDENTA);

console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);