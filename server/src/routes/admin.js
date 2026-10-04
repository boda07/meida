// Rota de administracao: semeia a base com um data.json.
//
// Serve para migrar a biblioteca/diario/contas do computador do utilizador para
// o servidor partilhado ("dados na nuvem") sem precisar de acesso ao disco do
// hosting:
//
//   curl -X POST https://<servidor>/api/admin/seed \
//        -H "x-admin-token: $ADMIN_TOKEN" \
//        -H "Content-Type: application/json" \
//        --data-binary @server/data/data.json
//
// So existe se a env ADMIN_TOKEN estiver definida; caso contrario responde 404
// (ninguem descobre sequer que a rota existe). Para reimportar por cima, junta
// ?force=1.
import { Router } from "express";
import { seedFromJson } from "../db/seed.js";

export const adminRouter = Router();

adminRouter.post("/admin/seed", (req, res, next) => {
  try {
    const expected = process.env.ADMIN_TOKEN?.trim();
    const provided = String(req.headers["x-admin-token"] || "");
    if (!expected || provided !== expected) {
      return res.status(404).json({ error: "Nao encontrado." });
    }
    const force = req.query.force === "1" || req.query.force === "true";
    const { counts, scoreScale } = seedFromJson(req.body, { force });
    res.json({ ok: true, scoreScale, counts });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});
