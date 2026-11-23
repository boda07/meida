// Servidor (so no desktop Electron): local vs remoto.
//
// Ler a configuracao, guardar e reiniciar a app. O `desktop` e' devolvido para
// a pagina decidir se a secao aparece.
import { useEffect, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";

export function useServidor() {
  const t = useT();
  // `window.electronAPI` so existe na app instalada; na web e' undefined.
  const desktop = typeof window !== "undefined" ? window.electronAPI : null;
  const [srv, setSrv] = useState(null);
  const [srvMode, setSrvMode] = useState("local");
  const [srvUrl, setSrvUrl] = useState("");
  const [srvBusy, setSrvBusy] = useState(false);
  const [srvMsg, setSrvMsg] = useState(null);
  const [srvErr, setSrvErr] = useState(false);

  // Servidor: ler a configuracao atual (so no desktop Electron).
  useEffect(() => {
    if (!desktop?.getServerConfig) return;
    desktop
      .getServerConfig()
      .then((c) => {
        setSrv(c);
        setSrvMode(c?.mode === "remote" ? "remote" : "local");
        setSrvUrl(c?.url || "");
      })
      .catch(() => {});
  }, [desktop]);

  async function saveServer() {
    if (!desktop?.setServerConfig) return;
    setSrvMsg(null);
    setSrvErr(false);
    setSrvBusy(true);
    let r;
    try {
      r = await desktop.setServerConfig({ mode: srvMode, url: srvUrl });
    } catch {
      r = null;
    }
    if (!r || r.ok === false) {
      setSrvErr(true);
      setSrvMsg(r?.error || t("Não foi possível guardar."));
      setSrvBusy(false);
      return;
    }
    setSrv(r.config);
    setSrvMsg(t("Guardado. A reiniciar..."));
    // Deixa a mensagem aparecer antes de reiniciar.
    setTimeout(() => desktop.restartApp?.(), 600);
  }

  return {
    desktop,
    srv,
    srvMode,
    setSrvMode,
    srvUrl,
    setSrvUrl,
    srvBusy,
    srvMsg,
    srvErr,
    saveServer,
  };
}