// Integracao com a API GraphQL do AniList: OAuth2 (Authorization Code),
// ligar conta, importar lista e marcar episodios vistos (scrobble).
//
// Diferente do MAL, o AniList usa GraphQL: as queries/mutations vao para
// https://graphql.anilist.co com Authorization: Bearer <token>.
import { config } from "../config.js";
import { setAnilistTokens, getAnilistTokens, upsertLibrary, importProgress } from "../store.js";
import { netFetch } from "./net.js";
import { cacheGetTtl, cacheSet, cacheDel } from "./cache.js";
import { log } from "./log.js";
import { getAnimeProgress, updateEpisode as malUpdateEpisode, status as malStatus } from "./mal.js";

const AUTH = "https://anilist.co/api/v1/oauth";
const GRAPHQL = "https://graphql.anilist.co";

export function anilistEnabled() {
  return Boolean(config.anilist.clientId);
}

export function buildAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: config.anilist.clientId,
    response_type: "code",
    state,
    redirect_uri: config.anilist.redirectUri,
  });
  return `${AUTH}/authorize?${p}`;
}

async function tokenRequest(params) {
  const body = new URLSearchParams({
    client_id: config.anilist.clientId,
    ...(config.anilist.clientSecret ? { client_secret: config.anilist.clientSecret } : {}),
    ...params,
  });
  const res = await netFetch(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    log.error("anilist", `token ${res.status}`, { msg: t.slice(0, 200) });
    throw new Error(`AniList token ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

export async function exchangeCode(code) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.anilist.redirectUri,
  });
}

async function refreshTokens(refreshToken) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

// Guarda tokens (com validade) + nome de utilizador do AniList.
function persistTokens(userId, tok) {
  const expiresAt = Date.now() + (tok.expires_in || 3600) * 1000;
  const tokens = {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || getAnilistTokens(userId)?.refreshToken || null,
    expiresAt,
    username: tok.username || null,
  };
  setAnilistTokens(userId, tokens);
  return tokens;
}

export async function linkAccount(userId, code) {
  const tok = await exchangeCode(code);
  const tokens = persistTokens(userId, tok);
  // O token endpoint nao devolve username nalguns casos: consulta o GraphQL.
  if (!tokens.username) {
    try {
      const me = await gql(tokens.accessToken, "query{Viewer{alias}}");
      tokens.username = me?.Viewer?.alias || null;
      setAnilistTokens(userId, tokens);
    } catch {
      /* fica null na UI, nao e critico */
    }
  }
  return tokens;
}

// Devolve um access token valido (renova se expirou).
async function getValidToken(userId) {
  const t = getAnilistTokens(userId);
  if (!t) throw httpError(400, "Conta AniList nao ligada.");
  if (Date.now() < t.expiresAt - 60000) return t.accessToken;
  const tok = await refreshTokens(t.refreshToken);
  const fresh = persistTokens(userId, tok);
  return fresh.accessToken;
}

// Cliente GraphQL minimo (autenticado).
async function gql(token, query, variables = {}) {
  const res = await netFetch(GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    const err = new Error(`AniList GraphQL ${res.status}: ${t.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (json.errors && json.errors.length) {
    log.warn("anilist", "graphql errors", { errors: json.errors });
  }
  return json.data || null;
}

// Lista de anime do utilizador no AniList (com estado e progresso).
// Query canonical: Page.mediaListEntry(mediaType:ANIME) usa o token do user autenticado.
export async function getAnimeList(userId) {
  const token = await getValidToken(userId);
  const out = [];
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const data = await gql(
      token,
      `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{hasNextPage}mediaListEntry(mediaType:ANIME){media{id idMal title{english romaji native} coverImage{extraLarge} meanScore genres{name}} progress numEpisodesWatched score status}}}`,
      { perPage: 50, page }
    );
    const entries = data?.Page?.mediaListEntry || [];
    for (const it of entries) out.push(it);
    if (!data?.Page?.pageInfo?.hasNextPage) break;
    page++;
  }
  return out;
}

// Marca/atualiza o progresso de um anime no AniList pelo idMal (converte para anilistId).
export async function updateEpisode(userId, malId, episode) {
  const token = await getValidToken(userId);
  const id = Number(malId);
  const ep = Number(episode) || 1;

  // Resolve o anilistId interno a partir do idMal (uma query).
  const resolved = await gql(
    token,
    `query($id:Int){Media(idMal:$id,type:ANIME){id}}`,
    { id }
  );
  const mediaId = resolved?.Media?.id;
  if (!mediaId) throw httpError(404, "Anime nao encontrado no AniList");

  const result = await gql(
    token,
    `mutation($id:Int!,$ep:Int!){incrementWatchProgress(mediaId:$id,episode:$ep){mediaId progress}}`,
    { id: mediaId, ep }
  );
  const progress = result?.incrementWatchProgress?.progress || 0;
  return { status: "watching", numEpisodesWatched: progress };
}

export function status(userId) {
  const t = getAnilistTokens(userId);
  return { linked: Boolean(t), username: t?.username || null };
}

export function unlink(userId) {
  setAnilistTokens(userId, null);
}

/* ===== Sincronizacao da lista ===== */

// Normaliza uma entrada de lista do AniList para o formato da app.
// entry: { media:{id,idMal,title,coverImage,meanScore,genres}, progress, numEpisodesWatched, score, status }
export function normalizeAnilistEntry(entry) {
  const media = entry?.media || {};
  const id = media.idMal || media.id;
  if (!id) return null;
  const status = entry?.status || ""; // "WATCHING" | "COMPLETED" | "PLANNING" | "DROPPED" | "PAUSED"
  const watched = status === "COMPLETED";
  const watchlist = status === "PLANNING" || status === "WATCHING" || status === "PAUSED";
  const en = media.title?.english || "";
  const romaji = media.title?.romaji || media.title?.native || "";
  const titleEn = en || romaji;
  // Nota pessoal (0-100) ou media da comunidade (meanScore). Converte para 0-10.
  const rawScore = entry?.score != null ? entry.score : media?.meanScore;
  const score = rawScore == null ? null : Math.round(Number(rawScore) / 10);
  return {
    tmdbId: Number(id), // a app trata anime por malId
    type: "anime",
    title: titleEn,
    titleEn: en || null,
    titleRomaji: romaji || null,
    genres: (media.genres || []).map((g) => g.name),
    poster: media.coverImage?.extraLarge || media.coverImage?.large || null,
    year: media.startDate?.year || null,
    rating: media.meanScore ? Math.round(media.meanScore / 100) : null,
    watched: watched ? 1 : 0,
    watchlist: watchlist ? 1 : 0,
    score: score && !Number.isNaN(score) ? score : null,
  };
}

function toIsoDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "").trim());
  if (!m) return null;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

