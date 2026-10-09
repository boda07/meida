// Testa a logica das @mencoes (web/src/lib/mencoes.js) sem React e sem browser.
//
// E' a parte com regras, e regras mal feitas aqui dão o pior tipo de bug: um
// "a@b.com" numa mensagem vira notificacao para um sitio, ou o "@" nunca abre a
// lista e a pessoa desiste. Por isso esta logica esta num ficheiro separado, sem
// React, e e' testada.
import { mencaoEmCurso, insereMencao, pedacosComMencoes, porPrioridade } from "../web/src/lib/mencoes.js";
// A versao que o SERVIDOR usa. Sao duas implementacoes das mesmas regras, com
// trabalhos diferentes (a do web e' sobre o cursor, a do servidor e' sobre o
// texto todo), e por isso as regras tem de concordar: se o servidor tratasse
// "a@b.com" como mencao e o frontend nao, aparecia uma notificacao a partir de um
// "@" que a interface nunca mostrou.
//
// Estao em ficheiros diferentes porque o servidor e' um pacote separado e no
// pacote instalado nao existe `resources/web/src` — o `store.js` nao conseguia
// importar do `web/`. A secção 4 deste teste e' que impede que voltem a divergir
// em silencio.
import { usernamesMencionados } from "../server/src/services/mencoes.js";

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}
const q = (t, c) => mencaoEmCurso(t, c);

// ---- 1) Quando e' que a lista abre -----------------------------------------------
ok("no inicio da linha", q("@", 1)?.query === "");
ok("a meio de uma palavra escrita", q("@an", 3)?.query === "an");
ok("depois de um espaco", q("olá @an", 7)?.query === "an");
ok("depois de virgula", q("olá, @an", 8)?.query === "an");
ok("depois de ponto-e-virgula", q("olá; @an", 8)?.query === "an");
ok("so o '@' ainda nao filtra nada", q("olá @", 5)?.query === "");

// ---- 2) Quando NAO pode abrir (os falsos positivos que importam) -----------------
ok("endereco de email nao e' mencao", q("a@b.com", 7) === null);
ok("arroba a meio de palavra nao e' mencao", q("ola@ana", 7) === null);
ok("username a comecar por ponto nao vale", q("@.oculto", 8) === null);
ok("espaco no meio acaba a mencao", q("@ana ana", 8) === null);
ok("cursor longe do '@' nao da' nada", q("@ana e mais texto aqui", 20) === null);
ok("texto vazio", q("", 0) === null);
// Cursor no inicio nao ha '@' antes dele, logo nao ha mencao em curso. O `Math.max(0, ...)`
// e' o que impede o loop de partir para indices negativos.
ok("cursor no inicio nao ha mencao em curso", q("@a", 0) === null);
ok("cursor negativo e' seguro (nao parte)", q("@a", -5) === null);

// ---- 3) O que se insere ------------------------------------------------------------
const i1 = insereMencao("olá @an", 7, "ana");
ok("insere o nome completo", i1.texto === "olá @ana ");
ok("deixa o cursor depois do espaco", i1.cursor === 9);

const i2 = insereMencao("olá @ana e @br", 14, "bruno");
ok("substitui so a mencao em curso, mantendo o resto", i2.texto === "olá @ana e @bruno ");

const i3 = insereMencao("@an", 3, "ana");
ok("funciona tambem no inicio", i3.texto === "@ana ");

// ---- 4) Quem foi mencionado -------------------------------------------------------
ok("uma mencao", usernamesMencionados("olá @ana").join() === "ana");
ok("varias, pela ordem", usernamesMencionados("@ana e @bruno e @carlos").join() === "ana,bruno,carlos");
ok("a mesma pessoa so conta uma vez", usernamesMencionados("@ana e @ana outra vez").join() === "ana");
ok("email nao conta", usernamesMencionados("manda para a@b.com").length === 0);
ok("arroba a meio de palavra nao conta", usernamesMencionados("ola@ana").length === 0);
ok("sem arroba nao ha mencoes", usernamesMencionados("so texto").length === 0);
ok("username com ponto e hifen", usernamesMencionados("olá @joao.silva-2").join() === "joao.silva-2");
// Um ponto no fim e' pontuacao, nao parte do nome: "@ana." deve notificar a "ana".
ok("ponto final e' pontuacao, nao parte do nome", usernamesMencionados("olá @ana.").join() === "ana");
ok("varios pontos finais tambem sao pontuacao", usernamesMencionados("olá @ana...").join() === "ana");
// O ponto NO MEIO do nome faz parte dele.
ok("ponto a meio do nome faz parte", usernamesMencionados("olá @joao.silva").join() === "joao.silva");
ok("virgula final tambem", usernamesMencionados("olá @ana,").join() === "ana");
ok("aspas final tambem", usernamesMencionados('olá "@ana"').join() === "ana");

// ---- 5) Como se desenha -------------------------------------------------------------
const p1 = pedacosComMencoes("olá @ana!");
ok("texto antes da mencao", p1[0].tipo === "texto" && p1[0].texto === "olá ");
ok("a mencao e' um pedaco proprio", p1[1].tipo === "mencao" && p1[1].texto === "ana");
ok("texto depois da mencao, com a pontuacao", p1[2].tipo === "texto" && p1[2].texto === "!");

const p2 = pedacosComMencoes("sem mencao nenhuma");
ok("texto sem mencoes fica num so pedaco", p2.length === 1 && p2[0].tipo === "texto");

