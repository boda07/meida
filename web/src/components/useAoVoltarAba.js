// Recarrega quando o separador volta a estar visível.
//
// Se a pessoa deixou a app aberta noutra janela, o sino antigo é pior do que
// uma espera: parece que não há nada novo.
import { useEffect, useRef } from "react";

/**
 * @param {() => void} accao
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.active=true]
 */
export function useAoVoltarAba(accao, { active = true } = {}) {
  const ref = useRef(accao);
  useEffect(() => {
    ref.current = accao;
  }, [accao]);

  useEffect(() => {
    if (!active) return undefined;
    const aoVoltar = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [active]);
}