// "2020-12-15" -> ISO (meio-dia UTC).
function isoDate(d) {
  return toIsoDate(d);
}

// O AniList e uma fonte de verdade da lista de anime: importa o estado preciso
// (visto/ver/watchlist, nota pessoal, progresso). Usado pelo /anilist/import
// e pelo sync automatico na Library (fire-and-forget).
export async function importAnilistList(userId) {
  const list = await getAnimeList(userId);
  let count = 0;
  let diary = 0;
  for (const it of list) {
    const row = normalizeAnilistEntry(it);
    if (!row) continue;
    // Nota pessoal ja convertida para 0-10 por normalizeAnilistEntry (score/10).
    upsertLibrary(row);
    count++;

    // Diario: o AniList nao expoe datas de start/finish por entrada de lista.
    // Usa apenas o progresso se estiver a fazer (watching).
    const watching = (it.status || "") === "WATCHING";
    const seen = it.numEpisodesWatched || it.progress || 0;
    if (watching || seen > 0) {
      importProgress({
        userId,
        type: "anime",
        tmdbId: row.tmdbId,
        title: row.title,
        poster: row.poster,
        episode: watching ? seen + 1 : seen || null,
        startedAt: watching ? isoDate(new Date().toISOString().slice(0, 10)) : null,
        finishedAt: null,
        status: watching ? "watching" : "finished",
      });
      diary++;
    }
  }
  log.info("anilist", `importados ${count} animes, ${diary} do diario`);
  return { imported: count, diary };
}

// Mapa malId -> progresso (episodios vistos) deste user no AniList.
// Reusa getAnimeList; só extrai idMal + progresso.
export async function getProgressMap(userId) {
  const token = await getValidToken(userId);
  const out = new Map();
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const data = await gql(
      token,
      `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{hasNextPage}mediaListEntry(mediaType:ANIME){media{idMal} progress}}}`,
      { perPage: 50, page }
    );
    for (const it of data?.Page?.mediaListEntry || []) {
      const id = it?.media?.idMal;
      const ep = it?.progress;
      if (id && Number.isInteger(Number(ep))) out.set(Number(id), Number(ep));
    }
    if (!data?.Page?.pageInfo?.hasNextPage) break;
    page++;
  }
  return out;
}

