import { Router } from "express";
import { register, login, requireAuth, setAvatar } from "../services/auth.js";

export const authRouter = Router();

authRouter.post("/auth/register", (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    res.json(register(username, password));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

authRouter.post("/auth/login", (req, res, next) => {
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

// Atualiza o perfil (de momento so o avatar).
authRouter.patch("/auth/profile", requireAuth, (req, res) => {
  try {
    const { avatar } = req.body || {};
    res.json({ user: setAvatar(req.user.id, avatar) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
