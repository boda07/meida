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
//   3. Redirecionamentos: seguimos **um salto de cada vez**, passando o destino
//      de cada um por `alvoSeguro`. Nem `redirect: "follow"` (reintroduzia o
//      SSRF: um 302 para `169.254.169.254` seria buscado sem validacao) nem
//      "nao seguir nada" (devolvia um 302 sem `Location`, um beco sem saida).
//
// O segredo vem de `MEIDA_PROXY_SECRET` ou, na falta, do `JWT_SECRET` (que o
// `config.js` exige em producao). Ver a nota sobre estabilidade abaixo.
import { deslocarVtt, limitarAtraso } from "./legendas.js";
import { BlockList, isIP } from "node:net";
import dns from "node:dns/promises";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------------------------------------------------------------------------
// O SEGREDO TEM DE SOBREVIVER A UM REINICIO (2026-10-18)
// ---------------------------------------------------------------------------
// Era `MEIDA_PROXY_SECRET || randomBytes(32)`, e **`MEIDA_PROXY_SECRET` nao esta
// definida em lado nenhum** — nem no `.env`, nem no Render, nem no `config.js`.
// Portanto, em producao, o segredo era ALEATORIO em cada arranque: um reinicio
// (e o Render hiberna) invalidava todas as URLs assinadas e o video que
// estivesse a dar partia a meio. Um `JWT_SECRET` que ja existe e' obrigatorio
// em producao, por isso e' a origem seguinte.
//
// **O segredo do JWT nao e' usado tal e qual**: deriva-se uma chave propria
// (separacao de dominio), para que um HMAC do proxy nunca sirva para forjar um
// token de login nem o contrario. `createHmac` aceita uma chave vazia sem
// lancar, por isso nem e' preciso um caminho aleatorio que nunca se alcanca.
const SEGREDO_PROXY = createHmac(
  "sha256",
  process.env.MEIDA_PROXY_SECRET?.trim() || config.jwtSecret
)
  .update("meida/proxy/hls/v1")
  .digest();

// **A validade tem de ser maior do que uma SESSAO DE VIDEO inteira, nao maior do
// que um pedido.** `rewritePlaylist` assina os segmentos uma unica vez, no
// momento em que a playlist e' lida, e um leitor de VOD nao volta a le-la. Com
// 10 minutos, um filme de 3 horas partia a meio e uma pausa de 10 minutos
// estragava o mesmo. Medido: um segmento dava 200 aos 10 min e 403 aos 11.
// 12 horas cobrem um filme longo com pausas, sem deixar a assinatura util para
// sempre. O custo de ser generoso e' pequeno: a assinatura so' vale para aquele
// URL especifico (e' HMAC de `alvo|ts`), nao da para assinar o que se quiser.
const VALIDADE_ASSINATURA_MS = 12 * 60 * 60 * 1000; // 12 horas

// Um `ts` no futuro era aceite sem limite nenhum (`agora - ts` dava negativo).
// Tolera-se algum desvio de relogio entre o servidor que assina e o que
// verifica, e uma mudanca de hora na maquina — 5 minutos chega para NTP.
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000; // 5 minutos

// Modo de teste: desativa o portao de seguranca (assinatura + IP privado) para
// que os testes unitarios chamem `handleProxy` directamente contra um servidor
// local (127.0.0.1) sem assinatura. NAO e' para usar em producao.
// `__ativarModoTeste` e `__permitirHostsNoTeste` desligam seguranca do proxy:
// o primeiro tira a assinatura E o filtro de IPs, o segundo deixa passar nomes
// que o filtro bloquearia. Nao ha razao nenhuma para isto ser possivel fora de
// `NODE_ENV=test`, e um gancho desprotegido num servidor publico e' um
// accident waiting to happen (um import acusinho, um_require deconveniente).
//
// **Atira** em vez de falhar em silencio: quem chamar isto sem ser num teste
// recebe o erro logo, e nao um proxy aberto sem dar conta.
function exigirModoTeste(nome) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(`${nome} so' pode ser chamado com NODE_ENV=test (desliga a seguranca do proxy)`);
  }
}

let desativarSegurancaParaTestes = false;
export function __ativarModoTeste() {
  exigirModoTeste("__ativarModoTeste");
  desativarSegurancaParaTestes = true;
}

