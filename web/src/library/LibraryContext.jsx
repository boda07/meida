import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../api/client.js";

const LibraryContext = createContext(null);

function key(type, tmdbId) {
  return `${type}:${tmdbId}`;
}

// Cache leve da biblioteca do utilizador (um por app, carregado uma vez).
// Serve para o "quick add" dos cartões do catalogo (home/search/category) e para
// mostrar as badges de visto/watchlist em cima de cada cartão.
export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const [loadedUid, setLoadedUid] = useState(null); // userId já carregado
  const [loading, setLoading] = useState(false);
  const [map, setMap] = useState(() => new Map());

  // Carrega a library uma vez por utilizador (não repete se já carregado).
  useEffect(() => {
    if (!user) {
      setMap(new Map());
      setLoadedUid(null);
      return;
    }
    const uid = String(user.id);
    if (loadedUid === uid) return;
    setLoading(true);
    api
      .library()
      .then((d) => {
        const m = new Map();
        for (const it of d.items || []) m.set(key(it.type, it.tmdbId), it);
        setMap(m);
        setLoadedUid(uid);
      })
      .catch(() => setMap(new Map()))
      .finally(() => setLoading(false));
  }, [user, loadedUid]);

  // Helpers que usam setMap como updater (sem depender do map actual em escopo).
  const mergeEntry = useCallback((it) => {
    if (!it) return;
    setMap((prev) => {
      const m = new Map(prev);
      m.set(key(it.type, it.tmdbId), it);
      return m;
    });
  }, []);
  const removeEntry = useCallback((type, tmdbId) => {
    setMap((prev) => {
      if (!prev.has(key(type, tmdbId))) return prev;
      const m = new Map(prev);
      m.delete(key(type, tmdbId));
      return m;
    });
  }, []);

  const getEntry = useCallback((type, tmdbId) => map.get(key(type, tmdbId)) || null, [map]);

  // Adiciona rapidamente à library (watchlist) optimicamente. Reverte em caso de falha.
  const quickAdd = useCallback(
    async (type, tmdbId, title, poster) => {
      mergeEntry({
        type,
        tmdbId,
        title: title ?? null,
        poster: poster ?? null,
        watched: false,
        watchlist: true,
        score: null,
        rating: null,
        updatedAt: null,
      });
      try {
        await api.saveLibrary({ tmdbId, type, title, poster, watchlist: true });
      } catch (e) {
        api
          .libraryItem(type, tmdbId)
          .then((d) => (d.item ? mergeEntry(d.item) : removeEntry(type, tmdbId)))
          .catch(() => removeEntry(type, tmdbId));
        throw e;
      }
    },
    [mergeEntry, removeEntry]
  );

  // Marca como visto (também tira da watchlist) optimicamente.
  const markWatched = useCallback(
    async (type, tmdbId, title, poster, existingScore) => {
      mergeEntry({
        type,
        tmdbId,
        title: title ?? null,
        poster: poster ?? null,
        watched: true,
        watchlist: false,
        score: existingScore ?? null,
        rating: null,
        updatedAt: null,
      });
      await api.saveLibrary({ tmdbId, type, title, poster, watched: true, watchlist: false });
    },
    [mergeEntry]
  );

  return (
    <LibraryContext.Provider value={{ getEntry, quickAdd, markWatched, loading }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  return useContext(LibraryContext);
}
