// Prova a parte NOVA do modo P2P (o que funciona sem Real-Debrid):
//   - `pecasDaJanela`: que pecas do torrent sao pedidas primeiro
//   - `priorizarPecas`: aplica isso ao torrent certo
//   - o `addTorrent` nao espera pelo ficheiro inteiro (`ready`)
//
// A funcao `pecasDaJanela` e' pura de proposito: e' o que a torna testavel sem
// WebTorrent, sem disco e sem rede. `priorizarPecas` e' o embrulho fino que a
// chama, e tambem se testa aqui, com um torrent falso que regista o que lhe
// foi pedido.
import assert from "node:assert/strict";
import path from "node:path";
import { pecasDaJanela, priorizarPecas, JANELA_CRITICA } from "../server/src/services/torrentEngine.js";

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

/* ---------- 1) O caso simples: ficheiro no inicio do torrent ---------- */
// 1 MiB de pieceLength: 64 pecas. O `offset` e' 0, portanto o byte do ficheiro
// e' o byte do torrent.

const MB = 1024 * 1024;

// `fim` em aberto + janela de 8 MB + pieceLength de 1 MiB = pecas 0..8 (o byte
// 8*1MiB ja e' a peca seguinte, por isso fecha em 8 e nao em 7).
ok_(
  "pedido sem fim cobre a janela de 8 MB -> pecas 0..8",
  JSON.stringify(pecasDaJanela({ offset: 0, tamanho: 100 * MB, pieceLength: MB, inicio: 0, fim: null })) ===
    JSON.stringify([0, 8])
);

// `fim` explicito e' respeitado quando cabe dentro da janela:
ok_(
  "fim explicito dentro da janela",
  JSON.stringify(pecasDaJanela({ offset: 0, tamanho: 100 * MB, pieceLength: MB, inicio: 0, fim: 2 * MB + 100 })) ===
    JSON.stringify([0, 2])
);

/* ---------- 2) O `offset` conta: ficheiro a meio do torrent ---------- */
// O ficheiro comeca no byte 10 MiB dentro do torrent (o caso dos packs/batch de
// anime, em que o episodio nao e' a primeira coisa). Sem o `offset`, marcaríamos
// as pecas do ficheiro ERRADO.

// `fim` em aberto aqui e' o fim do FICHEIRO (4 MB a partir do offset 10 MB),
// por isso a peca final e' a 13 (bytes 13..14 MiB do torrent).
ok_(
  "offset de 10 MB muda as pecas",
  JSON.stringify(pecasDaJanela({ offset: 10 * MB, tamanho: 4 * MB, pieceLength: MB, inicio: 0, fim: null })) ===
    JSON.stringify([10, 13])
);

ok_(
  "seek para 2 MB dentro do ficheiro (offset 10 MB) -> pecas 12..13",
  JSON.stringify(
    pecasDaJanela({ offset: 10 * MB, tamanho: 4 * MB, pieceLength: MB, inicio: 2 * MB, fim: 3 * MB })
  ) === JSON.stringify([12, 13])
);

/* ---------- 3) A JANELA: e' o que impede "marcar o ficheiro todo" ---------- */
// O browser pede `bytes=0-` (fim aberto) ao comecar. Sem janela, `fim` seria o
// fim do ficheiro e TODAS as pecas ficariam criticas — o mesmo que nao marcar
// nada. E' o teste que garante que a otimizacao vale alguma coisa.

const janela = pecasDaJanela({ offset: 0, tamanho: 4 * 1024 * MB, pieceLength: MB, inicio: 0, fim: null });
ok_("pedido sem fim NAO marca o ficheiro todo", janela[1] - janela[0] < 100);
ok_(
  "a janela cobre ~8 MB (a constante)",
  JANELA_CRITICA === 8 * MB && janela[1] === 8
);

// Seek muito para a frente: a janela e' a partir de ONDE, nao do inicio.
const seek = pecasDaJanela({ offset: 0, tamanho: 4000 * MB, pieceLength: MB, inicio: 3000 * MB, fim: null });
ok_("a janela comeca no ponto de leitura", seek[0] === 3000);

/* ---------- 4) Casos limite ---------- */

