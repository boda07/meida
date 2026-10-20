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
import { timingSafeEqual } from "node:crypto";

export const adminRouter = Router();

adminRouter.post("/admin/seed", (req, res, next) => {
  try {
    const expected = process.env.ADMIN_TOKEN?.trim();
    const provided = String(req.headers["x-admin-token"] || "");
    // Compara-se em BYTES, nao em caracteres: `timingSafeEqual` exige buffers do
    // mesmo tamanho e `provided.length` conta unidades de codigo UTF-16. Um
    // token com tantos caracteres quanto o certo mas mais bytes (uma letra
    // acentuada, por exemplo) passava o teste de comprimento e fazia o
    // `timingSafeEqual` atirar `RangeError` — respondia 500 em vez de 404.
    const esperadoBuf = expected ? Buffer.from(expected, "utf8") : null;
    const fornecidoBuf = Buffer.from(provided, "utf8");
    if (
      !esperadoBuf ||
      fornecidoBuf.length !== esperadoBuf.length ||
      !timingSafeEqual(fornecidoBuf, esperadoBuf)
    ) {
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
