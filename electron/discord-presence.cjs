// ===== Discord Rich Presence (100% gratis) =====
// Escreve directamente no canal local do Discord para mostrar o que o utilizador
// esta a ver ("A ver <titulo>  S1E2  12:34/45:00"), como fazem o Stremio e o
// Crunchyroll.
//
// Como funciona: o Discordcorre um servidor RPC local (Named Pipe no Windows,
// socket Unix nos outros). Fala-se com ele pelo protocolo RPC do proprio Discord
// (docs.discord.com/developers/topics/rpc), sem bots, sem servidores e sem
// qualquer API paga. Se o Discord nao estiver aberto, nao acontece nada e a app
// continua exactamente igual.
//
// Frame: [4 bytes LE opcode][4 bytes LE tamanho][payload JSON UTF-8]
//   opcodes: 0 HANDSHAKE, 1 FRAME, 2 CLOSE, 3 PING, 4 PONG
//
// Porquê nao usar uma biblioteca (`discord-rpc` esta abandonada desde 2021 e as
// alternativas-modernas exigem Node >= 24.13): o protocolo tem ~60 linhas e
// assim a app fica com zero dependencias novas.
const net = require("net");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

// Application ID de <https://discord.com/developers/applications> (MEIDA).
// Pode ser trocado com MEIDA_DISCORD_CLIENT_ID sem mexer no codigo.
const CLIENT_ID = (process.env.MEIDA_DISCORD_CLIENT_ID || "1556179310077804564").trim();

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

// O Discord limita as actualizacoes de presenca (daqui o intervalo minimo) e
// encher a ligacao de updates penaliza. O progresso do video chega de 5 em 5
// segundos, por isso filtramos aqui.
const MIN_UPDATE_MS = 15000;
const RECONNECT_MS = 60000;

const debug = () => process.env.MEIDA_DISCORD_DEBUG === "1";
const log = (...a) => {
  if (debug()) console.log("[discord]", ...a);
};

let sock = null; // socket ligado (ou a ligar)
let ready = false; // ja recebeu o READY do Discord
let connecting = false;
let current = null; // actividade a mostrar (para reenviar/reconectar)
let lastSentAt = 0;
let retryTimer = null;
let destroyed = false;

// Windows: \\?\pipe\discord-ipc-N.  Unix: $XDG_RUNTIME_DIR / $TMPDIR / /tmp.
function pipePaths() {
  const out = [];
  if (process.platform === "win32") {
    for (let i = 0; i < 10; i++) out.push(`\\\\?\\pipe\\discord-ipc-${i}`);
    return out;
  }
  const dirs = [process.env.XDG_RUNTIME_DIR, process.env.TMPDIR || os.tmpdir(), "/tmp", "/var/run"].filter(
    Boolean
  );
  for (const d of dirs) for (let i = 0; i < 10; i++) out.push(path.join(d, `discord-ipc-${i}`));
  return out;
}

function frame(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload ?? {}), "utf8");
  const head = Buffer.alloc(8);
  head.writeInt32LE(opcode, 0);
  head.writeInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

function write(buf) {
  if (!sock || sock.destroyed || !sock.writable) return false;
  try {
    sock.write(buf);
    return true;
  } catch (e) {
    log("escrita falhou:", e?.message || e);
    return false;
  }
}

function activityPayload() {
  const activity = {
    // 3 = Watching ("A ver"). E o mesmo que usam a Netflix/Crunchyroll.
    type: 3,
    details: current.details,
    timestamps: { start: current.startTimestamp },
  };
  // `paused: true` e' o que o Discord usa para congelar o contador e escrever
  // "Pausado". Sem isto, o tempo continuava a correr mesmo com o video parado —
  // que era o defeito reportado.
  if (current.paused) activity.timestamps.paused = Date.now();
  if (current.state) activity.state = current.state;
  if (current.largeImage) {
    activity.assets = {
      large_image: current.largeImage,
      large_text: current.largeText || current.details,
    };
  }
  return {
    cmd: "SET_ACTIVITY",
    args: { pid: process.pid, activity },
    nonce: crypto.randomUUID(),
  };
}

// Manda a actividade se o Discord ja estiver pronto e o intervalo minimo passar.
function sendPresence(force = false) {
  if (!ready || !current || !sock || sock.destroyed) return false;
  const now = Date.now();
  if (!force && now - lastSentAt < MIN_UPDATE_MS) return false;
  lastSentAt = now;
  const ok = write(frame(OP.FRAME, activityPayload()));
  log("presenca enviada:", activityPayload().args.activity.details, ok ? "" : "(falhou)");
  return ok;
}

function clearPresence() {
  if (!sock || sock.destroyed) return;
  write(
    frame(OP.FRAME, {
      cmd: "SET_ACTIVITY",
      args: { pid: process.pid, activity: null },
      nonce: crypto.randomUUID(),
    })
  );
}

