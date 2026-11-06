// A barra de controlos do player escondia-se e nunca mais voltava (B1).
//
// O bug: o `mousemove` estava so' na propria barra, e a barra escondida tem
// `pointer-events: none`. Portanto o unico evento que a havia de mostrar nunca
// chegava. Pior: ninguem chamava `mostrar()` ao pausar — clicar no video
// pausava-o e a barra continuava escondida, com o <video> por cima dos botoes.
//
// Este teste tem duas partes:
//   1) `barraPlayer.js` — comportamento, com objectos falsos que registam e
//      disparam eventos como o DOM faria. E' o que prova que o evento certo
//      esta' no alvo certo e que a limpeza remove tudo.
//   2) `PlayerControls.jsx` — invariantes de ligacao (alvo `.player`, sem
//      listener na barra, play/pause a mostrar).
//
// A parte 1 nao substitui a medicao no browser: so' o browser diz que um
// `mousemove` real por cima do <video> chega ao contentor. Mas se o alvo ou os
// eventos estiverem errados, e' aqui que se sabe primeiro.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ligarEventosDaBarra } from "../web/src/components/barraPlayer.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LER = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const CONTROLES = LER("web/src/components/PlayerControls.jsx");
const CSS = LER("web/src/styles.css");

let n = 0;
let falhou = 0;
function ok(nome, cond, extra = "") {
  if (cond) {
    n += 1;
    console.log("  OK    " + nome);
  } else {
    falhou += 1;
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
  }
}

/* ---------- 1) O comportamento da ligacao ---------- */

console.log("  1) eventos ligados ao contentor, nao a' barra");

class FalsoElemento {
  constructor(nome) {
    this.nome = nome;
    this.listeners = new Map(); // tipo -> [{ fn, opts }]
  }
  addEventListener(tipo, fn, opts) {
    const lista = this.listeners.get(tipo) || [];
    lista.push({ fn, opts });
    this.listeners.set(tipo, lista);
  }
  removeEventListener(tipo, fn) {
    const lista = this.listeners.get(tipo) || [];
    this.listeners.set(tipo, lista.filter((l) => l.fn !== fn));
  }
  disparar(tipo, evento = {}) {
    const lista = this.listeners.get(tipo) || [];
    for (const l of lista) l.fn(evento);
    return lista.length;
  }
  tem(tipo) {
    return (this.listeners.get(tipo) || []).length > 0;
  }
  opcoes(tipo) {
    return (this.listeners.get(tipo) || [])[0]?.opts;
  }
}

const alvo = new FalsoElemento(".player");
const video = new FalsoElemento("video");
let mostrou = 0;
let aoPlay = 0;
let aoPause = 0;
const desligar = ligarEventosDaBarra({
  alvo,
  video,
  mostrar: () => {
    mostrou += 1;
  },
  aoPlay: () => {
    aoPlay += 1;
  },
  aoPause: () => {
    aoPause += 1;
  },
});

ok("o mousemove fica no contentor", alvo.tem("mousemove"));
ok(
  "o mousemove NAO fica so' no video (o bug era o alvo errado)",
  !video.tem("mousemove")
);
ok("o pointerdown fica no contentor", alvo.tem("pointerdown"));
ok("o touchstart fica no contentor", alvo.tem("touchstart"));
ok(
  "o touchstart e' passivo (nao trava o scroll)",
  alvo.opcoes("touchstart")?.passive === true,
  JSON.stringify(alvo.opcoes("touchstart"))
);

mostrou = 0;
alvo.disparar("mousemove");
ok("mexer o rato mostra a barra", mostrou === 1, `mostrou=${mostrou}`);
alvo.disparar("pointerdown");
ok("tocar com o rato mostra a barra", mostrou === 2, `mostrou=${mostrou}`);
alvo.disparar("touchstart");
ok("tocar no ecra mostra a barra", mostrou === 3, `mostrou=${mostrou}`);

