// A camada de rede do Jikan (API publica do MyAnimeList, sem chave).
//
// 1-out-2026: inversao de ordem — o Tenrai passa a ser o primario (melhor rate
// limit, sem chave) e o Jikan o backup. Se o Tenrai falhar, o Jikan salva.
import { cacheGet, cacheSet } from "../cache.js";
import { netFetch } from "../net.js";

const JIKAN = "https://api.jikan.moe/v4";
const JIKAN_MIRROR = "https://api.tenrai.org/v1"; // espelho do schema v4 do Jikan

const PRIMARY_URL = JIKAN_MIRROR; // Tenrai
const BACKUP_URL = JIKAN; // Jikan (fallback)

const JIKAN_COOLDOWN_MS = 30 * 1000;
// No Tenrai (primário) limita-se o nº de retries: com o Jikan à frente, desistir
// cedo e cair para o backup é mais rápido que insistir no Tenrai.
const PRIMARY_RETRIES = 1;
let primaryBlockedUntil = 0;

export async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cooldownPrimary() {
  primaryBlockedUntil = Math.max(primaryBlockedUntil, Date.now() + JIKAN_COOLDOWN_MS);
}

// O Jikan limita a ~3 req/s (429 quando excede) e por vezes da 5xx.
// Tentamos de novo com backoff antes de desistir.
//
// `options` e `tries` tem valores por omissão: ha' chamadas diretas ao backup
// (ver `getAnimeEpisodes`) que passam so a base e o caminho — sem isto, a
// desestruturação de `options` rebentava e o fallback morria em silencio.
export async function jikanFetchBase(base, path, options = {}, tries = 0) {
  const { retries = 3, timeoutMs = 9000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await netFetch(`${base}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (tries < retries) {
      await sleep(700 * (tries + 1));
      return jikanFetchBase(base, path, options, tries + 1);
    }
    if (err?.name === "AbortError") throw new Error("Jikan timeout", { cause: err });
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const retryHttp = (res.status === 429 || res.status >= 500) && tries < retries;
  if (retryHttp) {
    await sleep(700 * (tries + 1));
    return jikanFetchBase(base, path, options, tries + 1);
  }
  if (!res.ok) {
    const who = base.includes("tenrai") ? "Tenrai" : "Jikan";
    throw new Error(`${who} ${res.status}`);
  }
  return res.json();
}

// Tenta o Jikan primeiro; se falhar (timeout/5xx/429/rede), cai para o espelho
// Tenrai (mesmo schema v4). Se o Jikan falhar mas o espelho responder, marcam-se
// 30s de cooldown do Jikan para os proximos pedidos irem diretos ao espelho
// (em vez de queimarem retries em cada chamada). Durante o cooldown, a cache em
// disco e consultada primeiro (resposta imediata). Se ambos falharem, a cache
// em disco serve os ultimos dados conhecidos. Cada resposta bem-sucedida fica
// gravada na cache em disco.
export async function jikanFetch(path, options = {}) {
  const opts = typeof options === "number" ? { tries: options } : options;
  const { tries = 0 } = opts;
  // Tenrai (primário), limitando retries: com o Jikan à frente, desistir cedo e
  // cair para o backup é mais rápido que insistir no Tenrai.
  const primaryOpts = { ...opts, retries: Math.min(opts.retries ?? 3, PRIMARY_RETRIES) };
  if (tries === 0 && Date.now() < primaryBlockedUntil) {
    const disk = cacheGet(path);
    if (disk) return disk;
    try {
      const data = await jikanFetchBase(BACKUP_URL, path, opts, 0);
      cacheSet(path, data);
      return data;
    } catch {
      cooldownPrimary();
      throw new Error("Tenrai temporariamente indisponivel");
    }
  }
  try {
    const data = await jikanFetchBase(PRIMARY_URL, path, primaryOpts, 0);
    cacheSet(path, data);
    return data;
  } catch (primaryErr) {
    try {
      const data = await jikanFetchBase(BACKUP_URL, path, opts, 0);
      cacheSet(path, data);
      cooldownPrimary();
      return data;
    } catch {
      const disk = cacheGet(path);
      if (disk) {
        cooldownPrimary();
        return disk;
      }
      cooldownPrimary();
      throw primaryErr;
    }
  }
}

export { PRIMARY_URL, BACKUP_URL };