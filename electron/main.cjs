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
const { app, BrowserWindow, shell, dialog, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

// ===== Servidor: local (embutido) ou remoto =====
// A app pode apontar para um servidor MEIDA remoto (o mesmo backend com
// SERVE_WEB=1) para partilhar conta, biblioteca e funcionalidades sociais entre
// dispositivos. A escolha fica guardada em userData/desktop-config.json.
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

const isDev = process.env.ELECTRON_DEV === "1";
const DEV_URL = "http://localhost:5173";
const PROD_URL = "http://localhost:5175";

let serverProc = null;
let win = null;
let splash = null;
let serverMode = "local"; // "local" | "remote"
let remoteUrl = "";
let remoteFailed = false;

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
    },
    stdio: "inherit",
  });
}

// O server/vite podem ainda nao estar prontos — tenta carregar com retry.
function loadWithRetry(url, tries = 0) {
  win.loadURL(url).catch(() => {
    if (tries < 80) setTimeout(() => loadWithRetry(url, tries + 1), 500);
  });
}

// Servidor remoto: carrega o URL remoto (que serve a app + a API). Se falhar,
// oferece voltar ao servidor local deste computador.
function loadRemote(url) {
  remoteFailed = false;
  win.webContents.on("did-fail-load", (_e, code, _desc, _validatedURL, isMainFrame) => {
    // -3 = ERR_ABORTED (navegacao cancelada); ignora.
    if (isMainFrame && code !== -3) handleRemoteFail(url);
  });
  win.loadURL(url).catch(() => handleRemoteFail(url));
}

async function handleRemoteFail(url) {
  if (remoteFailed) return;
  remoteFailed = true;
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Voltar ao servidor local", "Tentar de novo", "Manter"],
    defaultId: 0,
    cancelId: 2,
    title: "Servidor remoto indisponivel",
    message: `Nao consegui ligar a ${url}.`,
    detail:
      "Podes voltar ao servidor deste computador (e reconfigurar o endereco nas Definicoes) ou tentar outra vez.",
  });
  if (response === 0) {
    useLocalServer();
  } else if (response === 1) {
    remoteFailed = false;
    loadRemote(url);
  }
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

  // Quando a app estiver carregada, mostra a janela e fecha a splash.
  const reveal = () => {
    if (win && !win.isVisible()) win.show();
    closeSplash();
  };
  win.once("ready-to-show", reveal);
  win.webContents.on("did-finish-load", reveal);

  if (isDev) {
    loadWithRetry(DEV_URL);
  } else if (serverMode === "remote" && remoteUrl) {
    loadRemote(remoteUrl);
  } else {
    loadWithRetry(PROD_URL);
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
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (e) => console.error("[update]", e?.message || e));

  autoUpdater.checkForUpdates().catch(() => {});
  // Volta a verificar de 6 em 6 horas (caso fique aberta muito tempo).
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  const cfg = readConfig();
  remoteUrl = normalizeServerUrl(cfg.url);
  serverMode = cfg.mode === "remote" && remoteUrl ? "remote" : "local";
  createSplash();
  if (!isDev) startServer();
  createWindow();
  setupMenu();
  setupAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function stopServer() {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
}

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});
app.on("quit", stopServer);
