// Helpers de fetch para a API do backend (proxy /api do Vite).
//
// Ha dois servidores possiveis:
//  - LOCAL (same-origin, ou window.MEIDA_API_BASE): serve o video/streaming,
//    o catalogo (TMDB/Jikan) e o Real-Debrid. E onde a app corre.
//  - REMOTO (window.MEIDA_REMOTE_DATA_BASE, so no Electron em modo
//    "dados na nuvem"): guarda as contas, a biblioteca, o diario, as listas, os
//    perfis, os comentarios e as ligacoes MAL/AniList/Letterboxd — o que e
//    partilhado entre pessoas.
//
// `baseFor(path)` decide para onde vai cada pedido: as rotas de `LOCAL_API_PREFIXES`
// ficam sempre locais; TODAS as outras /api/* vao para o servidor remoto (quando
// existe). Assim, se uma rota nova esquecer de ser classificada, cai no remoto
// (o lado com os dados), em vez de falhar em silencio no servidor local.
//
// As bases sao lidas em cada pedido (e nao no import) porque o `main.jsx` so as
// define depois de ler o runtime-config.json / falar com o processo Electron.
import { tokenStore } from "../storage/token.js";
import { settingsStore } from "../storage/settings.js";
const LOCAL_API_PREFIXES = [
  "/api/health",
  "/api/catalog",
  "/api/rows",
  "/api/discover",
  "/api/search",
  "/api/details",
  "/api/recommendations",
  "/api/season",
  "/api/anime",
  "/api/genres",
  "/api/pick",
  "/api/sources",
  "/api/providers",
  "/api/torrents",
  "/api/extract",
  "/api/subtitles",
  "/api/stream",
  "/api/play",
  "/api/proxy",
  "/api/debrid",
  "/api/wp",
];

function isLocalApiPath(path) {
  return LOCAL_API_PREFIXES.some((prefix) => {
    if (!path.startsWith(prefix)) return false;
    const next = path[prefix.length];
    return next === undefined || next === "/" || next === "?" || next === "#";
  });
}

// Exportada para o teste poder provar que uma rota nova (ex.: `/api/rows`) fica
// LOCAL: se faltar na lista, com dados na nuvem vai para o servidor remoto, onde
// nao existe — e a resposta e' 401, que parece um problema de login.
export { isLocalApiPath };

function baseFor(path) {
  const remote =
    (typeof window !== "undefined" && window.MEIDA_REMOTE_DATA_BASE) || "";
  if (remote && path.startsWith("/api/") && !isLocalApiPath(path)) {
    return remote.replace(/\/+$/, "");
  }
  const base = (typeof window !== "undefined" && window.MEIDA_API_BASE) || "";
  return base ? base.replace(/\/+$/, "") : window.location.origin;
}

function fullUrl(path) {
  return `${baseFor(path)}${path}`;
}
// Os stores de preferências vivem em `web/src/storage/` (uma responsabilidade
// por ficheiro). Re-exportados daqui porque várias partes do código importam
// `api/client.js` — e `testar-idioma-titulos.mjs`/`testar-fonte-lembrada.mjs`
// continuam a valer sem mudar.
export { tokenStore } from "../storage/token.js";
export { settingsStore, DEFAULT_SETTINGS, migrarTitleLang } from "../storage/settings.js";
export { audioTituloStore } from "../storage/audioTitulo.js";

// Parametros de idioma (+ conteudo adulto) a juntar aos pedidos de catálogo.
// O fuso do utilizador, para os endpoints que contam DIAS.
//
// **Nao e' uma preferencia, e' um facto sobre a maquina:** o heatmap desenha
// dias locais (`chaveDia` usa `getFullYear/getDate`) e a racha pergunta "hoje
// conta?", portanto o servidor tem de agrupar as datas pelas mesmas regras.
// Sem isto, quem esta' em UTC-3 ve o que ve depois das 21:00 cair na celula de
// amanha — que o heatmap esconde por ser "depois de hoje".
//
// As HORAS ja eram rodadas no cliente (`serieStats.js`) e nao precisam de fuso.
function fusoParams() {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    // Sem `Intl` (ou com um runtime estranho): sem fuso, e o servidor fica em
    // UTC — o comportamento antigo, que pelo menos e' estavel.
  }
  return { tz };
}

