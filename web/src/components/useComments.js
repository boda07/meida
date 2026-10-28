import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

// Comentarios de um episodio/filme: carregar, enviar, like, apagar.
//
// Responsabilidade unica: chamar as quatro APIs e gerir o estado
// (comentarios, loading, error, busy). O formulario de texto e o estado de
// resposta vivem no componente.
//
// Devolve: { comments, loading, error, busy, load, submit, submitReply,
//           toggleLike, remove }
export function useComments({ type, tmdbId, season, episode }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!type || !tmdbId) return;
    setLoading(true);
    api
      .comments({ type, tmdbId, season, episode })
      .then((d) => setComments(d.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type, tmdbId, season, episode]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit({ body, atSeconds }) {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addComment({
        type,
        tmdbId,
        season,
        episode,
        body: body.trim(),
        atSeconds,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(parentId, body) {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addComment({ type, tmdbId, season, episode, parentId, body: body.trim() });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(c) {
    if (!c) return;
    try {
      if (c.likedByMe) await api.unlikeComment(c.id);
      else await api.likeComment(c.id);
      load();
    } catch {
      /* ignora: o proximo load repõe o estado real */
    }
  }

  async function remove(id) {
    try {
      await api.deleteComment(id);
      load();
    } catch {
      /* ignora */
    }
  }

  return { comments, loading, error, busy, load, submit, submitReply, toggleLike, remove };
}
