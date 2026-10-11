// Prova o comportamento do `addTorrent` de que o modo P2P depende: resolver nos
// METADADOS e nao no `ready` (100% descarregado), e dar erro em vez de esperar
// para sempre quando o torrent nao tem ninguem.
//
// Corre com um WebTorrent de mentira injectado por baixo do `import`: o
// `webtorrent` real traz o `node-datachannel` (binario nativo, que nem existe
// para esta arquitectura) e isto nao e' um teste de rede, e' um teste de
// QUANDO resolvemos a promessa.
//
// O motor e' uma COPIA com os dois imports trocados, escrita na pasta
// temporaria do sistema. `server/src` nunca e' tocado.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { pathToFileURL, fileURLToPath } from "node:url";

const MB = 1024 * 1024;

let ok = 0;
let falhou = 0;
const ok_ = (nome, cond, extra = "") => {
  if (cond) {
    ok++;
    console.log("  OK    " + nome);
  } else {
    falhou++;
    console.log("  FALHA " + nome + (extra ? "  (" + extra + ")" : ""));
  }
};

/* ---------- Torrent e cliente de mentira ---------- */

class TorrentFalso extends EventEmitter {
  constructor(infoHash, { pieceLength = MB, length = 4 * MB } = {}) {
    super();
    this.infoHash = infoHash;
    this.pieceLength = pieceLength;
    this.length = length;
    this.files = [];
    this.pieces = new Array(Math.ceil(length / pieceLength)).fill(null);
    this.ready = false;
    this.destroyed = false;
    this.marcadas = [];
  }
  /** Simula a chegada dos metadados (ainda sem `ready`). */
  temMetadados() {
    this.files = [{ name: "video.mp4", length: this.length, offset: 0 }];
    this.emit("metadata");
  }
  critical(a, b) {
    if (this.destroyed) throw new Error("torrent is destroyed");
    this.marcadas.push([a, b]);
  }
  deselect() {}
  destroy() {
    this.destroyed = true;
    this.emit("close");
  }
}

class ClientFalso extends EventEmitter {
  constructor() {
    super();
    this.torrents = [];
  }
  add(torrentId) {
    const infoHash = /btih:([0-9a-f]+)/i.exec(String(torrentId))?.[1] || String(torrentId);
    const t = new TorrentFalso(infoHash);
    this.torrents.push(t);
    return t;
  }
}

/* ---------- Carrega o motor com o cliente falso ---------- */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-wt-"));

// O webtorrent 2.x exporta uma CLASSE, e `new WebTorrent()` ja' se regista
// como cliente (o construtor devolve `undefined`). O motor trata dos dois, por
// isso o falso tem de ser uma classe que devolve o cliente.
fs.writeFileSync(
  path.join(dir, "webtorrent.mjs"),
  "export default class { constructor() { return globalThis.__wtCliente; } };\n"
);
fs.writeFileSync(
  path.join(dir, "log.mjs"),
  "export const log = { info() {}, warn() {}, error() {} };\n"
);
// O `webtorrent` e' importado em TEMPO DE EXECUCAO (`await import("webtorrent")`),
// por isso trocar so' o `import` estatico nao chega: a string do `import`
// dinamico tambem tem de apontar para o ficheiro falso.
// PRAZO_ENSAIO substitui o prazo real de 30 s. Nao e' uma mutacao: e' o harness
// a encurtar a espera para o teste demorar segundos em vez de 30 s. O codigo
// de producao fica com o valor que tem, e o teste continua a ver que existe um
// prazo (a mutacao "sem o timeout" remove-o).
const PRAZO_ENSAIO = 400;

const trocarImports = (texto) =>
  texto
    .replace(/from "webtorrent"/g, 'from "./webtorrent.mjs"')
    .replace(/import\("webtorrent"\)/g, 'import("./webtorrent.mjs")')
    .replace(/from "\.\/log\.js"/g, 'from "./log.mjs"')
    .replace(/const META_TIMEOUT_MS = 30_000;/, `const META_TIMEOUT_MS = ${PRAZO_ENSAIO};`);

