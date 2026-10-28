import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

// Fonte nativa de video (MegaPlay sem iframe).
//
// Responsabilidade unica: pedir ao servidor o m3u8 e as legendas em claro para
// uma fonte marcada com `native: true`, e gerir o estado nativo (url/data/erro).
//
// Devolve: { nativoPronto }
export function useNativeVideoSource({ nativoUrl, audio }) {
  const [nativeState, setNativeState] = useState({ url: null, data: null, erro: false });

  useEffect(() => {
    if (!nativoUrl) {
      setNativeState({ url: null, data: null, erro: false });
      return;
    }
    let vivo = true;
    setNativeState({ url: nativoUrl, data: null, erro: false });

    api
      .animeMegaplay({ url: nativoUrl, audio })
      .then((d) => {
        if (!vivo) return;
        if (d?.native && d.sources?.length) {
          setNativeState({ url: nativoUrl, data: d, erro: false });
        } else {
          setNativeState({ url: nativoUrl, data: null, erro: true });
        }
      })
      .catch(() => {
        if (vivo) setNativeState({ url: nativoUrl, data: null, erro: true });
      });

    return () => {
      vivo = false;
    };
  }, [nativoUrl, audio, api]);

  // O m3u8 so vale para a fonte que o pediu.
  const nativoPronto = nativoUrl && nativeState.url === nativoUrl && nativeState.data;

  return { nativoPronto };
}