const p3 = pedacosComMencoes("@ana e @bruno");
ok("duas mencoes em cadeia", p3.filter((x) => x.tipo === "mencao").length === 2);

// Nao pode perder nem um caractere, ou o texto muda.
const frase = "olá @ana! e @bruno, mais nada";
const reconstruido = pedacosComMencoes(frase).map((x) => (x.tipo === "mencao" ? "@" + x.texto : x.texto)).join("");
ok("a volta ao texto original da exactamente o que estava escrito", reconstruido === frase);

const frase2 = "email a@b.com e mencao @joao.silva-2.";
ok("tambem com email e nome com ponto", pedacosComMencoes(frase2).map((x) => (x.tipo === "mencao" ? "@" + x.texto : x.texto)).join("") === frase2);

ok("texto vazio nao da' pedacos", pedacosComMencoes("").length === 0);

// ---- 6) Ordem das sugestoes: quem esta ligado connosco primeiro --------------------
// A ordem dentro de cada grupo e' a do servidor (e' ele que sabe quem comeca
// por "an"), por isso o que se testa aqui e' so quem sobe, nao a posicao interna.
const pessoas = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
ok("os ligados sobem, mantendo a ordem do servidor", porPrioridade(pessoas, new Set([3, 1])).map((x) => x.id).join() === "1,3,2,4");
ok("aceita um array em vez de Set", porPrioridade(pessoas, [2]).map((x) => x.id).join() === "2,1,3,4");
ok("ninguem ligado mantem a ordem", porPrioridade(pessoas, []).map((x) => x.id).join() === "1,2,3,4");
ok("lista vazia da' lista vazia", porPrioridade([], new Set([1])).length === 0);
ok("ids como texto tambem contam", porPrioridade(pessoas, new Set(["2"])).map((x) => x.id).join() === "2,1,3,4");

// ---- 7) O frontend e o servidor tem de concordar ----------------------------------
// O `mencaoEmCurso` (web) diz o que a pessoa esta a escrever no cursor; o
// `usernamesMencionados` (servidor) diz a quem notificar. Se discordarem sobre o
// que e' uma mencao, aparece uma notificacao a partir de um "@" que a interface
// nunca mostrou.
//
// A verificacao e': para cada nome que o SERVIDOR extrai, o frontend tinha de
// oferecer exactamente esse nome no mesmo sitio. E' o que apanha o caso perigoso
// (servidor a notificar por um "@" que a interface nao mostrou).
const { mencaoEmCurso: webDetecta } = await import("../web/src/lib/mencoes.js");
const CASOS = [
  "olá @ana",
  "olá @ana,",
  "olá @ana!",
  '"@ana"',
  "@ana @bento e @ana outra vez",
  "@ana e mais texto",
  "email a@b.com",
  "ola@ana",
  "@.ana",
  "sem mencao",
  "@joao.silva-2 chegou",
  "@ana: e @bento;",
];

// Onde esta cada "@" que o servidor reconheceu, e que nome ele extraiu.
function extracoes(frase) {
  const fora = [];
  const re = /(^|[\s,.;:!?()[\]{}"'])(@)([A-Za-z0-9][A-Za-z0-9._-]{0,39})/g;
  let m;
  while ((m = re.exec(frase)) !== null) {
    let nome = m[3];
    while (nome.endsWith(".")) nome = nome.slice(0, -1);
    if (nome) fora.push({ nome, inicio: m.index + m[1].length });
  }
  return fora;
}

for (const frase of CASOS) {
  const nomes = usernamesMencionados(frase);
  const sitios = extracoes(frase);
  const bate = nomes.every((nome) => {
    const s = sitios.find((x) => x.nome === nome);
    if (!s) return false;
    // Com o cursor no fim do nome, o frontend tem de estar a escrever
    // exactamente esse nome.
    const m = webDetecta(frase, s.inicio + 1 + nome.length);
    return Boolean(m) && m.query === nome && m.start === s.inicio;
  });
  ok(`"${frase}" -> o frontend oferece o mesmo que o servidor notifica (servidor: [${nomes.join(", ")}])`, bate);
}

// O caso inverso, que e' o mesmo erro visto pelo outro lado: o frontend a
// oferecer um "@" onde o servidor nao ve nome nenhum.
const semResposta = [
  ["a@b.com", "email"],
  ["ola@ana", "arroba colado a uma palavra"],
  ["@.ana", "username a comecar por ponto"],
];
for (const [frase, porque] of semResposta) {
  const m = webDetecta(frase, frase.length);
  ok(`o frontend NAO oferece "@" em ${porque} ("${frase}")`, !m);
}

// Diferenca conhecida e aceitavel: um ponto no fim e' pontuacao para o servidor
// ("@ana." -> ana) mas o frontend, com o cursor depois do ponto, filtra por
// "ana." e nao encontra ninguem. Nao e' bug — a lista simplesmente aparece vazia e
// a pessoa escreve o "@" outra vez. O teste fixa-o para que, se um dia mudar, se
// saiba porque.
const comPonto = usernamesMencionados("olá @ana.");
ok("o servidor corta o ponto final do nome", comPonto.join() === "ana");
// Cursor logo depois do nome (antes do ponto): o frontend mostra o nome certo.
ok("com o cursor antes do ponto, o frontend mostra 'ana'",
  webDetecta("olá @ana.", 8)?.query === "ana");
// Cursor depois do ponto: a lista fica vazia. Diferenca conhecida.
ok("com o cursor depois do ponto, o frontend filtra por 'ana.' (lista vazia)",
  webDetecta("olá @ana.", 9)?.query === "ana.");

console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);
