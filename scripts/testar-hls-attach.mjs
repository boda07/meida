// H1 — o hls.js TEM de ser ligado ao <video> (2026-11-02).
//
// ---------------------------------------------------------------------------
// O DEFEITO QUE ISTO APANHA
// ---------------------------------------------------------------------------
// O `useHlsEngine` fazia `new Hls()` e `hls.loadSource(src)` e nunca chamava
// `attachMedia`. O hls.js descarregava a master e a playlist da qualidade e
// ficava por ai': sem `MediaSource` ligado ao `<video>` nao pede um unico
// segmento, o `readyState` fica a 0, o video fica parado em 0:00 e NAO ha'
// erro nenhum. Provado em A/B: sem a linha os pedidos sao master + legendas +
// playlist e 0 segmentos; com a linha o `seg-*.ts` e' pedido e responde 200.
//
// Estes tres defeitos foram no mesmo ficheiro, por isso o teste cobre os tres:
//
//   1. falta `attachMedia` (e tem de vir ANTES do `loadSource`);
//   2. `onErro` nas dependencias do `useEffect` recriava o hls sempre que o
//      callback mudava de identidade (o video voltava ao inicio);
//   3. `src.isM3U8` numa string e' sempre `undefined`, portanto os ficheiros
//      progressivos (mp4) iam parar ao hls.js. O `isM3U8` passa a ser um
//      parametro separado.
//
// Porque e' que nao chega um teste por texto: o que interessa e' a ORDEM das
// chamadas e o que acontece entre duas renderizacoes. Um `grep attachMedia`
// passaria com a linha no sitio errado e nao via a recriacao do hls. Por isso
// o gancho real e' importado com um React e um hls.js FALSOS que registam as
// chamadas — e as mutacoes correm contra o ficheiro real, nao contra uma
// reimplementacao do teste.
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = path.join(RAIZ, "web/src/components/useHlsEngine.js");
const HLS_PLAYER = path.join(RAIZ, "web/src/components/HlsPlayer.jsx");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra) {
  if (cond) {
    console.log("  OK    " + nome);
    ok++;
  } else {
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
    falhou++;
  }
}

// ---------------------------------------------------------------------------
// Os dois modulos falsos. O React falso compara dependencias como o verdadeiro
// (Object.is, posicao a posicao) e corre o cleanup antes do efeito novo — e'
// isso que torna a recriacao do hls observavel.
// ---------------------------------------------------------------------------
const REACT_FALSO = `
let idx = 0;
let slots = [];
let efeitos = [];
let pendentes = [];

function mesmoDeps(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((x, i) => Object.is(x, b[i]));
}

export function __reset() { idx = 0; slots = []; efeitos = []; pendentes = []; }

export function __render(fn, props) {
  idx = 0;
  pendentes = [];
  const retorno = fn(props);
  for (const p of pendentes) {
    const anterior = efeitos[p.i];
    if (anterior && typeof anterior.limpeza === "function") anterior.limpeza();
    const limpeza = p.fn();
    efeitos[p.i] = { deps: p.deps, limpeza };
  }
  return retorno;
}

export function useRef(v) {
  const i = idx++;
  if (!(i in slots)) slots[i] = { current: v };
  return slots[i];
}

export function useState(v) {
  const i = idx++;
  if (!(i in slots)) slots[i] = v;
  const set = (n) => { slots[i] = typeof n === "function" ? n(slots[i]) : n; };
  return [slots[i], set];
}

export function useEffect(fn, deps) {
  const i = idx++;
  const ant = efeitos[i];
  if (!ant || deps === undefined || !mesmoDeps(deps, ant.deps)) {
    pendentes.push({ i, fn, deps });
  }
}

export function useCallback(fn, deps) {
  const i = idx++;
  const ant = slots[i];
  if (ant && mesmoDeps(deps, ant.deps)) return ant.fn;
  slots[i] = { fn, deps };
  return fn;
}
`;

const HLS_FALSO = `
export const eventos = [];
export const instancias = [];

export function __limpar() {
  eventos.length = 0;
  instancias.length = 0;
}

export default class Hls {
  static Events = {
    MANIFEST_PARSED: "manifest-parsed",
    LEVEL_SWITCHED: "level-switched",
    FRAG_LOADED: "frag-loaded",
    ERROR: "error",
  };
  static ErrorTypes = { NETWORK_ERROR: "network-error", MEDIA_ERROR: "media-error" };
  static isSupported() { return true; }

  constructor(cfg) {
    this.cfg = cfg;
    this.handlers = {};
    eventos.push(["new"]);
    instancias.push(this);
  }
  attachMedia(video) { this.video = video; eventos.push(["attachMedia", video]); }
  loadSource(src) { this.src = src; eventos.push(["loadSource", src]); }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  destroy() { eventos.push(["destroy"]); }
  startLoad() { eventos.push(["startLoad"]); }
  recoverMediaError() { eventos.push(["recoverMediaError"]); }
  set currentLevel(v) { this.nivel = v; }
  get currentLevel() { return this.nivel; }
}
`;

