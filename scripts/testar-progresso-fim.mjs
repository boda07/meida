// O progresso era reportado duas vezes no fim do video (B3, 2026-11-06).
//
// Medido no Chromium: ao chegar ao fim disparam `timeupdate`, `pause` e `ended`
// pela mesma posicao, e nos tres `video.ended` ja' e' true. O `pause` reportava
// outra vez o que o `ended` ia reportar, e o `onProgress` recebia [12, 12] duas
// vezes — dois pedidos de progresso por cada video que termina.
//
// A correcao vive em `progressoVideo.js` (modulo puro, sem React nem DOM). Este
// teste liga-o a um video falso e dispara os eventos pela ordem real, por isso
// prova o comportamento e nao o texto. As mutacoes no fim confirmam que cada
// parte da guarda e' mesmo necessaria.
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULO = path.join(RAIZ, "web/src/components/progressoVideo.js");
const HOOK = path.join(RAIZ, "web/src/components/useVideoProgress.js");
const PKG = path.join(RAIZ, "package.json");
const ESTE = fileURLToPath(import.meta.url);

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra) {
  if (cond) {
    console.log("  OK    " + nome);
    ok++;
  } else {
    console.log("  FALHA " + nome + (extra ? " -> " + extra : ""));
    falhou++;
  }
}

const registar = (chamadas) => (posicao, duracao) => chamadas.push([posicao, duracao]);

// O minimo de um <video> para esta logica: tempo, duracao, `ended` e ouvintes.
function videoFalso({ duracao = 12, posicao = 0, terminou = false } = {}) {
  const eventos = new Map();
  return {
    currentTime: posicao,
    duration: duracao,
    ended: terminou,
    paused: false,
    addEventListener(ev, fn) {
      if (!eventos.has(ev)) eventos.set(ev, new Set());
      eventos.get(ev).add(fn);
    },
    removeEventListener(ev, fn) {
      eventos.get(ev)?.delete(fn);
    },
    disparar(ev) {
      for (const fn of [...(eventos.get(ev) || [])]) fn();
    },
    ouvintes(ev) {
      return eventos.get(ev)?.size || 0;
    },
  };
}