ok_("pieceLength invalido -> null", pecasDaJanela({ offset: 0, tamanho: MB, pieceLength: 0 }) === null);
ok_("ficheiro vazio -> null", pecasDaJanela({ offset: 0, tamanho: 0, pieceLength: MB }) === null);
ok_("inicio depois do fim -> null", pecasDaJanela({ offset: 0, tamanho: MB, pieceLength: MB, inicio: 5 * MB, fim: null }) === null);
ok_("inicio negativo e' tratado como 0", JSON.stringify(pecasDaJanela({ offset: 0, tamanho: MB, pieceLength: MB, inicio: -5, fim: null })) === JSON.stringify([0, 0]));
ok_("NaN no inicio e' tratado como 0", JSON.stringify(pecasDaJanela({ offset: 0, tamanho: MB, pieceLength: MB, inicio: NaN, fim: null })) === JSON.stringify([0, 0]));
ok_("fim invertido cai para o fim do ficheiro", JSON.stringify(pecasDaJanela({ offset: 0, tamanho: MB, pieceLength: MB, inicio: 0, fim: -1 })) === JSON.stringify([0, 0]));
ok_("offset invalido -> null", pecasDaJanela({ offset: NaN, tamanho: MB, pieceLength: MB }) === null);

/* ---------- 5) `priorizarPecas`: o embrulho com um torrent de mentira ---------- */
// Um torrent falso que regista o `critical(start, end)` que recebeu.

function torrentFalso({ pieceLength = MB, destroyed = false } = {}) {
  const registos = [];
  return {
    pieceLength,
    destroyed,
    registos,
    critical(a, b) {
      registos.push([a, b]);
    },
  };
}

const t1 = torrentFalso();
const f1 = { offset: 10 * MB, length: 4 * MB };
const quantas = priorizarPecas(t1, f1, 0, null);
ok_("priorizarPecas marca as pecas", JSON.stringify(t1.registos) === JSON.stringify([[10, 13]]));
ok_("priorizarPecas devolve quantas pecas", quantas === 4);

// Torrent morto: nao pode rebentar o pedido de video.
const t2 = torrentFalso({ destroyed: true });
ok_("torrent destruido devolve 0 e nao rebenta", priorizarPecas(t2, { offset: 0, length: MB }, 0, null) === 0);
ok_("torrent destruido nao recebeu nada", t2.registos.length === 0);

// `critical` que lanca (o WebTorrent atira se o torrent morreu a meio):
const t3 = { pieceLength: MB, destroyed: false, critical() { throw new Error("torrent is destroyed"); } };
ok_("critical() que rebenta devolve 0", priorizarPecas(t3, { offset: 0, length: MB }, 0, null) === 0);

// Ficheiro sem `offset`/`length`: nada a fazer, sem rebentar.
const t4 = torrentFalso();
ok_("file sem length -> 0", priorizarPecas(t4, {}, 0, null) === 0);
ok_("file sem length nao marcou nada", t4.registos.length === 0);

/* ---------- 6) Peças nao alinhadas (a coisa que o `offset` resolve) ---------- */
// Um torrent com pieceLength de 256 KiB e um ficheiro que comeca a meio de uma
// peca. O byte 0 do FICHEIRO esta' na peca 1, nao na peca 0.

const PL = 256 * 1024;
const meioPeca = 100 * 1024; // o ficheiro comeca 100 KiB dentro da peca 0
const r = pecasDaJanela({ offset: meioPeca, tamanho: 2 * MB, pieceLength: PL, inicio: 0, fim: null });
ok_("ficheiro que comeca a meio de uma peca", r[0] === 0 && r[1] >= 7, `peças ${r[0]}..${r[1]}`);

// O primeiro byte util do ficheiro e' o `offset`, logo a peca do inicio e' a
// que CONTEM esse offset. Confirmado aqui para nao haver suposicao:
const byteDoInicio = r[0] * PL;      // primeiro byte que a peca r[0] cobre
assert.ok(byteDoInicio <= meioPeca && byteDoInicio + PL > meioPeca, "a peca inicial tem de conter o offset");

/* ---------- 7) MUTACOES ---------- */
// O que da valor a este ficheiro: partir a funcao tem de partir o teste. Nao
// basta correr o codigo certo — e' preciso ver que o codigo partido da' errado.
//
// Cada mutacao reescreve a fonte da funcao e executa-a sozinha, num `data:` URI:
// nao toca no ficheiro em disco e nao precisa do resto do modulo (que importa
// `./log.js`, inexistente fora da pasta do servidor).

const fs = await import("node:fs");
const CAMINHO = new URL("../server/src/services/torrentEngine.js", import.meta.url);
const src = fs.readFileSync(CAMINHO, "utf8");

/**
 * Executa uma versao de `pecasDaJanela` isolada.
 *
 * Corta o texto da funcao do ficheiro em vez de o importar: o resto do modulo
 * importa `./log.js`, que nao existe fora da pasta do servidor.
 *
 * E' um ficheiro na pasta temporaria do sistema, com nome unico: o Node importa
 * um modulo UMA vez por URL (com `data:` URI a segunda mutacao receberia o
 * resultado da primeira), e `web/src` nunca e' tocado — uma corrida anterior
 * deixou `_mut-*.mjs` em `web/src` e o `eslint` do `build` apanhou-os.
 */
