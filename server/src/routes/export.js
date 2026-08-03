import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { listLibrary } from "../store.js";
import { listProgress } from "../store.js";

export const exportRouter = Router();
exportRouter.use(requireAuth);

// Export da biblioteca + diario do utilizador em JSON (objecto pronto a usar).
// O frontend gera os ficheiros CSV/JSON a partir daqui (client-side, sem deps).
exportRouter.get("/export", (req, res) => {
  const library = listLibrary(req.user.id);
  const diary = listProgress(req.user.id);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json({ exportedAt: new Date().toISOString(), library, diary });
});