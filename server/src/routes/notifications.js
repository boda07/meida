// Rotas das notificacoes.
//
// IMPORTANTE: `requireAuth` esta em CADA rota, e nao com `router.use(...)`.
// Um `router.use(requireAuth)` corre para todos os pedidos que entram no router
// e, sem token, responde 401 em vez de seguir — e como este router e' montado em
// `/api` antes do das contas, isso rebentava o registo e o login de toda a gente
// (medido a 2026-10-07: `POST /api/auth/register` devolvia "Nao autenticado.").
// E' o mesmo cuidado que o comments.js ja tem.
import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import {
  listNotifications,
  countUnread,
  markNotificationRead,
  markAllNotificationsRead,
} from "../store.js";

export const notificationsRouter = Router();

// Lista + contagem num pedido so. O sino e' actualizado a cada minuto e nao vale
// a pena dois pedidos para a mesma informacao; o `unread` ja vem no objecto.
notificationsRouter.get("/notifications", requireAuth, (req, res) => {
  const limite = Math.min(100, Math.max(1, Number(req.query.limite) || 40));
  res.json({ items: listNotifications(req.user.id, limite), unread: countUnread(req.user.id) });
});

// So' a contagem, para o sino. Barato: um COUNT, sem linhas.
notificationsRouter.get("/notifications/unread", requireAuth, (req, res) => {
  res.json({ unread: countUnread(req.user.id) });
});

// Marcar uma como lida.
notificationsRouter.post("/notifications/:id/read", requireAuth, (req, res) => {
  res.json(markNotificationRead(req.user.id, Number(req.params.id)));
});

// Marcar todas. E' o que o painel chama ao abrir.
notificationsRouter.post("/notifications/read-all", requireAuth, (req, res) => {
  res.json(markAllNotificationsRead(req.user.id));
});