// O gancho real, com os dois imports trocados pelos falsos.
const FONTE = fs.readFileSync(HOOK, "utf8").replace(/\r\n/g, "\n");
const BASE = FONTE
  .replace('from "react"', 'from "./react-falso.mjs"')
  .replace('from "hls.js"', 'from "./hls-falso.mjs"');

if (BASE === FONTE) {
  console.log("  FALHA o gancho nao importa react nem hls.js: o teste parte aqui.");
  process.exit(1);
}

function criarPasta(fonte, etiqueta) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-hls-" + etiqueta + "-"));
  fs.writeFileSync(path.join(dir, "react-falso.mjs"), REACT_FALSO);
  fs.writeFileSync(path.join(dir, "hls-falso.mjs"), HLS_FALSO);
  const alvo = path.join(dir, "useHlsEngine.js");
  fs.writeFileSync(alvo, fonte);
  return { dir, alvo };
}

// ---------------------------------------------------------------------------
// Os cenarios. Devolve as falhas (vazio = tudo bem), para as mutacoes poderem
// correr exactamente a mesma sequencia e serem julgadas pelo mesmo criterio.
// ---------------------------------------------------------------------------
async function cenarios(dir, alvo, etiqueta) {
  const react = await import(pathToFileURL(path.join(dir, "react-falso.mjs")).href);
  const hls = await import(pathToFileURL(path.join(dir, "hls-falso.mjs")).href);
  const modulo = await import(pathToFileURL(alvo).href + "?m=" + etiqueta + "-" + Date.now());

  const resultados = [];
  const ver = (nome, cond, extra) => {
    resultados.push({ nome, cond: !!cond, extra });
  };
  const src = "https://exemplo.pt/master.m3u8";

  // ---- A) primeira renderizacao de um m3u8 ----
  react.__reset();
  hls.__limpar();
  const video = { src: "" };
  const videoRef = { current: video };
  react.__render(modulo.useHlsEngine, {
    src,
    isM3U8: true,
    videoRef,
    onErro: () => {},
  });

  const nomes = hls.eventos.map((e) => e[0]);
  ver("cria uma instancia do hls", hls.instancias.length === 1, nomes.join(","));
  ver(
    "**liga o <video> ao hls com attachMedia**",
    hls.eventos.some((e) => e[0] === "attachMedia" && e[1] === video),
    "sem isto o video fica em 0:00 e nao pede segmentos. Eventos: " + nomes.join(",")
  );
  ver(
    "attachMedia vem ANTES do loadSource",
    nomes.includes("attachMedia") &&
      nomes.includes("loadSource") &&
      nomes.indexOf("attachMedia") < nomes.indexOf("loadSource"),
    nomes.join(",")
  );
  ver(
    "e o loadSource recebe a string do src",
    hls.eventos.some((e) => e[0] === "loadSource" && e[1] === src)
  );

  // ---- B) mudar SO' o onErro nao pode recriar o hls ----
  const antes = hls.instancias.length;
  const marca = hls.eventos.length;
  react.__render(modulo.useHlsEngine, {
    src,
    isM3U8: true,
    videoRef,
    onErro: () => {}, // identidade nova, como em cada render do Player
  });
  const depois = hls.eventos.slice(marca).map((e) => e[0]);
  ver(
    "**mudar o onErro nao recria o hls** (saiu das dependencias)",
    hls.instancias.length === antes && !depois.includes("destroy") && !depois.includes("new"),
    "eventos depois da 2.a renderizacao: " + (depois.join(",") || "(nenhum)")
  );

  // ---- C) mudar o isM3U8 (com o MESMO src) tem de ser avaliado ----
  const marca2 = hls.eventos.length;
  react.__render(modulo.useHlsEngine, {
    src,
    isM3U8: false, // passou a ser um ficheiro progressivo
    videoRef,
    onErro: () => {},
  });
  const depois2 = hls.eventos.slice(marca2).map((e) => e[0]);
  ver(
    "mudar isM3U8 sem mudar o src reavalia a fonte",
    video.src === src && depois2.includes("destroy"),
    "video.src=" + JSON.stringify(video.src) + " eventos=" + depois2.join(",")
  );

  // ---- D) ficheiro progressivo: NUNCA vai para o hls.js ----
  react.__reset();
  hls.__limpar();
  const mp4 = "https://exemplo.pt/filme.mp4";
  const video2 = { src: "" };
  react.__render(modulo.useHlsEngine, {
    src: mp4,
    isM3U8: false,
    videoRef: { current: video2 },
    onErro: () => {},
  });
  ver(
    "**um mp4 (isM3U8:false) nao cria hls.js**",
    hls.instancias.length === 0,
    "o `src.isM3U8` antigo lia `undefined` numa string e mandava o mp4 para o hls"
  );
  ver("e o <video> recebe o src directo", video2.src === mp4, JSON.stringify(video2.src));

  // ---- E) sem isM3U8 o comportamento antigo mantem-se (HLS por omissao) ----
  react.__reset();
  hls.__limpar();
  react.__render(modulo.useHlsEngine, {
    src,
    isM3U8: undefined,
    videoRef: { current: { src: "" } },
    onErro: () => {},
  });
  ver("sem o parametro, um m3u8 continua a usar hls", hls.instancias.length === 1);

  // ---- F) a rede a cair a meio: recupera 3x, depois desiste e troca de fonte ----
  // O HlsPlayer recebe `onErro` do Player, que passa a fonte seguinte. Se o
  // gancho nunca desistisse, o video ficava preso num erro para sempre.
  react.__reset();
  hls.__limpar();
  let errosChamados = 0;
  react.__render(modulo.useHlsEngine, {
    src,
    isM3U8: true,
    videoRef: { current: { src: "" } },
    onErro: () => {
      errosChamados++;
    },
  });
  const inst = hls.instancias[0];
  const fogo = inst?.handlers["error"]?.[0];
  if (typeof fogo === "function") {
    // 4 erros fatais de rede: os 3 primeiros recuperam, o 4.o desiste.
    for (let i = 0; i < 4; i++) fogo(null, { fatal: true, type: "network-error" });
  }
  ver(
    "a rede a cair: tenta recuperar 3 vezes",
    hls.eventos.filter((e) => e[0] === "startLoad").length === 3,
    JSON.stringify(hls.eventos.map((e) => e[0]))
  );
  ver(
    "e a 4.a falha desiste e chama onErro (o Player troca de fonte)",
    errosChamados === 1 && hls.eventos.some((e) => e[0] === "destroy"),
    "onErro=" + errosChamados
  );

  return resultados;
}

