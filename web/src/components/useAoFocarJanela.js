// Volta a verificar a ligação quando a janela recupera o foco.
//
// É o caso do OAuth: o utilizador sai para o browser, autoriza, e volta. Sem
// isto, a secção continuava a dizer "não ligado" até se recarregar a página.
import { useEffect, useRef } from "react";

/**
 * @param {() => void} accao
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.active=true]
 */
export function useAoFocarJanela(accao, { active = true } = {}) {
  const ref = useRef(accao);
  useEffect(() => {
    ref.current = accao;
  }, [accao]);

  useEffect(() => {
    if (!active) return undefined;
    const aoFocar = () => ref.current();
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, [active]);
}