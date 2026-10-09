// O botao "Responder" das respostas nao fazia nada.
//
// Reportado a 2026-10-09: "nao da' para responder a respostas do meu
// comentario". O bug tinha duas metades, uma em cada ficheiro:
//
//   server/src/store.js  — `parentId = p.parent_id ?? p.id` achatava a resposta
//                          na raiz. Sem ecra, sem erro: o comentario era gravado
//                          na mesma, so' no sitio errado.
//   web/src/.../Comments.jsx — o FORMULARIO so' era desenhado ao nivel de topo.
//                          O botao "Responder" aparecia em todos os niveis
//                          (esta dentro de `CommentItem`, que e' recursivo), e
//                          clicar nele punha `replyTo` a um id que nao estava em
//                          lado nenhum do JSX. Nao aparecia nada, nao havia erro,
//                          e nao havia como dar pelo erro pelo caminho.
//
// A segunda metade e' a que este ficheiro apanha. A primeira esta em
// `server/test/store.test.js` ("fio de respostas: fundo sem limite"), porque
// essa corre mesmo e da' para testar de verdade.
//
//porque nao se renderiza o componente: nao ha jsdom nem testing-library no
// `web/package.json` (verificado), e instalar isso so para isto seria levar
// dependencias a mais para um bug de um botao. O que este teste faz e' ler o
// ficheiro e confirmar a ligacao: que o formulario esta DENTRO de `CommentItem`
// (e nao no `comments.map` de fora, que era onde nao chegava), que recebe o
// `replyTo` para se saber a que comentario responde, e que o `parent` desce
// pela recursao para a citacao. Um teste de codigo-fonte nao substitui clicar
// no botao — substitui o que nao apanha: voltar a pôr o formulario no sitio
// errado, que e' como o bug voltou pela segunda vez se voltasse.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FICHEIRO = join("web", "src", "components", "Comments.jsx");
const fonte = readFileSync(FICHEIRO, "utf8");
const linhas = fonte.split(/\r?\n/);

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}

/**
 * O bloco que comeca na linha com `abre` e acaba na linha que for exactamente
 * `}`. Exactamente, e nao "contem": dentro do CommentItem ha meia duzia de
 * linhas com um `}` no fim (`{aResponder && user && (`) e nao pode ser uma
 * delas.
 * @returns {{a:number, b:number, texto:string}|null}
 */
function bloco(abre, fecha) {
  const a = linhas.findIndex((l) => l.includes(abre));
  if (a < 0) return null;
  const alvo = fecha === "}" ? (l) => l.trim() === "}" : (l) => l.includes(fecha);
  const b = linhas.findIndex((l, i) => i > a && alvo(l));
  if (b < 0) return null;
  return { a, b, texto: linhas.slice(a, b + 1).join("\n") };
}

const item = bloco("function CommentItem({", "}");
const lista = bloco("<ul className=\"comment-list\">", "</ul>");

ok("Comments.jsx foi lido", linhas.length > 100);
ok("encontrei o CommentItem", Boolean(item));
ok("encontrei a lista de topo", Boolean(lista));

if (item && lista) {
  // 1) O FORMULARIO tem de estar dentro do CommentItem. Estar no `comments.map`
  //    era o bug: o `CommentItem` desenha as respostas recursivamente, mas o
  //    formulario vivia ao lado do comentario de topo, e por isso nunca era
  //    desenhado para uma resposta.
  ok(
    "o formulario de resposta esta dentro do CommentItem (e nao so' no topo)",
    item.texto.includes('className="comment-reply-form"')
  );

  // 2) O CommentItem tem de saber QUAL comentario esta a ser respondido. Sem
  //    `replyTo` recebido por prop, nao ha como ligar `c.id` ao formulario.
  ok("o CommentItem recebe replyTo", /replyTo[,}]/.test(item.texto) && item.texto.includes("replyTo === c.id"));
  ok("o formulario so' aparece no comentario certo", item.texto.includes("replyTo === c.id"));

  // 3) E o `replyTo` tem de chegar ao CommentItem de topo, no `comments.map`.
  ok(
    "o `comments.map` passa o replyTo ao CommentItem",
    lista.texto.includes("replyTo={replyTo}")
  );
  ok(
    "e passa tambem o corpo e quem submete",
    lista.texto.includes("replyBody={replyBody}") &&
      lista.texto.includes("onSubmitReply={submitReply}")
  );

  // 4) A recursao tem de descer com `parent`, para a citacao saber a quem se
  //    responde, e com `nivel`, para a indentacao poder parar. A chamada vai em
  //    varias linhas, por isso da-se a tag E o fecho — ver so a linha da tag
  //    daria sempre falso.
  const dentro = linhas.slice(item.a, item.b + 1);
  const tag = dentro.findIndex((l) => l.includes("<CommentItem"));
  const fecho = dentro.findIndex((l, i) => i > tag && l.includes("/>"));
  const recursao = tag >= 0 && fecho > tag ? dentro.slice(tag, fecho + 1).join("\n") : "";
  ok("a recursao passa o pai a resposta", recursao.includes("parent={c}"));
  ok("a recursao conta o nivel", recursao.includes("nivel={nivel + 1}"));
  ok(
    "a recursao tambem desce com o estado do formulario",
    recursao.includes("replyTo={replyTo}") && recursao.includes("onSubmitReply={onSubmitReply}")
  );

  // 5) O `nivel` tem de chegar ao CommentItem de topo, senao comeca sempre a 0
  //    e a indentacao nunca conta.
  ok("o `comments.map` diz o nivel de topo", lista.texto.includes("nivel={0}"));

  // 6) A citacao: e' ela que diz a quem se responde quando a indentacao ja
  //    parou. Sem ela, um fio de seis respostas e' texto sem contexto.
  ok("a resposta cita quem esta a responder", item.texto.includes("comment-cita") && item.texto.includes("parent.author.username"));
  ok("a citacao liga ao comentario do pai", item.texto.includes("#comentario-${parent.id}"));

  // 7) O botao "Responder" tem de existir em TODOS os niveis. Vive dentro do
  //    `CommentItem`, que e' o componente recursivo — e nao de fora dele, que
  //    era onde nao chegava as respostas.
  ok('o botao "Responder" esta dentro do CommentItem', item.texto.includes('onClick={() => onReply(c.id)}'));
}

// 8) O store tem de gravar o pai verdadeiro. Nao e' o mesmo ficheiro, mas e' a
//    outra metade do bug e nao ha outro sitio onde ela possa estar.
const store = readFileSync(join("server", "src", "store.js"), "utf8");
ok(
  "o store nao achata mais a resposta na raiz",
  !/parentId\s*=\s*\w+\.parent_id\s*\?\?/.test(store)
);

console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);