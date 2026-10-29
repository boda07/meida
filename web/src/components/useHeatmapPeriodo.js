import { useCallback, useMemo, useState } from "react";
import {
  DIAS_SEMANA,
  PERIODOS,
  PERIODO_OMISSAO,
  semanasAte,
  chaveDia,
} from "./heatmap.js";

// Periodos do mapa de calor (botoes "3 meses", "6 meses", "tudo", etc.).
//
// Responsabilidade unica: calcular os botoes de periodo disponiveis com base na
// historica de atividade, e gerir qual esta selecionado.
//
// Devolve: { periodos, escolhido, setEscolhido, semanasAtivas }
export function useHeatmapPeriodo({ dias, semanas = PERIODO_OMISSAO }) {
  const [escolhido, setEscolhido] = useState(null);

  const tudo = semanasAte(dias);
  const periodos = useMemo(() => {
    const lista = PERIODOS.map((p) => ({ ...p, semanas: Math.min(p.semanas, tudo) }));
    const filtrados = lista.filter((p, i) => i === 0 || p.semanas < lista[i - 1].semanas);
    return [...filtrados, { semanas: tudo, chave: "{n} tudo", n: 0, tudo: true }];
  }, [dias]);

  const semanasAtivas = escolhido || semanas;

  return { periodos, escolhido, setEscolhido, semanasAtivas };
}
