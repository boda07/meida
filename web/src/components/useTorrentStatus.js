import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

// Polling do status de um stream de torrent (WebTorrent local).
//
// Responsabilidade unica: consultar `/api/stream/:infoHash/status` a cada 1.5s
// e manter `status` atualizado. O componente decide o que mostrar com o status.
//
// Devolve: { status }
export function useTorrentStatus({ infoHash, src }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!infoHash) return;
    setStatus(null);
    const tick = () =>
      fetch(`/api/stream/${infoHash}/status`)
        .then((r) => r.json())
        .then((d) => setStatus(d.status))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [infoHash, src]);

  return { status };
}

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
        setErroParar(
          "Não foi possível parar a descarga: " + e.message
        );
      })
      .finally(() => setRemoving(false));
  }, [infoHash, removing]);

  return { stop, removing, erroParar };
}
