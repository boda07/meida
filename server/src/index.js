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
import { letterboxdRouter } from "./routes/letterboxd.js";
import { progressRouter } from "./routes/progress.js";

const app = express();
app.use(cors());
app.use(express.json());

// Healthcheck + aviso se o TMDB nao estiver configurado.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    tmdbConfigured: Boolean(config.tmdb.apiKey || config.tmdb.accessToken),
  });
});

app.use("/api", catalogRouter);
app.use("/api", sourcesRouter);
app.use("/api", authRouter);
app.use("/api", streamRouter);
app.use("/api", playRouter);
// malRouter ANTES do libraryRouter: o library aplica requireAuth a tudo o que
// passa por ele, e as rotas publicas do MAL (callback OAuth) nao podem ser bloqueadas.
app.use("/api", malRouter);
app.use("/api", letterboxdRouter);
app.use("/api", progressRouter);
app.use("/api", libraryRouter);

// Em producao (app desktop), serve o frontend ja compilado (web/dist).
if (process.env.SERVE_WEB === "1") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // No app empacotado o caminho vem por WEB_DIST; em dev usa o relativo.
  const dist = process.env.WEB_DIST || resolve(__dirname, "../../web/dist");
  app.use(express.static(dist));
  // Fallback SPA: tudo o que nao seja /api devolve o index.html.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(resolve(dist, "index.html"));
  });
}

// Handler de erros central.
app.use((err, req, res, next) => {
  console.error("[erro]", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`Backend a correr em http://localhost:${config.port}`);
  // Force reload
  if (!config.tmdb.apiKey && !config.tmdb.accessToken) {
    console.warn(
      "AVISO: TMDB nao configurado. Cria server/.env a partir de server/.env.example."
    );
  }
});
