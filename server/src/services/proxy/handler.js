// O handler do `/api/proxy`: valida, busca, reescreve e passa os bytes.
//
// Proxy para HLS: contorna CORS e o Referer exigido pelos hosts de video.
// Reescreve as playlists .m3u8 para que segmentos/chaves passem tambem por aqui.
// E' tambem onde se desloca o `.vtt` das legendas (`&atraso=N`).
import { deslocarVtt, limitarAtraso } from "../legendas.js";
import { assinaturaValida } from "./assinatura.js";
import { alvoSeguro, segurancaDesligada } from "./ssrf.js";
import { isLegendas, isPlaylist, rewritePlaylist } from "./urls.js";
import { seguirRedirectos } from "./redirecionamentos.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function handleProxy(req, res) {
  const target = req.query.url;
  const ts = req.query.ts;
  const sig = req.query.sig;
  const referer = req.query.ref || "";

  // Sem assinatura valida, o proxy nao serve nada. Fecha a porta a quem
  // tentasse usar `/api/proxy?url=` directamente. No modo de teste este
  // portao fica desligado (ver `__ativarModoTeste`).
  if (!segurancaDesligada()) {
    if (!target || !ts || !sig || !assinaturaValida(target, ts, sig)) {
      return res.status(403).json({ error: "proxy requer assinatura valida" });
    }

    const seguro = await alvoSeguro(target);
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

  // Segue os redirecionamentos um a um, revalidando cada destino. Antes disto
  // era um unico `fetch(..., { redirect: "manual" })` que devolvia um 302 **sem
  // `Location`** ao cliente — um beco sem saida, porque a resposta so' copiava
  // content-type/length/range/accept-ranges. Qualquer provider que redirecione
  // a playlist ou os segmentos deixava de funcionar.
  let upstream;
  let urlFinal;
  try {
    ({ resposta: upstream, url: urlFinal } = await seguirRedirectos(target, headers));
  } catch (e) {
    return res.status(e.status || 502).json({ error: `proxy falhou: ${e.message}` });
  }

  const contentType = upstream.headers.get("content-type") || "";

  // O URL final tambem conta: um redirecionamento pode levar de `/play` (sem
  // extensao) a `/master.m3u8`, e sem esta segunda verificacao essa playlist
  // passava a ser tratada como video e nao seria reescrita.
  if (isPlaylist(target, contentType) || isPlaylist(urlFinal, contentType)) {
    res.status(upstream.status);

    // E um erro NAO se reescreve
    // a pagina de erro do fornecedor (HTML) e' passada tal e qual, com o status
    // que o site deu, sem a reescrever como playlist.
    if (!upstream.ok) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(await upstream.text());
    }

    const text = await upstream.text();
    // **O URL final, nao o pedido.** Os segmentos de uma playlist sao quase
    // sempre relativos (`seg1.ts`); resolvidos contra o URL que redirected
    // dariam o caminho errado.
    const rewritten = rewritePlaylist(text, urlFinal, referer);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(rewritten);
  }

  if (isLegendas(target, contentType) || isLegendas(urlFinal, contentType)) {
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