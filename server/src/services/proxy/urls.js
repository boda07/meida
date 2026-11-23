// Que respostas sao o que: playlists e legendas.
//
// Estas duas decisões vem **do URL pedido e do URL final** (um redirecionamento
// pode levar de `/play` para `/master.m3u8`), por isso ficam aqui como funcoes
// puras e o handler chama-as duas vezes.
import { buildProxyUrl } from "./assinatura.js";

export function isPlaylist(url, contentType = "") {
  return /\.m3u8(\?|$)/i.test(url) || /mpegurl/i.test(contentType);
}

// E' uma legenda? O `.vtt` e' o que o `<track>` do browser consome.
export function isLegendas(url, contentType = "") {
  return /\.vtt(\?|$)/i.test(url) || /text\/vtt/i.test(contentType);
}

// Reescreve uma playlist m3u8: todas as URLs (segmentos, sub-playlists, chaves)
// passam a apontar para o nosso /api/proxy, preservando o referer. Como
// `buildProxyUrl` agora assina, todos os segmentos reescritos levam assinatura.
export function rewritePlaylist(text, baseUrl, referer) {
  const resolve = (u) => new URL(u, baseUrl).toString();
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        // Reescreve atributos URI="..." (EXT-X-KEY, EXT-X-MEDIA, etc.)
        return line.replace(/URI="([^"]+)"/g, (_, u) => {
          return `URI="${buildProxyUrl(resolve(u), referer)}"`;
        });
      }
      // Linha de URL (segmento ou variante)
      return buildProxyUrl(resolve(t), referer);
    })
    .join("\n");
}