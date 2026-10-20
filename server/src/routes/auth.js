import { Router, json } from "express";
import { register, login, requireAuth, updateProfile } from "../services/auth.js";
import { rateLimiter, estaBloqueadoLogin, registarFalhaLogin } from "../services/rateLimit.js";

export const authRouter = Router();

authRouter.post(
  "/auth/register",
  rateLimiter(10, 60 * 60 * 1000), // 10 registos por hora por IP
  async (req, res) => {
    try {
      const { username, password } = req.body || {};
      res.json(await register(username, password));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

authRouter.post(
  "/auth/login",
  // O teto por IP e' largo de proposito (100 em 15 min). Antes eram 10 e
// contavam **todos** os pedidos, nao so' as falhas — medido: o 11.o login
// BEM-SUCEDIDO seguidos dava 429, o que parte uma casa, uma escola ou quem
// troque de conta. O controlo que aperta mesmo e' o de falhas, abaixo
// (`estaBloqueadoLogin`), que e' por (ip, utilizador) e so' conta senhas erradas.
rateLimiter(100, 15 * 60 * 1000), // 100 por 15 min por IP: so' anti-abuso
  async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || "desconhecido";
    const { username, password } = req.body || {};
    // Dez falhas seguidas para a mesma (ip, usuario) bloqueiam durante 15 min,
    // atrasando brute force e ataques distribuidos contra uma conta.
    if (estaBloqueadoLogin(ip, username)) {
      return res.status(429).json({
        error: "Muitas tentativas falhadas para esta conta. Tenta de novo mais tarde.",
      });
    }
    try {
      res.json(await login(username, password));
    } catch (err) {
      if (err.status === 401) registarFalhaLogin(ip, username);
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

authRouter.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Atualiza o perfil: avatar, bio e privacidade da biblioteca (isPublic).
authRouter.patch(
  "/auth/profile",
  requireAuth,
  json({ limit: "4mb" }), // avatar como data URL pode ser grande
  (req, res) => {
    try {
      const { avatar, bio, isPublic } = req.body || {};
      res.json({ user: updateProfile(req.user.id, { avatar, bio, isPublic }) });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);
