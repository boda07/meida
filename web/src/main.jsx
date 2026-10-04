import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { LibraryProvider } from "./library/LibraryContext.jsx";
import { SettingsProvider } from "./settings/SettingsContext.jsx";
import { WatchPartyProvider } from "./watchparty/WatchPartyContext.jsx";
import "./styles.css";

async function loadRuntimeConfig() {
  // public/runtime-config.json define VITE_API_BASE (vazio = same-origin, que
  // e o default do Electron e de hostings onde o server serve web+api juntos)
  // e VITE_REMOTE_DATA_BASE (modo "dados na nuvem" fora do Electron).
  // Falha silenciosa: se o ficheiro nao existir, fica same-origin.
  window.MEIDA_API_BASE = "";
  window.MEIDA_REMOTE_DATA_BASE = "";
  try {
    const res = await fetch("/runtime-config.json", { cache: "no-store" });
    if (res.ok) {
      const cfg = await res.json().catch(() => ({}));
      window.MEIDA_API_BASE = cfg.VITE_API_BASE || "";
      window.MEIDA_REMOTE_DATA_BASE = cfg.VITE_REMOTE_DATA_BASE || "";
    }
  } catch {
    /* sem runtime-config: same-origin */
  }

  // No Electron o processo principal manda: em modo "dados na nuvem" diz qual e
  // o servidor partilhado. Tem prioridade sobre o runtime-config.
  try {
    const cfg = await window.electronAPI?.getServerConfig?.();
    if (cfg && cfg.mode === "remote" && cfg.url) {
      window.MEIDA_REMOTE_DATA_BASE = String(cfg.url).replace(/\/+$/, "");
    }
  } catch {
    /* sem Electron: mantem o runtime-config */
  }
}

loadRuntimeConfig()
  .catch(() => {})
  .finally(() => {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(
      <React.StrictMode>
        <BrowserRouter>
           <SettingsProvider>
             <AuthProvider>
               <WatchPartyProvider>
                 <LibraryProvider>
                   <App />
                 </LibraryProvider>
               </WatchPartyProvider>
             </AuthProvider>
           </SettingsProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  });

// Regista o service worker do PWA (workbox) apenas na web — fora do Electron,
// onde o Electron gere propriamente o caching e o SW pode conflitar.
if (typeof window !== "undefined" && "serviceWorker" in navigator && !window.electronAPI) {
  import("workbox-window").then(({ Workbox }) => {
    const wb = new Workbox("/sw.js");
    wb.addEventListener("waiting", () => {
      // Nova versao do SW pronta: recarrega para aplicar (update).
      wb.addEventListener("controlling", () => window.location.reload());
      wb.activate();
    });
    wb.register().catch(() => {});
  });
}
