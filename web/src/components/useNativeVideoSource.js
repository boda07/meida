import { useEffect, useState } from "react";
import { api } from "../api/client.js";

// Fonte nativa de video (MegaPlay sem iframe).
//
// Responsabilidade unica: pedir ao servidor o m3u8 e as legendas em claro para
// uma fonte marcada com `native: true`, e gerir o estado nativo (url/data/erro).
//
// Devolve: { nativoPronto, codigo, detalhe, falhouPedido } — `codigo` diz porque
// e' que o nativo nao deu (o servidor devolve-o em `native: false`) e e' o
// cliente que o traduz; `detalhe` e' texto tecnico e fica SO' na consola.
// `falhouPedido` marca o caso em que o pedido nem chegou ao servidor (esse texto
// e' traduzido no Player).
export function useNativeVideoSource({ nativoUrl, audio }) {
  const [nativeState, setNativeState] = useState({
    url: null,
    data: null,
    codigo: null,
    detalhe: null,
    falhouPedido: false,
  });

  useEffect(() => {
    if (!nativoUrl) {
      setNativeState({
        url: null,
        data: null,
        codigo: null,
        detalhe: null,
        falhouPedido: false,
      });
      return;
    }
    let vivo = true;
    setNativeState({
      url: nativoUrl,
      data: null,
      codigo: null,
      detalhe: null,
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
            codigo: null,
            detalhe: null,
            falhouPedido: false,
          });
        } else {
          // O servidor devolveu native:false ou sem sources. O codigo e' para
          // traduzir; o detalhe tecnico fica na consola (nunca no ecra).
          const codigo = d?.codigo || null;
          const detalhe = d?.detalhe || d?.error || null;
          console.warn("[nativo] extraction failed:", codigo, detalhe, {
            url: nativoUrl,
            audio,
          });
          setNativeState({
            url: nativoUrl,
            data: null,
            codigo,
            detalhe,
            falhouPedido: false,
          });
        }
      })
      .catch((e) => {
        if (vivo) {
          // Sem codigo do servidor (o pedido nem chegou): a interface diz o que
          // aconteceu, e o texto fica no Player (que tem o `t`), nao aqui.
          console.warn("[nativo] request failed:", e?.message || e, {
            url: nativoUrl,
            audio,
          });
          setNativeState({
            url: nativoUrl,
            data: null,
            codigo: null,
            detalhe: null,
            falhouPedido: true,
          });
        }
      });

    return () => {
      vivo = false;
    };
  }, [nativoUrl, audio]);

  // O m3u8 so vale para a fonte que o pediu.
  const atual = nativeState.url === nativoUrl ? nativeState : null;
  const nativoPronto = nativoUrl && atual?.data;
  const codigo = atual?.codigo || null;
  const detalhe = atual?.detalhe || null;
  const falhouPedido = Boolean(atual?.falhouPedido);

  return { nativoPronto, codigo, detalhe, falhouPedido };
}
