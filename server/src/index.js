import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";
import { catalogRouter } from "./routes/catalog.js";
import { sourcesRouter } from "./routes/sources.js";
import { authRouter } from "./routes/auth.js";
import { libraryRouter } from "./routes/library.js";
import { streamRouter } from "./routes/stream.js";
import { playRouter } from "./routes/play.js";
import { malRouter } from "./routes/mal.js";
import { anilistRouter } from "./routes/anilist.js";
import { mangaRouter } from "./routes/manga.js";
import { letterboxdRouter } from "./routes/letterboxd.js";
import { debridRouter } from "./routes/debrid.js";
import { progressRouter } from "./routes/progress.js";
import { exportRouter } from "./routes/export.js";
import { achievementsRouter } from "./routes/achievements.js";
import { socialRouter } from "./routes/social.js";
import { commentsRouter } from "./routes/comments.js";
import { watchPartyRouter } from "./routes/watchparty.js";
import { adminRouter } from "./routes/admin.js";
import { notificationsRouter } from "./routes/notifications.js";
import { log } from "./services/log.js";

const app = express();
// CORS so e preciso quando o servidor NAO serve o frontend (hosting so-API: a
// app chama-o de outro dominio, ex.: Electron local -> servidor partilhado, ou
// PWA num hosting estatico). Quando e o proprio servidor que serve o web/dist,
// tudo e same-origin — e desligar o CORS fecha a porta a sitios maliciosos que
// tentem falar com o servidor local atraves do browser.
if (process.env.SERVE_WEB !== "1") app.use(cors());
// Limite generoso para o body: o avatar pode vir como imagem (data URL).
app.use(express.json({ limit: "4mb" }));

// Healthcheck + aviso se o TMDB nao estiver configurado.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    tmdbConfigured: Boolean(config.tmdb.apiKey || config.tmdb.accessToken),
  });
});

// Semeia a base remota (migracao inicial). Sem ADMIN_TOKEN responde 404.
app.use("/api", adminRouter);

app.use("/api", catalogRouter);
app.use("/api", sourcesRouter);
app.use("/api", authRouter);
app.use("/api", notificationsRouter);
// social/comments ANTES dos routers com requireAuth global (letterboxd, debrid,
// progress, export, achievements, library): esses aplicam o login a TUDO o que
// lhes chega, e os perfis publicos e a leitura de comentarios sao anonimos.
app.use("/api", socialRouter);
app.use("/api", commentsRouter);
app.use("/api", streamRouter);
app.use("/api", playRouter);
// watchPartyRouter publique e tem de vir ANTES de qualquer router com
// use(requireAuth) global (library, debrid, ...), senao o /api/wp/* e bloqueado.
app.use("/api", watchPartyRouter);
// malRouter ANTES do libraryRouter: o library aplica requireAuth a tudo o que
// passa por ele, e as rotas publicas do MAL (callback OAuth) nao podem ser bloqueadas.
app.use("/api", malRouter);
app.use("/api", anilistRouter);
app.use("/api", mangaRouter);
app.use("/api", letterboxdRouter);
app.use("/api", debridRouter);
app.use("/api", progressRouter);
app.use("/api", exportRouter);
app.use("/api", achievementsRouter);
app.use("/api", libraryRouter);

