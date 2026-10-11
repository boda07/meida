import os from "node:os";
import { resolve } from "node:path";

import { log } from "./log.js";

// Onde os pedacos descarregados sao guardados (temporario do sistema).
const DOWNLOAD_DIR = resolve(os.tmpdir(), "streamapp-torrents");

// O WebTorrent e' opcional. Depende do node-datachannel, que tem um binario
// nativo (.node) especifico da arquitectura; em Windows, se o binario for de
// outra arquitectura, o Node morre com
//
//   Error: node_datachannel.node is not a valid Win32 application
//
// O import era ESTATICO, por isso o servidor morria ao arrancar e a janela da
// app ficava preta. Agora carrega em silencio: se falhar, o resto da app
// funciona e so as funcionalidades de torrent ficam indisponiveis.
let client = null;
let motivo = "";
let tentativaFeita = false;

async function carregar() {
  if (client || tentativaFeita) return client;
  tentativaFeita = true;
  try {
    const mod = await import("webtorrent");
    const WebTorrent = mod.default || mod;
    client = new WebTorrent();
    client.on("error", (e) => log.error("webtorrent", e.message));
    log.info("webtorrent", "torrents disponiveis.");
  } catch (e) {
    motivo = e?.message || String(e);
    log.warn(
      "webtorrent",
      `Torrents indisponiveis neste PC (${motivo}). O resto da app funciona.`
    );
  }
  return client;
}

export function torrentsDisponiveis() {
  return !!client;
}

export function motivoIndisponivel() {
  return motivo;
}

// infoHash -> magnet completo (com trackers), preenchido quando listamos torrents.
const magnetCache = new Map();
const VIDEO_RE = /\.(mp4|m4v|mkv|webm|avi|mov|ts|mpg|mpeg|wmv|flv)$/i;

// Quanto tempo se espera pelos METADADOS antes de dar o torrent como morto.
//
// Sem isto, um torrent sem seeds fica a rodar para sempre: o `c.add()` nunca
// chama o callback e o `error` raramente dispara (o WebTorrent emite um
// `warning`, nao um `error`, quando nao encontra os metadados). No frontend era
// uma barra de progresso parada sem fim e sem explicacao.
const META_TIMEOUT_MS = 30_000;

// Janela de bytes marcada como "critica" a partir da posicao de leitura.
//
// TEM de ter um limite. O browser pede `bytes=0-` (sem fim) para comecar a
// reproduzir, e o `end` nesse caso e' o fim do ficheiro. Sem o limite,
// marcariamos o ficheiro inteiro como critico — o que e' o mesmo que nao
// marcar nada, porque a prioridade e' uniforme. 8 MB dah para ~8 segundos de
// video a 1080p, que e' muito mais do que o buffer precisa antes de comecar.
export const JANELA_CRITICA = 8 * 1024 * 1024;

/**
 * Converte um pedido de leitura (em bytes DENTRO do ficheiro) no intervalo de
 * pecas do torrent a pedir primeiro. Funcao PURA: nao toca em nada, devolve
 * `[primeiraPeca, ultimaPeca]` ou `null`. E' o que a torna testavel sem
 * WebTorrent e sem disco — ver `scripts/testar-p2p.mjs`.
 *
 * O truque do `offset`: dentro de um torrent as pecas sao do TORRENT, nao do
 * ficheiro. Num pack/batch o filme comeca a meio do torrent, por isso os bytes
 * que o player pede nao sao os indices de peca. Sem somar o `offset` marcariamos
 * as pecas do ficheiro errado.
 */
