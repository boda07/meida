// Processo principal do Electron: abre a app numa janela desktop (estilo Stremio).
// - Em dev (ELECTRON_DEV=1): carrega o Vite (http://localhost:5173), assumindo
//   que `npm run dev` ja arrancou o server (5175) + web (5173).
// - Em producao: arranca o backend (que tambem serve o web/dist) e carrega-o.
// Este ficheiro so deve correr dentro do runtime Electron. Se o executas com
// `node electron/main.cjs` fora do Electron (ex.: hosting web/PWA via Render),
// o `app` de Electron e undefined e a app nao funciona — usa:
//   npm run start:pwa   (ou: SERVE_WEB=1 node server/src/index.js)
if (!process.versions?.electron) {
  console.error(
    "[meida] electron/main.cjs foi executado fora do runtime Electron (process.versions.electron indefinido).\n" +
      "Isto acontece quando o hosting corre 'node electron/main.cjs' em vez do server.\n" +
      "Corrige: usa 'npm run start:pwa' (ou 'node server/src/index.js' com SERVE_WEB=1) para correr a PWA/web+api."
  );
  process.exit(1);
}
const { app, BrowserWindow, shell, dialog, ipcMain, Menu, session } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const discordPresence = require("./discord-presence.cjs");
const { installAdBlock } = require("./adblock.cjs");
const { definirAutoplay } = require("./autoplay.cjs");

// ===== Servidor: local (video) + remoto (dados) =====
// A app corre SEMPRE localmente (serve o UI e o video/streaming). Em modo "dados
// na nuvem" aponta as rotas de dados (conta, biblioteca, diario, social,
// comentarios, MAL/AniList) para um servidor MEIDA remoto partilhado, para os
// utilizadores terem a mesma biblioteca em computadores diferentes. A escolha
// fica guardada em userData/desktop-config.json.
const CONFIG_FILE = () => path.join(app.getPath("userData"), "desktop-config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8")) || {};
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[config] falha a gravar:", e?.message || e);
    return false;
  }
}

// "exemplo.com", "http://exemplo.com/" ou "https://exemplo.com/sub" ->
// "https://exemplo.com" / "https://exemplo.com/sub". Devolve "" se for invalido.
function normalizeServerUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname) return "";
    const sub = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/+$/, "") : "";
    return u.origin + sub;
  } catch {
    return "";
  }
}

// URL do servidor partilhado, lido de `electron/default-server.txt` (embutido no
// build). E assim que uma instalacao nova fica logo ligada a nuvem sem o amigo
// configurar nada — basta a release trazer esse ficheiro preenchido.
function readBundledDefaultServer() {
  try {
    return fs.readFileSync(path.join(__dirname, "default-server.txt"), "utf8").trim();
  } catch {
    return "";
  }
}

// Servidor partilhado por defeito (ex.: "https://meida-xxxx.fadehost.app").
// Numa instalacao nova (sem desktop-config.json) a app liga-se logo aqui, para
// os amigos só precisarem de instalar/atualizar a app — sem configurar nada.
// Deixa "" para o modo local continuar a ser o padrao. Precedencia:
//   1. env MEIDA_DEFAULT_SERVER (dev/testes:  MEIDA_DEFAULT_SERVER=... npm run app:dev)
//   2. electron/default-server.txt (preenchido na release)
const DEFAULT_REMOTE_URL = normalizeServerUrl(
  process.env.MEIDA_DEFAULT_SERVER || readBundledDefaultServer() || ""
);

