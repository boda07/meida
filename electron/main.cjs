// Processo principal do Electron: abre a app numa janela desktop (estilo Stremio).
// - Em dev (ELECTRON_DEV=1): carrega o Vite (http://localhost:5173), assumindo
//   que `npm run dev` ja arrancou o server (5175) + web (5173).
// - Em producao: arranca o backend (que tambem serve o web/dist) e carrega-o.
const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

// Abrir URLs externos (ex.: login do MyAnimeList) no browser do sistema.
ipcMain.handle("open-external", (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

const isDev = process.env.ELECTRON_DEV === "1";
const DEV_URL = "http://localhost:5173";
const PROD_URL = "http://localhost:5175";

let serverProc = null;
let win = null;

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

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "MEIDA",
    backgroundColor: "#070708",
    autoHideMenuBar: true,
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

  loadWithRetry(isDev ? DEV_URL : PROD_URL);

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
  if (!isDev) startServer();
  createWindow();
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