export function pecasDaJanela({
  offset,
  tamanho,
  pieceLength,
  inicio,
  fim,
  janela = JANELA_CRITICA,
}) {
  if (!pieceLength || pieceLength <= 0) return null;
  if (!tamanho || tamanho <= 0) return null;
  if (!Number.isFinite(offset) || offset < 0) return null;

  // O `Range` pode vir malformado; e melhor um pedido do inicio do que falhar.
  const de = Number.isFinite(inicio) && inicio > 0 ? Math.floor(inicio) : 0;
  if (de >= tamanho) return null;

  // `fim` em aberto (`bytes=0-`): assume o fim do ficheiro e deixa ser a janela
  // a cortar. `fim` explicito: usa o menor entre o pedido e o fim da janela.
  const pedido = Number.isFinite(fim) && fim >= de ? Math.floor(fim) : tamanho - 1;
  const limite = de + (Number.isFinite(janela) && janela > 0 ? janela : JANELA_CRITICA);
  const para = Math.min(pedido, limite, tamanho - 1);

  if (para < de) return null;

  const primeira = Math.floor((offset + de) / pieceLength);
  const ultima = Math.floor((offset + para) / pieceLength);
  if (ultima < primeira) return null;
  return [primeira, ultima];
}

export function rememberMagnet(infoHash, magnet) {
  magnetCache.set(infoHash.toLowerCase(), magnet);
}

export function getMagnet(infoHash) {
  const m = magnetCache.get(infoHash.toLowerCase());
  return m || `magnet:?xt=urn:btih:${infoHash}`;
}

function findTorrent(key) {
  if (!client) return null;
  return client.torrents.find((t) => t.infoHash?.toLowerCase() === key);
}

// Os metadados (a lista de ficheiros) chegam muito antes do ficheiro estar
// completo. E' tudo o que e' preciso para comecar a transmitir.
function temMetadados(t) {
  return !!(t && !t.destroyed && t.files?.length && t.pieces?.length && t.pieceLength);
}

function erroSemMetadados(infoHash) {
  const e = new Error(
    "Nao foi possivel ler os metadados deste torrent (ninguem o tem disponivel agora). Tenta outro torrent."
  );
  e.status = 504;
  e.code = "SEM_METADADOS";
  e.infoHash = infoHash;
  return e;
}

// Adiciona (ou reutiliza) um torrent e resolve quando os METADADOS chegarem.
async function addTorrent(infoHash) {
  const c = await carregar();
  if (!c) throw new Error(`Torrents indisponiveis: ${motivo}`);
  const key = infoHash.toLowerCase();
  const existing = findTorrent(key);

  // O `timeout` e' SEMPRE limpo: um timer vivo numa promessa ja resolvida
  // segura o event loop da timers e, em Node, mantem o processo vivo mais tempo
  // do que o preciso (e aqui o processo e' a app de desktop).
  const esperaMetadados = (t, aoEstourar) =>
    new Promise((res, rej) => {
      if (temMetadados(t)) return res(t);
      const timer = setTimeout(() => {
        t.removeListener("metadata", aoTer);
        t.removeListener("error", aoErrar);
        // So' destroi o torrent NOVO. Um torrent que ja' estava a descarregar
        // (o caso de retomar) nao pode ser destruido por um prazo perdido —
        // ia deitar fora trabalho que ja' estava feito.
        try {
          aoEstourar?.();
        } catch {
          /* ja morreu */
        }
        rej(erroSemMetadados(key));
      }, META_TIMEOUT_MS);
      const limpa = () => {
        clearTimeout(timer);
        t.removeListener("metadata", aoTer);
        t.removeListener("error", aoErrar);
      };
      const aoTer = () => {
        limpa();
        // O WebTorrent emite `metadata` e so depois monta os ficheiros; se um
        // `destroy` tivesse corrido entre os dois, `temMetadados` protege.
        temMetadados(t) ? res(t) : rej(erroSemMetadados(key));
      };
      const aoErrar = (e) => {
        limpa();
        rej(e);
      };
      t.once("metadata", aoTer);
      t.once("error", aoErrar);
    });

  if (existing) {
    // ANTES: esperava pelo `ready` (100% descarregado). Retomar ou ver um
    // episodio pela segunda vez ficava bloqueado ate o ficheiro inteiro estar
    // em disco — ou seja, nao havia buffering nenhum, o que mata o modo P2P.
    return esperaMetadados(existing);
  }

  const torrentId = magnetCache.get(key) || `magnet:?xt=urn:btih:${infoHash}`;
  const added = c.add(torrentId, { path: DOWNLOAD_DIR });
  // Um torrent sem seeds fica em `client.torrents` para sempre a tentar, e cada
  // reproducao nova volta a esperar os mesmos 30 s. Por isso, ao estourar o
  // prazo, o torrent e' DESTRUIDO — senao o "ninguem tem isto" nunca mais acaba.
  return esperaMetadados(added, () => {
    try {
      added.destroy();
    } catch {
      /* ja morreu */
    }
  });
}