fs.writeFileSync(
  path.join(dir, "motor.mjs"),
  trocarImports(
    fs.readFileSync(path.join(RAIZ, "server", "src", "services", "torrentEngine.js"), "utf8")
  )
);

const cliente = new ClientFalso();
globalThis.__wtCliente = cliente;

let mod;
try {
  mod = await import(pathToFileURL(path.join(dir, "motor.mjs")).href);
} catch (e) {
  console.log("  NAO CONSEGUI CARREGAR O MOTOR: " + e.message);
  process.exit(1);
}

const { getTorrentFile, priorizarPecas, getStatus, torrentsDisponiveis } = mod;

// `carregar()` so' corre a primeira vez que se pede um torrent (e' um import
// assincrono), por isso `torrentsDisponiveis()` e' `false` ate la. O que
// interessa e' que depois do primeiro pedido esteja disponivel.
ok_("antes de usar, os torrents ainda nao estao carregados (import e' lazy)", torrentsDisponiveis() === false);

/* ---------- 1) Resolve nos METADADOS, nao no `ready` ---------- */
// Este e' o bug principal: antes esperava pelo `ready`, ou seja, pelo ficheiro
// INTEIRO em disco. Retomar um episodio pela segunda vez ficava bloqueado ate
// acabar o download — sem buffering nenhum.

const HASH1 = "a".repeat(40);
const p1 = getTorrentFile(HASH1, null);

// O `carregar()` e' assincrono (um `import`), por isso o torrent so' existe na
// lista DEPOIS de um tick. Sem esta espera, `cliente.torrents` ainda estava
// vazio e o teste rebentava a ler `undefined`.
await new Promise((r) => setTimeout(r, 60));
ok_("depois do primeiro pedido, os torrents ficam disponiveis", torrentsDisponiveis());
const t1 = cliente.torrents[cliente.torrents.length - 1];
ok_("o torrent foi adicionado ao cliente", !!t1 && t1.infoHash === HASH1);

let resolvido1 = false;
p1.then(
  () => (resolvido1 = true),
  () => (resolvido1 = true)
);
await new Promise((r) => setTimeout(r, 40));
ok_("sem metadados, ainda nao resolve", resolvido1 === false);

t1.temMetadados();
await new Promise((r) => setTimeout(r, 40));
ok_("resolve quando chegam os metadados, sem `ready`", resolvido1 === true);
ok_("o torrent continua NAO descarregado (foi mesmo so' metadados)", t1.ready === false);

/* ---------- 2) Reutilizar um torrent ja' em curso tambem resolve logo ---------- */

const HASH2 = "b".repeat(40);
const p2 = getTorrentFile(HASH2, null);
await new Promise((r) => setTimeout(r, 60));
const t2 = cliente.torrents[cliente.torrents.length - 1];
t2.temMetadados();
const r2 = await p2;
ok_("reutilizar um torrent com metadados resolve", !!r2.file);

let resolvido3 = false;
getTorrentFile(HASH2, null).then(
  () => (resolvido3 = true),
  () => (resolvido3 = true)
);
await new Promise((r) => setTimeout(r, 40));
ok_("o segundo pedido do MESMO torrent nao espera por nada", resolvido3 === true);

/* ---------- 3) Torrent morto: erro em vez de esperar para sempre ---------- */
// Um torrent sem seeds nunca emite `metadata` nem `error`. Antes, o pedido de
// video ficava pendurado para sempre (barra de progresso parada sem fim).

const HASH3 = "c".repeat(40);
const p4 = getTorrentFile(HASH3, null);
await new Promise((r) => setTimeout(r, 60));
const t3 = cliente.torrents[cliente.torrents.length - 1];

