// As estatisticas da pagina /stats.
//
// So' para o proprio utilizador: nao ha nada de publico aqui. Ao contrario do
// perfil, onde os numeros de biblioteca sao visiveis por toda a gente, o tempo
// visto e' dado pessoal e so' sai para quem o pediu.
//
// O calculo esta' em `server/src/stats.js` e nao aqui — a rota e' so' o porto.
import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { statsFor } from "../stats.js";

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get("/stats", (req, res) => {
  res.json(statsFor(req.user.id));
});