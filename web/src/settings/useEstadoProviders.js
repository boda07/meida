// Estado (vivo/morto) dos providers.
//
// Carregado ao inicio da pagina; o botao "Rever agora" forca o check.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export function useEstadoProviders() {
  const [provHealth, setProvHealth] = useState(null);

  useEffect(() => {
    api.providersHealth().then(setProvHealth).catch(() => {});
  }, []);

  async function reverAgora() {
    setProvHealth({ checking: true, providers: null, stale: false });
    try {
      setProvHealth(await api.providersHealth(true));
    } catch {
      setProvHealth(null);
    }
  }

  return { provHealth, reverAgora };
}