function teardown() {
  ready = false;
  connecting = false;
  const s = sock;
  sock = null;
  if (s) {
    try {
      s.removeAllListeners();
      s.destroy();
    } catch {
      /* ja estava morto */
    }
  }
}

function stopRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

// Tenta ligar ao Discord. Como o numero do pipe e variavel (0..9), vai tentando
// cada um; se nenhum responder, espera e tenta mais tarde.
function connect() {
  if (destroyed || connecting || (sock && !sock.destroyed)) return;
  connecting = true;
  const paths = pipePaths();
  let i = 0;

  const tryNext = () => {
    if (i >= paths.length) {
      connecting = false;
      log("sem Discord running");
      scheduleRetry();
      return;
    }
    const target = paths[i++];
    const s = net.connect(target);
    let settled = false;

    s.once("connect", () => {
      settled = true;
      connecting = false;
      stopRetry();
      sock = s;
      ready = false;
      log("ligado a", target);
      // HANDSHAKE: versao 1 + a nossa application id.
      write(frame(OP.HANDSHAKE, { v: 1, client_id: CLIENT_ID }));
      attach(s);
    });

    s.once("error", (err) => {
      if (!settled) {
        try {
          s.destroy();
        } catch {
          /* ignore */
        }
        tryNext();
      } else {
        log("erro:", err?.message || err);
      }
    });
  };

  tryNext();
}

function scheduleRetry() {
  if (destroyed || retryTimer || !current) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, RECONNECT_MS);
  if (typeof retryTimer.unref === "function") retryTimer.unref();
}

// Le frames do socket: responde ao PING do Discord e detecta o READY.
function attach(s) {
  let buf = Buffer.alloc(0);

  s.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 8) return;
      const opcode = buf.readInt32LE(0);
      const len = buf.readInt32LE(4);
      if (buf.length < 8 + len) return;
      const body = buf.subarray(8, 8 + len).toString("utf8");
      buf = buf.subarray(8 + len);
      try {
        onFrame(opcode, body);
      } catch (e) {
        log("frame invalido:", e?.message || e);
      }
    }
  });

  s.on("error", (e) => log("socket erro:", e?.message || e));
  s.on("close", () => {
    log("socket fechado");
    // O Discord fechou (arrancou, reiniciou, etc.). Mantemos a actividade para
    // reconectar assim que houver uma nova actualizacao.
    ready = false;
    if (sock === s) sock = null;
    scheduleRetry();
  });
}

function onFrame(opcode, body) {
  if (opcode === OP.PING) {
    // O Discord faz ping periodico; sem isto corta-nos a ligacao.
    write(frame(OP.PONG, body ? JSON.parse(body) : {}));
    return;
  }
  if (opcode === OP.CLOSE) {
    log("o Discord fechou a ligacao");
    teardown();
    scheduleRetry();
    return;
  }
  if (opcode !== OP.FRAME) return;
  const msg = JSON.parse(body);
  if (msg.evt === "READY") {
    ready = true;
    log("READY");
    sendPresence(true);
  }
}

// ===== API publica =====

// Mostra `details` no perfil. `state` e a linha de baixo (ex.: "S1E2 · 12:34/45:00").
// `largeImage` pode ser um URL (o Discord vai buscar a imagem).
// `paused` diz ao Discord para congelar o contador: e' o que distingue "esta a
// ver" de "deixou em pausa a meio".
function setPresence({ details, state = "", largeImage = "", largeText = "", paused = false } = {}) {
  if (destroyed || !details) return false;
  const changed = !current || current.details !== details;
  const wasPaused = Boolean(current && current.paused);
  const agoraPausado = Boolean(paused);
  current = {
    details: String(details).slice(0, 128),
    state: String(state || "").slice(0, 128),
    largeImage: largeImage || "",
    largeText: largeText || "",
    // O contador do tempo so reinicia quando muda de titulo.
    startTimestamp: changed ? Date.now() : current.startTimestamp,
    paused: agoraPausado,
  };
  // Uma mudanca de pausa tambem tem de sair na hora: se nao, o Discord
  // continuava a contar mais 15 s (o intervalo minimo) com o estado errado.
  // `changed` (titulo novo) ja e' forcado.
  if (ready) sendPresence(changed || wasPaused !== agoraPausado);
  else connect();
  return true;
}

// Devolve true se o Discord estiver ligado e a mostrar a presenca.
function isConnected() {
  return Boolean(ready && sock && !sock.destroyed);
}

// Esconde a presenca (fim de um filme, fechar a app, ...). Mantem o socket
// ligado de proposito: e o que o Stremio faz e evita reconectar a cada
// episodio. So o shutdown fecha a ligacao.
function clear() {
  stopRetry();
  current = null;
  if (ready) clearPresence();
}

// Ao sair da app: limpa a presenca e fecha o socket para nao prender o processo.
function shutdown() {
  destroyed = true;
  clear();
  teardown();
}

module.exports = { CLIENT_ID, setPresence, clear, isConnected, shutdown };