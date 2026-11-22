// Fecha um popup quando se clica fora dele (e, por omissão, com Escape).
//
// PORQUE EXISTE: o mesmo bloco de `mousedown` + `keydown` estava copiado em
// cinco componentes — cada cópia com a sua variante (umas com Escape, outras
// sem). Qualquer correcção tinha de ser feita cinco vezes, e uma cópia
// esquecida era um menu que não fechava.
import { useEffect, useRef } from "react";
import { useTeclaEsc } from "./useTeclaEsc.js";

/**
 * @param {import("react").RefObject<HTMLElement>} ref  a caixa que deve ficar aberta
 * @param {() => void} fechar
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.active=true]  só liga os ouvintes quando `true`
 * @param {boolean} [opcoes.escape=true]  Escape também fecha
 */
export function useClickOutside(ref, fechar, { active = true, escape = true } = {}) {
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  }, [fechar]);

  useEffect(() => {
    if (!active) return undefined;
    const aoClicar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) fecharRef.current();
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [active, ref]);

  useTeclaEsc(() => fecharRef.current(), { active: active && escape });
}