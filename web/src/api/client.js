// Helpers de fetch para a API do backend (proxy /api do Vite).

// O token de login fica em localStorage e e enviado em todos os pedidos.
const TOKEN_KEY = "streamapp_token";
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Definições do utilizador (idiomas, etc.) guardadas em localStorage.
const SETTINGS_KEY = "streamapp_settings";
export const DEFAULT_SETTINGS = {
  titleLang: "en", // idioma dos títulos: "en" | "pt"
  overviewLang: "pt", // idioma das sinopses: "en" | "pt"
  animeTitleLang: "en", // títulos de anime: "en" (ingles) | "romaji"
  subtitleLang: "pt", // legenda preferida: "pt" | "en" | "off"
  defaultTab: "providers", // separador inicial: providers | extract | torrents
  animeAudio: "sub", // anime: "sub" (legendado) ou "dub" (dobrado)
  accent: "#c90303", // cor de destaque da UI (botoes, realces)
  bgColor: "#070708", // cor de fundo da app
  recentAccent: [], // últimas cores de destaque escolhidas no picker
  recentBg: [], // últimas cores de fundo escolhidas no picker
  cardW: 184, // largura dos cartazes (px)
  cardH: 272, // altura dos cartazes (px)
  autoplay: true, // reproduzir automaticamente ao abrir uma fonte
  autoskip: false, // tentar saltar intro/genericos automaticamente
};
export const settingsStore = {
  get() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },
  set(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  },
};

// Parametros de idioma a juntar aos pedidos de catálogo.
function langParams() {
  const s = settingsStore.get();
  return {
    titleLang: s.titleLang,
    overviewLang: s.overviewLang,
    animeTitleLang: s.animeTitleLang,
  };
}

// Lista de idiomas (OpenSubtitles) a partir da preferência de legendas.
function subtitleLangs() {
  const map = { pt: "pt,pt-br,en", en: "en,pt", off: "pt,pt-br,en" };
  return map[settingsStore.get().subtitleLang] || "pt,pt-br,en";
}

function authHeaders() {
  const t = tokenStore.get();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function handle(res) {
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function get(path, params = {}) {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  return handle(await fetch(url, { headers: authHeaders() }));
}

async function post(path, body) {
  return handle(
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    })
  );
}

async function patch_(path, body) {
  return handle(
    await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    })
  );
}

async function del(path, params = {}) {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  return handle(await fetch(url, { method: "DELETE", headers: authHeaders() }));
}

export const api = {
  health: () => get("/api/health"),
  catalog: () => get("/api/catalog", langParams()),
  category: (c) => get(`/api/catalog/${c}`, langParams()),
  discover: (opts) => get("/api/discover", { ...opts, ...langParams() }),
  search: (q) => get("/api/search", { q, ...langParams() }),
  details: (type, id) => get("/api/details", { type, id, ...langParams() }),
  season: (id, season) => get("/api/season", { id, season, ...langParams() }),
  genres: (type) => get("/api/genres", { type }),
  pick: (opts) => get("/api/pick", { ...opts, ...langParams() }),
  sources: (opts) => get("/api/sources", opts),
  torrents: (opts) => get("/api/torrents", opts),
  extract: (opts) => get("/api/extract", opts),
  animeEnabled: () => get("/api/anime/enabled"),
  animeExtract: (opts) => get("/api/anime/extract", opts),
  subtitles: (opts) => get("/api/subtitles", { languages: subtitleLangs(), ...opts }),

  // Auth
  register: (username, password) => post("/api/auth/register", { username, password }),
  login: (username, password) => post("/api/auth/login", { username, password }),
  me: () => get("/api/auth/me"),
  updateProfile: (patch) => patch_("/api/auth/profile", patch),

  // Biblioteca pessoal
  library: () => get("/api/library", langParams()),
  libraryItem: (type, tmdb) => get("/api/library/item", { type, tmdb }),
  saveLibrary: (entry) => post("/api/library", entry),
  removeLibrary: (type, tmdb) => del("/api/library/item", { type, tmdb }),
  clearWatchlist: (type) => del("/api/library/watchlist", { type }),

  // MyAnimeList
  malEnabled: () => get("/api/mal/enabled"),
  malStatus: () => get("/api/mal/status"),
  malLogin: () => get("/api/mal/login"),
  malImport: () => post("/api/mal/import", {}),
  malUnlink: () => post("/api/mal/unlink", {}),
  malScrobble: (malId, episode) => post("/api/mal/scrobble", { malId, episode }),

  // Diário / continua a ver
  progress: () => get("/api/progress"),
  progressItem: (type, tmdb) => get("/api/progress/item", { type, tmdb }),
  progressStart: (entry) => post("/api/progress/start", entry),
  progressFinish: (entry) => post("/api/progress/finish", entry),
  progressUpdate: (patch) => patch_("/api/progress/item", patch),
  progressRemove: (type, tmdb) => del("/api/progress/item", { type, tmdb }),

  // Letterboxd (filmes)
  letterboxdStatus: () => get("/api/letterboxd/status"),
  letterboxdLink: (username) => post("/api/letterboxd/link", { username }),
  letterboxdUnlink: () => post("/api/letterboxd/unlink", {}),
  letterboxdImport: (what = "all") => post("/api/letterboxd/import", { what }),
};

// Abre um URL no browser do sistema (Electron) ou numa nova aba (web).
export function openExternal(url) {
  if (typeof window !== "undefined" && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

export function imageUrl(path, size = "w342") {
  if (!path) return null;
  // Já e um URL completo (ex.: posters do Jikan/MyAnimeList) -> usa tal e qual.
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
