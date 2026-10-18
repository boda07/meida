// O pedido de ecrã inteiro nunca pode ser engolido.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **Um pedido recusado tem de dar erro visivel. "Nada acontece" nao e' uma resposta
// aceitavel.**
//
// Havia tres codigos quase iguais — `AppFullscreen`, `PlayerControls`,
// `usePlayerShortcuts` — e os tres faziam isto:
//
//     (alvo.requestFullscreen || alvo.webkitRequestFullscreen)?.call(alvo);
//
// O `?.` parece proteger o pedido, mas e' o METODO que esta' a ser testado. A
// promessa que `requestFullscreen()` devolve ia para o lixo: recusada por falta
// de gesto do utilizador, por permissao negada, ou por um `Permissions-Policy`,
// e o unico sintoma era um botao que nao fazia nada. Sem erro na consola, sem
// `fullscreenerror`, sem forma de saber a razao.
//
// E' por isso que o teste foca em duas coisas que um "corrige o botao" normal nao
// garante: que a promessa recusada vira erro LEGIVEL, e que os tres sitios usam o
// modulo em vez do codigo antigo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ecraInteiro } = await import("../web/src/components/ecraInteiro.js");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// Um `document` de mentira, para nao depender de um ecra a serio.
function instalarDocument({ temFullscreen = true, temExit = true, pedidoFalha = null } = {}) {
  let pedidoFeito = 0;
  let exitFeito = 0;
  globalThis.document = {
    fullscreenElement: null,
    exitFullscreen: temExit ? async () => { exitFeito++; globalThis.document.fullscreenElement = null; } : undefined,
  };
  const alvo = {
    requestFullscreen: temFullscreen
      ? async function () {
          pedidoFeito++;
          if (pedidoFalha) throw pedidoFalha;
          globalThis.document.fullscreenElement = alvo;
        }
      : undefined,
  };
  return {
    alvo,
    contas: () => ({ pedidoFeito, exitFeito }),
  };
}

/* ---------- 1) O caminho feliz ---------- */
console.log("");
console.log("  1) entra e sai");
{
  const d = instalarDocument();
  const r = await ecraInteiro(d.alvo);
  ok_("pede o ecrã inteiro", d.contas().pedidoFeito === 1);
  ok_("e devolve ok", r.ok === true && r.erro === null, JSON.stringify(r));

  globalThis.document.fullscreenElement = d.alvo;
  await ecraInteiro(d.alvo);
  ok_("com o fullscreenElement posto, sai em vez de pedir", d.contas().exitFeito === 1);
  ok_("e nao volta a pedir", d.contas().pedidoFeito === 1);
}

/* ---------- 2) A promessa recusada vira erro legivel ---------- */
console.log("");
console.log("  2) o pedido recusado NAO e' engolido");
{
  // O `console.warn` e' parte do que se quer provar (o erro tem de aparecer), mas
  // aqui baralha a leitura da saida. Guarda-se e ve-se que foi chamado.
  const avisos = [];
  const warnOriginal = console.warn;
  console.warn = (...partes) => { avisos.push(partes.join(" ")); };
  try {
  // As tres razoes pelas quais o Chromium recusa, cada uma de um sitio
  // diferente. Se alguma delas voltar a passar em silencio, o botao volta a
  // parecer morto sem ninguem perceber.
  const RAZOES = [
    ["sem gesto do utilizador", Object.assign(new Error("Request for fullscreen was denied because Element.requestFullscreen() was not called from inside a short running user-generated event handler."), { name: "TypeError" })],
    ["permissao negada", Object.assign(new Error("Permissions denied"), { name: "NotAllowedError" })],
    ["politica", Object.assign(new Error("fullscreen is disabled in this document"), { name: "SecurityError" })],
  ];
  for (const [nome, erro] of RAZOES) {
    const d = instalarDocument({ pedidoFalha: erro });
    const r = await ecraInteiro(d.alvo);
    ok_("recusado (" + nome + ") -> ok: false", r.ok === false);
    ok_("  └─ e a razao chega ao consumidor", typeof r.erro === "string" && r.erro.includes(erro.name), String(r.erro));
    ok_("  └─ com a mensagem do browser la dentro", typeof r.erro === "string" && r.erro.length > 20);
  }
  // E o aviso vai para a consola: e' o que o utilizador ve nas DevTools quando
  // o botao "nao faz nada".
  ok_("cada recusa foi avisada na consola", avisos.length === RAZOES.length, avisos.length + " avisos");
  ok_("e o aviso traz a razao", avisos.every((a) => /recusado/.test(a)));
  } finally {
    console.warn = warnOriginal;
  }
}