// Abrir URLs externos (ex.: login do MyAnimeList) no browser do sistema.
ipcMain.handle("open-external", (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

// Versao instalada da app (para o "o que mudou" depois de atualizar).
ipcMain.handle("app-version", () => app.getVersion());

// Procurar atualizacao a pedido (botao nas Definicoes/menu). Se houver uma nova,
// o autoUpdater descarrega-a e o evento "update-downloaded" mostra o dialogo para
// reiniciar. Devolve um estado simples para a UI dar feedback imediato.
ipcMain.handle("check-update", async () => {
  if (!app.isPackaged) return { status: "dev" };
  try {
    const r = await autoUpdater.checkForUpdates();
    const latest = r?.updateInfo?.version || null;
    const current = app.getVersion();
    if (latest && latest !== current) return { status: "available", version: latest };
    return { status: "latest", version: current };
  } catch (e) {
    return { status: "error", error: e?.message || String(e) };
  }
});

// Desinstalar a app: pede confirmacao e corre o desinstalador do NSIS.
ipcMain.handle("uninstall-app", async (event) => {
  if (!isTrustedSender(event)) return { ok: false, error: "Origem nao autorizada." };
  if (!app.isPackaged) return { ok: false, error: "So funciona na app instalada." };
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Desinstalar", "Cancelar"],
    defaultId: 1,
    cancelId: 1,
    title: "Desinstalar MEIDA",
    message: "Queres mesmo desinstalar a MEIDA?",
    detail: "A app fecha e o desinstalador abre.",
  });
  if (response !== 0) return { ok: false };
  // O desinstalador do NSIS fica na pasta de instalacao, ao lado do .exe.
  const uninstaller = path.join(path.dirname(process.execPath), "Uninstall MEIDA.exe");
  try {
    spawn(uninstaller, [], { detached: true, stdio: "ignore" }).unref();
  } catch (e) {
    return { ok: false, error: e.message };
  }
  stopServer();
  setTimeout(() => app.quit(), 400);
  return { ok: true };
});

// So aceita pedidos de origens conhecidas (o proprio app): o preload tambem e
// exposto a pagina carregada do servidor remoto, por isso convem validar.
function isTrustedSender(event) {
  try {
    const url = event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    const origin = new URL(url).origin;
    if (origin === new URL(PROD_URL).origin) return true;
    if (isDev && origin === new URL(DEV_URL).origin) return true;
    if (serverMode === "remote" && remoteUrl && origin === new URL(remoteUrl).origin) return true;
    return false;
  } catch {
    return false;
  }
}

// ===== Servidor: usado pela seccao "Servidor" das Definicoes =====
ipcMain.handle("get-server-config", () => ({
  mode: serverMode,
  url: remoteUrl,
  packaged: app.isPackaged,
}));

ipcMain.handle("set-server-config", (event, cfg) => {
  if (!isTrustedSender(event)) return { ok: false, error: "Origem nao autorizada." };
  const mode = cfg?.mode === "remote" ? "remote" : "local";
  let url = "";
  if (mode === "remote") {
    url = normalizeServerUrl(cfg?.url);
    if (!url) {
      return { ok: false, error: "URL invalido. Exemplo: https://meida.exemplo.com" };
    }
  }
  if (!writeConfig({ mode, url })) {
    return { ok: false, error: "Nao consegui gravar a configuracao." };
  }
  serverMode = mode;
  remoteUrl = url;
  return { ok: true, config: { mode, url, packaged: app.isPackaged } };
});

ipcMain.handle("restart-app", (event) => {
  if (!isTrustedSender(event)) return { ok: false, error: "Origem nao autorizada." };
  app.relaunch();
  app.quit();
  return { ok: true };
});

// ===== Discord Rich Presence (mostrar no Discord o que se esta a ver) =====
// Tudo gratis e local: o frontend avisa quando escolhe uma fonte/comeca a ver e
// manda actualizacoes do progresso. Se o Discord nao estiver aberto, nao ha erro
// nenhum — a ligacao fica a tentar de minuto a minuto, em silencio.
ipcMain.handle("set-presence", (event, data) => {
  if (!isTrustedSender(event)) return { ok: false, error: "Origem nao autorizada." };
  if (!discordPresence.isConnected() && !data) return { ok: false };
  discordPresence.setPresence({
    details: data?.details,
    state: data?.state,
    largeImage: data?.largeImage,
    largeText: data?.largeText,
    // `estado` ("a-ver" | "pausa" | "sem-dados"). Tem de ser Explicitamente
    // listado aqui: o IPC so passa os campos marcados, e sem esta linha o
    // Discord recebia sempre "a-ver" — o contador a correr com o video parado,
    // que era o defeito reportado a 2026-10-08.
    estado: data?.estado,
  });
  return { ok: true, connected: discordPresence.isConnected(), clientId: discordPresence.CLIENT_ID };
});

