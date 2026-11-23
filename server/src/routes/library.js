// Biblioteca e listas pessoais.
//
// Rota fina: valida o essencial, chama o handler e responde. Toda a regra
// (backfill, fusao com o estado guardado, feed, generos) vive em
// `handlers/library.js`.
import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import {
  listarBiblioteca,
  obterItem,
  guardarItem,
  guardarAno,
  limparWatchlist,
  removerItem,
  listarListas,
  criarLista,
  obterLista,
  renomearLista,
  apagarLista,
  acrescentarTitulo,
  removerTitulo,
} from "../handlers/library.js";

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

// Os handlers devolvem `{ erro, status }` quando o pedido nao passa; o resto e'
// o corpo da resposta tal e qual.
function responder(res, r) {
  if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
  return res.json(r);
}

// Lista completa da biblioteca (com backfill em segundo plano).
libraryRouter.get("/library", async (req, res) => {
  responder(
    res,
    await listarBiblioteca({
      userId: req.user.id,
      titleLang: req.query.titleLang,
      genreLang: req.query.genreLang,
      overviewLang: req.query.overviewLang,
    })
  );
});

// Estado de um titulo (para a pagina de detalhe saber visto/nota atuais).
libraryRouter.get("/library/item", (req, res) => {
  responder(res, obterItem({ userId: req.user.id, type: req.query.type, tmdb: req.query.tmdb }));
});

// Cria/atualiza visto e/ou nota.
libraryRouter.post("/library", (req, res) => {
  responder(res, guardarItem({ userId: req.user.id, body: req.body }));
});

// Guarda so' o ano de um titulo que ja esta' na biblioteca.
libraryRouter.patch("/library/year", (req, res) => {
  responder(res, guardarAno({ userId: req.user.id, body: req.body }));
});

// Limpa a watchlist por tipo (movie|tv|anime|all).
libraryRouter.delete("/library/watchlist", (req, res) => {
  responder(res, limparWatchlist({ userId: req.user.id, type: req.query.type || "all" }));
});

// Remove um titulo da biblioteca.
libraryRouter.delete("/library/item", (req, res) => {
  responder(res, removerItem({ userId: req.user.id, type: req.query.type, tmdb: req.query.tmdb }));
});

/* ===== Listas personalizadas ===== */

libraryRouter.get("/lists", (req, res) => {
  responder(res, listarListas({ userId: req.user.id }));
});

libraryRouter.post("/lists", (req, res) => {
  responder(res, criarLista({ userId: req.user.id, body: req.body }));
});

libraryRouter.get("/lists/:id", (req, res) => {
  responder(
    res,
    obterLista({ userId: req.user.id, id: req.params.id, titleLang: req.query.titleLang })
  );
});

libraryRouter.patch("/lists/:id", (req, res) => {
  responder(res, renomearLista({ userId: req.user.id, id: req.params.id, body: req.body }));
});

libraryRouter.delete("/lists/:id", (req, res) => {
  responder(res, apagarLista({ userId: req.user.id, id: req.params.id }));
});

libraryRouter.post("/lists/:id/titles", (req, res) => {
  responder(res, acrescentarTitulo({ userId: req.user.id, id: req.params.id, body: req.body }));
});

libraryRouter.delete("/lists/:id/titles", (req, res) => {
  responder(
    res,
    removerTitulo({
      userId: req.user.id,
      id: req.params.id,
      tmdbId: req.query.tmdbId,
      type: req.query.type,
    })
  );
});