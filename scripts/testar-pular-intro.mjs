// Testa a logica de pular a abertura e o fim (scripts/testar-pular-intro.mjs).
//
// Nao ha nada de rede aqui: a logica e' pura e os valores vem das tres formas
// REAIS que o MegaPlay devolveu (medidas em 2026-10-11), incluindo o
// `{start:0, end:0}` de "sem fim" que — sem o filtro — faria o botao aparecer aos
// 0 segundos de qualquer episodio.

import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD = path.join(RAIZ, "web", "src", "components", "pularIntro.js");

let ok = 0;
let falhou = 0;

function ok_(nome, cond) {
  if (cond) {
    ok++;
    console.log("  OK    " + nome);
  } else {
    falhou++;
    console.log("  FALHA " + nome);
  }
}

async function carregar() {
  const mod = await import("file:///" + MOD.replace(/\\/g, "/") + "?v=" + Date.now());
  return mod;
}

// As tres formas reais que o MegaPlay devolve.
const INTRO_REAL = { start: 140, end: 229 };
const OUTRO_REAL = { start: 1376, end: 1447 };
const SEM_FIM = { start: 0, end: 0 };

console.log("");
console.log("  1) A janela so vale se for um intervalo de verdade");
{
  const { janelaValida } = await carregar();

  ok_("o intro real e' uma janela valida", janelaValida(INTRO_REAL));
  ok_("o outro real e' uma janela valida", janelaValida(OUTRO_REAL));

  ok_("{start:0,end:0} (o 'sem fim' do MegaPlay) NAO e' janela", !janelaValida(SEM_FIM));
  ok_("null nao e' janela", !janelaValida(null));
  ok_("undefined nao e' janela", !janelaValida(undefined));
  ok_("{} nao e' janela", !janelaValida({}));
  ok_("um numero solto nao e' janela", !janelaValida(140));
  ok_("o inicio em texto nao e' janela", !janelaValida({ start: "140", end: 229 }));
  ok_("o fim em texto nao e' janela", !janelaValida({ start: 140, end: "229" }));
  ok_("NaN nao e' janela", !janelaValida({ start: NaN, end: 229 }));
  ok_("Infinity nao e' janela", !janelaValida({ start: 140, end: Infinity }));
  ok_("o fim antes do inicio nao e' janela", !janelaValida({ start: 229, end: 140 }));
  ok_("inicio == fim nao e' janela", !janelaValida({ start: 140, end: 140 }));
  ok_("uma janela de menos de 1 s nao e' janela", !janelaValida({ start: 140, end: 140.5 }));
  ok_("uma janela de 1 s e' janela", janelaValida({ start: 140, end: 141 }));

  // Este caso e' o que torna o `start >= 0` observavel. Sem ele na mutacao
  // abaixo, tirar o filtro nao mudava NADA — porque `{start: 0, end: 0}` ja
  // caia pelo `end - start < 1`. So' um inicio NEGATIVO o distingue, e e' um
  // caso que o site pode dar num tempo corrompido: saltava para antes de zero.
  ok_("um inicio negativo nao e' janela", !janelaValida({ start: -5, end: 10 }));
}

console.log("");
console.log("  2) Para onde salta");
{
  const { destinoPulo } = await carregar();

  ok_("salta para o fim da abertura", destinoPulo(INTRO_REAL, 1440) === 229);
  ok_("o 'sem fim' nao tem destino", destinoPulo(SEM_FIM, 1440) === null);
  ok_("sem duracao nao vale-known, usa o fim da janela", destinoPulo(INTRO_REAL, NaN) === 229);
  ok_("duracao 0 nao conta", destinoPulo(INTRO_REAL, 0) === 229);

  // A janela passa do fim do video (o site tem tempos ligeiramente errados):
  // salta para o fim, nao para um ponto que nao existe.
  const curto = destinoPulo({ start: 100, end: 900 }, 400);
  ok_("uma janela que passa do fim salta para o fim do video", curto === 399);
  ok_("o salto nunca fica antes do destino pedido", destinoPulo(INTRO_REAL, 1440) >= INTRO_REAL.end - 1);

  const negativo = destinoPulo({ start: 0, end: 1 }, 0.2);
  ok_("um destino que daria negativo nao e' usado", negativo === null || negativo >= 0);
}