ipcMain.handle("clear-presence", (event) => {
  if (!isTrustedSender(event)) return { ok: false, error: "Origem nao autorizada." };
  discordPresence.clear();
  return { ok: true };
});

// "Autoplay desligado" nas Definicoes. O renderer diz o valor; aqui injecta-se
// `Permissions-Policy: autoplay=()` nas respostas de documento quando esta
// desligado. Sem isto so funciona com providers que respeitem o parametro do
// URL, e o MegaPlay nao respeita (ver electron/autoplay.cjs).
ipcMain.handle("set-autoplay", (event, ligado) => {
  if (!isTrustedSender(event)) return { ok: false, error: "Origem nao autorizada." };
  const ligadoFinal = ligado !== false;
  aplicarAutoplay(ligadoFinal);
  if (process.env.MEIDA_AUTOPLAY_DEBUG === "1") {
    console.log(`[autoplay] definicao do utilizador: ${ligadoFinal ? "ligado" : "desligado"}`);
  }
  return { ok: true, autoplay: ligadoFinal };
});

// Aplica a politica na sessao. Separado para o arranque e para o IPC usarem
// exactamente o mesmo caminho. Sem window nao ha nada a fazer (o servidor web
// serve a interface fora do Electron, onde nao existe este hook).
function aplicarAutoplay(ligado) {
  const janela = BrowserWindow.getAllWindows()[0];
  if (!janela) return false;
  return definirAutoplay(janela.webContents.session, ligado);
}

const isDev = process.env.ELECTRON_DEV === "1";
const DEV_URL = "http://localhost:5173";
const PROD_PORT_DEFAULT = 5175;
// O backend pode ficar noutra porta se a 5175 estiver ocupada (fiz-lo morrer
// antes deixava a janela preta sem explicacao). Ele escreve a porta escolhida
// neste ficheiro, e aqui le-se para a app abrir na porta certa.
const PORT_FILE = () => path.join(app.getPath("userData"), "porta.txt");

// Pasta dos registos, a mesma onde o backend escreve arranque-*.log e onde o
// Electron desenha os erros que nao dao para mostrar numa caixa de dialogo
// (URLs enormes, stack traces). Usado nas mensagens de erro para o utilizador
// saber onde ir buscar o detalhe.
const LOG_DIR = () => path.join(app.getPath("userData"), "logs");
// Apaga a porta de uma sessao anterior. Sem isto a app pode ir buscar o
// servidor a uma porta onde ele ja nao esta (porque na sessao passada ficou
// noutra), e a janela falha ao abrir com um erro interno.
function limparPortaAntiga() {
  try {
    fs.unlinkSync(PORT_FILE());
  } catch {
    /* nao existia: nada a fazer */
  }
}
function prodUrl() {
  try {
    const p = parseInt(fs.readFileSync(PORT_FILE(), "utf8").trim(), 10);
    if (p > 0 && p < 65536) return `http://127.0.0.1:${p}`;
  } catch {
    /* sem ficheiro: usa a porta por omissao */
  }
  return `http://127.0.0.1:${PROD_PORT_DEFAULT}`;
}
const PROD_URL = isDev ? "http://localhost:5175" : "http://127.0.0.1:5175";

let serverProc = null;
let win = null;
let splash = null;
let serverMode = "local"; // "local" | "remote"
let remoteUrl = "";

// Tela de carregamento (cobre o ecra preto enquanto o backend e o web arrancam).
function createSplash() {
  splash = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#0a1226",
    webPreferences: { contextIsolation: true },
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) splash.close();
  splash = null;
}

