// Fontes de video e estado dos providers.
//
// Rota fina: le os parametros, chama o handler e responde. A regra esta em
// `handlers/sources.js`.
import { Router } from "express";
import {
  provedores,
  estadoProvedores,
  estadoDoAnikoto,
  fontes,
} from "../handlers/sources.js";

export const sourcesRouter = Router();

// Os handlers devolvem `{ erro, status }` quando o pedido nao passa; o resto e'
// o corpo da resposta tal e qual.
function responder(res, r) {
  if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
  return res.json(r);
}

sourcesRouter.get("/providers", (_req, res) => {
  responder(res, provedores());
});

// Estado (vivo/morto) dos providers: ?refresh=1 forca o check agora.
sourcesRouter.get("/providers/health", async (req, res, next) => {
  try {
    responder(res, await estadoProvedores({ refresh: req.query.refresh }));
  } catch (err) {
    next(err);
  }
});

// Fontes de embed para um titulo especifico.
sourcesRouter.get("/sources", async (req, res, next) => {
  try {
    responder(res, await fontes({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Estado do catalogo do Anikoto (util para ver se o rasteio esta' a avancar).
sourcesRouter.get("/providers/anikoto", (_req, res) => {
  responder(res, estadoDoAnikoto());
});