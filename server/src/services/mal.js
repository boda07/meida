// Integracao com a API v2 do MyAnimeList: OAuth2 (PKCE), ligar conta, importar
// lista e marcar episodios vistos (scrobble).
import crypto from "node:crypto";
import { config } from "../config.js";
import { setMalTokens, getMalTokens, upsertLibrary, importProgress } from "../store.js";
import { netFetch } from "./net.js";
import { cacheGetTtl, cacheSet, cacheDel } from "./cache.js";

const AUTH = "https://myanimelist.net/v1/oauth2";
const API = "https://api.myanimelist.net/v2";

export function malEnabled() {
  return Boolean(config.mal.clientId);
}

// MAL so suporta PKCE "plain": o code_challenge == code_verifier.
export function makeVerifier() {
  return crypto.randomBytes(48).toString("base64url"); // 64 chars
}

export function buildAuthUrl(state, verifier) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: config.mal.clientId,
    code_challenge: verifier,
    code_challenge_method: "plain",
    state,
    redirect_uri: config.mal.redirectUri,
  });
  return `${AUTH}/authorize?${p}`;
}

async function tokenRequest(params) {
  const body = new URLSearchParams({
    client_id: config.mal.clientId,
    ...(config.mal.clientSecret ? { client_secret: config.mal.clientSecret } : {}),
    ...params,
  });
  const res = await netFetch(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`MAL token ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

export async function exchangeCode(code, verifier) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: config.mal.redirectUri,
  });
}

async function refreshTokens(refreshToken) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

// Guarda tokens (com validade) + nome de utilizador do MAL.
async function persistTokens(userId, tok) {
  const expiresAt = Date.now() + (tok.expires_in || 2419200) * 1000;
  const tokens = {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt,
  };
  // Busca o nome de utilizador para mostrar na UI.
  try {
    const me = await apiGet("/users/@me?fields=name", tokens.accessToken);
    tokens.username = me?.name || null;
  } catch {
    tokens.username = null;
  }
  setMalTokens(userId, tokens);
  return tokens;
}

export async function linkAccount(userId, code, verifier) {
  const tok = await exchangeCode(code, verifier);
  return persistTokens(userId, tok);
}

// Devolve um access token valido (renova se expirou) para um utilizador da app.
async function getValidToken(userId) {
  const t = getMalTokens(userId);
  if (!t) throw httpError(400, "Conta MAL nao ligada.");
  if (Date.now() < t.expiresAt - 60000) return t.accessToken;
  const tok = await refreshTokens(t.refreshToken);
  const fresh = await persistTokens(userId, tok);
  return fresh.accessToken;
}

async function apiGet(path, token) {
  const res = await netFetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`MAL GET ${path} ${res.status}`);
  return res.json();
}

// Lista de anime do utilizador no MAL (com estado e progresso).
export async function getAnimeList(userId) {
  const token = await getValidToken(userId);
  const out = [];
  let url =
    "/users/@me/animelist?fields=list_status,num_episodes,main_picture,start_season,media_type,alternative_titles,genres&limit=1000&nsfw=true";
  // Pagina enquanto houver "next".
  for (let i = 0; i < 10; i++) {
    const data = await apiGet(url, token);
    for (const it of data.data || []) out.push(it);
    const next = data.paging?.next;
    if (!next) break;
    url = next.replace(API, "");
  }
  return out;
}

// Lista de manga do utilizador no MAL (estado + generos, para recomendacoes).
export async function getMangaList(userId) {
  const token = await getValidToken(userId);
  const out = [];
  let url =
    "/users/@me/mangalist?fields=list_status,num_chapters,main_picture,media_type,alternative_titles,genres,mean,status&limit=1000&nsfw=true";
  for (let i = 0; i < 10; i++) {
    const data = await apiGet(url, token);
    for (const it of data.data || []) out.push(it);
    const next = data.paging?.next;
    if (!next) break;
    url = next.replace(API, "");
  }
  return out;
}

// Mapa malId -> media da comunidade (mean) da lista do utilizador. Pagina a
// lista toda (1000/pagina) num minimo de pedidos. Usado no backfill de notas.
export async function getMeanScores(userId) {
  const token = await getValidToken(userId);
  const out = new Map();
  let url = "/users/@me/animelist?fields=mean&limit=1000&nsfw=true";
  for (let i = 0; i < 10; i++) {
    const data = await apiGet(url, token);
    for (const it of data.data || []) {
      const id = it.node?.id;
      const mean = it.node?.mean;
      if (id && mean != null) out.set(Number(id), Math.round(mean * 10) / 10);
    }
    const next = data.paging?.next;
    if (!next) break;
    url = next.replace(API, "");
  }
  return out;
}

// Marca/atualiza o progresso de um anime no MAL.
export async function updateEpisode(userId, animeId, episode) {
  const token = await getValidToken(userId);

  // Le o estado atual para nao baixar o progresso nem o status.
  let current = null;
  try {
    const node = await apiGet(
      `/anime/${animeId}?fields=num_episodes,my_list_status`,
      token
    );
    current = node?.my_list_status || null;
    var totalEps = node?.num_episodes || 0;
  } catch {
    var totalEps = 0;
  }

  const watched = Math.max(Number(episode) || 0, current?.num_episodes_watched || 0);
  let status = current?.status || "watching";
  if (totalEps && watched >= totalEps) status = "completed";
  else if (status !== "completed") status = "watching";

  const body = new URLSearchParams({
    status,
    num_watched_episodes: String(watched),
  });
  const res = await netFetch(`${API}/anime/${animeId}/my_list_status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`MAL PATCH ${res.status}`);
  return res.json();
}