// **Ganhao de teste, separado de `__ativarModoTeste`** (que desliga a assinatura
// e nao servia aqui: o `testar-proxy-redirect.mjs` quer a assinatura activa).
// O upstream desse teste vive em `localhost`, que o filtro passa a bloquear — e
// bem: `localhost` resolve para 127.0.0.1 e ::1.
//
// Sao NOMES EXACTOS. E' essa selectividade que torna o teste do SSRF util: o
// `localhost` do upstream passa, e o `127.0.0.1` para onde o upstream manda
// redirigir NAO esta' na lista — provando que cada salto e' revalidado.
// Por omissao e' `null` (nada passa); ver `testar-filtro-alvos.mjs`.
let hostsPermitidosNoTeste = null;
export function __permitirHostsNoTeste(lista) {
  exigirModoTeste("__permitirHostsNoTeste");
  hostsPermitidosNoTeste = new Set(lista || []);
}

// Sub-redes que o proxy nunca busca: loopback, privado, link-local (onde vivem
// os metadados da nuvem), CGNAT, multicast e os IPv6 equivalentes.
// A conta e' feita pelo `net.BlockList` em vez de expressoes regulares porque
// era a expressao regular do CGNAT que estava errada em ambos os sentidos:
// `100\.(6[4-9]|7[0-9]|8[0-9]|9[0-9]|1[0-1][0-9]|2[0-5][0-5]\.)` bloqueava
// `100.200.x.x` (que e' publico) e deixava passar `100.120.x.x` (que e' CGNAT).
const SUB_REDES = [
  ["0.0.0.0", 8, "ipv4"],      // "este host" em IPv4
  ["10.0.0.0", 8, "ipv4"],
  ["100.64.0.0", 10, "ipv4"],  // CGNAT (100.64.0.0/10 = segundo octeto 64..127)
  ["127.0.0.0", 8, "ipv4"],
  ["169.254.0.0", 16, "ipv4"], // link-local: 169.254.169.254 e' os metadados
  ["172.16.0.0", 12, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["224.0.0.0", 4, "ipv4"],    // multicast
  ["::", 128, "ipv6"],         // "este host" em IPv6
  ["::1", 128, "ipv6"],
  ["fc00::", 7, "ipv6"],       // unique local
  ["fe80::", 10, "ipv6"],      // link-local
  ["ff00::", 8, "ipv6"],       // multicast
];

const BLOQUEADOS = new BlockList();
for (const [endereco, prefixo, tipo] of SUB_REDES) BLOQUEADOS.addSubnet(endereco, prefixo, tipo);

// **NAO adicionar `::ffff:0:0/96` aqui.** Medido no Node 24.19: acrescentar essa
// regra faz `BLOQUEADOS.check("8.8.8.8", "ipv4")` devolver `true` — o verificador
// IPv4 passa a casar com a sub-rede IPv6 e bloqueia TODOS os enderecos IPv4,
// ou seja, todos os provedores. Nao e' preciso: o BlockList aplica as regras IPv4
// aos enderecos IPv4 mapeados quando esses sao verificados como ipv6 (medido:
// `::ffff:7f00:1` e' bloqueado por 127.0.0.0/8 e `::ffff:8.8.8.8` continua a
// passar). O teste fixa esse comportamento para se um dia mudar de Node.

// Resolver o nome fecha o ultimo buraco: sem isto, um nome publico que aponta
// para 127.0.0.1 passava inteiro (medido: `localtest.me` e
// `127.0.0.1.nip.io` devolviam `ok: true`).
//
// **O que isto NAO fecha:** entre a nossa resolucao e a do `fetch` passa um
// instante — um nome com DNS rebinding pode responder `1.2.3.4` aqui e
// `127.0.0.1` a seguir. Fechar isso a serio e' fixar o IP resolvido no proprio
// pedido (`fetch` para o IP com cabecalho `Host`), o que nao cabe aqui. O cache
// abaixo reduz a janela.
//
// O cache e' por nome com TTL curto: sem ele, um filme (700 segmentos) faria 700
// resolucoes DNS.
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const cacheAlvos = new Map();

function doCache(chave) {
  const entrada = cacheAlvos.get(chave);
  if (!entrada) return null;
  if (Date.now() > entrada.ate) {
    cacheAlvos.delete(chave);
    return null;
  }
  return entrada.valor;
}

function paraCache(chave, valor) {
  // Nao crescer sem limite se alguem usar muitos nomes.
  if (cacheAlvos.size > CACHE_MAX) cacheAlvos.clear();
  cacheAlvos.set(chave, { valor, ate: Date.now() + CACHE_TTL_MS });
  return valor;
}

// `dns.lookup` nao aceita sinal de abort; o tecto e' uma corrida com um
// temporizador sem referencia (para nao segurar o event loop).
const DNS_TIMEOUT_MS = 3000;
function resolverComTempoLimite(host) {
  let temporizador;
  const tecto = new Promise((_, recusa) => {
    temporizador = setTimeout(() => recusa(new Error("tempo esgotado")), DNS_TIMEOUT_MS);
    if (temporizador.unref) temporizador.unref();
  });
  return Promise.race([dns.lookup(host, { all: true, verbatim: true }), tecto])
    .finally(() => clearTimeout(temporizador));
}

/**
 * Decide se ALGUM dos enderecos de um nome e' interno. **Todos** sao julgados,
 * nao so' o primeiro: um nome pode devolver um endereco publico e um interno, e
 * o `fetch` escolhe qualquer um dos dois.
 *
 * Funcao pura e exportada para poder ser testada com uma lista sintetica
 * (`[publico, interno]`). Nao existe nome publico no mundo que devolva um
 * endereco publico e um privado em conjunto, portanto um teste so' com DNS real
 * nunca apanharia um "so' julgo o primeiro" — foi o que aconteceu na primeira
 * versao deste teste.
 *
 * @param {Array<{address: string}>} enderecos
 * @returns {boolean} true se algum for interno
 */
export function algumEnderecoBloqueado(enderecos) {
  if (!Array.isArray(enderecos)) return true;
  for (const { address } of enderecos) {
    if (enderecoBloqueado(String(address))) return true;
  }
  return false;
}

// `url.hostname` devolve os IPv6 ENTRE PARENTESES (`[::1]`) e `isIP("[::1]")`
// da 0 — por isso nenhum dos IPv6 literais passava pelo filtro.
function semParenteses(host) {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function enderecoBloqueado(endereco) {
  const tipo = isIP(endereco) === 6 ? "ipv6" : "ipv4";
  try {
    return BLOQUEADOS.check(endereco, tipo);
  } catch {
    // Endereco que o BlockList nao percebe: trata-se como bloqueado.
    return true;
  }
}
// Valida o alvo antes de qualquer fetch: so http(s), e nunca um endereco
// interno. Hostnames (nao IPs literais) sao deixados passar — o DNS e'
// resolvido no fetch, mas o alvo e' externo por definiçao.
/**
 * Valida o alvo ANTES de qualquer `fetch`: so http(s), e nunca um endereco
 * interno. Um IP literal e' julgado directamente; um nome e' resolvido e
 * **todos** os enderecos que der sao julgados.
 *
 * E' `async` desde 2026-10-19 porque resolve nomes. Todos os chamadores
 * (`handleProxy`, `seguirRedirectos`, `fetchSubtitleAsVtt` e a rota
 * `/subtitles/vtt`) ja eram `async`.
 *
 * @returns {Promise<{ok: boolean, motivo?: string}>}
 */
export async function alvoSeguro(alvo) {
  let url;
  try {
    url = new URL(alvo);
  } catch {
    return { ok: false, motivo: "URL invalido" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, motivo: "so http(s) sao permitidos" };
  }

  const host = semParenteses(url.hostname);
  if (!host) return { ok: false, motivo: "URL invalido" };

  // Gancho de teste, desligado por omissao. Ver `__permitirHostsNoTeste`.
  if (hostsPermitidosNoTeste && hostsPermitidosNoTeste.has(host)) return { ok: true };

  const guardado = doCache(host);
  if (guardado) return guardado;

  // IP literal: julgado directamente, sem DNS (e sem esperar por ele).
  if (isIP(host) === 4 || isIP(host) === 6) {
    return paraCache(
      host,
      enderecoBloqueado(host) ? { ok: false, motivo: "endereco interno bloqueado" } : { ok: true }
    );
  }

  let enderecos;
  try {
    enderecos = await resolverComTempoLimite(host);
  } catch {
    // Sem resolucao nao ha como verificar. Bloquear e' o lado seguro: se o nome
    // nao resolve, o `fetch` tambem falharia.
    return { ok: false, motivo: "nao foi possivel resolver o endereco" };
  }
  if (!enderecos || !enderecos.length) {
    return { ok: false, motivo: "o nome nao devolveu nenhum endereco" };
  }

  // Todos os enderecos, nao so' o primeiro: o `fetch` escolhe qualquer um.
  if (algumEnderecoBloqueado(enderecos)) {
    return paraCache(host, { ok: false, motivo: "endereco interno bloqueado" });
  }
  return paraCache(host, { ok: true });
}
// Exportada para os testes poderem assinar um `ts` a escolher (para verificar a
// expiracao) sem reimplementar o HMAC — quando o teste tinha a crypto duplicada,
// mudou a derivacao da chave e os dois partiram ao mesmo tempo, sem o dizer.
export function assinar(targetUrl, ts) {
  return createHmac("sha256", SEGREDO_PROXY).update(targetUrl + "|" + ts).digest("hex");
}

export function assinaturaValida(targetUrl, ts, sig) {
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  // **A assinatura tem de ser 64 caracteres hexadecimais, e este teste e' o que
  // mantem o `timingSafeEqual` vivo.** O `if (sig.length !== esperado.length)`
  // que estava aqui media o comprimento da *string*, e o `Buffer.from(sig,
  // "hex")` decodifica par a par: um `sig` de 64 caracteres com um `z` no
  // primeiro par dava um buffer de 0 bytes, e o `timingSafeEqual` atirava
  // `RangeError: Input buffers must have the same byte length`.
  // Numa rota `async` isso era uma rejeicao sem dono e o Node matava o
  // processo: **um GET sem autenticacao derrubava o servidor** (ver AGENTS.md).
  // A expressao regular garante 64 chars -> 32 bytes, exactamente o tamanho do
  // digest, por isso abaixo ja e' impossivel os buffers diferirem de tamanho.
  if (typeof sig !== "string" || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  const agora = Date.now();
  if (agora - tsNum > VALIDADE_ASSINATURA_MS) return false;
  if (tsNum - agora > TOLERANCIA_FUTURO_MS) return false;
  const esperado = assinar(targetUrl, ts);
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(esperado, "hex"));
}

// Constrói um URL assinado para `/api/subtitles/vtt`. Mesmo modelo do
// `buildProxyUrl`: HMAC-SHA256 com expiração de 12 horas (mesma
// `VALIDIDADE_ASSINATURA_MS` — ver a nota dessa constante sobre porque que a
// validade é uma sessão inteira e não um pedido), para que só o
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

// Quantos redirecionamentos se seguem antes de desistir. Um CDN pode ter
// `origem -> CDN` e mais um salto para o token; 5 chega com folga e impede
// `a -> b -> a -> b -> ...` de correr infinitamente.
const MAX_SALTOS_REDIRECT = 5;
const ESTADOS_REDIRECT = new Set([301, 302, 303, 307, 308]);

// Erro com `status` para o `handleProxy` responder com esse codigo (o handler
// de erros do Express usa o mesmo campo).
class ErroProxy extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

/**
 * Segue os redirecionamentos do upstream um a um, revalidando **cada** destino
 * com `alvoSeguro` antes de o buscar. Devolve a resposta final e o URL final —
 * o URL final e' o que serve de base a `rewritePlaylist`, porque os segmentos
 * de uma playlist sao quase sempre relativos.
 */
async function seguirRedirectos(urlInicial, headers) {
  let url = urlInicial;
  let resposta = await fetch(url, { headers, redirect: "manual" });

  for (let salto = 0; salto < MAX_SALTOS_REDIRECT; salto++) {
    if (!ESTADOS_REDIRECT.has(resposta.status)) return { resposta, url };

    const localizacao = resposta.headers.get("location");
    // Um 3xx sem `Location` nao tem onde ir: devolve-se tal e qual.
    if (!localizacao) return { resposta, url };

    let destino;
    try {
      destino = new URL(localizacao, url).toString();
    } catch {
      return { resposta, url };
    }

    // **Cada salto passa por `alvoSeguro`.** E' isto que permite seguir sem
    // reabrir o SSRF: o `redirect: "follow"` do `fetch` buscaria o destino sem
    // nunca o ver. O modo de teste desliga o portao todo, como no alvo inicial.
    if (!desativarSegurancaParaTestes) {
      const seguro = await alvoSeguro(destino);
      if (!seguro.ok) {
        throw new ErroProxy(`redirecionamento bloqueado (${seguro.motivo}): ${destino}`, 403);
      }
    }

    url = destino;
    // O corpo do 3xx nao interessa e fica preso na ligacao se nao for solto.
    try { await resposta.body?.cancel(); } catch { /* ja fechado */ }
    resposta = await fetch(url, { headers, redirect: "manual" });
  }

  if (ESTADOS_REDIRECT.has(resposta.status)) {
    throw new ErroProxy(`demasiados redirecionamentos (${MAX_SALTOS_REDIRECT})`, 502);
  }
  return { resposta, url };
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