// Em producao (app desktop), serve o frontend ja compilado (web/dist).
if (process.env.SERVE_WEB === "1") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // No app empacotado o caminho vem por WEB_DIST; em dev usa o relativo.
  const dist = process.env.WEB_DIST || resolve(__dirname, "../../web/dist");

  // `/runtime-config.json` responde com o ficheiro de `web/public/` JA
  // CORRIGIDO pela variavel de ambiente. Sem isto, trocar o servidor de dados
  // obriga a recompilar o frontend e a redeployar — e a config errada fica em
  // cache no navegador, a mandar pedidos a um servidor que ja nao e' o dos dados.
  //
  // Porquê e' preciso: e' este ficheiro que diz ao frontend "as contas, a
  // biblioteca e os comentarios estao em https://...". E' assim que a versao web
  // passa a ver os mesmos dados que a app de desktop (que ja vai ao servidor
  // partilhado por `electron/default-server.txt`).
  //
  // A variavel e' MEIDA_REMOTE_DATA_BASE, a mesma do resto do projecto. O que
  // estiver em `web/public/runtime-config.json` e' a base, e a variavel
  // sobrescreve so o VITE_REMOTE_DATA_BASE — nunca o resto, para nao se perder
  // o VITE_API_BASE.
  app.get("/runtime-config.json", (req, res) => {
    let base;
    try {
      base = JSON.parse(readFileSync(resolve(dist, "runtime-config.json"), "utf8"));
      if (!base || typeof base !== "object") base = {};
    } catch {
      base = {};
    }
    const remoto = (process.env.MEIDA_REMOTE_DATA_BASE || "").trim();
    if (remoto) {
      base.VITE_REMOTE_DATA_BASE = remoto.replace(/\/+$/, "");
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(base);
  });

  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        // O index.html NUNCA pode ficar em cache: se ficar, a app volta a abrir
        // com o bundle JS antigo (a changelog fica antiga e pode dar "fail to
        // fetch" se o JS antigo ja nao estiver na cache). Os assets com hash no
        // nome (index-XXXX.js) continuam cacheaveis — o nome muda a cada build.
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );
  // Fallback SPA: tudo o que nao seja /api devolve o index.html.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(resolve(dist, "index.html"), {
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    });
  });
}

// Handler de erros central. `_next` precisa de estar na assinatura para o
// Express saber que isto e um error handler (4 argumentos).
app.use((err, req, res, _next) => {
  log.error("backend", err.message, { url: req.path, status: err.status });
  res.status(err.status || 500).json({ error: err.message });
});

// Arranca a escutar. Se a porta estiver ocupada, tenta a seguinte em vez de
// morrer: antes, um EADDRINUSE matava o servidor no arranque e a janela ficava
// preta sem mostrar nada (foi o que aconteceu num PC de um utilizador, com
// outra coisa a usar a porta 5175).
const PORTAS = [config.port, config.port + 1, config.port + 2, config.port + 3];
let portaEscolhida = null;

function tentar(indice) {
  if (indice >= PORTAS.length) {
    log.error(
      "backend",
      `Nenhuma porta livre entre ${PORTAS[0]} e ${PORTAS[PORTAS.length - 1]}. Abortado.`
    );
    process.exit(1);
  }
  const porta = PORTAS[indice];
  const servidor = app.listen(porta, config.host);

  servidor.once("listening", () => {
    portaEscolhida = porta;
    // O Electron precisa de saber em que porta ficou. Le-o do ficheiro.
    // (num ficheiro ESM nao se pode usar require.)
    try {
      if (process.env.MEIDA_PORT_FILE) {
        writeFileSync(process.env.MEIDA_PORT_FILE, String(porta));
      }
    } catch {
      /* sem ficheiro de porta e' normal em dev */
    }
    log.info("backend", `Backend a correr em http://${config.host}:${porta}`);
    if (porta !== config.port) {
      log.warn(
        "backend",
        `A porta ${config.port} estava ocupada; a app ficou na porta ${porta}.`
      );
    }
    if (!config.tmdb.apiKey && !config.tmdb.accessToken) {
      log.warn(
        "backend",
        "TMDB nao configurado. Cria server/.env a partir de server/.env.example."
      );
    }
  });

  servidor.once("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      log.warn("backend", `Porta ${porta} ocupada. A tentar a seguinte...`);
      servidor.close(() => tentar(indice + 1));
      return;
    }
    log.error("backend", `Erro ao escutar: ${err && err.message}`);
    process.exit(1);
  });
}

tentar(0);
