// Area social: seguir utilizadores, ver perfis e a biblioteca/listas de outros.
//
// Privacidade: um perfil publico ve-se sem login; um perfil privado so o
// proprio. Por isso a leitura usa optionalAuth (nunca bloqueia um perfil
// publico) e as accoes (seguir/deixar de seguir) exigem requireAuth.
import { Router } from "express";
import { requireAuth, optionalAuth } from "../services/auth.js";
import {
  getUserById,
  getProfileByUsername,
  followUser,
  unfollowUser,
  isFollowing,
  followCounts,
  listFollowers,
  listFollowing,
  searchUsers,
  sugerirUsers,
  canViewProfile,
  listLibrary,
  listLists,
  getList,
} from "../store.js";

export const socialRouter = Router();

// Normaliza as flags 0/1 da biblioteca para booleanos (igual a library.js).
function publicLibrary(userId) {
  return listLibrary(userId).map((i) => ({ ...i, watched: Boolean(i.watched), watchlist: Boolean(i.watchlist) }));
}

// Pesquisa de utilizadores por nome (para descobrir quem seguir).
socialRouter.get("/users", optionalAuth, (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ users: [] });
  res.json({ users: searchUsers(q, 20) });
});

// Quem sugerir para uma "@mencao": toda a gente, mas quem tem ligacao connosco
// primeiro. E' uma rota separada e nao um parametro de `/users` porque e' outro
// trabalho — precisa de saber quem e' quem ve, e a `/users` e' para procurar
// alguem a seguir.
socialRouter.get("/users/suggest", optionalAuth, (req, res) => {
  const q = String(req.query.q || "").trim();
  // Sem query devolve a lista toda, porque acabaste de escrever "@" e a lista
  // tem de aparecer logo (com `q === ""`, `searchUsers` devolvia vazio).
  const { users, linked } = sugerirUsers(q, req.user?.id ?? null, 20);
  res.json({ users, linked });
});

// Perfil publico. Sem login tambem funciona (para perfis publicos).
socialRouter.get("/users/:username", optionalAuth, (req, res) => {
  const p = getProfileByUsername(req.params.username);
  if (!p) return res.status(404).json({ error: "Utilizador nao encontrado." });
  const isMe = req.user?.id === p.id;
  res.json({
    user: {
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      bio: p.bio,
      isPublic: p.isPublic,
      createdAt: p.createdAt,
    },
    ...followCounts(p.id),
    isMe,
    isFollowing: req.user ? isFollowing(req.user.id, p.id) : false,
    canView: canViewProfile(req.user?.id, p),
  });
});

// Biblioteca de outro utilizador (respeita a privacidade).
socialRouter.get("/users/:username/library", optionalAuth, (req, res) => {
  const p = getProfileByUsername(req.params.username);
  if (!p) return res.status(404).json({ error: "Utilizador nao encontrado." });
  if (!canViewProfile(req.user?.id, p)) {
    return res.status(403).json({ error: "Este perfil é privado." });
  }
  res.json({ items: publicLibrary(p.id) });
});

// Listas de outro utilizador (so os nomes e contagens).
socialRouter.get("/users/:username/lists", optionalAuth, (req, res) => {
  const p = getProfileByUsername(req.params.username);
  if (!p) return res.status(404).json({ error: "Utilizador nao encontrado." });
  if (!canViewProfile(req.user?.id, p)) {
    return res.status(403).json({ error: "Este perfil é privado." });
  }
  res.json({ lists: listLists(p.id) });
});

// Conteudo de uma lista de outro utilizador.
socialRouter.get("/users/:username/lists/:id", optionalAuth, (req, res) => {
  const p = getProfileByUsername(req.params.username);
  if (!p) return res.status(404).json({ error: "Utilizador nao encontrado." });
  if (!canViewProfile(req.user?.id, p)) {
    return res.status(403).json({ error: "Este perfil é privado." });
  }
  const list = getList(p.id, Number(req.params.id));
  if (!list) return res.status(404).json({ error: "Lista nao encontrada." });
  res.json({ list });
});

// Seguidores / a seguir.
socialRouter.get("/users/:username/followers", optionalAuth, (req, res) => {
  const p = getProfileByUsername(req.params.username);
  if (!p) return res.status(404).json({ error: "Utilizador nao encontrado." });
  res.json({ users: listFollowers(p.id) });
});

socialRouter.get("/users/:username/following", optionalAuth, (req, res) => {
  const p = getProfileByUsername(req.params.username);
  if (!p) return res.status(404).json({ error: "Utilizador nao encontrado." });
  res.json({ users: listFollowing(p.id) });
});

// Seguir por id (a UI ja' tem o id do perfil). O proprio username tambem serve.
function resolveTarget(param) {
  const asId = Number(param);
  if (Number.isInteger(asId) && asId > 0) return getUserById(asId);
  return getProfileByUsername(param);
}

socialRouter.post("/users/:id/follow", requireAuth, (req, res) => {
  const target = resolveTarget(req.params.id);
  if (!target) return res.status(404).json({ error: "Utilizador nao encontrado." });
  const r = followUser(req.user.id, target.id);
  if (!r.ok && r.error === "self") {
    return res.status(400).json({ error: "Nao podes seguir-te a ti proprio." });
  }
  if (!r.ok) return res.status(404).json({ error: "Utilizador nao encontrado." });
  res.json({ ok: true, isFollowing: true, ...followCounts(target.id) });
});

socialRouter.delete("/users/:id/follow", requireAuth, (req, res) => {
  const target = resolveTarget(req.params.id);
  if (!target) return res.status(404).json({ error: "Utilizador nao encontrado." });
  unfollowUser(req.user.id, target.id);
  res.json({ ok: true, isFollowing: false, ...followCounts(target.id) });
});
