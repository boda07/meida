// Atualizações da app (procurar nova versão).
//
// Fica num gancho, e nao so no menu da conta, porque esse menu so aparece com
// sessao iniciada - e quem ainda nao fez login e' precisamente quem mais precisa
// de actualizar a app.
import { useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";

export function useAtualizacao() {
  const t = useT();
  const [updMsg, setUpdMsg] = useState(null);
  const [updBusy, setUpdBusy] = useState(false);

  async function checkUpdate() {
    if (updBusy) return;
    setUpdBusy(true);
    setUpdMsg(t("A procurar..."));
    try {
      const r = await window.electronAPI.checkForUpdates();
      if (r?.status === "available")
        setUpdMsg(t("Nova versão {v} — a descarregar...", { v: r.version }));
      else if (r?.status === "latest") setUpdMsg(t("Já tens a versão mais recente. ✓"));
      else if (r?.status === "dev") setUpdMsg(t("Indisponível em desenvolvimento."));
      else setUpdMsg(t("Não foi possível verificar agora."));
    } catch {
      setUpdMsg(t("Não foi possível verificar agora."));
    } finally {
      setUpdBusy(false);
    }
  }

  return { updMsg, updBusy, checkUpdate };
}