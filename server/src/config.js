import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Carrega server/.env independentemente da pasta de trabalho de onde o node
// foi arrancado (cwd pode ser a raiz do projeto ou a pasta server/).
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const DEFAULT_JWT_SECRET = "dev-secret-muda-me-em-producao";
const jwtSecret = process.env.JWT_SECRET?.trim() || "";

// Em producao (Render/Electron com NODE_ENV=production) o segredo e obrigatorio:
// um default publico deixaria qualquer pessoa forjar tokens e entrar noutras contas.
if (process.env.NODE_ENV === "production" && (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET)) {
  throw new Error(
    "JWT_SECRET nao esta definido. Gera um com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
      "e define-o nas env vars do Render (Dashboard -> Environment) OU no server/.env."
  );
}

export const config = {
  port: Number(process.env.PORT) || 5175,
  jwtSecret: jwtSecret || DEFAULT_JWT_SECRET,
  // Se definido, usa um extractor externo compativel com Consumet (ex.: http://localhost:3000).
  extractorApiBase: process.env.EXTRACTOR_API_BASE?.trim().replace(/\/$/, "") || "",
  // Extrator de anime (aniwatch-api alojado): da player proprio ao anime
  // (sub/dub + legendas soft + sync no watch party). Ex.: https://...onrender.com
  animeExtractorBase: process.env.ANIME_EXTRACTOR_BASE?.trim().replace(/\/$/, "") || "",
  openSubtitlesKey: process.env.OPENSUBTITLES_API_KEY?.trim() || "",
  // MyAnimeList (API v2). Client ID obtido em https://myanimelist.net/apiconfig
  mal: {
    clientId: process.env.MAL_CLIENT_ID?.trim() || "",
    clientSecret: process.env.MAL_CLIENT_SECRET?.trim() || "",
    redirectUri:
      process.env.MAL_REDIRECT_URI?.trim() ||
      "http://localhost:5175/api/mal/callback",
  },
  // AniList (GraphQL). Cria uma app em https://anilist.co/api/v1/auth
  // e obtem client id + client secret. Usa Authorization Code Grant.
  anilist: {
    clientId: process.env.ANILIST_CLIENT_ID?.trim() || "",
    clientSecret: process.env.ANILIST_CLIENT_SECRET?.trim() || "",
    redirectUri:
      process.env.ANILIST_REDIRECT_URI?.trim() ||
      "http://localhost:5175/api/anilist/callback",
  },
  // Letterboxd (filmes). A leitura (importar diario + nota da comunidade) usa
  // recursos publicos e nao precisa de chaves. A ESCRITA (marcar visto no
  // Letterboxd) precisa da API oficial, que e fechada e requer aprovacao:
  // pede acesso em https://letterboxd.com/api-beta/ e poe as chaves aqui.
  letterboxd: {
    apiKey: process.env.LETTERBOXD_API_KEY?.trim() || "",
    apiSecret: process.env.LETTERBOXD_API_SECRET?.trim() || "",
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
