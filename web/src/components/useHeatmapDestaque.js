import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Estado do destaque/tooltip do mapa de calor.
//
// Responsabilidade unica: gerir qual celula esta destacada, a posicao do texto
// (medida em tempo real para nao sair do ecra), se ficou preso por toque, e
// fechar com Escape ou ao sair para outro dia.
//
// Devolve: { destaque, setDestaque, mostrar, soltar, dicaRef }
export function useHeatmapDestaque() {
  const [destaque, setDestaqueState] = useState(null);
  const dicaRef = useRef(null);

  // Medir o texto real e puxar para dentro das margens.
  useLayoutEffect(() => {
    const el = dicaRef.current;
    if (!el || !destaque) return;
    const meia = el.offsetWidth / 2 + 8;
    const x = Math.max(meia, Math.min(destaque.x, window.innerWidth - meia));
    if (x !== destaque.x) setDestaqueState((d) => (d ? { ...d, x } : d));
  }, [destaque]);

  // Esc fecha o que ficou preso por um toque.
  useEffect(() => {
    if (!destaque || !destaque.preso) return;
    const aoTeclar = (e) => { if (e.key === "Escape") setDestaqueState(null); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [destaque]);

  const mostrar = useCallback((celula, preso = false, ev = null) => {
    if (!celula || celula.fora) return;
    const alvo = ev?.currentTarget;
    let x = 0;
    let y = 0;
    if (alvo) {
      const r = alvo.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top;
    }
    setDestaqueState({ ...celula, preso, x, y });
  }, []);

  const soltar = useCallback((celula) => {
    setDestaqueState((d) => (d && d.preso && d.dia !== celula.dia ? d : null));
  }, []);

  return { destaque, setDestaque: setDestaqueState, mostrar, soltar, dicaRef };
}
