import { Router } from "express";
import { register, login, requireAuth, updateProfile } from "../services/auth.js";

export const authRouter = Router();

authRouter.post("/auth/register", (req, res) => {
  try {
    const { username, password } = req.body || {};
    res.json(register(username, password));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

authRouter.post("/auth/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    res.json(login(username, password));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

authRouter.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Atualiza o perfil: avatar, bio e privacidade da biblioteca (isPublic).
authRouter.patch("/auth/profile", requireAuth, (req, res) => {
  try {
    const { avatar, bio, isPublic } = req.body || {};
    res.json({ user: updateProfile(req.user.id, { avatar, bio, isPublic }) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
