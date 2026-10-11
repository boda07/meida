// Catalogo do Anikoto: resolve um titulo de anime (por id do MAL ou do
// AniList) para os `embed_url` que ele tem.
//
// ── O QUE ESTE SERVICO FAZ E PORQUÊ ──────────────────────────────────────────
// A app resolve anime pelo MegaPlay na rota `/stream/ani/{idAniList}/{ep}/{audio}`.
// Essa rota falha em titulos que o Anikoto tem. A razao e' visivel no provider
// (ver `providers.js`): as DUAS rotas do MegaPlay nao sao iguais, e cada uma
// falha em titulos que a outra resolve.
//
// O Anikoto da'-nos o URL DIRECTO do episodio, e esse URL e' do MESMO MegaPlay
// mas na rota `/stream/s-2/{episode_embed_id}` — ou seja, uma terceira rota,
// que a app nunca usou. E' um fallback real: nao e' outro site, e' o mesmo
// site por um caminho que resolve titulos diferentes.
//
// ── A API ─────────────────────────────────────────────────────────────────────
// Medido a 2026-10-11 (a nota do IDEIAS.md, de 2026-10-04, ja nao bate):
//   GET /recent-anime?page=N&per_page=M  -> { ok, data: [ { id, mal_id, ani_id, ... } ], pagination }
//   GET /series/{id}                    -> { ok, data: { episodes: [ { number, embed_url: {sub, dub} } ] } }
// Limite: 60 pedidos por IP a cada 120 s (headers `X-RateLimit-*`).
//
// A API e' para uso no SERVIDOR: o proprio site avisa que chamar do browser do
// utilizador queima o limite dele. Por isso isto corre aqui e o catalogo fica
// em cache no disco.
//
// ── PORQUÊ O RASTEIO E' INCREMENTAL ───────────────────────────────────────────
// A lista tem ~91 paginas e a API nao tem pesquisa. Rastear tudo de uma vez
// seriam 91 pedidos, e o limite e' 60/2min — burst. Por isso o rasteio corre
// quando alguem pede uma serie que ainda nao esta' em cache, e guarda o que
// viu. Como a lista e' por data de estreia, os titulos novos aparecem logo no
// topo, o que e' exatamente o que interessa.
import { db } from "../db/index.js";
import { log } from "./log.js";

const BASE = "https://anikotoapi.site";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MEIDA/1.4.2";

/** Paginas que se aceitam por rasteio. 91 e' o total que a API reporta. */
const MAX_PAGINAS = 95;
/** Pausa entre pedidos, em ms. A API permite 60/120 s; vai-se bem abaixo. */
const PAUSA_MS = 1400;

const AGORA = () => new Date().toISOString();

/* ---------- consultas ---------- */