export function status(userId) {
  const t = getMalTokens(userId);
  return { linked: Boolean(t), username: t?.username || null };
}

export function unlink(userId) {
  setMalTokens(userId, null);
}

/* ===== Sincronizacao da lista ===== */

// "2020-12-15" -> ISO (meio-dia UTC). Datas SEM dia exato ("2020" ou "2020-12")
// devolvem null: nao inventamos o dia 1, que dava datas erradas (ex.: "acabou
// antes de comecar"). Nesses casos o diario mostra "data nao disponivel".
function isoDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "").trim());
  if (!m) return null;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

// O MAL é a fonte de verdade da lista de anime: importa o estado preciso
// (visto/ver/watchlist, nota pessoal, progresso, diario). Usado pelo /mal/import
// e pelo sync automatico na Library (fire-and-forget, sem bloquear a resposta).
export async function importMalList(userId) {
  const list = await getAnimeList(userId);
  let count = 0;
  let diary = 0;
  for (const it of list) {
    const node = it.node || {};
    const ls = it.list_status || {};
    if (!node.id) continue;
    const watched = ls.status === "completed";
    const watchlist = ls.status === "plan_to_watch" || ls.status === "watching";
    const titleRomaji = node.title || "";
    const titleEn = node.alternative_titles?.en || "";
    const poster = node.main_picture?.large || node.main_picture?.medium || null;
    upsertLibrary({
      userId,
      tmdbId: node.id, // id do MAL (a app trata "anime" por malId)
      type: "anime",
      title: titleEn || titleRomaji, // ingles por default
      titleEn: titleEn || null,
      titleRomaji: titleRomaji || null,
      genres: (node.genres || []).map((g) => g.name),
      poster,
      watched: watched ? 1 : 0,
      watchlist: watchlist ? 1 : 0,
      score: ls.score ? ls.score : null,
    });
    count++;

    // Diario: usa as datas de inicio/fim que o MAL guarda por anime.
    const startedAt = isoDate(ls.start_date);
    const finishedAt = isoDate(ls.finish_date);
    if (startedAt || finishedAt) {
      const watching = ls.status === "watching";
      const seen = ls.num_episodes_watched || 0;
      importProgress({
        userId,
        type: "anime",
        tmdbId: node.id,
        title: titleEn || titleRomaji,
        poster,
        // "A ver" -> retoma no episodio seguinte; concluido -> ultimo visto.
        episode: watching ? seen + 1 : seen || null,
        startedAt,
        finishedAt,
        status: watching ? "watching" : "finished",
      });
      diary++;
    }
  }
  return { imported: count, diary };
}

// Controlo do sync automatico (a Library chama no maximo de 6 em 6 horas).
const MAL_SYNC_TTL = 6 * 60 * 60 * 1000;
export function shouldAutoSync(userId) {
  const hit = cacheGetTtl(`malsync:${userId}`, MAL_SYNC_TTL);
  return !hit.found;
}
export function markAutoSync(userId) {
  cacheSet(`malsync:${userId}`, Date.now());
}
export function unmarkAutoSync(userId) {
  cacheDel(`malsync:${userId}`);
}

function httpError(s, m) {
  const e = new Error(m);
  e.status = s;
  return e;
}
