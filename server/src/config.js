import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Carrega server/.env independentemente da pasta de trabalho de onde o node
// foi arrancado (cwd pode ser a raiz do projeto ou a pasta server/).
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

export const config = {
  port: Number(process.env.PORT) || 5175,
  jwtSecret: process.env.JWT_SECRET?.trim() || "dev-secret-muda-me-em-producao",
  // Se definido, usa um extractor externo compativel com Consumet (ex.: http://localhost:3000).
  extractorApiBase: process.env.EXTRACTOR_API_BASE?.trim().replace(/\/$/, "") || "",
  openSubtitlesKey: process.env.OPENSUBTITLES_API_KEY?.trim() || "",
  // MyAnimeList (API v2). Client ID obtido em https://myanimelist.net/apiconfig
  mal: {
    clientId: process.env.MAL_CLIENT_ID?.trim() || "",
    clientSecret: process.env.MAL_CLIENT_SECRET?.trim() || "",
    redirectUri:
      process.env.MAL_REDIRECT_URI?.trim() ||
      "http://localhost:5175/api/mal/callback",
  },
  tmdb: {
    apiKey: process.env.TMDB_API_KEY?.trim() || "",
    accessToken: process.env.TMDB_ACCESS_TOKEN?.trim() || "",
    baseUrl: "https://api.themoviedb.org/3",
    imageBase: "https://image.tmdb.org/t/p",
    language: "pt-PT",
    // Idioma usado apenas para os titulos (nome dos filmes/series/anime).
    titleLanguage: "en-US",
  },
};

export function assertTmdbConfigured() {
  if (!config.tmdb.apiKey && !config.tmdb.accessToken) {
    throw new Error(
      "TMDB nao configurado. Cria server/.env (ver server/.env.example) e define TMDB_API_KEY ou TMDB_ACCESS_TOKEN."
    );
  }
}
