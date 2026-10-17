// Proxy para HLS: contorna CORS e o Referer exigido pelos hosts de video.
// Reescreve as playlists .m3u8 para que segmentos/chaves passem tambem por aqui.
// E' tambem onde se desloca o `.vtt` das legendas (`&atraso=N`).
//
// ---------------------------------------------------------------------------
// SEGURANCA (2026-10-16)
// ---------------------------------------------------------------------------
// Antes, `fetch(target)` aceitava qualquer URL: era um proxy aberto que
// qualquer pessoa podia usar para chegar a IPs internos do alojamento ou como
// proxy gratis (gasta largura de banda e pode levar à suspensao). Agora:
//
//   1. Todo URL construido por `buildProxyUrl` e' assinado (HMAC-SHA256 com
//      expiracao). `handleProxy` rejeita o que nao tem assinatura valida.
//      Como so o servidor chama `buildProxyUrl`, o frontend nao muda.
//   2. IPs privados, loopback e link-local sao rejeitados (`alvoSeguro`).
//   3. `redirect: "manual"`: nao seguimos redirecionamentos cegamente (um
//      redirecionamento para um IP interno era SSRF).
//
// O segredo e' lido de `MEIDA_PROXY_SECRET` ou gerado ao arrancar. URLs
// assinadas expiram quando o servidor reinicia; o cliente re-fetcha as fontes
// e volta a funcionar. Isso e' aceitavel: o preço de nao assinar era um proxy
// aberto num servidor publico.
import { deslocarVtt, limitarAtraso } from "./legendas.js";
import { isIP } from "node:net";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Segredo partilhado entre `buildProxyUrl` (constrói) e `handleProxy` (verifica).
// Nunca viaja na rede.
const SEGREDO_PROXY =
  process.env.MEIDA_PROXY_SECRET || randomBytes(32).toString("hex");
const VALIDADE_ASSINATURA_MS = 10 * 60 * 1000; // 10 minutos

// Modo de teste: desativa o portao de seguranca (assinatura + IP privado) para
// que os testes unitarios chamem `handleProxy` directamente contra um servidor
// local (127.0.0.1) sem assinatura. NAO e' para usar em producao.
let desativarSegurancaParaTestes = false;
export function __ativarModoTeste() {
  desativarSegurancaParaTestes = true;
}

// IPs privados, loopback e link-local (IPv4 e IPv6, incluindo mapeados IPv4
// no IPv6 `::ffff:a.b.c.d`). Um alvo literal com estes enderecos e' rejeitado.
const IP_PRIVADO_V4 = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\./,
  /^100\.(6[4-9]|7[0-9]|8[0-9]|9[0-9]|1[0-1][0-9]|2[0-5][0-5])\./,
];
const IP_PRIVADO_V6 = [
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80/i,
  /^::ffff:127\./,
  /^::ffff:10\./,
  /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^::ffff:192\.168\./,
];

// Valida o alvo antes de qualquer fetch: so http(s), e nunca um endereco
// interno. Hostnames (nao IPs literais) sao deixados passar — o DNS e'
// resolvido no fetch, mas o alvo e' externo por definiçao.
export function alvoSeguro(alvo) {
  let url;
  try {
    url = new URL(alvo);
  } catch {
    return { ok: false, motivo: "URL invalido" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, motivo: "so http(s) sao permitidos" };
  }
  const host = url.hostname;
  const ip = isIP(host);
  if (ip === 4 || ip === 6) {
    const lista = ip === 4 ? IP_PRIVADO_V4 : IP_PRIVADO_V6;
    for (const re of lista) {
      if (re.test(host)) return { ok: false, motivo: "endereco interno bloqueado" };
    }
  }
  return { ok: true };
}

function assinar(targetUrl, ts) {
  return createHmac("sha256", SEGREDO_PROXY).update(targetUrl + "|" + ts).digest("hex");
}

export function assinaturaValida(targetUrl, ts, sig) {
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Date.now() - tsNum > VALIDADE_ASSINATURA_MS) return false;
  const esperado = assinar(targetUrl, ts);
  if (sig.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(esperado, "hex"));
}

// Constrói um URL assinado para `/api/subtitles/vtt`. Mesmo modelo do
// `buildProxyUrl`: HMAC-SHA256 com expiração de 10 minutos, para que só o
// servidor possa pedir ao servidor para buscar legendas externas.
// Usado nos dois sítios de `play.js` que montam `/api/subtitles/vtt?url=`.
export function buildSubtitleVttUrl(targetUrl) {
  const p = new URLSearchParams({ url: targetUrl });
  const ts = String(Date.now());
  p.set("ts", ts);
  p.set("sig", assinar(targetUrl, ts));
  return `/api/subtitles/vtt?${p.toString()}`;
}

export function buildProxyUrl(targetUrl, referer) {
  const p = new URLSearchParams({ url: targetUrl });
  if (referer) p.set("ref", referer);
  const ts = String(Date.now());
  p.set("ts", ts);
  p.set("sig", assinar(targetUrl, ts));
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
// passam a apontar para o nosso /api/proxy, preservando o referer. Como
// `buildProxyUrl` agora assina, todos os segmentos reescritos levam assinatura.
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
  const ts = req.query.ts;
  const sig = req.query.sig;
  const referer = req.query.ref || "";

  // Sem assinatura valida, o proxy nao serve nada. Fecha a porta a quem
  // tentasse usar `/api/proxy?url=` directamente. No modo de teste este
  // portao fica desligado (ver `__ativarModoTeste`).
  if (!desativarSegurancaParaTestes) {
    if (!target || !ts || !sig || !assinaturaValida(target, ts, sig)) {
      return res.status(403).json({ error: "proxy requer assinatura valida" });
    }

    const seguro = alvoSeguro(target);
    if (!seguro.ok) {
      return res.status(403).json({ error: seguro.motivo });
    }
  }

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

  // `redirect: "manual"`: nao seguimos redirecionamentos cegamente. Um
  // redirecionamento para um IP interno era SSRF; devolvemos a resposta tal e
  // qual e o navegador segue (ou nao) directamente para o upstream.
  let upstream;
  try {
    upstream = await fetch(target, { headers, redirect: "manual" });
  } catch (e) {
    return res.status(502).json({ error: `proxy falhou: ${e.message}` });
  }

  const contentType = upstream.headers.get("content-type") || "";

  if (isPlaylist(target, contentType)) {
    res.status(upstream.status);

    // E um erro NAO se reescreve
    // a pagina de erro do fornecedor (HTML) e' passada tal e qual, com o status
    // que o site deu, sem a reescrever como playlist.
    if (!upstream.ok) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(await upstream.text());
    }

    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, target, referer);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(rewritten);
  }

  if (isLegendas(target, contentType)) {
    const atraso = limitarAtraso(req.query.atraso);
    let text = await upstream.text();
    if (atraso !== 0) text = deslocarVtt(text, Math.round(atraso * 1000));
    res.status(upstream.status);
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    return res.send(text);
  }

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
