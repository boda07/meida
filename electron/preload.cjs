const { contextBridge, ipcRenderer } = require("electron");

// Expoe um minimo seguro ao frontend: abrir um URL no browser do sistema
// (necessario para o login OAuth do MyAnimeList).
contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  uninstall: () => ipcRenderer.invoke("uninstall-app"),
});
