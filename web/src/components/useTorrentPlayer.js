import { useCallback, useState } from "react";
import { api } from "../api/client.js";

// Reproducao de torrent: Debrid (cache instant) vs WebTorrent local.
//
// Responsabilidade unica: escolher o stream (Debrid se em cache, senao
// WebTorrent local) e gerir o estado de streaming/erro/src.
//
// Devolve: { videoSrc, streaming, streamErr, setVideoSrc, setStreamErr, pick }
export function useTorrentPlayer({ debrid }) {
  const [videoSrc, setVideoSrc] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [streamErr, setStreamErr] = useState(null);

  function localStreamUrl(t) {
    return (
      `/api/stream/${t.infoHash}` +
      (t.fileIdx != null ? `?fileIdx=${t.fileIdx}` : "")
    );
  }

  // Ao escolher um torrent: se Debrid estiver ligado e o torrent estiver em
  // cache, resolve o stream via Debrid (logo). Senão, usa WebTorrent local.
  const pick = useCallback(async (t) => {
    setVideoSrc(null);
    const tryDebrid = debrid?.linked && debrid?.instant?.has(t.infoHash);
    if (tryDebrid) {
      setStreaming(true);
      try {
        const d = await api.debridStream(t.infoHash, t.fileIdx);
        setVideoSrc(d.url);
      } catch (e) {
        // Se o Debrid falhar, cai para o WebTorrent (stream local).
        setStreamErr(e.message);
        setVideoSrc(localStreamUrl(t));
      } finally {
        setStreaming(false);
      }
    } else {
      setVideoSrc(localStreamUrl(t));
    }
  }, [debrid]);

  return { videoSrc, streaming, streamErr, setVideoSrc, setStreamErr, pick };
}
