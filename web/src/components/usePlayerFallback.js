import { useCallback, useEffect, useRef, useState } from "react";

// Auto-fallback de fontes de vídeo.
//
// Responsabilidade unica: quando a fonte activa nao carrega dentro do TIMEOUT,
// troca automaticamente para a proxima fonte viva (salvando os mortos). Gerencia
// o timer de 15s (automatico) ou 45s (escolha manual), o estado loaded e o
// reloadKey para forcar recriacao do iframe quando necessario.
//
// Devolve: { index, loaded, reloadKey, trocada, carregouRef, timerRef,
//           marcarCarregado, setIndex, setLoaded, setTrocada, setReloadKey }
export function usePlayerFallback({
  lista,
  deadIds,
  startIndex = 0,
  manual = false,
  arrancado = false,
}) {
  const TIMEOUT_MS = 15000;
  const TIMEOUT_MANUAL_MS = 45000;

  // Indice da fonte activa dentro da lista.
  const [index, setIndex] = useState(() => firstAlive(lista, deadIds, startIndex));
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Fonte trocada sozinha (para o utilizador saber o que aconteceu).
  const [trocada, setTrocada] = useState(null);

  const deadRef = useRef(deadIds);
  deadRef.current = deadIds;

  // "Ja carregou" e o timer em refs porque o load pode chegar antes do efeito correr.
  const carregouRef = useRef(false);
  const timerRef = useRef(null);

  // Primeiro embed "vivo" (nao em deadIds), ou o primeiro conhecido.
  function firstAlive(list, dead, start) {
    if (!list?.length) return 0;
    const s = Math.max(0, start);
    for (let i = s; i < list.length; i++) if (!dead?.has(list[i].provider)) return i;
    for (let i = 0; i < s; i++) if (!dead?.has(list[i].provider)) return i;
    return s < list.length ? s : 0;
  }

  // Proximo indice vivo a partir de `i` (exclusive: a propria fonte nao conta).
  function nextAlive(i, list, dead) {
    if (!list?.length) return 0;
    for (let j = i + 1; j < list.length; j++) if (!dead?.has(list[j].provider)) return j;
    for (let j = 0; j < i; j++) if (!dead?.has(list[j].provider)) return j;
    return i;
  }

  // Fonte activa: calculada a partir do index, para o Player usar o mesmo que o hook gere.
  const active = lista?.[index];

  // O iframe carregou.
  const marcarCarregado = useCallback(() => {
    if (carregouRef.current) return;
    carregouRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setLoaded(true);
  }, []);

  // Re-inicia o indice activo quando a lista ou a origem mudarem.
  // deadIds NAO entra aqui: o health-check chega depois do episodio arrancar,
  // e antes isto reiniciava o player inteiro.
  useEffect(() => {
    setIndex(() => firstAlive(lista, deadRef.current, startIndex));
    setReloadKey((k) => k + 1);
    setLoaded(false);
  }, [lista, startIndex]);

  // Reage a health-check: sai da fonte atual APENAS se ela estiver nos mortos.
  useEffect(() => {
    if (!deadIds || !active) return;
    if (!deadIds.has(active.provider)) return;
    const proximo = nextAlive(index, lista, deadIds);
    if (proximo === index) return;
    setTrocada(active.name || null);
    setIndex(proximo);
    setReloadKey((k) => k + 1);
    setLoaded(false);
  }, [deadIds, index, active, lista]);

  // Timeout de fallback: 15s sem load -> proxima fonte.
  useEffect(() => {
    if (!active || !arrancado) return;
    carregouRef.current = false;
    setLoaded(false);
    timerRef.current = setTimeout(() => {
      if (carregouRef.current) return;
      carregouRef.current = true;
      clearTimeout(timerRef.current);
      timerRef.current = null;

      // Escolha manual: fica nesta fonte; a pessoa ve se esta partida e escolhe outra.
      if (manual) {
        setLoaded(true);
        return;
      }

      const proximo = nextAlive(index, lista, deadRef.current);
      if (proximo === index) {
        setLoaded(true); // sem mais fontes: para de tentar
        return;
      }
      setTrocada(active?.name || null);
      setIndex(proximo);
      setReloadKey((k) => k + 1);
      setLoaded(false);
    }, manual ? TIMEOUT_MANUAL_MS : TIMEOUT_MS);

    return () => {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [active, lista, index, arrancado, manual]);

  return {
    index,
    active,
    loaded,
    reloadKey,
    trocada,
    carregouRef,
    timerRef,
    marcarCarregado,
    setIndex,
    setLoaded,
    setTrocada,
    setReloadKey,
    nextAlive,
  };
}