// Em producao corre o backend usando o Node embutido no Electron.
// Quando empacotado, o server e o web/dist ficam em "resources" (fora do asar).
function startServer() {
  // Log do arranque do backend, em ficheiro. E o unico sítio onde se ve o que
  // o backend fez ou deixou de fazer - essencial quando a janela fica preta.
  let logFd = "ignore";
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    logFd = fs.openSync(path.join(dir, `arranque-${stamp}.log`), "a");
    fs.writeSync(
      logFd,
      `--- arranque ${new Date().toISOString()} ---\n` +
        `electron=${process.versions.electron} node=${process.versions.node}\n`
    );
  } catch {
    logFd = "ignore";
  }

  const serverBase = app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(__dirname, "..", "server");
  const webDist = app.isPackaged
    ? path.join(process.resourcesPath, "web", "dist")
    : path.join(__dirname, "..", "web", "dist");

  const serverEntry = path.join(serverBase, "src", "index.js");
  serverProc = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      SERVE_WEB: "1",
      WEB_DIST: webDist,
      // A DB tem de gravar numa pasta com escrita (resources e so-leitura).
      DB_DIR: app.getPath("userData"),
      // O servidor local nunca precisa de estar exposto a rede.
      HOST: "127.0.0.1",
      // Se a porta estiver ocupada o backend escolhe outra e escreve-a aqui.
      MEIDA_PORT_FILE: PORT_FILE(),
      // Modo "dados na nuvem": a app serve o UI e o video localmente, mas as
      // rotas de dados (conta, biblioteca, social) vao diretas para o servidor
      // partilhado; as rotas de video locais (Real-Debrid) aceitam o token
      // emitido por esse servidor.
      ...(serverMode === "remote" && remoteUrl
        ? { MEIDA_REMOTE_DATA_URL: remoteUrl }
        : {}),
    },
    // A saida do backend vai para um ficheiro. Com "inherit" ia para a consola
    // do Electron, que numa app instalada nao existe - por isso, se o backend
    // morresse ao arrancar (falta uma dependencia, permissao negada), nao
    // aparecia nada em lado nenhum e a janela ficava preta sem explicacao.
    stdio: ["ignore", logFd, logFd],
  });

  // Se o backend morrer, escreve no log porque. Antes falhava em silencio.
  serverProc.on("exit", (code, signal) => {
    const msg =
      `[backend] morreu: codigo=${code} sinal=${signal} ` +
      `(${new Date().toISOString()})\n`;
    console.error(msg);
    try {
      fs.appendFileSync(logFd, msg);
    } catch {}
    if (code !== 0 && code !== null) {
      try {
        dialog.showMessageBox({
          type: "error",
          title: "MEIDA - o servidor nao arrancou",
          message: "A app nao conseguiu iniciar o servidor interno.",
          detail:
            `Codigo: ${code}\n` +
            `Sinal: ${signal}\n\n` +
            `O ficheiro com o erro e' este:\n` +
            `${LOG_DIR()}\n\n` +
            `Manda essa pasta a quem te deu a app.`,
          buttons: ["Fechar"],
        });
      } catch {}
    }
  });
  serverProc.stderr?.on("data", (d) => {
    try {
      fs.appendFileSync(logFd, String(d));
    } catch {}
  });
}

// O server/vite podem ainda nao estar prontos — tenta carregar com retry.
//
// Enquanto se esta a tentar, o erro de carregamento e' ESPERADO e nao se mostra
// nada ao utilizador: cada tentativa falhada dispara um `did-fail-load` com o
// codigo -102 (ERR_CONNECTION_REFUSED) e, sem isto, aparecia um "a janela ficou
// em branco" a cada 500 ms durante o arranque. So quando as tentativas
// acabarem (ou nao houver mais para tentar) e' que vale a pena avisar.
let tentativasRestantes = 0;

function loadWithRetry(url, tries = 0) {
  tentativasRestantes = 80 - tries;
  win.loadURL(url).catch(() => {
    if (tries < 80) setTimeout(() => loadWithRetry(url, tries + 1), 500);
  });
}