function pickFile(torrent, fileIdx) {
  const idx = fileIdx != null && fileIdx !== "" ? Number(fileIdx) : null;
  if (idx != null && torrent.files[idx]) return torrent.files[idx];
  const vids = torrent.files.filter((f) => VIDEO_RE.test(f.name));
  const pool = vids.length ? vids : torrent.files;
  return pool.reduce((a, b) => (b.length > a.length ? b : a), pool[0]);
}

// Resolve o ficheiro de video a transmitir, descarregando SO esse ficheiro
// (importante nos packs/batches de anime: nao puxa a serie inteira).
export async function getTorrentFile(infoHash, fileIdx) {
  const torrent = await addTorrent(infoHash);
  const file = pickFile(torrent, fileIdx);
  // Limpa a selecao global que o WebTorrent cria ao adicionar o torrent...
  try {
    torrent.deselect(0, torrent.pieces.length - 1, false);
  } catch {
    /* versoes antigas: ignora */
  }
  // ...e deixa selecionado apenas o ficheiro do episodio escolhido.
  for (const f of torrent.files) if (f !== file) f.deselect?.();
  file.select?.();
  return { torrent, file };
}

/**
 * Marca como "criticas" as pecas que o player esta' a ler agora, para que o
 * WebTorrent as peca ANTES das outras. Devolve quantas pecas marcou (0 se nao
 * marcou nenhuma), para o log.
 *
 * Porque isto importa: sem `critical()`, todas as pecas competem de igual e o
 * inicio do ficheiro pode ser a ultima a chegar — mesmo com seeders e velocidade
 * de sobra. Com `critical()`, o comecar a reproduzir deixa de depender de o
 * inicio "dar a sorte" na fila de pedidos.
 */
export function priorizarPecas(torrent, file, inicio, fim) {
  try {
    const janela = pecasDaJanela({
      offset: file?.offset ?? 0,
      tamanho: file?.length ?? 0,
      pieceLength: torrent?.pieceLength ?? 0,
      inicio,
      fim,
    });
    if (!janela) return 0;
    const [primeira, ultima] = janela;
    // `critical` atira se o torrent ja morreu entre o `getTorrentFile` e aqui.
    if (torrent.destroyed) return 0;
    torrent.critical(primeira, ultima);
    return ultima - primeira + 1;
  } catch {
    return 0;
  }
}

export function getStatus(infoHash) {
  if (!client) return null;
  const t = findTorrent(infoHash.toLowerCase());
  if (!t) return null;
  return {
    progress: Math.round(t.progress * 1000) / 10,
    downloadSpeed: t.downloadSpeed,
    peers: t.numPeers,
    downloaded: t.downloaded,
    length: t.length,
    ready: t.ready,
    // O frontend usa isto para distinguir "ainda a procurar quem tem isto"
    // (0 peers, sem metadados) de "esta a descarregar devagar" — sao situacoes
    // em que a pessoa espera de maneira completamente diferente.
    temMetadados: temMetadados(t),
  };
}

// Torrents ativos (a descarregar/reproduzir), para a lista "a gerir".
export function listActive() {
  if (!client) return [];
  return client.torrents.map((t) => {
    const name =
      t.files.find((f) => VIDEO_RE.test(f.name))?.name || t.name || "?";
    return {
      infoHash: t.infoHash,
      name,
      progress: Math.round(t.progress * 1000) / 10,
      downloadSpeed: t.downloadSpeed,
      peers: t.numPeers,
    };
  });
}

// Para de descarregar e remove o torrent (limpa ficheiros do disco).
export function removeTorrent(infoHash) {
  if (!client) return false;
  const t = findTorrent(infoHash.toLowerCase());
  if (!t) return false;
  return new Promise((res) => {
    t.destroy({ destroyStore: true }, () => res(true));
  });
}
