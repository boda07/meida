// Barrel do proxy HLS.
//
// O modulo foi dividido por responsabilidade (todos em `proxy/`):
//
//   ssrf.js             — filtro de IPs internos, `alvoSeguro`, ganchos de teste
//   assinatura.js       — HMAC, prazo, `buildProxyUrl`/`buildSubtitleVttUrl`
//   urls.js             — o que e' playlist/legenda e a reescrita do `.m3u8`
//   redirecionamentos.js— seguir 3xx um a um, revalidando cada destino
//   handler.js          — o `handleProxy` que responde ao cliente
//
// A fachada e' este ficheiro: as rotas e os testes continuam a importar
// `services/proxy.js`.
export { handleProxy } from "./proxy/handler.js";
export {
  assinar,
  assinaturaValida,
  buildSubtitleVttUrl,
  buildProxyUrl,
} from "./proxy/assinatura.js";
export {
  alvoSeguro,
  algumEnderecoBloqueado,
  __ativarModoTeste,
  __permitirHostsNoTeste,
} from "./proxy/ssrf.js";
export { rewritePlaylist } from "./proxy/urls.js";
export { seguirRedirectos, ErroProxy } from "./proxy/redirecionamentos.js";