async function pecasDe(fonte) {
  const inicio = fonte.indexOf("export function pecasDaJanela(");
  if (inicio < 0) return null;
  // O `{` do CORPO da funcao (a lista de destructuring) tambem fecha com `}`, e
  // por isso contar chaves a partir do `(` da assinatura dava a assinatura
  // inteira. Por isso o corpo conta as chaves a partir do `{` que segue o `)`:
  // esse e' o unico fecho que devolve o nivel a zero no fim da funcao.
  const abre = fonte.indexOf("{", fonte.indexOf(")", inicio));
  if (abre < 0) return null;
  let nivel = 0;
  let fim = -1;
  for (let i = abre; i < fonte.length; i++) {
    if (fonte[i] === "{") nivel++;
    else if (fonte[i] === "}") {
      nivel--;
      if (nivel === 0) {
        fim = i + 1;
        break;
      }
    }
  }
  if (fim < 0) return null;
  const corpo = fonte.slice(inicio, fim);

  // So' falta declarar a constante de que a funcao depende. NOTA: nao se
  // acrescenta `export { pecasDaJanela }` — o `export` da assinatura JA'
  // exporta a funcao, e a segunda linha dava "Duplicate export" e o ficheiro
  // nao carregava.
  //
  // Cada corpo vai para um ficheiro com nome unico na pasta temporaria do
  // sistema: o Node importa um modulo UMA vez por URL (com `data:` URI a
  // segunda mutacao receberia o resultado da primeira), e `web/src` nunca e'
  // tocado — uma corrida anterior deixou `_mut-*.mjs` em `web/src` e o `eslint`
  // do `build` apanhou-os.
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(path.join(tmpdir(), "meida-p2p-"));
  const ficheiro = path.join(dir, "p.mjs");
  writeFileSync(ficheiro, corpo + `\nconst JANELA_CRITICA = ${JANELA_CRITICA};\n`);
  try {
    const mod = await import("file:///" + ficheiro.replace(/\\/g, "/"));
    return mod.pecasDaJanela;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CASO_OFFSET = { offset: 10 * MB, tamanho: 4 * MB, pieceLength: MB, inicio: 2 * MB, fim: 3 * MB };
const CASO_JANELA = { offset: 0, tamanho: 4000 * MB, pieceLength: MB, inicio: 3000 * MB, fim: null };
const CASO_FIM = { offset: 0, tamanho: 100 * MB, pieceLength: MB, inicio: 0, fim: 2 * MB + 100 };

const MUTACOES = [
  // O bug do `offset`: sem ele, um seek marca as pecas do inicio do TORRENT, que
  // num pack sao as de outro episodio.
  ["sem o `offset` (pecas do torrent, nao do ficheiro)",
   "(offset + de) / pieceLength", "de / pieceLength",
   CASO_OFFSET, JSON.stringify([12, 13])],
  // O bug da janela: sem ela, `bytes=0-` marca o ficheiro todo e a otimizacao
  // nao otimiza nada.
  ["sem a janela (marca o ficheiro todo)",
   "Math.min(pedido, limite, tamanho - 1)", "Math.min(pedido, tamanho - 1)",
   CASO_JANELA, JSON.stringify([3000, 3007])],
  // A ordem do `Math.min`: trocando os dois argumentos, o `fim` explicito do
  // Range deixa de valer e a janela manda sempre.
  ["o `limite` antes do `pedido` (ignora o fim do Range)",
   "Math.min(pedido, limite, tamanho - 1)", "Math.min(limite, tamanho - 1)",
   CASO_FIM, JSON.stringify([0, 2])],
  // A ultima peca: `tamanho - 1` e' o ultimo BYTE;_marker um byte acima marca
  // uma peca a mais do que existe.
  ["marca uma peca a mais no fim",
   "Math.floor((offset + para) / pieceLength)", "Math.floor((offset + para + 1) / pieceLength)",
   { offset: 0, tamanho: 1025, pieceLength: 1024, inicio: 0, fim: null }, JSON.stringify([0, 0])],
];

console.log("");
for (const [nome, de, para, entrada, esperado] of MUTACOES) {
  if (!src.includes(de)) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
    falhou++;
    continue;
  }
  const partido = src.replace(de, para);
  if (partido === src) {
    console.log("  FALHA MUTACAO VAZIA (nao mudou nada): " + nome);
    falhou++;
    continue;
  }
  const f = await pecasDe(partido);
  if (!f) {
    console.log("  FALHA nao consegui executar a funcao partida: " + nome);
    falhou++;
    continue;
  }
  const got = JSON.stringify(f(entrada));
  if (got === esperado) {
    console.log("  FALHA MUTACAO NAO DETECTADA (a funcao partida da' o mesmo): " + nome);
    falhou++;
  } else {
    console.log("  OK    MUTACAO apanhada: " + nome);
    ok++;
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);