/* ---------- 3) Nao rebenta quando nao ha nada ---------- */
console.log("");
console.log("  3) os cantos sem ecrã inteiro");
{
  const semMetodo = instalarDocument({ temFullscreen: false });
  let r = await ecraInteiro(semMetodo.alvo);
  ok_("sem requestFullscreen diz isso", r.ok === false && /requestFullscreen/.test(r.erro), JSON.stringify(r));

  const semExit = instalarDocument({ temExit: false });
  globalThis.document.fullscreenElement = semExit.alvo;
  r = await ecraInteiro(semExit.alvo);
  ok_("sem exitFullscreen diz isso", r.ok === false && /exitFullscreen/.test(r.erro), JSON.stringify(r));

  r = await ecraInteiro(null);
  ok_("sem alvo nao rebenta", r.ok === false && r.erro === "sem elemento");
  delete globalThis.document;
  r = await ecraInteiro(null);
  ok_("sem `document` nenhum (SSR/Node) nao rebenta", r.ok === false && r.erro === "sem elemento");
}

/* ---------- 4) Os tres sitios passam pelo modulo ---------- */
// O bug estava nos TRES. Um teste que so olhe para um deixa os outros dois a
// poder voltar ao `?.` que engole a promessa.
console.log("");
console.log("  4) os tres sitios usam o modulo");
{
  const SITIOS = [
    ["web/src/components/AppFullscreen.jsx", "ecraInteiro(document.documentElement)"],
    ["web/src/components/PlayerControls.jsx", "ecraInteiro_(alvo)"],
    ["web/src/components/usePlayerShortcuts.js", "ecraInteiro(container)"],
  ];
  for (const [f, chamada] of SITIOS) {
    const src = fs.readFileSync(path.join(RAIZ, f), "utf8");
    ok_(f.split("/").pop() + " importa o modulo", /from "\.\/ecraInteiro\.js"/.test(src));
    ok_("  └─ e usa-o: " + chamada, src.includes(chamada));
    // O codigo antigo nao pode sobreviver em lado nenhum do ficheiro.
    const antigo = /requestFullscreen \|\| \w+\.webkitRequestFullscreen/.test(src);
    ok_("  └─ e nao sobrou o `?.` que engolia a promessa", !antigo);
  }
}

/* ---------- 5) O Electron cobre os dois lados da permissao ---------- */
console.log("");
console.log("  5) o Electron cobre pedido E consulta");
{
  const main = fs.readFileSync(path.join(RAIZ, "electron/main.cjs"), "utf8");
  ok_("ha setPermissionRequestHandler", /setPermissionRequestHandler/.test(main));
  ok_("e tambem setPermissionCheckHandler", /setPermissionCheckHandler/.test(main));
  ok_("e ha modo de diagnostico (MEIDA_FS_DEBUG)", /MEIDA_FS_DEBUG/.test(main));

  // O Chromium PERGUNTA `automatic-fullscreen` e PEDE `fullscreen` (medido com um
  // clique a serio e MEIDA_FS_DEBUG=1). O handler da consulta por isso tem de
  // conhecer os dois — senao esta' a negar o caminho do nosso proprio botao.
  ok_("o check conhece `automatic-fullscreen`", /automatic-fullscreen/.test(main));
  ok_("e so' o permite a nos (nao a um iframe de provider)",
    /permission === "automatic-fullscreen" && nosso/.test(main));
  ok_("com a nossa propria origem a decisao", /origemPermitida\(requestingOrigin\)/.test(main));
  // O pedido continua a ser so `fullscreen` (e `clipboard-sanitized-write`
  // para a Watch Party): negar o resto e' o que o R7 quis.
  // O intervalo vai do CHAMADO (com `(`) e nao do nome, porque o nome tambem
  // aparece escrito nos comentarios.
  const iPedido = main.indexOf("setPermissionRequestHandler((_wc");
  ok_("o pedido so' permite `fullscreen` e `clipboard-sanitized-write`",
    iPedido > -1 && /PERMISSOES_OK\.has\(permission\)/.test(main.slice(iPedido, iPedido + 400)),
    "iPedido=" + iPedido);
  ok_("e o pedido CHAMA o `callback` (o valor de retorno e' ignorado)",
    iPedido > -1 && /callback\(ok\)/.test(main.slice(iPedido, iPedido + 400)));
}

/* ---------- 6) Higiene ---------- */
console.log("");
console.log("  6) higiene");
{
  const alvos = [
    "web/src/components/ecraInteiro.js",
    "web/src/components/AppFullscreen.jsx",
    "web/src/components/PlayerControls.jsx",
    "web/src/components/usePlayerShortcuts.js",
    "electron/main.cjs",
  ].map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n");
  ok_("sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(alvos));
  ok_("sem caractere de substituicao", !/[\uFFFD]/.test(alvos));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);