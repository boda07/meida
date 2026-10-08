// Testa a presenca do Discord sem Discord e sem Electron.
//
// O defeito reportado a 2026-10-08 foi duas vezes no mesmo sitio:
//   1. o contador do tempo nunca parava (o video pausado continuava a contar);
//   2. a correcção inicial marquava os players em iframe como "Pausado" para
//      sempre, porque "sem progresso" era lido como "em pausa".
//
// A correcao sao tres estados, distinguidos pelo que sabemos e' nao pelo que
// achamos. E' `buildActivity()` que decide o que vai para o Discord, por isso
// e' ela que se testa — a parte que decidetimestamps e' pura e nao precisa de
// socket nenhum.
//
// Importa `discord-presence.cjs` para o `buildActivity` real: testar uma copia
// da logica aqui seria testar outra coisa.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { buildActivity } = require("../electron/discord-presence.cjs");

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}

const AGORA = 1000000;
const base = { details: "South Park", state: "S1E1", startTimestamp: 900000, largeImage: "http://x/p.jpg", largeText: "South Park" };

// ---- 1) "a-ver": contador a correr ------------------------------------------------
const aVer = buildActivity({ ...base, estado: "a-ver" }, AGORA);
ok('"a-ver" conta tempo (tem timestamps)', Boolean(aVer.timestamps));
ok('"a-ver" conta desde o inicio do titulo', aVer.timestamps.start === 900000);
ok('"a-ver" nao diz "Pausado"', !("paused" in aVer.timestamps));
ok('"a-ver" mostra o titulo', aVer.details === "South Park");
ok('"a-ver" e do tipo Watching (3)', aVer.type === 3);
ok('"a-ver" mostra a linha de baixo', aVer.state === "S1E1");
ok('"a-ver" mostra o cartaz', aVer.assets.large_image === "http://x/p.jpg");

// ---- 2) "pausa": congela e marca -------------------------------------------------
const pausa = buildActivity({ ...base, estado: "pausa" }, AGORA);
ok('"pausa" ainda tem timestamps (para o Discord mostrar)', Boolean(pausa.timestamps));
ok('"pausa" marca o instante da pausa', pausa.timestamps.paused === AGORA);
ok('"pausa" nao reinicia a contagem', pausa.timestamps.start === 900000);

// ---- 3) "sem-dados": o titulo aparece, nada mais ----------------------------------
// Este e' o caso dos players em iframe (MegaPlay, VidLove): nunca chega
// progresso, nem quando o video esta a dar. Nao se pode dizer "a ver" nem
// "pausado" — nenhum dos dois e' verdade. O que se manda e' o titulo e nada
// mais, e o Discord nao conta tempo.
const semDados = buildActivity({ ...base, estado: "sem-dados" }, AGORA);
ok('"sem-dados" NAO manda timestamps (o Discord nao conta)', !("timestamps" in semDados));
ok('"sem-dados" mostra o titulo na mesma', semDados.details === "South Park");
ok('"sem-dados" mostra a linha de baixo na mesma', semDados.state === "S1E1");
ok('"sem-dados" mostra o cartaz na mesma', Boolean(semDados.assets));
ok('"sem-dados" nao se acusa de pausa', !JSON.stringify(semDados).includes("paused"));

// ---- 4) Estado desconhecido: o default nao pode mentir ----------------------------
// O IPC pode mandar um estado invalido (frontend mais antigo, typo). O default
// e' "a-ver", que e' o comportamento antigo — nunca "pausa", que acusaria
// alguem de ter pausado sem provas.
const invalido = buildActivity({ ...base, estado: "lixo" }, AGORA);
ok('estado invalido conta (nao acusa pausa)', !("paused" in invalido.timestamps));

// ---- 5) O IPC repassa o `estado` (a regressao que quase me passou) ---------------
// `electron/main.cjs` lista os campos um a um. Sem `estado:` nessa lista, o
// Discord recebia sempre o default "a-ver" e o defeito voltava sem dar erro
// nenhum. Este teste existe para nunca mais acontecer em silencio.
const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const bloco = main.slice(main.indexOf('ipcMain.handle("set-presence"'), main.indexOf('ipcMain.handle("clear-presence"'));
ok("main.cjs repassa 'estado' ao processo principal", /estado:\s*data\?\.estado/.test(bloco));

// ---- 6) O frontend tem os tres estados --------------------------------------------
// Indiferente ao tipo de aspas: o que interessa e' que o estado exista, nao como
// esta escrito.
const details = readFileSync(new URL("../web/src/pages/Details.jsx", import.meta.url), "utf8");
for (const e of ["a-ver", "pausa", "sem-dados"]) {
  ok("Details.jsx conhece o estado " + e, details.includes(`"${e}"`) || details.includes(`'${e}'`));
}
ok("Details.jsx ja nao usa o booleano antigo (presencaPausada)", !details.includes("presencaPausada"));
// O `viuProgressoRef` e' o que separa "parou" de "nunca soube". Sem ele, um
// player nosso que arranca devagar seria marcado como pausa.
ok("Details.jsx so marca 'viuProgresso' quando ha progresso", /viuProgressoRef\.current = true/.test(details));
ok("Details.jsx so passa a 'pausa' se ja viu progresso", /if \(!viuProgressoRef\.current\) return/.test(details));

// O efeito que envia o estado nao pode levar `position`: a posicao vem do
// `reportPos`, e mandar `undefined` faria o `subLine` escrever "undefined".
const efeito = details.slice(details.indexOf("estado: presencaEstado") - 400, details.indexOf("estado: presencaEstado"));
ok("o efeito do estado nao inventa posicao", !efeito.includes("position,"));

console.log(mau ? "\n  " + mau + " FALHA(S)" : "\n  " + n + " verificacoes passam");
process.exit(mau ? 1 : 0);
