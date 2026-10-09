// Health-check dos providers: testa 1x/dia cada provider de filmes/series e de
// anime com um titulo conhecido, e sinaliza os que estao mortos (DNS, timeout,
// 4xx/5xx ou pagina de erro), os que enchem o ecra de anuncios e os que sao
// demasiado lentos, para o frontend mostrar sem depender de tentar um titulo a
// serio. Resultado guardado em cache em disco (sobrevive a reinicios) e em
// memoria; o check corre em background, sem bloquear pedidos.
import { PROVIDERS, ANIME_PROVIDERS } from "./providers.js";
import { cacheGet, cacheSet } from "./cache.js";
import { log } from "./log.js";

// Titulos de teste: populares e presentes em todos os providers.
const TEST_MOVIE = 550; // Fight Club
const TEST_ANIME = 21; // One Piece (mesmo id no MAL e no AniList)

const TIMEOUT_MS = 8000;
const TTL_MS = 6 * 60 * 60 * 1000; // 1x de cada 6h (providers morrem/volatilizam-se no dia)
const CACHE_KEY = "provider-health";
// Providers que demoram mais que isto a responder sao marcados como "lentos"
// (ok=false) — não porque estejam mortos, mas porque degradam a experiência.
// Medidos: o MegaEmbed dava ~2.3s vs ~0.2s dos restantes.
const SLOW_MS = 2500;

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

// Redes de anuncios / scripts de popunder que aparecem no HTML do player. Um
// provider que os traz e' pior que nao ter provider: enche o ecra de anuncios.
// Medido a 2026-10-04: o megavid.buzz trazia "teniacites" + "histats"; o
// vidnest.fun e o vidapi.xyz nao traziam nenhum.
//
// De proposito NAO entram ferramentas de analise (googletagmanager,
// google-analytics, etc.): aparecem em players perfeitamente decentes e nao
// dizem nada sobre anuncios. Exige-se 2 marcadores DISTINTOS para marcar como
// nao-ok, para nao cair em falsos positivos.
const AD_MARKERS = [
  "teniacites",
  "histats",
  "adsbygoogle",
  "doubleclick.net",
  "googlesyndication.com/pagead",
  "onclickpopunder",
  "propellerads",
  "adsterra",
  "popcash",
  "exoclick",
  "adcash",
  "mgid.com",
  "taboola",
  "outbrain",
  "trafficjunky",
  "juicyads",
];
const AD_MIN_HITS = 2;

let memory = null; // { at, providers: [...] } com o ultimo resultado
let checking = null; // Promise do check em curso

// Alguns providers exigem um header Referer para responder com o player em vez
// de uma pagina de erro: o megaplay.buzz devolve "Error - MegaPlay" sem ele
// (medido a 2026-10-04). Nao validam o valor, so exigem que exista — e um iframe
// envia sempre, por isso na app funciona. Aqui mandamos a raiz do proprio site,
// que e o que o browser faria ao navegar para la.
function refererFor(url) {
  try {
    return new URL(url).origin + "/";
  } catch {
    return undefined;
  }
}

// Testa um URL: devolve ok=false + motivo se falhar, vier com anuncios ou for
// demasiado lento, true se responder bem (rapido e limpo).
async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
        referer: refererFor(url),
      },
    });
    const ms = Date.now() - t0;
    if (res.status >= 400) return { ok: false, status: res.status, error: `HTTP ${res.status}`, ms };
    const text = await res.text();
    const low = text.toLowerCase();
    for (const hint of DEAD_HINTS) {
      if (low.includes(hint)) return { ok: false, status: res.status, error: hint, ms };
    }
    const ads = AD_MARKERS.filter((m) => low.includes(m));
    if (ads.length >= AD_MIN_HITS) {
      return { ok: false, status: res.status, error: `anuncios (${ads.join(", ")})`, ms };
    }
    if (ms > SLOW_MS) return { ok: false, status: res.status, error: `lento (${ms}ms)`, ms };
    return { ok: true, status: res.status, ms };
  } catch (e) {
    const err = e.cause?.code === "UND_ERR_ABORTED" ? "timeout" : e.cause?.code || e.message;
    // O vidcore.org tem o certificado SSL quebrado (UNABLE_TO_VERIFY_LEAF_SIGNATURE)
    // mas ainda serve o player e o video passa (verificado no browser e no
    // adblock.cjs). Ignora-se esse erro especifico para nao marcar como morto
    // um provider que funciona — o stream resolve-se por JS (SPA) e o auto-fallback
    // de 15 s cobre falhas.
    if (err === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" && url.includes("vidcore")) {
      return { ok: true, ms: Date.now() - t0, error: "certificado (ignorado)" };
    }
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err,
    };
  } finally {
    clearTimeout(timer);
  }
}

function runCheck() {
  const tests = [
    ...PROVIDERS.filter((p) => p.movie).map((p) => ({
      id: p.id,
      name: p.name,
      type: "movie",
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
      const r = await probe(t.url);
      if (!r.ok) {
        log.warn("provider", `${t.name} (${t.id}) falhou`, {
          status: r.status,
          error: r.error,
          url: t.url,
        });
      }
      return { id: t.id, name: t.name, type: t.type, ok: r.ok, status: r.status, error: r.error, ms: r.ms };
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