console.log("");
console.log("  3) Quando o botao aparece");
{
  const { pularVisivel } = await carregar();
  const vazio = new Set();
  const nada = { intro: INTRO_REAL, outro: OUTRO_REAL, jaSaltou: vazio, duracao: 1440 };

  ok_("fora de tudo: nenhum botao", pularVisivel({ ...nada, tempo: 0 }) === null);
  ok_("antes da abertura: nenhum botao", pularVisivel({ ...nada, tempo: 100 }) === null);
  ok_("dentro da abertura: aparece", (pularVisivel({ ...nada, tempo: 150 }) || {}).tipo === "intro");
  ok_("no fim da abertura: aparece", (pularVisivel({ ...nada, tempo: 229 }) || {}).tipo === "intro");
  ok_("passada a abertura: ja nao aparece", pularVisivel({ ...nada, tempo: 260 }) === null);
  ok_("um pouco antes da abertura (margem): aparece", (pularVisivel({ ...nada, tempo: 139 }) || {}).tipo === "intro");

  ok_("dentro do fim: aparece o botao do fim", (pularVisivel({ ...nada, tempo: 1400 }) || {}).tipo === "outro");
  ok_("entre a abertura e o fim: nada", pularVisivel({ ...nada, tempo: 800 }) === null);

  // O 'sem fim' (0 -> 0) nunca pode mostrar nada, em nenhum momento.
  ok_(
    "o 'sem fim' (0->0) nao mostra botao aos 0 s",
    pularVisivel({ intro: SEM_FIM, outro: SEM_FIM, tempo: 0, jaSaltou: vazio, duracao: 1440 }) === null
  );
  ok_(
    "o 'sem fim' (0->0) nao mostra botao no meio",
    pularVisivel({ intro: SEM_FIM, outro: SEM_FIM, tempo: 700, jaSaltou: vazio, duracao: 1440 }) === null
  );

  // Ja saltado: nunca mais reaparece (senao o autoskip entra em ciclo).
  const salvos = new Set(["intro"]);
  ok_(
    "depois de saltar a abertura, nao volta a aparecer",
    pularVisivel({ ...nada, tempo: 150, jaSaltou: salvos }) === null
  );
  ok_(
    "depois de saltar a abertura, o fim ainda aparece",
    (pularVisivel({ ...nada, tempo: 1400, jaSaltou: salvos }) || {}).tipo === "outro"
  );

  ok_("tempo invalido nao mostra nada", pularVisivel({ ...nada, tempo: NaN }) === null);
  ok_("tempo negativo nao mostra nada", pularVisivel({ ...nada, tempo: -5 }) === null);
  ok_("sem janelas nao mostra nada", pularVisivel({ intro: null, outro: null, tempo: 150, jaSaltou: vazio }) === null);

  // O destino que vem tem de servir para saltar.
  const v = pularVisivel({ ...nada, tempo: 150 });
  ok_("o botao traz um destino usavel", v && typeof v.destino === "number" && v.destino > 150);
}

console.log("");
console.log("  4) O autoskip");
{
  const { autoskipDestino } = await carregar();

  ok_("dentro da abertura salta sozinho", autoskipDestino({ intro: INTRO_REAL, tempo: 150, jaSaltou: new Set(), duracao: 1440 }) === 229);
  ok_("fora da abertura nao salta", autoskipDestino({ intro: INTRO_REAL, tempo: 800, jaSaltou: new Set(), duracao: 1440 }) === null);
  ok_(
    "depois de saltar, o autoskip nao repete",
    autoskipDestino({ intro: INTRO_REAL, tempo: 150, jaSaltou: new Set(["intro"]), duracao: 1440 }) === null
  );
  ok_("o autoskip nunca salta o fim", autoskipDestino({ intro: INTRO_REAL, tempo: 1400, jaSaltou: new Set(), duracao: 1440 }) === null);
  ok_("sem intro, o autoskip nao faz nada", autoskipDestino({ intro: null, tempo: 150, jaSaltou: new Set(), duracao: 1440 }) === null);
  ok_("o 'sem fim' nao faz o autoskip saltar", autoskipDestino({ intro: SEM_FIM, tempo: 0, jaSaltou: new Set(), duracao: 1440 }) === null);
}

console.log("");
console.log("  5) O botao tem de estar ligado no HlsPlayer e no Player");
{
  const hls = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "HlsPlayer.jsx"), "utf8");
  const pl = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "Player.jsx"), "utf8");

  ok_("o HlsPlayer recebe intro e outro", /intro/.test(hls) && /outro/.test(hls));
  ok_("o HlsPlayer usa a logica pura", /pularIntro/.test(hls));
  ok_("o HlsPlayer le o autoskip das Definicoes", /autoskip/.test(hls));
  ok_("o Player passa o intro ao HlsPlayer", /intro=/.test(pl));
  ok_("o Player passa o outro ao HlsPlayer", /outro=/.test(pl));
}