mostrou = 0;
aoPlay = 0;
video.disparar("play");
ok("dar play mostra a barra", mostrou === 1, `mostrou=${mostrou}`);
ok("dar play avisa o estado (icone de pausa)", aoPlay === 1, `aoPlay=${aoPlay}`);

mostrou = 0;
aoPause = 0;
video.disparar("pause");
ok("pausar mostra a barra", mostrou === 1, `mostrou=${mostrou}`);
ok("pausar avisa o estado (icone de play)", aoPause === 1, `aoPause=${aoPause}`);

mostrou = 0;
aoPause = 0;
video.disparar("ended");
ok("chegar ao fim mostra a barra", mostrou === 1, `mostrou=${mostrou}`);
ok("chegar ao fim tambem atualiza o estado", aoPause === 1, `aoPause=${aoPause}`);

// A limpeza tem de remover TODOS os listeners. Se um ficar, o componente que
// ja' saiu continua a mandar `mostrar()` para um setState morto.
desligar();
mostrou = 0;
aoPlay = 0;
aoPause = 0;
alvo.disparar("mousemove");
alvo.disparar("pointerdown");
alvo.disparar("touchstart");
video.disparar("play");
video.disparar("pause");
video.disparar("ended");
ok(
  "depois da limpeza nenhum evento chama nada",
  mostrou === 0 && aoPlay === 0 && aoPause === 0,
  `mostrou=${mostrou} aoPlay=${aoPlay} aoPause=${aoPause}`
);
ok(
  "depois da limpeza o contentor fica sem listeners",
  !alvo.tem("mousemove") && !alvo.tem("pointerdown") && !alvo.tem("touchstart")
);
ok(
  "depois da limpeza o video fica sem listeners",
  !video.tem("play") && !video.tem("pause") && !video.tem("ended")
);

// Sem elementos (o ref ainda nao existe) devolve uma limpeza inofensiva.
let limpeza;
try {
  limpeza = ligarEventosDaBarra({ alvo: null, video: null, mostrar: () => {} });
  limpeza();
  ok("sem alvo/video devolve uma limpeza segura", typeof limpeza === "function");
} catch (e) {
  ok("sem alvo/video devolve uma limpeza segura", false, String(e));
}

/* ---------- 2) O componente usa a ligacao certa ---------- */

console.log("  2) PlayerControls liga ao .player e ouve play/pause");

ok(
  "importa ligarEventosDaBarra",
  /import\s*\{\s*ligarEventosDaBarra\s*\}\s*from\s*"\.\/barraPlayer\.js"/.test(
    CONTROLES
  )
);
ok(
  "procura o contentor .player (e nao a barra)",
  /video\.closest\("\.player"\)/.test(CONTROLES)
);
ok(
  "devolve a limpeza da ligacao no efeito",
  /return\s+ligarEventosDaBarra\(\{/.test(CONTROLES)
);
ok(
  "a barra ja' nao tem o onMouseMove (era o alvo errado)",
  !/pc-barra[^>]*onMouseMove/.test(CONTROLES)
);
ok(
  "a barra escondida continua sem receber o rato (pointer-events: none)",
  /\.pc-barra\.escondida\s*\{[^}]*pointer-events:\s*none/.test(CSS)
);
ok(
  "so' esconde se o video estiver mesmo a dar",
  /if\s*\(v\s*&&\s*!v\.paused\)\s*setBarraVisivel\(false\)/.test(CONTROLES)
);
ok(
  "o estado do icone nasce do proprio video",
  /setADar\(!video\.paused\)/.test(CONTROLES)
);
ok(
  "o play liga o estado de reproduzir",
  /aoPlay:\s*\(\)\s*=>\s*setADar\(true\)/.test(CONTROLES)
);
ok(
  "o pause desliga o estado de reproduzir",
  /aoPause:\s*\(\)\s*=>\s*setADar\(false\)/.test(CONTROLES)
);

/* ---------- Resumo ---------- */

console.log(`\n${n} ok, ${falhou} falha(s)`);
process.exitCode = falhou ? 1 : 0;
