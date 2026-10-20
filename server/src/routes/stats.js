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
import { tzDoPedido } from "../services/dias.js";

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get("/stats", (req, res) => {
  // `?tz` e' o fuso do cliente, e nao uma opcao: sem ele os dias saem em UTC e o
  // heatmap (que desenha dias locais) esconde a atividade da ultima hora do dia.
  res.json(statsFor(req.user.id, tzDoPedido(req)));
});