// ---------------------------------------------------------------------------
// 1) O gancho real
// ---------------------------------------------------------------------------
console.log("");
console.log("  1) o gancho real: attachMedia, dependencias e isM3U8");
const real = criarPasta(BASE, "real");
{
  const resultados = await cenarios(real.dir, real.alvo, "real");
  for (const r of resultados) ok_(r.nome, r.cond, r.extra);
}

// ---------------------------------------------------------------------------
// 2) O HlsPlayer passa o isM3U8 a parte
// ---------------------------------------------------------------------------
console.log("");
console.log("  2) o HlsPlayer entrega o isM3U8 como parametro separado");
{
  const player = fs.readFileSync(HLS_PLAYER, "utf8");
  ok_(
    "le o isM3U8 de sources[0], nao de uma propriedade da string",
    /const isM3U8 = sources\[0\]\?\.isM3U8;/.test(player)
  );
  ok_(
    "e passa-o na chamada do gancho",
    /useHlsEngine\(\{\s*\n?\s*src,\s*\n?\s*isM3U8,/.test(player)
  );
  // A prova de que isto nao e' so' texto: a mutacao M4 abaixo troca o parametro
  // pelo `src.isM3U8` no gancho e os cenarios falham.
}

// ---------------------------------------------------------------------------
// 3) Mutacoes: o teste apanha mesmo os defeitos?
// ---------------------------------------------------------------------------
console.log("");
console.log("  3) mutacoes (o teste tem de as apanhar)");

const MUTACOES = [
  [
    "tira o attachMedia",
    "    if (video) hls.attachMedia(video);\n",
    "",
  ],
  [
    "poe o loadSource antes do attachMedia",
    "    if (video) hls.attachMedia(video);\n    hls.loadSource(src);",
    "    hls.loadSource(src);\n    if (video) hls.attachMedia(video);",
  ],
  [
    "volta a meter o onErro nas dependencias",
    "  }, [src, isM3U8]);",
    "  }, [src, isM3U8, onErro]);",
  ],
  [
    "le src.isM3U8 (a string) em vez do parametro",
    "isM3U8 !== false",
    "src.isM3U8 !== false",
  ],
  [
    "tira o isM3U8 das dependencias",
    "  }, [src, isM3U8]);",
    "  }, [src]);",
  ],
  [
    "a recuperacao de rede nunca desiste (o video fica preso)",
    "if (errosRef.current.network < 3) {",
    "if (errosRef.current.network < 100) {",
  ],
];

for (const [nome, de, para] of MUTACOES) {
  if (!BASE.includes(de)) {
    ok_("MUTACAO IMPOSSIVEL (o codigo mudou): " + nome, false);
    continue;
  }
  const pasta = criarPasta(BASE.replace(de, para), "mut");
  let resultados;
  try {
    resultados = await cenarios(pasta.dir, pasta.alvo, "mut-" + Math.random().toString(16).slice(2));
  } catch {
    // Um rebentar tambem conta: o comportamento mudou.
    resultados = [{ nome: "o modulo mutado atirou", cond: false, extra: "" }];
  }
  fs.rmSync(pasta.dir, { recursive: true, force: true });
  const apanhada = resultados.some((r) => !r.cond);
  ok_("MUTACAO apanhada: " + nome, apanhada, apanhada ? "" : "o teste nao deu por ela");
}

fs.rmSync(real.dir, { recursive: true, force: true });

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
