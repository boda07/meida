// Comentarios por episodio (e por titulo, para filmes).
//
// A chave e' (type, tmdbId, season, episode). Ler nao exige login (optionalAuth)
// mas escrever/gostar/apagar exige (requireAuth).
import { Router } from "express";
import { requireAuth, optionalAuth } from "../services/auth.js";
import { listComments, addComment, deleteComment, likeComment, unlikeComment, getComment } from "../store.js";

export const commentsRouter = Router();

// Le e valida os parametros do episodio a partir da query ou do corpo.
function episodeFrom(obj) {
  const type = obj.type;
  const tmdbId = Number(obj.tmdbId);
  if (type !== "movie" && type !== "tv" && type !== "anime") return { error: "type invalido" };
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return { error: "tmdbId invalido" };
  const toIntOrNull = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  return { type, tmdbId, season: toIntOrNull(obj.season), episode: toIntOrNull(obj.episode) };
}

commentsRouter.get("/comments", optionalAuth, (req, res) => {
  const ep = episodeFrom(req.query);
  if (ep.error) return res.status(400).json({ error: ep.error });
  res.json({ comments: listComments({ ...ep, viewerId: req.user?.id ?? null }) });
});

commentsRouter.post("/comments", requireAuth, (req, res) => {
  const { parentId, body, atSeconds } = req.body || {};
  const ep = episodeFrom(req.body || {});
  if (ep.error) return res.status(400).json({ error: ep.error });
  const c = addComment({
    ...ep,
    userId: req.user.id,
    parentId: parentId ?? null,
    body,
    atSeconds,
  });
  if (c?.error === "empty") return res.status(400).json({ error: "Escreve alguma coisa." });
  if (c?.error === "long") return res.status(400).json({ error: "O comentario e' demasiado longo." });
  if (c?.error === "parent") return res.status(404).json({ error: "Comentario a responder nao existe." });
  res.json({ comment: c });
});

commentsRouter.delete("/comments/:id", requireAuth, (req, res) => {
  const r = deleteComment(req.user.id, Number(req.params.id));
  if (!r.ok && r.error === "notfound") return res.status(404).json({ error: "Comentario nao existe." });
  if (!r.ok) return res.status(403).json({ error: "So podes apagar os teus comentarios." });
  res.json({ ok: true });
});

commentsRouter.post("/comments/:id/like", requireAuth, (req, res) => {
  const r = likeComment(req.user.id, Number(req.params.id));
  if (!r.ok) return res.status(404).json({ error: "Comentario nao existe." });
  res.json(r);
});

commentsRouter.delete("/comments/:id/like", requireAuth, (req, res) => {
  res.json(unlikeComment(req.user.id, Number(req.params.id)));
});

// Um comentario isolado (para responder na UI sem recarregar a lista toda).
commentsRouter.get("/comments/:id", optionalAuth, (req, res) => {
  const c = getComment(Number(req.params.id), req.user?.id ?? null);
  if (!c) return res.status(404).json({ error: "Comentario nao existe." });
  res.json({ comment: c });
});