function casosComportamento(mod) {
  const casos = [];
  const add = (nome, cond, extra) => casos.push({ nome, cond, extra });
  const caso = (nome, fn) => {
    try {
      fn(add);
    } catch (e) {
      // Um rebentar conta como falha, com linha de resumo (nunca matar o teste).
      add(nome, false, "ATIROU: " + e.message);
    }
  };

  caso("no fim, o pause nao reporta — quem reporta e' o ended", (add) => {
    const v = videoFalso({ duracao: 12, posicao: 12, terminou: true });
    const chamadas = [];
    const limpar = mod.ligarEventosDeProgresso({ video: v, onProgress: registar(chamadas) });

    v.disparar("pause");
    add("pause com ended: 0 chamadas", chamadas.length === 0, JSON.stringify(chamadas));

    v.disparar("ended");
    add(
      "ended: 1 chamada [12, 12]",
      chamadas.length === 1 && chamadas[0][0] === 12 && chamadas[0][1] === 12,
      JSON.stringify(chamadas)
    );

    limpar();
    add("a limpeza no fim nao duplica", chamadas.length === 1, JSON.stringify(chamadas));
  });

  caso("o fim nao repete o que o timeupdate ja' reportou", (add) => {
    const v = videoFalso({ duracao: 12, posicao: 5 });
    const chamadas = [];
    const limpar = mod.ligarEventosDeProgresso({ video: v, onProgress: registar(chamadas) });

    v.disparar("timeupdate");
    add("reporta aos 5s", chamadas.length === 1 && chamadas[0][0] === 5, JSON.stringify(chamadas));

    // O browser chega ao fim: `ended` fica true e a posicao e' a duracao.
    v.currentTime = 12;
    v.ended = true;
    v.paused = true;
    v.disparar("timeupdate");
    add(
      "reporta o fim no timeupdate",
      chamadas.length === 2 && chamadas[1][0] === 12 && chamadas[1][1] === 12,
      JSON.stringify(chamadas)
    );

    v.disparar("pause");
    add("o pause no fim nao acrescenta", chamadas.length === 2, JSON.stringify(chamadas));

    v.disparar("ended");
    add("o ended no mesmo instante nao acrescenta", chamadas.length === 2, JSON.stringify(chamadas));

    limpar();
    add("a limpeza no fim tambem nao acrescenta", chamadas.length === 2, JSON.stringify(chamadas));
  });

  caso("pause a meio reporta, e a repeticao nao", (add) => {
    const v = videoFalso({ duracao: 12, posicao: 6 });
    const chamadas = [];
    const limpar = mod.ligarEventosDeProgresso({ video: v, onProgress: registar(chamadas) });

    v.disparar("pause");
    add(
      "pause a meio: 1 chamada [6, 12]",
      chamadas.length === 1 && chamadas[0][0] === 6 && chamadas[0][1] === 12,
      JSON.stringify(chamadas)
    );

    v.disparar("pause");
    add("pausa repetida nao duplica", chamadas.length === 1, JSON.stringify(chamadas));

    limpar();
    add("limpeza sem mudanca nao duplica", chamadas.length === 1, JSON.stringify(chamadas));
  });

  caso("o intervalo e' 5s, e recuar conta", (add) => {
    const v = videoFalso({ duracao: 100, posicao: 0 });
    const chamadas = [];
    const limpar = mod.ligarEventosDeProgresso({ video: v, onProgress: registar(chamadas) });

    v.currentTime = 4;
    v.disparar("timeupdate");
    add("aos 4s ainda nao reporta", chamadas.length === 0, JSON.stringify(chamadas));

    v.currentTime = 5;
    v.disparar("timeupdate");
    add(
      "aos 5s reporta [5, 100]",
      chamadas.length === 1 && chamadas[0][0] === 5 && chamadas[0][1] === 100,
      JSON.stringify(chamadas)
    );

    v.currentTime = 9;
    v.disparar("timeupdate");
    add("aos 9s nao repete", chamadas.length === 1, JSON.stringify(chamadas));

    v.currentTime = 10;
    v.disparar("timeupdate");
    add("aos 10s reporta", chamadas.length === 2 && chamadas[1][0] === 10, JSON.stringify(chamadas));

    v.currentTime = 4;
    v.disparar("timeupdate");
    add(
      "recuar 6s reporta [4, 100]",
      chamadas.length === 3 && chamadas[2][0] === 4,
      JSON.stringify(chamadas)
    );

    limpar();
    add("a limpeza sem mudanca nao repete", chamadas.length === 3, JSON.stringify(chamadas));
  });

  caso("a limpeza remove os ouvintes e reporta a posicao final", (add) => {
    const v = videoFalso({ duracao: 30, posicao: 7 });
    const chamadas = [];
    const limpar = mod.ligarEventosDeProgresso({ video: v, onProgress: registar(chamadas) });

    add("sem reporte antes da limpeza", chamadas.length === 0, JSON.stringify(chamadas));
    add(
      "liga os tres eventos",
      v.ouvintes("timeupdate") === 1 && v.ouvintes("pause") === 1 && v.ouvintes("ended") === 1,
      `timeupdate=${v.ouvintes("timeupdate")} pause=${v.ouvintes("pause")} ended=${v.ouvintes("ended")}`
    );

    limpar();
    add(
      "a limpeza reporta [7, 30]",
      chamadas.length === 1 && chamadas[0][0] === 7 && chamadas[0][1] === 30,
      JSON.stringify(chamadas)
    );

    v.disparar("pause");
    v.disparar("timeupdate");
    v.disparar("ended");
    add("depois da limpeza nada dispara", chamadas.length === 1, JSON.stringify(chamadas));
    add(
      "os ouvintes foram removidos",
      v.ouvintes("timeupdate") === 0 && v.ouvintes("pause") === 0 && v.ouvintes("ended") === 0
    );
  });

  caso("sem video ou sem onProgress nao rebenta", (add) => {
    const semVideo = mod.ligarEventosDeProgresso({ video: null, onProgress: () => {} });
    add("sem video devolve uma funcao", typeof semVideo === "function");
    semVideo();

    const v = videoFalso();
    const semCallback = mod.ligarEventosDeProgresso({ video: v, onProgress: null });
    add("sem onProgress devolve uma funcao", typeof semCallback === "function");
    add("sem onProgress nao liga eventos", v.ouvintes("pause") === 0);
    semCallback();

    const semNada = mod.ligarEventosDeProgresso({});
    add("sem nada devolve uma funcao", typeof semNada === "function");
    semNada();
  });

  return casos;
}

const mod = await import(pathToFileURL(MODULO).href + "?t=" + Date.now());

console.log("  1) o fim do video reporta uma vez so'");
for (const c of casosComportamento(mod)) ok_(c.nome, c.cond, c.extra);

