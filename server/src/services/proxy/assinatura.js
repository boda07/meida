// Assinatura das URLs do proxy (HMAC-SHA256 com prazo).
//
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
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../config.js";

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