// Health-check dos providers: testa 1x/dia cada provider de filmes/series e de
// anime com um titulo conhecido, e sinaliza os que estao mortos (DNS, timeout,
// 4xx/5xx ou pagina de erro) para o frontend mostrar sem depender de tentar
// um titulo a serio. Resultado guardado em cache em disco (sobrevive a
// reinicios) e em memoria; o check corre em background, sem bloquear pedidos.
import { PROVIDERS, ANIME_PROVIDERS } from "./providers.js";
import { cacheGet, cacheSet } from "./cache.js";
import { log } from "./log.js";

// Titulos de teste: populares e presentes em todos os providers.
const TEST_MOVIE = 550; // Fight Club
const TEST_ANIME = 21; // One Piece (mesmo id no MAL e no AniList)

const TIMEOUT_MS = 8000;
const TTL_MS = 24 * 60 * 60 * 1000; // 1x/dia
const CACHE_KEY = "provider-health";

// Marcadores fortes de pagina de erro (ignoram-se "not found"/"404" soltos:
// muitos sites tem isso no JS para mostrar fora de iframe).
const DEAD_HINTS = [
  "media unavailable",
  "title not found",
  "video not found",
  "movie not found",
  "episode not found",
  "no longer available",
  "the content you are looking for",
  "this video is not available",
];

let memory = null; // { at, providers: [...] } com o ultimo resultado
let checking = null; // Promise do check em curso

// Testa um URL: devolve ok=false + motivo se falhar, true se responder bem.
async function probe(url, referer) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0",
        ...(referer ? { referer, origin: referer } : {}),
      },
    });
    if (res.status >= 400) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const text = await res.text();
    const low = text.toLowerCase();
    for (const hint of DEAD_HINTS) {
      if (low.includes(hint)) return { ok: false, status: res.status, error: hint };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: e.cause?.code === "UND_ERR_ABORTED" ? "timeout" : e.cause?.code || e.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// O Megavid (anime) bloqueia pedidos sem referer/origin (usa o header ao embutir).
function refererFor(url) {
  if (!url.includes("megavid.buzz")) return null;
  return "https://megavid.buzz/";
}

function runCheck() {
  const tests = [
    ...PROVIDERS.filter((p) => p.movie).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.id.startsWith("megavid") ? "anime" : "movie",
      url: p.movie.replace("{tmdb}", String(TEST_MOVIE)),
    })),
    ...ANIME_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      type: "anime",
      url: p.url
        .replace("{mal}", String(TEST_ANIME))
        .replace("{anilist}", String(TEST_ANIME))
        .replace("{ep}", "1")
        .replace("{audio}", "sub"),
    })),
  ];
  return Promise.all(
    tests.map(async (t) => {
      const r = await probe(t.url, refererFor(t.url));
      if (!r.ok) {
        log.warn("provider", `${t.name} (${t.id}) falhou`, {
          status: r.status,
          error: r.error,
          url: t.url,
        });
      }
      return { id: t.id, name: t.name, type: t.type, ok: r.ok, status: r.status, error: r.error };
    })
  );
}

// Força o health-check agora (usado pelo botão "Rever agora" no frontend).
export async function refreshProviderHealth() {
  memory = null;
  checking = null;
  const providers = await runCheck();
  memory = { at: Date.now(), providers };
  cacheSet(CACHE_KEY, memory);
  const ok = providers.filter((p) => p.ok).length;
  const fail = providers.length - ok;
  log.info("provider:health", "check concluido", { ok, fail });
  return { providers, stale: false };
}

// Devolve o estado dos providers. Se a cache/memoria estiver velha, dispara o
// check em background e devolve o ultimo conhecido (ou null enquanto corre).
export function getProviderHealth() {
  const fresh = (entry) => entry && Date.now() - entry.at < TTL_MS;

  if (fresh(memory)) return { providers: memory.providers, stale: false };
  if (!memory) {
    const disk = cacheGet(CACHE_KEY);
    if (fresh(disk)) {
      memory = disk;
      return { providers: memory.providers, stale: false };
    }
  }

  if (!checking) {
    log.info("provider:health", "a verificar providers (background)");
    checking = runCheck()
      .then((providers) => {
        memory = { at: Date.now(), providers };
        cacheSet(CACHE_KEY, memory);
        const ok = providers.filter((p) => p.ok).length;
        const fail = providers.length - ok;
        log.info("provider:health", "check concluido", { ok, fail });
      })
      .catch(() => {})
      .finally(() => {
        checking = null;
      });
  }

  const known = memory || cacheGet(CACHE_KEY);
  return {
    providers: known ? known.providers : null,
    stale: true,
    checking: true,
  };
}
