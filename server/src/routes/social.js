// Area social: seguir utilizadores, ver perfis e a biblioteca/listas de outros.
//
// Privacidade: um perfil publico ve-se sem login; um perfil privado so o
// proprio. Por isso a leitura usa optionalAuth (nunca bloqueia um perfil
// publico) e as accoes (seguir/deixar de seguir) exigem requireAuth.
import { Router } from "express";
import { createHash } from "node:crypto";
import { requireAuth, optionalAuth } from "../services/auth.js";
import { localizarTitulos, preencherTitulosLocalizados } from "../services/tmdb.js";
import {
  getUserById,
  getUserAvatar,
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

// Avatar de um utilizador, servido separadamente (nao inline nas listas).
// Devolve o valor armazenado (data URL, "emoji:..." ou URL externa) para que
// o frontend possa buscar so quando precisa - ex.: ao renderizar o comentario
// de um utilizador cuja lista de comentarios ja nao traz o avatar.
//
// **O ETag e' o SHA-1 do VALOR, nunca o comprimento.** Era `avatar.length`, e
// dois emojis diferentes tem o mesmo `length` (medido: "emoji:😀" e "emoji:😁"
// dao ambos 8), portanto o ETag nao mudava: o cliente revalidava, levava **304**
// e ficava com o avatar antigo indefinidamente. O `res.json` do Express trata o
// `If-None-Match` sozinho, por isso o 304 chegava mesmo.
//
// **Sem `immutable`:** num URL que muda, `immutable` + `max-age=86400` dizia ao
// browser para nao revalidar durante um dia — o avatar novo so aparecia amanha.
// `max-age=300, must-revalidate` da' 5 minutos sem tocar no servidor e obriga a
// revalidar depois disso.
//
// O SHA-1 de um avatar de 4 MB (data URL) custa ~6 ms (medido). Como o valor
// vem sempre do mesmo sitio e o `===` de uma string em JS e' imediato, guardar o
// ultimo hash por utilizador torna as repeticoes gratis.
const etagsAvatar = new Map(); // id -> { valor, etag }
function etagDoAvatar(id, valor) {
  const guardado = etagsAvatar.get(id);
  if (guardado && guardado.valor === valor) return guardado.etag;
  const etag = createHash("sha1").update(valor).digest("base64");
  if (etagsAvatar.size > 2000) etagsAvatar.clear();
  etagsAvatar.set(id, { valor, etag });
  return etag;
}

socialRouter.get("/users/:id/avatar", optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  const avatar = getUserAvatar(id);
  if (avatar === null) return res.status(404).json({ error: "Sem avatar." });
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.setHeader("ETag", `"${etagDoAvatar(id, avatar)}"`);
  res.json({ avatar });
});

// Biblioteca de outro utilizador (respeita a privacidade).
//
// Os titulos localized-se ao mesmo tempo que os da biblioteca propria: o titulo
// guardado e' o de quem guardou, no idioma que tinha entao. Sem isto, um perfil
// publico mostrava os titulos em ingles a quem esta com a interface em portugues.
socialRouter.get("/users/:username/library", optionalAuth, (req, res) => {
  const p = getProfileByUsername(req.params.username);
  if (!p) return res.status(404).json({ error: "Utilizador nao encontrado." });
  if (!canViewProfile(req.user?.id, p)) {
    return res.status(403).json({ error: "Este perfil é privado." });
  }
  const items = publicLibrary(p.id);
  const titleLang = req.query.titleLang;
  const emFalta = localizarTitulos(items, titleLang);
  res.json({ items });
  preencherTitulosLocalizados(emFalta, titleLang);
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
  // Como a biblioteca propria: o titulo guardado e' o de quem guardou, no
  // idioma que tinha entao. Localiza-se ao sair.
  const titleLang = req.query.titleLang;
  const emFalta = localizarTitulos(list.items, titleLang);
  res.json({ list });
  preencherTitulosLocalizados(emFalta, titleLang);
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
