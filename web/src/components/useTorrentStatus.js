import { useEffect, useState } from "react";

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
