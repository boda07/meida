// Fecha com a tecla Escape.
//
// O `keydown` fica na `window` (e não no elemento): o foco pode estar num link
// dentro do popup e o evento não sobe se não houver um agrupador com `tabIndex`
// — e não há, para não meter um foco invisível na ordem da tabulação.
import { useEffect, useRef } from "react";

/**
 * @param {() => void} fechar
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.active=true]  só liga o ouvinte quando `true`
 */
export function useTeclaEsc(fechar, { active = true } = {}) {
  const ref = useRef(fechar);
  useEffect(() => {
    ref.current = fechar;
  }, [fechar]);

  useEffect(() => {
    if (!active) return undefined;
    const aoTeclar = (e) => {
      if (e.key === "Escape") ref.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [active]);
}