// Cross-sync MAL <-> AniList: dados os dois mapas de progresso, decide o que
// empurrar para cada lado (tomar o MAXIMO por anime). Puro — sem efeitos.
// Devolve { toMal: [{malId,ep}], toAni: [{malId,ep}] }.
export function computeCrossUpdates(malProgress, aniProgress) {
  const toMal = [];
  const toAni = [];
  const keys = new Set([...(malProgress instanceof Map ? malProgress.keys() : []), ...(aniProgress instanceof Map ? aniProgress.keys() : [])]);
  for (const malId of keys) {
    const malEp = (malProgress instanceof Map ? malProgress.get(malId) : malProgress[malId]) || 0;
    const aniEp = (aniProgress instanceof Map ? aniProgress.get(malId) : aniProgress[malId]) || 0;
    const target = Math.max(malEp, aniEp);
    if (!target) continue;
    if (malEp < target) toMal.push({ malId: Number(malId), ep: target });
    if (aniEp < target) toAni.push({ malId: Number(malId), ep: target });
  }
  return { toMal, toAni };
}

// Cross-sync bidireccional MAL <-> AniList para um user que tem as duas contas
// ligadas. Tome o MAXIMO de episodios vistos por anime (idMal) e empurre para
// a conta que estiver atrasada — nunca regride. O resultado e {mal, anilist}.
export async function syncCrossWithMal(userId) {
  if (!malStatus(userId).linked) return { ok: false, reason: "mal not linked" };
  const aniProgress = await getProgressMap(userId);
  const malProgress = await getAnilistProgress(userId);
  const updates = computeCrossUpdates(malProgress, aniProgress);

  let malUpdated = 0;
  let aniUpdated = 0;

  // Pre-resolve os anilistId internos (idMal -> id) para as mutations do lado.
  const aniToken = await getValidToken(userId);
  const anilistIds = new Map();
  for (const { malId } of updates.toAni) {
    if (anilistIds.has(malId)) continue;
    try {
      const r = await gql(aniToken, `query($id:Int){Media(idMal:$id,type:ANIME){id}}`, { id: malId });
      anilistIds.set(malId, r?.Media?.id || null);
    } catch (e) {
      log.warn("anilist", "cross-sync resolve anilistId failed", { malId, err: e.message });
    }
  }

  for (const { malId, ep } of updates.toMal) {
    try {
      await malUpdateEpisode(userId, malId, ep);
      malUpdated++;
    } catch (e) {
      log.warn("anilist", "cross-sync mal update failed", { malId, err: e.message });
    }
  }
  for (const { malId, ep } of updates.toAni) {
    try {
      const aniId = anilistIds.get(malId);
      if (aniId) {
        await gql(aniToken, `mutation($id:Int!,$ep:Int!){incrementWatchProgress(mediaId:$id,episode:$ep){mediaId progress}}`, { id: aniId, ep });
        aniUpdated++;
      }
    } catch (e) {
      log.warn("anilist", "cross-sync anilist update failed", { malId, err: e.message });
    }
  }

  log.info("anilist", "cross-sync MAL<->AniList concluido", { malUpdated, aniUpdated });
  return { ok: true, malUpdated, aniUpdated };
}

// Helper lazy para o progresso MAL (evita chamar getValidToken duas vezes no caller).
// Reusa o servico MAL mas so para obter o mapa — nao depende de tokens AniList.
async function getAnilistProgress(userId) {
  return getAnimeProgress(userId);
}

// Controlo do sync automatico (a Library chama no maximo de 6 em 6 horas).
const ANILIST_SYNC_TTL = 6 * 60 * 60 * 1000;
export function shouldAutoSync(userId) {
  const hit = cacheGetTtl(`anilistsync:${userId}`, ANILIST_SYNC_TTL);
  return !hit.found;
}
export function markAutoSync(userId) {
  cacheSet(`anilistsync:${userId}`, Date.now());
}
export function unmarkAutoSync(userId) {
  cacheDel(`anilistsync:${userId}`);
}

// Cooldown proprietario do cross-sync MAL <-> AniList (6h, chave independente
// das sincronizacoes unilaterais). Dispara apenas quando as duas contas estao
// ligadas.
export function shouldAutoSyncCross(userId) {
  const hit = cacheGetTtl(`anilistcrosssync:${userId}`, ANILIST_SYNC_TTL);
  return !hit.found;
}
export function markAutoSyncCross(userId) {
  cacheSet(`anilistcrosssync:${userId}`, Date.now());
}
export function unmarkAutoSyncCross(userId) {
  cacheDel(`anilistcrosssync:${userId}`);
}

function httpError(s, m) {
  const e = new Error(m);
  e.status = s;
  return e;
}
