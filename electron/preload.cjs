const { contextBridge, ipcRenderer } = require("electron");

// Expoe um minimo seguro ao frontend: abrir um URL no browser do sistema
// (necessario para o login OAuth do MyAnimeList).
contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  uninstall: () => ipcRenderer.invoke("uninstall-app"),
  appVersion: () => ipcRenderer.invoke("app-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-update"),
  getServerConfig: () => ipcRenderer.invoke("get-server-config"),
  setServerConfig: (cfg) => ipcRenderer.invoke("set-server-config", cfg),
  restartApp: () => ipcRenderer.invoke("restart-app"),
  // Discord Rich Presence: mostrar no Discord o que se esta a ver.
  setPresence: (data) => ipcRenderer.invoke("set-presence", data),
  clearPresence: () => ipcRenderer.invoke("clear-presence"),
  setAutoplay: (ligado) => ipcRenderer.invoke("set-autoplay", ligado),
});
