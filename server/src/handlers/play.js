// Reproducao: extracao de streams, MegaPlay nativo e legendas.
//
// A rota (`routes/play.js`) le os parametros, chama e responde. Aqui esta a
// regra: que URLs sao aceites (SSRF), quando se responde `native: false` em vez
// de erro, e o que vai pelo nosso proxy (m3u8 e legendas, para valer o Referer).
import { extractStream, extractEnabled } from "../services/extractor/index.js";
import { extractAnime, animeExtractorEnabled } from "../services/animeStream.js";
import { log } from "../services/log.js";
import {
  extrairMegaPlayNativo,
  embedUrlValido,
  tracksParaSubtitulos,
} from "../services/megaplayNativo.js";
import { buildProxyUrl, buildSubtitleVttUrl, assinaturaValida, alvoSeguro } from "../services/proxy.js";
import {
  searchSubtitles,
  fetchSubtitleAsVtt,
  subtitlesEnabled,
  getSubtitleVttCached,
} from "../services/subtitles.js";

// O extrator de anime (player proprio) esta configurado?
export function animeAtivo() {
  return { enabled: animeExtractorEnabled() };
}

// O extrator "Sem anuncios" de filmes/series (Consumet) esta configurado?
export function extractAtivo() {
  return { enabled: extractEnabled() };
}

// Reprodução NATIVA do MegaPlay: da' o m3u8 e as legendas em claro, sem
// iframe. E' o que resolve os dois problemas do iframe (ver
// services/megaplayNativo.js): as legendas passam a ser nossas (com escolha de
// idioma) e o play/pausa passa a sincronizar no Watch Party, porque nao ha'
// cross-origin pelo meio.
//
// Devolve `native: false` + `codigo` e `detalhe` (e nao um erro) quando nao
// consegue: quem chama mostra o iframe como estava, que continua a funcionar, e
// pode dizer o que falhou em vez de cair no iframe em silencio (N1). O `codigo`
// e' traduzido no cliente; o `detalhe` tecnico vai so' para a consola (B2).
export async function megaplay({ url, audio }) {
  if (!url) return { erro: "falta o parametro url", status: 400 };

  // O URL vem do cliente e esta rota e' publica: sem esta porta, `lerDataId`
  // fazia `fetch` ao que lhe dessem (um SSRF cego — 2026-10-19). So o MegaPlay
  // serve; o resto e' 400, e nao um `native: false` que parece "o site nao tem".
  if (!embedUrlValido(url)) {
    return { erro: "url tem de ser https://megaplay.buzz/stream/...", status: 400 };
  }

  // A extracao ja nao lanca (devolve `{ ok: false, codigo, detalhe }`), mas se
  // um dia lancar, a rota `async` nao pode deixar o pedido pendurado. No
  // Express 4 o valor devolvido e' ignorado e a rejeicao fica sem dono.
  try {
    const r = await extrairMegaPlayNativo({ embedUrl: String(url), audio });
    if (!r?.ok) {
      return {
        native: false,
        codigo: r?.codigo || "sem_video",
        detalhe: r?.detalhe || "extracao nativa indisponivel",
      };
    }

    return {
      native: true,
      audio: r.audio,
      intro: r.intro,
      outro: r.outro,
      // O m3u8 vai pelo nosso proxy: e' ele que poem o `Referer` que o MegaPlay
      // exige e que reescreve os segmentos da playlist tambem por aqui.
      sources: [{ isM3U8: true, url: buildProxyUrl(r.m3u8, "https://megaplay.buzz/") }],
      subtitles: tracksParaSubtitulos(r.tracks).map((s) => ({
        ...s,
        url: buildProxyUrl(s.url, "https://megaplay.buzz/"),
      })),
    };
  } catch (e) {
    log.warn("megaplay", `rota /anime/megaplay rebentou: ${e.message}`);
    return {
      native: false,
      codigo: "sem_video",
      detalhe: "erro interno a extrair o video",
    };
  }
}