// Volta ao backend embutido. Guarda o URL remoto para se poder trocar depois.
function useLocalServer() {
  writeConfig({ mode: "local", url: remoteUrl });
  app.relaunch();
  app.quit();
}

// Abre as Definicoes no servidor local (rede de seguranca: mesmo com o remoto
// em baixo, o layout local permite corrigir o endereco).
function openLocalSettings() {
  const base = isDev ? DEV_URL : PROD_URL;
  loadWithRetry(base + "/settings");
}

// Menu da app: acessivel com Alt (a barra fica escondida). Da sempre uma forma
// de voltar ao servidor local ou reconfigurar.
function setupMenu() {
  const alvo =
    serverMode === "remote" && remoteUrl ? `Remoto: ${remoteUrl}` : "Local (este computador)";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Servidor",
        submenu: [
          { label: `A ligar a: ${alvo}`, enabled: false },
          { type: "separator" },
          { label: "Abrir Definicoes do servidor", click: openLocalSettings },
          { label: "Usar o servidor local deste computador", click: useLocalServer },
        ],
      },
      {
        label: "Ver",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ])
  );
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "MEIDA",
    backgroundColor: "#070708",
    autoHideMenuBar: true,
    show: false, // so mostra quando estiver pronta (a splash cobre o arranque)
    icon: app.isPackaged
      ? undefined // empacotado: usa o icone embutido no .exe
      : path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // Bloqueia popups (ex.: anuncios dos providers) em vez de abrir novas janelas.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Bloqueia tambem os PEDIDOS de anuncios dos players (redes de anuncios,
  // popunder, tracking). Vale para todos os providers e e' gratis/local: o video
  // continua a passar, os anuncios nunca chegam a sair. Ver electron/adblock.cjs.
  if (process.env.MEIDA_ADBLOCK_DEBUG === "1") {
    const quantos = installAdBlock(win.webContents.session, (host, url, ref) =>
      console.log("[adblock] bloqueado", host, "|", url, "| de:", ref || "?")
    );
    console.log(`[adblock] ativo (${quantos} dominios)`);
  } else {
    installAdBlock(win.webContents.session);
  }

  // Politica de autoplay, so com MEIDA_AUTOPLAY_DEBUG=1 (como o adblock). Fica
  // a forcar "desligado" e a registar cada documento a que toca — foi assim que
  // se viu que a definicao chegava e que o cabecalho saia, e que o MegaPlay
  // arrancava na mesma (motivo do portao "Carregar video" no Player.jsx).
  //
  // Em uso normal a politica e' posta pelo IPC `set-autoplay`, que o renderer
  // chama com o valor das Definicoes assim que a app arranca.
  if (process.env.MEIDA_AUTOPLAY_DEBUG === "1") {
    definirAutoplay(win.webContents.session, false, (...partes) =>
      console.log("[autoplay]", ...partes)
    );
    console.log("[autoplay] diagnostico ligado (a forcar autoplay desligado)");
  }

  // Quando a app estiver carregada, mostra a janela e fecha a splash.
  const reveal = () => {
    if (win && !win.isVisible()) win.show();
    closeSplash();
  };
  win.once("ready-to-show", reveal);
  win.webContents.on("did-finish-load", () => {
    // A janela carregou: acabou o arranque, ja nao ha tentativas pendentes.
    // Sem isto, um servidor que caia mais tarde (-102) ficava silenciado para
    // sempre, e o utilizador via so uma janela em branco sem aviso.
    tentativasRestantes = 0;
    reveal();
  });

  // Se a pagina nao carregar, a janela fica preta sem explicar nada. Antes isso
  // deixava a pessoa sem ideia nenhuma do que se passou - e sem poder ajudar.
  // Agora diz o que aconteceu.
  //
  // O quinto argumento (`isMainFrame`) e' essencial: o `did-fail-load` dispara
  // TANTO para a janela principal COMO para cada iframe. Sem esta verificacao,
  // um provider que devolvesse um URL invalido abria um "a janela ficou em
  // branco" com a app perfeitamente saudavel - que era o que acontecia ao
  // utilizador (faltava um "ts" e o video funcionava na mesma). O codigo de
  // erro era -3 (ERR_ABORTED) e o URL um `data:application/pdf;base64,...`, que
  // vem de um provider a servir um PDF como data URL.
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame) {
      // Um iframe que nao carregou. Frequente e inofensivo: o botao de recarregar
      // a fonte resolve. So registamos - mostrar aqui era alarmismo falso.
      console.error("[iframe] falhou:", code, desc, url);
      return;
    }
    // A janela principal tambem falha durante o arranque, enquanto o backend
    // ainda nao aceita ligacoes (-102 = ERR_CONNECTION_REFUSED). O loadWithRetry
    // esta a tentar e vai succeeds; mostrar aqui dava um "a janela ficou em
    // branco" a cada 500 ms durante o arranque. So avisamos se ja nao ha mais
    // tentativas para fazer.
    if (tentativasRestantes > 0) {
      console.error(`[load] a tentar (${tentativasRestantes} restantes):`, code, desc);
      return;
    }
    console.error("[load] falhou:", code, desc, url);
    dialog.showMessageBox(win, {
      type: "error",
      title: "MEIDA nao conseguiu abrir",
      message: "A janela ficou em branco.",
      detail:
        `Nao consegui carregar a interface.\n\n` +
        `Motivo: ${desc || "desconhecido"} (codigo ${code})\n` +
        // O URL fica no registo, nao no ecra: pode ser um data URL gigante
        // (base64) que nao cabe numa caixa de dialogo, e o utilizador via
        // so um bocado de lixo em vez da causa.
        `Isto e' um erro do programa, nao do teu PC. O endereco completo esta no registo:\n` +
        `${LOG_DIR()}`,
      buttons: ["Fechar"],
    });
  });
  // Erros da pagina (fetch mal formado, modulo em falta) vao para a consola do
  // Electron - que em modo instalado ninguem ve. Guardam-se num ficheiro para
  // se poder diagnosticar depois.
  win.webContents.on("console-message", (_e, level, msg, line, src) => {
    if (level >= 2) {
      console.error(`[pagina] ${msg} (${src}:${line})`);
    }
  });

  // A app e servida SEMPRE pelo servidor local deste computador: e ele que corre
  // o video/streaming. Em modo "dados na nuvem" o frontend encaminha as rotas de
  // dados (conta, biblioteca, social) para o servidor remoto partilhado.
  if (isDev) {
    loadWithRetry(DEV_URL);
  } else {
    // Espera que o backend escreva a porta escolhida (ou que a janela apanhe a
    // porta por omissao) antes de abrir a interface.
    const abrir = (tentativas) => {
      const url = prodUrl();
      const teste = http
        .get(`${url}/api/health`, (res) => {
          res.resume();
          loadWithRetry(url);
        })
        .on("error", () => {
          if (tentativas > 0) {
            setTimeout(() => abrir(tentativas - 1), 500);
          } else {
            // Nao respondeu: mostra o erro em vez de deixar preto.
            loadWithRetry(url);
          }
        });
      teste.setTimeout(4000, () => teste.destroy());
    };
    abrir(60);
  }

  if (isDev) win.webContents.openDevTools({ mode: "detach" });
}

