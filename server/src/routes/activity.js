// Feed de atividade: "X viu o episodio 3 da temporada 2 de Y".
//
// Duas leituras, a mesma fonte (`activity`, migracao 10):
//   * `/feed` — quem o utilizador segue + ele proprio (precisa de sessao);
//   * `/users/:username/activity` — o historico de um perfil (publico ou dono).
//
// A privacidade e' a mesma da biblioteca: perfil publico -> todos veem; privado
// -> so o dono. Seguir um perfil privado NAO abre excepcao (ver `canViewProfile`).
import { Router } from "express";
import { requireAuth, optionalAuth } from "../services/auth.js";
import { localizarTitulos, preencherTitulosLocalizados } from "../services/tmdb.js";
import {
  canViewProfile,
  getProfileByUsername,
  listFeedActivity,
  listUserActivity,
} from "../store.js";

export const activityRouter = Router();

// Limites do pedido. `limit` tem tecto para uma pagina nao pedir a base toda;
// `offset` idem, para um pedido absurdo nao varrer a tabela inteira.
function paginacao(q) {
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(q.limit)) || 20));
  const offset = Math.max(0, Math.min(2000, Math.trunc(Number(q.offset)) || 0));
  return { limit, offset };
}

// O titulo guardado e' o do momento em que se viu. Localiza-se ao sair, como na
// biblioteca e nas listas; o que falta vai para background e a proxima abertura
// ja vem completa.
//
// As duas rotas ficam com uma responsabilidade cada (autenticacao e privacidade);
// o resto e' igual e vive aqui.
function responderPagina(req, res, listar) {
  const { limit, offset } = paginacao(req.query);
  const { items, hasMore } = listar({ limit, offset });
  const emFalta = localizarTitulos(items, req.query.titleLang);
  res.json({ items, hasMore });
  preencherTitulosLocalizados(emFalta, req.query.titleLang);
}

activityRouter.get("/feed", requireAuth, (req, res) => {
  responderPagina(req, res, (p) => listFeedActivity(req.user.id, p));
});

activityRouter.get("/users/:username/activity", optionalAuth, (req, res) => {
  const perfil = getProfileByUsername(req.params.username);
  if (!perfil) return res.status(404).json({ error: "Utilizador nao encontrado." });
  if (!canViewProfile(req.user?.id, perfil)) {
    return res.status(403).json({ error: "Este perfil é privado." });
  }
  responderPagina(req, res, (p) => listUserActivity(perfil.id, p));
});
