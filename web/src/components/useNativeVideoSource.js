import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

// Fonte nativa de video (MegaPlay sem iframe).
//
// Responsabilidade unica: pedir ao servidor o m3u8 e as legendas em claro para
// uma fonte marcada com `native: true`, e gerir o estado nativo (url/data/erro).
//
// Devolve: { nativoPronto, motivo, falhouPedido } — `motivo` diz porque e' que
// o nativo nao deu (o servidor passou a devolve-lo em `native: false`), para a
// interface nao cair no iframe em silencio. `falhouPedido` marca o caso em que
// o pedido nem chegou ao servidor (esse texto e' traduzido no Player).
export function useNativeVideoSource({ nativoUrl, audio }) {
  const [nativeState, setNativeState] = useState({
    url: null,
    data: null,
    erro: false,
    motivo: null,
    falhouPedido: false,
  });

  useEffect(() => {
    if (!nativoUrl) {
      setNativeState({
        url: null,
        data: null,
        erro: false,
        motivo: null,
        falhouPedido: false,
      });
      return;
    }
    let vivo = true;
    setNativeState({
      url: nativoUrl,
      data: null,
      erro: false,
      motivo: null,
      falhouPedido: false,
    });

    api
      .animeMegaplay({ url: nativoUrl, audio })
      .then((d) => {
        if (!vivo) return;
        if (d?.native && d.sources?.length) {
          setNativeState({
            url: nativoUrl,
            data: d,
            erro: false,
            motivo: null,
            falhouPedido: false,
          });
        } else {
          // O servidor devolveu native:false ou sem sources. Regista o motivo
          // (se o servidor o incluiu) para nao falhar em silencio.
          const motivo = d?.motivo || d?.error || null;
          console.warn("[nativo] extraction failed:", motivo, { url: nativoUrl, audio });
          setNativeState({
            url: nativoUrl,
            data: null,
            erro: true,
            motivo,
            falhouPedido: false,
          });
        }
      })
      .catch((e) => {
        if (vivo) {
          // Sem motivo do servidor (o pedido nem chegou): a interface diz o que
          // aconteceu, e o texto fica no Player (que tem o `t`), nao aqui.
          console.warn("[nativo] request failed:", e?.message || e, {
            url: nativoUrl,
            audio,
          });
          setNativeState({
            url: nativoUrl,
            data: null,
            erro: true,
            motivo: null,
            falhouPedido: true,
          });
        }
      });

    return () => {
      vivo = false;
    };
  }, [nativoUrl, audio, api]);

  // O m3u8 so vale para a fonte que o pediu.
  const atual = nativeState.url === nativoUrl ? nativeState : null;
  const nativoPronto = nativoUrl && atual?.data;
  const motivo = atual?.motivo || null;
  const falhouPedido = Boolean(atual?.falhouPedido);

  return { nativoPronto, motivo, falhouPedido };
}
