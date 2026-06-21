// Utilidades partilhadas pelos providers best-effort.
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function getText(url, referer) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: referer || "", Accept: "*/*" },
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.text();
}

// Procura um link .m3u8 em texto (HTML/JSON), lidando com barras escapadas.
export function findM3U8(text) {
  if (!text) return null;
  const m = text.match(/https?:\\?\/\\?\/[^"'\\\s]+?\.m3u8[^"'\\\s]*/i);
  return m ? m[0].replace(/\\\//g, "/") : null;
}

// Best-effort generico: pede a pagina de embed, procura m3u8 direto e, se nao
// houver, segue endpoints de API referenciados (/api, /source, /player, /e).
export async function scanEmbed(embedUrl, host) {
  const html = await getText(embedUrl, host + "/");
  let url = findM3U8(html);
  if (url) return url;

  const paths = [
    ...html.matchAll(/["'](\/(?:api|source|player|e|embed)\/[^"']+)["']/g),
  ]
    .map((m) => m[1])
    .slice(0, 8);

  for (const path of paths) {
    const body = await getText(host + path, embedUrl).catch(() => "");
    url = findM3U8(body);
    if (url) return url;
  }
  return null;
}