// Atualizacao automatica (estilo Spotify): verifica, descarrega em fundo e
// pergunta para reiniciar quando estiver pronta. So funciona no app empacotado.
function setupAutoUpdate() {
  if (!app.isPackaged) return;

  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Reiniciar e atualizar", "Mais tarde"],
      defaultId: 0,
      cancelId: 1,
      title: "Atualizacao disponivel",
      message: `Nova versao ${info.version} pronta a instalar.`,
      detail: "A app reinicia para aplicar a atualizacao.",
    });
    if (response === 0) {
      // Mata o backend e espera que ele desapareca antes de chamar o instalador:
      // o backend e outro processo do MESMO MEIDA.exe, e se ainda estiver vivo o
      // NSIS nao consegue substituir os ficheiros (update a meio = atalho
      // partido). Ver stopServer().
      await stopServer(true);
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on("error", (e) => console.error("[update]", e?.message || e));

  autoUpdater.checkForUpdates().catch(() => {});
  // Volta a verificar de 6 em 6 horas (caso fique aberta muito tempo).
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  const cfg = readConfig();
  remoteUrl = normalizeServerUrl(cfg.url);
  if (cfg.mode === "remote") {
    // Escolha explicita nas Definicoes.
    serverMode = remoteUrl ? "remote" : "local";
  } else if (cfg.mode === "local") {
    // O utilizador escolheu ficar local (ou caiu aqui pelo aviso de falha).
    serverMode = "local";
  } else if (DEFAULT_REMOTE_URL) {
    // Instalacao nova sem escolha guardada: usa o servidor partilhado.
    remoteUrl = DEFAULT_REMOTE_URL;
    serverMode = "remote";
  } else {
    serverMode = "local";
  }
  createSplash();
  // Limpa o cache da interface ao arrancar. Sem isto, depois de uma
  // atualizacao a app abre com o index.html e os ficheiros JS de uma versao
  // antiga que ficaram no perfil do Electron: a lista de novidades prende-se
  // numa versao velha, o bundle antigo pede ficheiros que ja nao existem
  // ("fail to fetch") e a janela fica preta. E o pior sintoma de todos porque
  // parece que a app esta partida.
  //
  // "serviceworkers" e "cachestorage" sao os culpados: o service worker segura
  // uma copia antiga da interface e so se larga se for explicitamente
  // descartado - o clearCache() sozinho nao chega.
  //
  // So na app instalada (em dev o Vite nao quer cache limpo). Nao apaga nada do
  // utilizador: toco-se em "serviceworkers" e "cachestorage", nunca em
  // "localstorage", "indexdb" ou "cookies", que e' onde estao as listas, as
  // notas e a sessao.
  if (!isDev) {
    const sess = session.defaultSession;
    sess.clearCache().catch(() => {});
    sess
      .clearStorageData({
        storages: ["serviceworkers", "cachestorage"],
      })
      .catch(() => {});
  }
  // O servidor local arranca SEMPRE (serve a app + o video). Em modo "dados na
  // nuvem" as rotas de dados vao para o servidor remoto partilhado, mas o UI e o
  // streaming continuam a correr neste computador.
  if (!isDev) {
    // A porta da sessao anterior ja nao vale: o servidor pode ter ficado noutra.
    limparPortaAntiga();
    startServer();
  }
  createWindow();
  setupMenu();
  setupAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Fecha o backend, ESPERANDO que ele saia de facto. E' preciso para a
// atualizacao: o backend tambem e um processo do proprio MEIDA.exe (spawn de
// process.execPath com ELECTRON_RUN_AS_NODE), portanto enquanto ele estiver vivo
// o .exe e a pasta resources/ estao trancados e o instalador do NSIS falha a meio
// — o .exe antigo desaparece, o novo nao fica, e o atalho do Menu Iniciar passa
// a apontar para um ficheiro que nao existe ("este atalho foi alterado ou
// removido").
function stopServer(waitForExit = false) {
  const proc = serverProc;
  serverProc = null;
  if (!proc) return Promise.resolve();
  const exited = new Promise((resolve) => {
    proc.once("exit", () => resolve("exit"));
    proc.once("error", () => resolve("error"));
  });
  try {
    proc.kill();
  } catch {
    /* ja estava morto */
  }
  if (!waitForExit) return exited;
  return Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]).then(() => {
    // 5 s e ainda esta vivo: forcamos o fim.
    if (proc.exitCode === null && proc.signalCode === null) {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* nada a fazer */
      }
    }
    return exited;
  });
}

// Antes de sair: esconder a presenca no Discord (senao fica "A ver" para sempre)
// e fechar o socket para nao prender o processo.
app.on("before-quit", () => discordPresence.shutdown());

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});
app.on("quit", stopServer);
