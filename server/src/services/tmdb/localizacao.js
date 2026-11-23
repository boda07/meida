// Titulos/cartazes localizados de itens guardados (biblioteca, listas, perfil).
//
// Existe porque o titulo gravado na base de dados e' o titulo **no momento em
// que o titulo foi visto** — uma watchlist importada do Letterboxd vem em
// ingles, e fica em ingles para sempre, mesmo depois de escolher portugues nas
// Definicoes. As rotas que devolvem itens guardados passam por aqui para que a
// preferencia seja cumprida em todas elas e nao so no catalogo.
import { pMap } from "../net.js";
import { cacheGet, cacheSet } from "../cache.js";
import { LANG_MAP, tmdbFetch } from "./base.js";
import { pickPoster } from "./normalizar.js";
import { bestTitle } from "./titulos.js";

// Titulo + cartaz de um filme/serie no idioma pedido, em cache por
// (tipo, id, idioma) para nao repetir pedidos a cada abertura da lista. Os dois
// vem do(s) mesmo(s) pedido(s) — sem custo extra.
const localMetaCache = new Map();

const resolverIdioma = (titleLang) =>
  LANG_MAP[titleLang] || (String(titleLang || "").includes("-") ? titleLang : "en-US");

// So o que ja e' conhecido (memoria/disco), sem pedidos ao TMDB. Para a lista
// abrir ja com os titulos/cartazes localizados que temos.
export function getLocalizedMetaCached(type, id, titleLang) {
  if (type !== "movie" && type !== "tv") return null;
  const key = `${type}:${id}:${resolverIdioma(titleLang)}`;
  if (localMetaCache.has(key)) return localMetaCache.get(key);
  const disk = cacheGet(`tmeta:${key}`);
  if (disk) localMetaCache.set(key, disk);
  return disk;
}

/**
 * Troca o titulo e o cartaz de uma lista de itens pelos do idioma pedido, usando
 * so o que ja esta em cache. Devolve os que ficaram de fora, para se poder
 * buscar em segundo plano.
 *
 * So filmes e series: o anime tem o seu proprio idioma (`animeTitleLang`) e o
 * `getLocalizedMetaCached` devolve `null` para o resto, que fica como esta.
 *
 * Muta os itens no sitio (e' o que a resposta vai serializar) e nao escreve nada
 * na base de dados: o titulo original continua guardado, para voltar ao idioma
 * anterior se a preferencia mudar.
 */
export function localizarTitulos(items, titleLang) {
  const emFalta = [];
  for (const i of items || []) {
    if (i.type !== "movie" && i.type !== "tv") continue;
    const m = getLocalizedMetaCached(i.type, i.tmdbId, titleLang);
    if (m?.title) i.title = m.title;
    if (m?.poster) i.poster = m.poster;
    if (!m) emFalta.push(i);
  }
  return emFalta;
}

/**
 * Busca ao TMDB os titulos que `localizarTitulos` nao tinha em cache.
 *
 * Dispara-se sem `await`: a resposta ja foi enviada e a mutacao dos itens nao
 * altera o que o cliente recebeu. O que serve e' a proxima abertura, que ja vem
 * completa — e' o mesmo acordo que a biblioteca fazia.
 */
export function preencherTitulosLocalizados(emFalta, titleLang, concorrencia = 12) {
  if (!emFalta?.length) return Promise.resolve();
  return pMap(emFalta, concorrencia, async (i) => {
    const m = await getLocalizedMeta(i.type, i.tmdbId, titleLang);
    if (m?.title) i.title = m.title;
    if (m?.poster) i.poster = m.poster;
  }).catch(() => {
    /* best-effort: a proxima abertura tenta outra vez */
  });
}

export async function getLocalizedMeta(type, id, titleLang) {
  if (type !== "movie" && type !== "tv") return null;
  const target = resolverIdioma(titleLang);
  const short = target.slice(0, 2);
  const key = `${type}:${id}:${target}`;
  if (localMetaCache.has(key)) return localMetaCache.get(key);
  // Cache em disco: a memoria perde-se ao reiniciar e a lista re-faria 2 pedidos
  // ao TMDB por item de cada vez.
  const disk = cacheGet(`tmeta:${key}`);
  if (disk) {
    localMetaCache.set(key, disk);
    return disk;
  }
  try {
    const imgParams = {
      append_to_response: "images",
      include_image_language: `${short},en,null`,
    };
    let title, poster;
    if (target === "en-US") {
      const en = await tmdbFetch(`/${type}/${id}`, imgParams, "en-US");
      title = en.title || en.name || null;
      poster = pickPoster(en.images?.posters, "en");
    } else {
      const [loc, en] = await Promise.all([
        tmdbFetch(`/${type}/${id}`, imgParams, target),
        tmdbFetch(`/${type}/${id}`, {}, "en-US"),
      ]);
      title = bestTitle(loc, en.title || en.name || "") || null;
      poster = pickPoster(loc.images?.posters, short);
    }
    const out = { title, poster };
    localMetaCache.set(key, out);
    // So persiste quando ha alguma coisa (uma falha temporaria do TMDB nao deve
    // travar titulo/cartaz para sempre).
    if (out.title || out.poster) cacheSet(`tmeta:${key}`, out);
    return out;
  } catch {
    return null;
  }
}