function langParams() {
  const s = settingsStore.get();
  return {
    titleLang: titleLangEfetivo(s.titleLang),
    overviewLang: s.overviewLang,
    // Idioma dos géneros: o escolhido ou, se nao houver, segue as sinopses.
    genreLang: s.genreLang || s.overviewLang,
    animeTitleLang: s.animeTitleLang,
    adult: s.showAdult ? "1" : "", // "" e descartado em get()
  };
}

/**
 * O idioma efetivo dos titulos, ja resolvido.
 *
 * `"auto"` nao chega ao servidor: e' uma preferencia do cliente, e o servidor nao
 * sabe o idioma da interface de ninguem. Se "auto" escapasse, o `resolveLang` do
 * servidor caia no seu fallback (`en-US`) — isto e', o titulo ia para ingles,
 * que e' exactamente o defeito que se quer corrigir.
 *
 * Funcao pura (a parte que depende do `localStorage` e' a unica que nao) para
 * poder ser testada.
 */
export function titleLangEfetivo(valor) {
  return valor === "auto" ? idiomaAtual() : valor;
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

// `traduzir`/`idiomaAtual` vem do mesmo sitio que o resto do i18n. Importado de
// `traduzir.js` (e nao do contexto) porque este modulo nao e' um componente
// React e nao pode usar o hook `useT()`.
//
// A linguagem da interface e' a MESMA regra do `I18nProvider` — ler a chave
// `meida:idioma` em dois sítios era duas implementações à espera de divergir.
import { idiomaAtual, traduzir, t as tt } from "../i18n/traduzir.js";

async function handle(res) {
  if (!res.ok) {
    let msg = tt("Erro {n}", { n: res.status });
    try {
      const body = await res.json();
      if (body.error) {
        // O servidor responde em portugues; traduz-se aqui pela mesma chave.
        // Se a chave nao existir no ingles, o proprio `traduzir` devolve o
        // portugues — nunca fica um `undefined` no ecra.
        const lang = idiomaAtual();
        msg =
          lang !== "pt"
            ? traduzir(body.error, null, lang)
            : body.error;
      }
    } catch {
      /* corpo nao e JSON: fica o erro por defeito */
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function get(path, params = {}) {
  const url = new URL(fullUrl(path));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  return handle(await fetch(url, { headers: authHeaders() }));
}

async function post(path, body) {
  return handle(
    await fetch(fullUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    })
  );
}

async function patch_(path, body) {
  return handle(
    await fetch(fullUrl(path), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    })
  );
}

async function del(path, params = {}) {
  const url = new URL(fullUrl(path));
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
  // Lista completa de uma row do catalogo ("Ver todos"), com pagina.
  catalogRow: (row, opts = {}) =>
    get(`/api/rows/${encodeURIComponent(row)}`, { ...opts, ...langParams() }),
  search: (q) => get("/api/search", { q, ...langParams() }),
  details: (type, id) => get("/api/details", { type, id, ...langParams() }),
  recommendations: (type, id) => get("/api/recommendations", { type, id, ...langParams() }),
  season: (id, season) => get("/api/season", { id, season, ...langParams() }),
  animeEpisodes: (mal) => get("/api/anime/episodes", { mal }),
  genres: (type) => get("/api/genres", { type, ...langParams() }),
  pick: (opts) => get("/api/pick", { ...opts, ...langParams() }),
  sources: (opts) => get("/api/sources", opts),
  providersHealth: (refresh) => get("/api/providers/health", { refresh }),
  torrents: (opts) => get("/api/torrents", opts),
  // Parar uma descarga (libera disco e ligacoes).
  //
  // Vai por `del` e nao por um `fetch` cru dentro do componente porque o
  // `DELETE` do servidor passou a exigir login. O `fetch` cru nao mandava o
  // cabecalho `Authorization`, o servidor respondia 401 e o `.catch(() => {})`
  // engolia o erro — o botao jurava que tinha parado e o torrent continuava a
  // descarregar. Um erro engolido aqui e' pior do que um erro visivel: e' uma
  // mentira sobre o disco e a rede.
  stopTorrent: (infoHash) => del(`/api/stream/${encodeURIComponent(infoHash)}`),
  // Estado de um stream de torrent (WebTorrent local). O `useTorrentStatus`
  // consulta isto a cada 1,5 s; passa pelo client para levar os cabecalhos de
  // autenticacao e nao falar com o `fetch` por conta propria.
  torrentStatus: (infoHash) => get(`/api/stream/${encodeURIComponent(infoHash)}/status`),
  extract: (opts) => get("/api/extract", opts),
  animeEnabled: () => get("/api/anime/enabled"),
  extractEnabled: () => get("/api/extract/enabled"),
  animeExtract: (opts) => get("/api/anime/extract", opts),
  // Reprodução NATIVA do MegaPlay: em vez do iframe, o servidor devolve o
  // m3u8 (decifrando o campo `enc` do site) e as legendas em claro. Devolve
  // `{ native: false }` quando não consegue — nunca um erro, porque o
  // frontend nesse caso mostra o iframe, que continua a funcionar.
  animeMegaplay: (opts) => get("/api/anime/megaplay", opts),
  subtitles: (opts) => get("/api/subtitles", { languages: subtitleLangs(), ...opts }),

  // Auth
  register: (username, password) => post("/api/auth/register", { username, password }),
  login: (username, password) => post("/api/auth/login", { username, password }),
  me: () => get("/api/auth/me"),
  updateProfile: (patch) => patch_("/api/auth/profile", patch),

  // Perfis e seguir utilizadores
  userProfile: (username) => get(`/api/users/${encodeURIComponent(username)}`),
  userLibrary: (username) =>
    get(`/api/users/${encodeURIComponent(username)}/library`, langParams()),
  userLists: (username) => get(`/api/users/${encodeURIComponent(username)}/lists`),
  userList: (username, id) =>
    get(`/api/users/${encodeURIComponent(username)}/lists/${id}`, langParams()),
  userFollowers: (username) => get(`/api/users/${encodeURIComponent(username)}/followers`),
  userFollowing: (username) => get(`/api/users/${encodeURIComponent(username)}/following`),
  // Feed de atividade: quem segues + tu. `opts` tem limit/offset.
  feed: (opts = {}) => get("/api/feed", { ...opts, ...langParams() }),
  // Historico de um perfil (so se o perfil for publico ou for o teu).
  userActivity: (username, opts = {}) =>
    get(`/api/users/${encodeURIComponent(username)}/activity`, { ...opts, ...langParams() }),
  searchUsers: (q) => get("/api/users", { q }),
  // Quem sugerir para uma "@mencao". Query vazia e' valida de proposito: e' o que
  // se pede logo apos escrever o "@", e devolve a primeira pagina de toda a gente
  // com quem tem ligacao connosco no topo.
  sugerirUsers: (q) => get("/api/users/suggest", { q: q ?? "" }),
  follow: (id) => post(`/api/users/${id}/follow`, {}),
  unfollow: (id) => del(`/api/users/${id}/follow`),
  userAvatar: (id) => get(`/api/users/${encodeURIComponent(id)}/avatar`),

  // Watch Party: envia um evento para a sala (o servidor difunde aos outros).
  wpSend: (payload) => post("/api/wp/send", payload),

  // Comentarios por episodio
  comments: (opts) => get("/api/comments", opts),
  addComment: (entry) => post("/api/comments", entry),
  deleteComment: (id) => del(`/api/comments/${id}`),
  likeComment: (id) => post(`/api/comments/${id}/like`, {}),
  unlikeComment: (id) => del(`/api/comments/${id}/like`),

  // Notificacoes. `notifications()` traz a lista E a contagem num pedido so —
  // o sino e' actualizado a cada minuto e nao vale a pena dois pedidos.
  notifications: () => get("/api/notifications"),
  notificationsUnread: () => get("/api/notifications/unread"),
  markNotificationRead: (id) => post(`/api/notifications/${id}/read`, {}),
  markAllNotificationsRead: () => post("/api/notifications/read-all", {}),

  // Biblioteca pessoal
  library: () => get("/api/library", langParams()),
  libraryItem: (type, tmdb) => get("/api/library/item", { type, tmdb }),
  saveLibrary: (entry) => post("/api/library", entry),
  saveLibraryYear: (type, tmdb, year) =>
    patch_("/api/library/year", { type, tmdbId: tmdb, year }),
  removeLibrary: (type, tmdb) => del("/api/library/item", { type, tmdb }),
  clearWatchlist: (type) => del("/api/library/watchlist", { type }),

  // Listas personalizadas
  lists: () => get("/api/lists"),
  createList: (name) => post("/api/lists", { name }),
  renameList: (id, name) => patch_(`/api/lists/${id}`, { name }),
  deleteList: (id) => del(`/api/lists/${id}`),
  listTitles: (id) => get(`/api/lists/${id}`, langParams()),
  addListTitle: (id, entry) => post(`/api/lists/${id}/titles`, entry),
  removeListTitle: (id, tmdbId, type) =>
    del(`/api/lists/${id}/titles`, { tmdbId, type }),

  // Manga / Manhwa / Manhua (Jikan + recomendacoes via lista do MAL)
  mangaGenres: () => get("/api/manga/genres", langParams()),
  mangaDiscover: (opts) => get("/api/manga/discover", { ...opts, ...langParams() }),
  mangaRecommend: (opts) => get("/api/manga/recommend", { ...opts, ...langParams() }),
  mangaToRead: () => get("/api/manga/to-read", langParams()),

  // MyAnimeList
  malEnabled: () => get("/api/mal/enabled"),
  malStatus: () => get("/api/mal/status"),
  malLogin: () => get("/api/mal/login"),
  malImport: () => post("/api/mal/import", {}),
  malUnlink: () => post("/api/mal/unlink", {}),
  malScrobble: (malId, episode) => post("/api/mal/scrobble", { malId, episode }),

  // AniList
  anilistEnabled: () => get("/api/anilist/enabled"),
  anilistStatus: () => get("/api/anilist/status"),
  anilistLogin: () => get("/api/anilist/login"),
  anilistImport: () => post("/api/anilist/import", {}),
  anilistUnlink: () => post("/api/anilist/unlink", {}),
  anilistScrobble: (malId, episode) => post("/api/anilist/scrobble", { malId, episode }),
  anilistSync: () => post("/api/anilist/sync", {}),

  // Diário / continua a ver
  progress: () => get("/api/progress", langParams()),
  progressItem: (type, tmdb) => get("/api/progress/item", { type, tmdb }),
  progressStart: (entry) => post("/api/progress/start", entry),
  progressFinish: (entry) => post("/api/progress/finish", entry),
  progressPosition: (entry) => post("/api/progress/position", entry),
  progressUpdate: (patch) => patch_("/api/progress/item", patch),
  progressRemove: (type, tmdb) => del("/api/progress/item", { type, tmdb }),

  // Letterboxd (filmes)
  letterboxdStatus: () => get("/api/letterboxd/status"),
  letterboxdLink: (username) => post("/api/letterboxd/link", { username }),
  letterboxdUnlink: () => post("/api/letterboxd/unlink", {}),
  letterboxdImport: (what = "all") => post("/api/letterboxd/import", { what }),

  // Real-Debrid (streaming instantaneo de torrents)
  debridStatus: () => get("/api/debrid/status"),
  debridLink: (token) => post("/api/debrid/link", { token }),
  debridUnlink: () => post("/api/debrid/unlink", {}),
  debridAvailability: (hashes) => post("/api/debrid/availability", { hashes }),
  debridStream: (infoHash, fileIdx) =>
    get("/api/debrid/stream/" + infoHash, fileIdx != null ? { fileIdx } : {}),
  debridActive: () => get("/api/debrid/active"),

  // Export dos teus dados (biblioteca + diário)
  exportData: () => get("/api/export"),

  // Gamificação (badges + streak)
  achievements: () => get("/api/achievements", fusoParams()),
  stats: () => get("/api/stats", fusoParams()),

  // Metas e desafios. `setGoal` devolve o alvo gravado (o servidor e' a
  // autoridade sobre a lista de alvos validos e devolve os dois se recusar).
  goals: () => get("/api/goals"),
  setGoal: (alvo) => patch_("/api/goals", { alvo }),

  // Importar dados exportados anteriormente (merge conservador)
  importData: (payload) =>
    post("/api/export/import", payload),
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