// Extrai stream + legendas de um episodio de anime (player proprio).
export async function extrairAnime({ title, episode, audio }) {
  if (!animeExtractorEnabled()) {
    return { erro: "Extrator de anime nao configurado.", status: 400 };
  }
  if (!title) return { erro: "falta title", status: 400 };

  const r = await extractAnime({
    title: String(title),
    episode: Number(episode) || 1,
    audio,
  });
  const ref = r.referer || "";
  const sources = r.sources.map((s) => ({
    isM3U8: s.isM3U8,
    url: s.isM3U8 ? buildProxyUrl(s.url, ref) : s.url,
  }));
  const subtitles = (r.subtitles || []).map((sub) => ({
    lang: sub.lang,
    label: sub.label || sub.lang,
    default: sub.default,
    url: buildSubtitleVttUrl(sub.url),
    source: "hianime",
  }));
  return { provider: r.provider, sources, subtitles, intro: r.intro, outro: r.outro };
}

// Extrai stream sem anuncios e devolve URLs ja encaminhadas pelo proxy.
export async function extrair({ query }) {
  const { type, tmdb, imdb, title, year, season, episode } = query;
  if (type !== "movie" && type !== "tv") {
    return { erro: "type tem de ser 'movie' ou 'tv'", status: 400 };
  }
  if (!tmdb || !title) {
    return { erro: "faltam tmdb e title", status: 400 };
  }

  const ctx = {
    type,
    tmdb,
    imdb,
    title,
    year,
    season: season != null ? Number(season) : undefined,
    episode: episode != null ? Number(episode) : undefined,
  };
  const result = await extractStream(ctx);
  const ref = result.referer || "";

  // m3u8 -> via proxy (resolve CORS/Referer no browser).
  const sources = result.sources.map((s) => ({
    quality: s.quality,
    isM3U8: s.isM3U8,
    url: s.isM3U8 ? buildProxyUrl(s.url, ref) : s.url,
  }));
  // legendas do stream -> via /subtitles/vtt (convertidas para VTT).
  const subtitles = (result.subtitles || []).map((sub) => ({
    lang: sub.lang,
    label: sub.label || sub.lang,
    url: buildSubtitleVttUrl(sub.url),
    source: "stream",
  }));

  return { provider: result.provider, sources, subtitles };
}

// Lista legendas do OpenSubtitles para um titulo.
export async function legendas({ query }) {
  const { imdb, season, episode, languages } = query;
  if (!subtitlesEnabled()) {
    return { enabled: false, subtitles: [] };
  }
  const list = await searchSubtitles({
    imdb,
    season: season != null ? Number(season) : undefined,
    episode: episode != null ? Number(episode) : undefined,
    languages,
  });
  return {
    enabled: true,
    subtitles: list.map((s) => ({
      lang: s.lang,
      label: s.label,
      url: `/api/subtitles/download/${s.fileId}`,
      source: "opensubtitles",
    })),
  };
}

// Descarrega uma legenda do OpenSubtitles (VTT, com cache/retry).
export async function legendaVtt({ fileId }) {
  return { vtt: await getSubtitleVttCached(fileId) };
}

// Converte uma legenda de um URL externo (do extractor) para VTT.
// Exige assinatura valida (mesmo modelo do /api/proxy), nao segue IPs
// internos e corta respostas acima de 2 MB.
export async function legendaDoUrl({ url, ts, sig }) {
  if (!url || !ts || !sig || !assinaturaValida(url, ts, sig)) {
    return { erro: "legendas requerem assinatura valida", status: 403 };
  }

  // `alvoSeguro` resolve o nome do hostname.
  const seguro = await alvoSeguro(url);
  if (!seguro.ok) {
    return { erro: seguro.motivo, status: 403 };
  }

  const vtt = await fetchSubtitleAsVtt(url);
  if (Buffer.byteLength(vtt) > 2 * 1024 * 1024) {
    return { erro: "legenda excede o limite de 2 MB", status: 413 };
  }
  return { vtt };
}