/* ---------- 2. O gancho so' liga o modulo ---------- */

console.log("  2) o gancho delega no modulo");
{
  const hook = fs.readFileSync(HOOK, "utf8");
  ok_(
    "importa o modulo",
    /import \{ ligarEventosDeProgresso \} from "\.\/progressoVideo\.js";/.test(hook)
  );
  ok_(
    "devolve a limpeza do modulo",
    /return ligarEventosDeProgresso\(\{ video, onProgress \}\);/.test(hook)
  );
  ok_("ja' nao liga eventos a mao", !/addEventListener/.test(hook));
  ok_("ja' nao tem a logica do intervalo", !/Math\.abs|INTERVALO/.test(hook));

  const modulo = fs.readFileSync(MODULO, "utf8");
  ok_("a guarda do pause esta' no modulo", /if \(video\.ended\) return;/.test(modulo));
  ok_(
    "a repeticao do mesmo par esta' travada",
    /if \(posicao === ultimaPosicao && duracao === ultimaDuracao\) return;/.test(modulo)
  );
  ok_("o intervalo continua a usar Math.abs", /Math\.abs\(posicao - ultimo\) >= INTERVALO/.test(modulo));

  const pkg = fs.readFileSync(PKG, "utf8");
  ok_("o teste entra no npm test", pkg.includes("node scripts/testar-progresso-fim.mjs"));
}

/* ---------- 3. Mutacoes ---------- */

console.log("  3) mutacoes");
{
  const fonte = fs.readFileSync(MODULO, "utf8").replace(/\r\n/g, "\n");
  const mutacoes = [
    ["o pause no fim volta a reportar", "if (video.ended) return;", "if (false) return;"],
    [
      "o mesmo par volta a ser reportado",
      "if (posicao === ultimaPosicao && duracao === ultimaDuracao) return;",
      "if (false) return;",
    ],
    [
      "o intervalo desce para 1s",
      "Math.abs(posicao - ultimo) >= INTERVALO",
      "Math.abs(posicao - ultimo) >= 1",
    ],
    [
      "recuar deixa de contar",
      "Math.abs(posicao - ultimo) >= INTERVALO",
      "posicao - ultimo >= INTERVALO",
    ],
    ["a limpeza deixa de reportar", "    reportar();\n  };\n}", "  };\n}"],
  ];

  for (const [nome, de, para] of mutacoes) {
    if (!fonte.includes(de)) {
      console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
      falhou++;
      continue;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-progresso-mut-"));
    fs.writeFileSync(path.join(dir, "progressoVideo.js"), fonte.replace(de, para));

    let apanhada;
    try {
      const mut = await import(
        pathToFileURL(path.join(dir, "progressoVideo.js")).href + "?m=" + Date.now()
      );
      apanhada = casosComportamento(mut).some((c) => !c.cond);
    } catch {
      apanhada = true;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    if (apanhada) {
      console.log("  OK    MUTACAO apanhada: " + nome);
      ok++;
    } else {
      console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
      falhou++;
    }
  }

  // Mutacao de texto: o gancho deixar de devolver a limpeza.
  {
    const hook = fs.readFileSync(HOOK, "utf8");
    const de = "return ligarEventosDeProgresso({ video, onProgress });";
    const para = "ligarEventosDeProgresso({ video, onProgress });";
    const verificacao = (s) => /return ligarEventosDeProgresso\(\{ video, onProgress \}\);/.test(s);
    if (!hook.includes(de)) {
      console.log("  FALHA MUTACAO IMPOSSIVEL (o gancho mudou): sem return");
      falhou++;
    } else {
      const apanhada = verificacao(hook) && !verificacao(hook.replace(de, para));
      if (apanhada) {
        console.log("  OK    MUTACAO apanhada: sem return");
        ok++;
      } else {
        console.log("  FALHA MUTACAO NAO DETECTADA: sem return");
        falhou++;
      }
    }
  }
}

/* ---------- 4. Higiene ---------- */

console.log("  4) higiene");
{
  const ficheiros = [
    ["progressoVideo.js", fs.readFileSync(MODULO, "utf8")],
    ["useVideoProgress.js", fs.readFileSync(HOOK, "utf8")],
    ["testar-progresso-fim.mjs", fs.readFileSync(ESTE, "utf8")],
  ];
  for (const [nome, texto] of ficheiros) {
    ok_(nome + " sem CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(texto));
    ok_(nome + " sem caractere de substituicao", !texto.includes("\uFFFD"));
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
