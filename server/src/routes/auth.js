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
  rateLimiter(10, 15 * 60 * 1000), // 10 tentativas por 15 min por IP
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