// A API devolve `mal_id` e `ani_id` como TEXTO, e `""` quando nao tem (nao
// `null`, nao `0`). Guardar `""` numa coluna INTEGER da' 0, e 0 e' um id
// VALIDO de outra serie — o que fazia o rasteio encontrar a serie errada em vez
// de dizer que nao sabia. Da' a funcao de limpeza abaixo: um id so' conta se
// for um inteiro positivo.
function idValido(v) {
  if (v === null || v === undefined || v === "" || v === 0 || v === "0") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// `mal_id` e' o que resolve: o catalogo da app e' do MyAnimeList. `ani_id` fica
// como segundo criterio porque ha titulos onde so um dos dois vem preenchido.
//
// NAO se filtra por `embed_ids IS NOT NULL`. A serie e' encontrada mesmo sem
// embeds guardados — e' assim que a primeira vez que alguem abre um episodio
// encontra a linha e vai buscar os `/series/{id}`. Filtrar aqui era um deadlock
// silencioso: o rasteio so' grava com `embed_ids = NULL`, portanto a linha
// acabava de ser gravada e nao era nunca encontrada.
function seriePorAniId(aniId) {
  const id = idValido(aniId);
  if (!id) return null;
  const r = db.prepare(`SELECT anikoto_id FROM anikoto_series WHERE ani_id = ? LIMIT 1`).get(id);
  return r ? r.anikoto_id : null;
}

function seriePorMalId(malId) {
  const id = idValido(malId);
  if (!id) return null;
  const r = db.prepare(`SELECT anikoto_id FROM anikoto_series WHERE mal_id = ? LIMIT 1`).get(id);
  return r ? r.anikoto_id : null;
}

/** Os `episode_embed_id` de uma serie, ja em memoria. */
export function embedsDe(anikotoId) {
  const r = db
    .prepare(`SELECT embed_ids FROM anikoto_series WHERE anikoto_id = ?`)
    .get(anikotoId);
  if (!r?.embed_ids) return null;
  try {
    return JSON.parse(r.embed_ids);
  } catch {
    return null;
  }
}

/** Estatisticas do catalogo local, para o log e para o `/api/providers`. */
export function estadoAnikoto() {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS series,
              COUNT(CASE WHEN embed_ids IS NOT NULL THEN 1 END) AS comEmbeds,
              MAX(ultima_pagina) AS ultimaPagina,
              MAX(updated_at) AS actualizadoEm
         FROM anikoto_series`
    )
    .get();
  return {
    series: r.series,
    comEmbeds: r.comEmbeds,
    ultimaPagina: r.ultimaPagina || 0,
    actualizadoEm: r.actualizado_at || null,
  };
}

/* ---------- escrita ---------- */

function guardarItem(item, ultimaPagina) {
  // `embed_ids` fica NULL enquanto a serie nao foi buscada: da' o catalogo
  // completo dos titulos sem 91 pedidos ao `/series/{id}`.
  db.prepare(
    `INSERT INTO anikoto_series (anikoto_id, mal_id, ani_id, titulo, embed_ids, ultima_pagina, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(anikoto_id) DO UPDATE SET
       mal_id     = COALESCE(excluded.mal_id, mal_id),
       ani_id     = COALESCE(excluded.ani_id, ani_id),
       titulo     = excluded.titulo,
       updated_at = excluded.updated_at`
  ).run(
    item.id,
    idValido(item.mal_id),
    idValido(item.ani_id),
    item.title ?? null,
    ultimaPagina,
    AGORA()
  );
}

function guardarEmbeds(anikotoId, mapa) {
  db.prepare(
    `UPDATE anikoto_series SET embed_ids = ?, updated_at = ? WHERE anikoto_id = ?`
  ).run(JSON.stringify(mapa), AGORA(), anikotoId);
}

/* ---------- rede ---------- */

async function pedir(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const e = new Error(`anikoto ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function pagina(p) {
  return pedir(`${BASE}/recent-anime?page=${p}&per_page=100`);
}

/** Busca os embed ids de uma serie e guarda-os. */
async function buscarEmbeds(anikotoId) {
  const dados = await pedir(`${BASE}/series/${anikotoId}`);
  const eps = dados?.data?.episodes || [];
  const mapa = {};
  for (const ep of eps) {
    const n = Number(ep.number);
    if (!Number.isFinite(n) || n < 1) continue;
    const sub = ep.embed_url?.sub || null;
    const dub = ep.embed_url?.dub || null;
    // Um episodio so' com `dub` ou so' com `sub` ainda vale: guarda os dois
    // campos e deixa quem chama escolher.
    if (!sub && !dub) continue;
    mapa[n] = { sub, dub };
  }
  guardarEmbeds(anikotoId, mapa);
  return mapa;
}

/* ---------- rasteio ---------- */

// Um rasteio por vez. Sem isto, dois pedidos de dois titulos diferentes fazem
// dois rasteios em paralelo erebentam o limite de 60/120 s.
let rasteando = null;

/**
 * Varre a lista do Anikoto a partir de `atePagina`, guardando o catalogo.
 * Incremental: guarda de onde parou, para a proxima vez continuar.
 *
 * @param {number} atePagina  pagina maxima a varrer nesta passagem
 * @returns {Promise<number>} quantos titulos novos foram guardados
 */
async function rastear(atePagina) {
  let novos = 0;
  const ate = Math.min(atePagina, MAX_PAGINAS);
  for (let p = 1; p <= ate; p++) {
    let dados;
    try {
      dados = await pagina(p);
    } catch (e) {
      // 429 e' o limite: parar aqui e tentar mais tarde. Nao e' um erro do
      // servidor da MEIDA, por isso nao se propaga.
      if (e.status === 429) {
        log.warn("anikoto", `limite de pedidos na pagina ${p}; rasteio interrompido`);
        break;
      }
      log.warn("anikoto", `pagina ${p} falhou: ${e.message}`);
      break;
    }
    const itens = dados?.data || [];
    if (!Array.isArray(itens) || !itens.length) break;
    for (const it of itens) {
      if (it?.id == null) continue;
      guardarItem(it, p);
      novos++;
    }
    if (p < ate) await dormir(PAUSA_MS);
  }
  return novos;
}

function rastearDepois(atePagina) {
  if (!rasteando) {
    rasteando = rastear(atePagina).finally(() => {
      rasteando = null;
    });
  }
  return rasteando;
}

// Para os testes: espera pelo rasteio em curso (ou faz um curto) e devolve.
// `fontesAnikoto` dispara o rasteio em background (`rastearDepois`) e nao
// espera — para o pedido de fontes nao ficar preso a dezenas de segundos. E'
// este que deixa o teste ver o resultado sem ter de dormir um tempo fixo.
export async function rastearParaTeste(atePagina = 2) {
  await rastearDepois(atePagina);
  return estadoAnikoto();
}

/* ---------- a API que o resto da app usa ---------- */

/**
 * As fontes de um episodio, a partir do catalogo do Anikoto.
 *
 * Devolve `[]` quando nao sabe o titulo — e' um FALLBACK, nao uma fonte
 * principal: quem chama junta isto ao que ja tinha.
 *
 * @param {{mal?:number|string, anilist?:number|string, episode?:number, audio?:string}} opts
 * @returns {Promise<{provider:string,name:string,embedUrl:string}[]>}
 */
export async function fontesAnikoto({ mal, anilist, episode = 1, audio }) {
  const ep = Number(episode) || 1;
  const querDub = audio === "dub";

  let anikotoId = mal ? seriePorMalId(mal) : null;
  if (!anikotoId && anilist) anikotoId = seriePorAniId(anilist);

  // Nao esta' em cache: rasteia e tenta outra vez. Nao se espera pelo rasteio
  // (sao dezenas de segundos) — a proxima vez ja esta' la.
  if (!anikotoId) {
    rastearDepois(3).catch(() => {});
    return [];
  }

  let mapa = embedsDe(anikotoId);
  if (!mapa) {
    try {
      mapa = await buscarEmbeds(anikotoId);
    } catch (e) {
      log.warn("anikoto", `serie ${anikotoId}: ${e.message}`);
      return [];
    }
  }
  const doEpisodio = mapa?.[ep];
  if (!doEpisodio) return [];

  const url = querDub ? doEpisodio.dub : doEpisodio.sub;
  if (!url) return [];
  // Um so' lado existe: se pediu dub e so' ha' sub, devolve o que ha' em vez
  // de nada. O `audio` e' preferencia, nao exigencia.
  const escolhido = url || doEpisodio.sub || doEpisodio.dub;
  if (!escolhido) return [];

  return [
    {
      provider: "anikoto",
      name: "MegaPlay (via Anikoto)",
      embedUrl: escolhido,
    },
  ];
}

/**
 * Arranca o rasteio em segundo plano. Chamado uma vez ao arrancar o servidor.
 *
 * TEM de devolver a promessa: quem chama faz `aquecerCatalogo().catch(...)`, e
 * uma funcao que nao devolve nada faz o servidor MORRER ao arrancar com
 * "Cannot read properties of undefined (reading 'catch')". Foi o que aconteceu
 * na 1.4.3 — apanhado pelo teste que arranca o servidor de verdade.
 */
export function aquecerCatalogo() {
  return rastearDepois(2).catch(() => {});
}