import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

// Lógica de comparação de avaliações.
//
// Responsabilidade unica: carregar a library, buscar o item atual e guardar
// a nota. O componente decide o que mostrar com o estado.
//
// Devolve: { items, current, loading, error, busy, msg, saveScore, adjust,
//           seen, refs }
export function useCompareRating({ details }) {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const seen = useMemo(() => items.filter((i) => i.watched), [items]);
  const refs = useMemo(
    () =>
      seen.filter(
        (i) => !(i.type === details.type && String(i.tmdbId) === String(details.id))
      ),
    [seen, details]
  );

  useEffect(() => {
    api.library().then((d) => setItems(d.items || [])).catch(() => {});
    api.libraryItem(details.type, details.id).then((d) => setCurrent(d.item)).catch(() => {});
  }, [details.type, details.id]);

  useEffect(() => {
    // Referência aleatória quando a lista carrega.
    // (fecho sobre `refs`; o componente chama swapRef quando necessário)
  }, [refs]);

  async function saveScore(score) {
    setBusy(true);
    setMsg(null);
    try {
      const curItem = {
        tmdbId: details.id,
        type: details.type,
        title: details.title,
        poster: details.poster,
        rating: details.rating ?? null,
        genres: details.genres || [],
        score: current?.score ?? null,
      };
      const d = await api.saveLibrary({
        tmdbId: curItem.tmdbId,
        type: curItem.type,
        title: curItem.title,
        poster: curItem.poster,
        genres: curItem.genres,
        rating: curItem.rating,
        score,
      });
      setCurrent(d.item);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  function adjust(delta) {
    const cur = current?.score ?? 50;
    const next = Math.max(1, Math.min(100, cur + delta));
    saveScore(next);
  }

  return {
    items,
    current,
    seen,
    refs,
    busy,
    msg,
    saveScore,
    adjust,
    setCurrent,
    setMsg,
  };
}
