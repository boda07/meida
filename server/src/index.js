import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
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

app.listen(config.port, config.host, () => {
  log.info("backend", `Backend a correr em http://${config.host}:${config.port}`);
  // Force reload
  if (!config.tmdb.apiKey && !config.tmdb.accessToken) {
    log.warn("backend", "TMDB nao configurado. Cria server/.env a partir de server/.env.example.");
  }
});
