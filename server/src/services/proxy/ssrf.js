// Sigil do proxy: modo de teste e o filtro de enderecos internos (SSRF).
//
// ---------------------------------------------------------------------------
// SEGURANCA (2026-10-16)
// ---------------------------------------------------------------------------
// IPs privados, loopback e link-local sao rejeitados (`alvoSeguro`). Sem isto,
// o proxy era uma porta aberta para os metadados da nuvem e para a rede interna
// do alojamento.
import { BlockList, isIP } from "node:net";
import dns from "node:dns/promises";

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

// O portao esta' desligado? (usado pelo handler e por quem segue redirecionamentos)
export function segurancaDesligada() {
  return desativarSegurancaParaTestes;
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