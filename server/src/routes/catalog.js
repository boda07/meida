// Catálogo: filas, pesquisa, detalhes, temporadas e o "escolhe por mim".
//
// Rota fina: le os parametros, chama o handler e responde. A regra (que fontes
// entram, como se juntam, o que acontece quando uma falha) vive em
// `handlers/catalog.js`.
import { Router } from "express";
import {
  catalogo,
  categoria,
  linha,
  descobrir,
  pesquisar,
  episodiosAnime,
  recomendacoes,
  detalhes,
  generos,
  escolher,
  temporada,
} from "../handlers/catalog.js";

export const catalogRouter = Router();

// Os handlers devolvem `{ erro, status }` quando o pedido nao passa; o resto e'
// o corpo da resposta tal e qual.
function responder(res, r) {
  if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
  return res.json(r);
}

catalogRouter.get("/catalog", async (req, res, next) => {
  try {
    responder(res, await catalogo({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/catalog/:category", async (req, res, next) => {
  try {
    responder(res, await categoria({ category: req.params.category, query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Lista completa de uma row do catalogo ("Ver todos"), pagina a pagina.
catalogRouter.get("/rows/:id", async (req, res, next) => {
  try {
    responder(res, await linha({ id: req.params.id, query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Grelha filtravel/ordenavel por tipo (Filmes/Series/Anime), com paginacao.
catalogRouter.get("/discover", async (req, res, next) => {
  try {
    responder(res, await descobrir({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/search", async (req, res, next) => {
  try {
    responder(res, await pesquisar({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/anime/episodes", async (req, res, next) => {
  try {
    responder(res, await episodiosAnime({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/recommendations", async (req, res, next) => {
  try {
    responder(res, await recomendacoes({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/details", async (req, res, next) => {
  try {
    responder(res, await detalhes({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Lista de generos para o "Escolhe algo para mim", no idioma escolhido.
catalogRouter.get("/genres", async (req, res, next) => {
  try {
    responder(res, await generos({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

// Escolhe um titulo aleatorio segundo generos a incluir/excluir.
catalogRouter.get("/pick", async (req, res, next) => {
  try {
    responder(res, await escolher({ query: req.query }));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/season", async (req, res, next) => {
  try {
    responder(res, await temporada({ query: req.query }));
  } catch (err) {
    next(err);
  }
});