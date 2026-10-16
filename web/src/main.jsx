import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { LibraryProvider } from "./library/LibraryContext.jsx";
import { SettingsProvider } from "./settings/SettingsContext.jsx";
import { WatchPartyProvider } from "./watchparty/WatchPartyContext.jsx";
import { I18nProvider } from "./i18n/I18nContext.jsx";
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
  // o servidor partilhado, e tem prioridade sobre o runtime-config.
  //
  // E o inverso tambem conta: se o utilizador escolheu "local" nas Definicoes,
  // o runtime-config tem de ser IGNORADO. Sem esta ressalva, ter um
  // VITE_REMOTE_DATA_BASE no ficheiro (que e' preciso para a versao web usar o
  // servidor de dados partilhado) faria a app de desktop mandar contas e
  // comentarios para a nuvem sem ninguem ter pedido isso.
  try {
    const cfg = await window.electronAPI?.getServerConfig?.();
    if (cfg) {
      if (cfg.mode === "remote" && cfg.url) {
        window.MEIDA_REMOTE_DATA_BASE = String(cfg.url).replace(/\/+$/, "");
      } else {
        window.MEIDA_REMOTE_DATA_BASE = "";
      }
    }
  } catch {
    /* sem Electron: mantem o runtime-config */
  }
}

loadRuntimeConfig()
  .catch(() => {})
  .finally(() => {
    // O ecra ESTATICO do `index.html` diz "a app esta a arrancar" e sai aqui:
    // o React ja vai montar e a app assume com a interface. Se nao se removesse,
    // ficavam os dois no ecra ao mesmo tempo (e o estatico, que tem z-index 9999,
    // tapava o outro).
    document.getElementById("boot")?.remove();

    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(
      <React.StrictMode>
        <BrowserRouter>
           {/* O i18n e' o mais exterior de todos: os outros contextos
               (Definições, Conta, Biblioteca) tambem mostram texto, por isso
               precisam do `t()` ja montado. */}
           <I18nProvider>
             <SettingsProvider>
               <AuthProvider>
                 <WatchPartyProvider>
                   <LibraryProvider>
                     {/* NAO ha ecra de arranque a tapar a app (1.5.4).

                         Havia: um ecra de espera que so' saia quando o servidor de
                         DADOS respondia, e que ficava 40 s de cada vez que a app
                         abria — num servidor de dados que estava acordado. A raza
                         de ser tao ma e' que o `fetch` do health nao tinha tempo
                         limite: um pedido pendurado (ligacao aceite, resposta que
                         nao vem — IPv6 sem rota, VPN, portal cativo) nao entrava
                         no `.then()` nem no `.catch()`, e como a repeticao so
                         estava no `.catch()`, o ecra ficava preso a dizer "o
                         servidor esta a acordar" sem o servidor ter nada a ver.

                         A app agora aparece sempre. Quem precisa do servidor de
                         dados mostra o SEU estado de carregamento e o SEU erro —
                         que e' verdadeiro e diz o que se pode fazer; um ecra de
                         espera a tempo inteiro nao diz nada. */}
                     <App />
                   </LibraryProvider>
                 </WatchPartyProvider>
               </AuthProvider>
             </SettingsProvider>
           </I18nProvider>
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