const inicio = Date.now();
const erro = await p4.then(
  () => null,
  (e) => e
);
const passou = Date.now() - inicio;
ok_("um torrent sem metadados da' ERRO em vez de esperar sempre", !!erro);
ok_("o erro tem codigo para o frontend", erro?.code === "SEM_METADADOS");
ok_("o erro tem status HTTP (504, nao 500)", erro?.status === 504);
ok_(
  "o torrent morto foi destruido (nao fica a tentar sempre)",
  t3.destroyed === true
);
// O prazo real em producao e' de 30 s (ver `META_TIMEOUT_MS`); aqui o harness
// encurta-o para o teste acabar em segundos. O que interessa e' que existe um
// prazo: nem instantaneo, nem infinito.
ok_(
  "esperou o prazo (nao instantaneo, nao infinito)",
  passou > 50 && passou < PRAZO_ENSAIO * 4,
  "passou " + passou + " ms"
);

/* ---------- 4) `getStatus` diz se ja' ha' metadados ---------- */
// E' o que distingue "ninguem tem isto" de "esta' devagar" — situacoes em que se
// espera de maneira completamente diferente.

const s1 = getStatus(HASH1);
ok_("getStatus devolve temMetadados", s1?.temMetadados === true);
ok_("o torrent NOTA-ready tem metadados na mesma", s1?.ready === false);
ok_("torrent inexistente da' null", getStatus("d".repeat(40)) === null);

/* ---------- 5) `priorizarPecas` contra um torrent de mentira ---------- */

const marcas = priorizarPecas(t1, r2.file, 0, null);
ok_("marca as pecas do inicio", t1.marcadas.length === 1 && t1.marcadas[0][0] === 0);
ok_("devolve o numero de pecas", marcas > 0);

// Um torrent destruido entre o `getTorrentFile` e o `priorizar` nao pode rebentar
// o pedido de video (e' o tipo de crash que matou a app na 1.2.7 — ver AGENTS.md).
t2.destroy();
ok_("torrent destruido a meio da devolve 0", priorizarPecas(t2, r2.file, 0, null) === 0);

/* ---------- 6) MUTACOES ---------- */
// O que da valor a este ficheiro: voltar a esperar pelo `ready` tem de partir o
// teste. E' o bug real que estes testes existem para travar.

const fonte = fs.readFileSync(
  path.join(RAIZ, "server", "src", "services", "torrentEngine.js"),
  "utf8"
);

// Cada mutacao parte UMA coisa. A de trasso e' a ORIGINAL (voltar ao bug), e e'
// a mais importante: e' ela que diz que o teste sabe a diferenca entre
// "resolve nos metadados" e "resolve no fim do download".
const MUTACOES = [
  [
    "volta a esperar pelo `ready` (o bug original)",
    "if (temMetadados(t)) return res(t);",
    "if (t.ready) return res(t);",
  ],
  [
    "sem o timeout (um torrent sem seeds espera para sempre)",
    "}, META_TIMEOUT_MS);",
    "}, 0);",
  ],
  [
    "sem destruir o torrent morto",
    "aoEstourar?.();",
    "void 0;",
  ],
];

