import { useCallback, useState } from "react";
import { api } from "../api/client.js";

// Parar um torrent (WebTorrent local).
//
// Responsabilidade unica: chamar `api.stopTorrent(infoHash)` e gerir o estado
// de `removing` e `erroParar`. O componente decide o que mostrar com o erro.
//
// Devolve: { stop, removing, erroParar }
//
// `onStopped` (opcional) corre SO' depois de o servidor confirmar que parou.
// Nunca no `finally`: antes disso o botao dizia "parado" com o torrent ainda a
// descarregar (401 engolido), e o player fechava sem o torrent ter parado.
export function useStopTorrent({ infoHash, onStopped }) {
  const [removing, setRemoving] = useState(false);
  // `null` ou `{ mensagem }`. E' um objecto para o alerta aparecer mesmo quando
  // o erro nao traz mensagem (uma string vazia escondia-o).
  const [erroParar, setErroParar] = useState(null);

  const stop = useCallback(() => {
    if (removing || !infoHash) return;
    setErroParar(null);
    setRemoving(true);
    api
      .stopTorrent(infoHash)
      .then(() => {
        setRemoving(false);
        // So' aqui: o servidor ja' confirmou. E' isto que fecha o player.
        onStopped?.();
      })
      .catch((e) => {
        // Guarda a mensagem CRUA (nao a frase de interface): quem mostra o erro
        // e' o VideoPlayer, que tem o `t` e traduz. Assim o gancho nao carrega
        // texto de interface (e o auditor de traducao nao o aponta).
        setErroParar({ mensagem: e.message || "" });
      })
      .finally(() => setRemoving(false));
  }, [infoHash, removing, onStopped]);

  return { stop, removing, erroParar };
}