/* ---------- MUTACOES ---------- */
// Um teste que passa porque o codigo esta certo nao prova nada. Parte-se o
// codigo de proposito e confirma-se que o teste o apanha.
console.log("");
console.log("  MUTACOES (partir o codigo de proposito)");

const MUTACOES = [
  [
    "o filtro do 'sem fim' ({start:0,end:0}) deixa de existir de todo",
    "  if (end - start < MIN_SEGUNDOS) return false;\n  return start >= 0;",
    "  return true;",
  ],
  [
    "o filtro do inicio negativo desaparece",
    "  return start >= 0;",
    "  return true;",
  ],
  [
    "a margem antes da abertura desaparece",
    "    if (t < j.start - margem || t > j.end) continue;",
    "    if (t < j.start || t > j.end) continue;",
  ],
  [
    "o 'ja saltou' deixa de ser respeitado (o botao volta sempre)",
    "    if (feitos.has(tipo)) continue;",
    "    if (false) continue;",
  ],
  [
    "o `start` em texto passa a ser aceite",
    "  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;",
    "  if (start == null || end == null) return false;",
  ],
  [
    "uma janela que passa do fim salta para fora do video",
    "  if (Number.isFinite(d) && d > 0 && destino > d - 1) destino = Math.max(0, d - 1);",
    "  ",
  ],
  [
    "o autoskip volta a devolver o objecto em vez do destino",
    "  const v = pularVisivel({ intro, outro: null, tempo, jaSaltou, duracao });\n  return v ? v.destino : null;",
    "  return pularVisivel({ intro, outro: null, tempo, jaSaltou, duracao });",
  ],
];

const original = fs.readFileSync(MOD, "utf8");
for (const [nome, de, para] of MUTACOES) {
  if (!original.includes(de)) {
    ok_("MUTACAO " + nome + " (o codigo mudou, a mutacao nao aplica)", false);
    continue;
  }
  const dirMut = fs.mkdtempSync(path.join(RAIZ, "scripts", ".mut-"));
  const modMut = path.join(dirMut, "pularIntro.js");
  fs.writeFileSync(modMut, original.replace(de, para));

  // O teste importa por caminho, por isso corre-se uma copia dele que aponta
  // para o ficheiro partido.
  //
  // O `split` corta o bloco das mutacoes (para nao recursarem sem fim) mas TEM
  // de levar a cauda de volta: sem o `process.exit(falhou ? 1 : 0)`, o sub-teste
  // imprime as falhas e sai com 0 na mesma — e o harness dizia "mutacao nao
  // apanhada" quando o teste ate a apanhara. Foi o que aconteceu aqui, e quase
  // levou-me a "consertar" testes que estavam certos.
  const CAUDA =
    "\nconsole.log('');\n" +
    "console.log('  ' + ok + ' ok, ' + falhou + ' falha(s)');\n" +
    "process.exit(falhou ? 1 : 0);\n";
  const testeMut = path.join(dirMut, "t.mjs");
  fs.writeFileSync(
    testeMut,
    fs
      .readFileSync(path.join(RAIZ, "scripts", "testar-pular-intro.mjs"), "utf8")
      .split("/* ---------- MUTACOES ---------- */")[0]
      .replace(/const MOD = [^\n]+;/, 'const MOD = ' + JSON.stringify(modMut) + ";")
      .replace(/const RAIZ = [^\n]+;/, 'const RAIZ = ' + JSON.stringify(RAIZ) + ";") + CAUDA
  );

  const r = spawnSync(process.execPath, [testeMut], { encoding: "utf8" });
  const saida = (r.stdout || "") + (r.stderr || "");
  const apanhou = r.status !== 0 && /FALHA/.test(saida);
  ok_("MUTACAO apanhada: " + nome, apanhou);

  // Se nao apanhou, mostra o que o sub-teste disse. Sem isto, uma mutacao que
  // nao aplica e' igual a uma mutacao que o teste nao apanha, e nao se sabe
  // qual das duas e' — foi a confusao que gastou tempo aqui.
  if (!apanhou) {
    console.log("        (status " + r.status + ") " + saida.split(/\r?\n/).filter((l) => l.trim()).slice(-4).join(" | ").slice(0, 150));
  }

  fs.rmSync(dirMut, { recursive: true, force: true });
}
fs.writeFileSync(MOD, original); // restaura sempre

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);
