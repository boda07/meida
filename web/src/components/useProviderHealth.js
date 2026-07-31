// Estado (vivo/morto) dos providers de embed, vindo do health-check do servidor.
// Carregado uma vez por página de detalhes; os mortos ficam sinalizados no
// seletor e são saltados na escolha automática da fonte.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function useProviderHealth() {
  const [dead, setDead] = useState(null); // Set de ids mortos; null = desconhecido

  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    const load = () => {
      api
        .providersHealth()
        .then((d) => {
          if (cancelled) return;
          if (d.checking && !d.providers && retries < 4) {
            retries += 1;
            setTimeout(load, 3000); // ainda a testar pela 1ª vez: volta a perguntar
            return;
          }
          const deadIds = new Set(
            (d.providers || []).filter((p) => !p.ok).map((p) => p.id)
          );
          setDead(deadIds);
        })
        .catch(() => {
          if (!cancelled) setDead(new Set()); // sem info: nada sinalizado
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return dead;
}
