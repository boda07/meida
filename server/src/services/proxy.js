// Proxy para HLS: contorna CORS e o Referer exigido pelos hosts de video.
// Reescreve as playlists .m3u8 para que segmentos/chaves passem tambem por aqui.

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
    } catch {}
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