console.log("");
for (const [nome, de, para] of MUTACOES) {
  if (!fonte.includes(de)) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
    falhou++;
    continue;
  }
  const partido = fonte.replace(de, para);
  if (partido === fonte) {
    console.log("  FALHA MUTACAO VAZIA: " + nome);
    falhou++;
    continue;
  }

  // Carrega o motor partido num `cwd` novo (o `import` do Node guarda por URL,
  // por isso tem de ser um ficheiro com outro nome) e ve se ainda se comporta.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "meida-wt-mut-"));
  fs.writeFileSync(
    path.join(dir2, "webtorrent.mjs"),
    "export default class { constructor() { return globalThis.__wtCliente; } };\n"
  );
  fs.writeFileSync(path.join(dir2, "log.mjs"), "export const log = { info(){}, warn(){}, error(){} };\n");
  fs.writeFileSync(path.join(dir2, "motor.mjs"), trocarImports(partido));
  const cliente2 = new ClientFalso();
  globalThis.__wtCliente = cliente2;

  let mudou = false;
  try {
    const m2 = await import(pathToFileURL(path.join(dir2, "motor.mjs")).href);
    // Torrent sem metadados: tem de dar erro num prazo curto.
    const th = "e".repeat(40);
    const p = m2.getTorrentFile(th, null);
    // `.catch` vazio: ha' ramos em que o `Promise.race` da' o prazo ganha e a
    // promessa rejeita DEPOIS. Sem este `catch` o Node aborta com
    // "unhandled rejection" e a mutacao que estamos a provar mata o teste
    // inteiro, em vez de o fazer falhar.
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    const t = cliente2.torrents[cliente2.torrents.length - 1];
    const t0 = Date.now();
    const r = await Promise.race([
      p.then(
        () => "ok",
        () => "erro"
      ),
      new Promise((res) => setTimeout(() => res("pendente"), PRAZO_ENSAIO * 4)),
    ]);
    const dt = Date.now() - t0;

    // Cada mutacao parte UMA coisa, e o teste ve ESSA coisa. Escrever as
    // condicoes uma a uma (em vez de um `||` generico) e' o que garante que
    // uma mutacao nao passa por estar a verificar outra.
    if (nome.startsWith("volta a esperar")) {
      // O bug original, visto pelo lado que importa na pratica: RETOMAR.
      //
      // Com `if (t.ready)` em vez de `if (temMetadados(t))`, um torrent que ja'
      // tem metadados mas ainda NAO esta' descarregado fica a espera de um
      // `ready` que so' chega no fim do download — e o `metadata` ja' foi
      // emitido, portanto o listener novo nunca dispara. O pedido fica
      // pendurado ate ao prazo: e' exactamente "retomar um episodio fica
      // bloqueado ate o ficheiro inteiro estar em disco".
      const th2 = "f".repeat(40);
      const p2 = m2.getTorrentFile(th2, null);
      p2.catch(() => {});
      await new Promise((r) => setTimeout(r, 60));
      const t2 = cliente2.torrents[cliente2.torrents.length - 1];
      t2.temMetadados(); // metadados chegaram; `ready` NUNCA

      // Segunda chamada ao MESMO torrent: e' o caso "retomar".
      const rr3 = await Promise.race([
        m2.getTorrentFile(th2, null).then(
          () => "ok",
          () => "erro"
        ),
        new Promise((res) => setTimeout(() => res("pendente"), 250)),
      ]);
      // certo -> "ok" (tem metadados, resolve logo)
      // partido -> "pendente" (espera por `ready`, que nunca vem)
      mudou = rr3 === "pendente" && t2.ready === false;
    } else if (nome.startsWith("sem o timeout")) {
      // Sem o timeout, um torrent sem metadados fica pendurado. `r === "erro"`
      // com `dt >= PRAZO_ENSAIO` e' o comportamento certo; a mutacao da' erro
      // instantaneo (dt ~0) porque o `setTimeout(..., 0)` dispara logo.
      mudou = r === "erro" && dt < 60;
    } else if (nome.startsWith("sem destruir")) {
      // O codigo certo DESTRUI o torrent ao estourar o prazo. Sem a chamada, o
      // torrent continua a tentar e cada reproducao nova volta a esperar 30 s.
      mudou = r === "erro" && !!t && t.destroyed === false;
    }
  } catch (e) {
    mudou = true; // uma mutacao que rebenta o motor tambem parte o teste
  }
  fs.rmSync(dir2, { recursive: true, force: true });

  if (!mudou) {
    console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
    falhou++;
  } else {
    console.log("  OK    MUTACAO apanhada: " + nome);
    ok++;
  }
}

fs.rmSync(dir, { recursive: true, force: true });

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);