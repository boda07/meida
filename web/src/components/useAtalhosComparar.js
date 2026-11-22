// Os atalhos de teclado do jogo "Compara as tuas notas".
//
// ↑ aumenta a nota da esquerda, ↓ diminui, Espaço passa ao par seguinte.
// Fica num gancho (e não no meio da página) porque é a única parte daquele
// ecrã que não é desenho nem pedido de dados — e era a única com um
// `eslint-disable react-hooks/exhaustive-deps`: `adjust` e `next` eram
// capturados por uma closure que só se renovava quando o par mudava.
import { useEffect, useRef } from "react";

/**
 * @param {object} p
 * @param {[object, object]|null} p.pair
 * @param {boolean} p.busy
 * @param {(item: object, delta: number) => void} p.adjust
 * @param {() => void} p.next
 */
export function useAtalhosComparar({ pair, busy, adjust, next }) {
  const ref = useRef({ pair, busy, adjust, next });
  useEffect(() => {
    ref.current = { pair, busy, adjust, next };
  }, [pair, busy, adjust, next]);

  useEffect(() => {
    function onKey(e) {
      const est = ref.current;
      if (!est.pair || est.busy) return;
      if (e.target?.tagName === "INPUT") return; // não interrompe a escrever na caixa
      if (e.key === "ArrowUp") {
        e.preventDefault();
        est.adjust(est.pair[0], 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        est.adjust(est.pair[0], -1);
      } else if (e.key === " ") {
        e.preventDefault();
        est.next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}