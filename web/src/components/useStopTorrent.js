import { useCallback, useState } from "react";
import { api } from "../api/client.js";

// Parar um torrent (WebTorrent local).
//
// Responsabilidade unica: chamar `api.stopTorrent(infoHash)` e gerir o estado
// de `removing` e `erroParar`. O componente decide o que mostrar com o erro.
//
// Devolve: { stop, removing, erroParar }
export function useStopTorrent({ infoHash }) {
  const [removing, setRemoving] = useState(false);
  const [erroParar, setErroParar] = useState("");

  const stop = useCallback(() => {
    if (removing || !infoHash) return;
    setErroParar("");
    setRemoving(true);
    api
      .stopTorrent(infoHash)
      .then(() => {
        setRemoving(false);
      })
      .catch((e) => {
        setErroParar("Não foi possível parar a descarga: " + e.message);
      })
      .finally(() => setRemoving(false));
  }, [infoHash, removing]);

  return { stop, removing, erroParar };
}
