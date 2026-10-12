// Proxy para HLS: contorna CORS e o Referer exigido pelos hosts de video.
// Reescreve as playlists .m3u8 para que segmentos/chaves passem tambem por aqui.
// E' tambem onde se desloca o `.vtt` das legendas (`&atraso=N`).

import { deslocarVtt, limitarAtraso } from "./legendas.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function buildProxyUrl(targetUrl, referer) {
  const p = new URLSearchParams({ url: targetUrl });
  if (referer) p.set("ref", referer);
  return `/api/proxy?${p.toString()}`;
}

function isPlaylist(url, contentType = "") {
  return /\.m3u8(\?|$)/i.test(url) || /mpegurl/i.test(contentType);
}

// E' uma legenda? O `.vtt` e' o que o `<track>` do browser consome.
function isLegendas(url, contentType = "") {
  return /\.vtt(\?|$)/i.test(url) || /text\/vtt/i.test(contentType);
}

// Reescreve uma playlist m3u8: todas as URLs (segmentos, sub-playlists, chaves)
// passam a apontar para o nosso /api/proxy, preservando o referer.
function rewritePlaylist(text, baseUrl, referer) {
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

export async function handleProxy(req, res) {
  const target = req.query.url;
  const referer = req.query.ref || "";
  if (!target) return res.status(400).json({ error: "falta o parametro url" });

  const headers = {
    "User-Agent": UA,
    Accept: "*/*",
  };
  if (referer) {
    headers.Referer = referer;
    try {
      headers.Origin = new URL(referer).origin;
    } catch {
      /* referer invalido: sem Origin e seguir */
    }
  }
  if (req.headers.range) headers.Range = req.headers.range;

  let upstream;
  try {
    upstream = await fetch(target, { headers });
  } catch (e) {
    return res.status(502).json({ error: `proxy falhou: ${e.message}` });
  }

  const contentType = upstream.headers.get("content-type") || "";

  if (isPlaylist(target, contentType)) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, target, referer);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(rewritten);
  }

  // Legendas com atraso pedido pelo utilizador: `&atraso=2.5`. O `<track>` do
  // browser nao deixa mexer nos tempos, entao desloca-se aqui — que e' onde o
  // `.vtt` ja passa. Um atraso de 0 (o normal) nao faz nada e nao reescreve.
  if (isLegendas(target, contentType)) {
    const atraso = limitarAtraso(req.query.atraso);
    let text = await upstream.text();
    if (atraso !== 0) text = deslocarVtt(text, Math.round(atraso * 1000));
    res.status(upstream.status);
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Sem cache: o mesmo URL com atrasos diferentes da conteudos diferentes.
    res.setHeader("Cache-Control", "no-store");
    return res.send(text);
  }

  // Segmentos / chaves / outros: encaminhar bytes (com range se aplicavel).
  res.status(upstream.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!upstream.body) return res.end();
  const reader = upstream.body.getReader();
  req.on("close", () => reader.cancel().catch(() => {}));
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch {
    // cliente desligou
  }
  res.end();
}
