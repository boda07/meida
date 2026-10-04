// Bloqueador de anuncios dos providers de embed (gratis, local, sem listas
// externas).
//
// Porquê: os players de anime/filmes gratis enchem o ecra de anuncios. Nao ha
// nenhum provider "limpo" — medido a 2026-10-04, tanto o megavid.buzz como o
// vidnest.fun carregam scripts de anuncios. Como a app carrega os players num
// <iframe> do seu proprio Electron, da para bloquear ESSES pedidos na sessao
// antes de sairem para a net: o video continua a passar, os anuncios nunca
// chegam a existir. Nao e' um bloqueador de anuncios completo (a lista e' a mao
// e os sites trocam de dominio), mas apanha os casos medidos e os mais comuns.
// O que nao apanhar e' melhor do que hoje, que nao bloqueia nada.
//
// Este modulo nao faz "require("electron")": recebe a sessao como parametro, o
// que o torna carregavel num script node normal (para testes).

// Dominios de anuncios/popunder. Um pedido e' bloqueado se o hostname terminar
// EXACTAMENTE numa destas entradas (ou for igual), por isso nao se pode escrever
// aqui nada que seja tambem usado para servir video, subtitles ou a API.
const AD_HOSTS = [
  // --- Redes de anuncios e tracking (as mais comuns; so aparecem com ads) ---
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adservice.google.com",
  "amazon-adsystem.com",
  "adnxs.com",
  "criteo.com",
  "criteo.net",
  "taboola.com",
  "outbrain.com",
  "popcash.net",
  "propellerads.com",
  "adsterra.com",
  "hilltopads.net",
  "mgid.com",
  "adcash.com",
  "exoclick.com",
  "juicyads.com",
  "trafficjunky.com",
  "clickadu.com",
  "adskeeper.com",
  "zedo.com",
  "ad-maven.com",
  "plisto.com",
  "adhigh.net",
  "supplyframe.com",
  "kargo.com",
  "advertising.com",

  // --- Medidos no megavid.buzz a 2026-10-04 (o player ERA um site de anuncios:
  //     servia pelo CDN do Teniacites e ainda fazia tracking com o Histats) ---
  "teniacites.com",
  "histats.com",

  // --- Medidos no vidnest.fun a 2026-10-04 (popunder + tracking de fundo) ---
  "mintads.site", // alem destes dois: view-mintads.site e imp-mintads.site
  "view-mintads.site",
  "imp-mintads.site",
  "bmndx.com", // bounceExchange
  "bdpcmd.com", // eu.xml.bdpcmd.com
  "kirpankinky.cfd", // tenio.kirpankinky.cfd
  "shankedunwindy.cyou", // debaser.shankedunwindy.cyou
  "hartlysiegeractos.cyou", // shorl.* — config de popunder {"s":"1536x960","b":"1000x700"}
  "thatdisform.cyou", // CSS que injeta o click-catcher do popunder
  "ceriphtibbit.cfd", // identificador de maquina para targeting

  // --- Medidos no megaplay.buzz a 2026-10-04. E' o provider de anime mais
  //     limpo que encontramos: em 12 s de reproducao, e mesmo a clicar (que e o
  //     que dispara popunders), so pediu segmentos de video. O unico pedido de
  //     terceiros e o statlytic.net, que e estatisticas. ---
  "statlytic.net",
];

// Dominios que NUNCA podem ser bloqueados, porque o video deixaria de passar.
// Nao e' preciso agora (a lista de anuncios nao os toca), mas fica como rede de
// seguranca caso se mexa na lista de cima.
const NEVER_BLOCK = [
  "127.0.0.1",
  "localhost",
  "workers.dev", // fetch.streaming-1.workers.dev = proxy do stream do vidnest
  "ani.zip", // api.ani.zip = mapeamento AniList -> backend do player
  "vidnest.fun",
  // CDN de video/legendas do MegaPlay (medido a 2026-10-04). Os subdominios
  // mudam de serie para serie (hd3x5., cl1bh., gnze8., 9lc74., cf16y.), por isso
  // fica o sufixo. upcloud.animanga.fun e o proxy que o VidNest usa para as
  // legendas. Se um dia o video deixar de passar, e' aqui que se mete o dominio
  // que aparecer no log de bloqueios.
  "megaplay.buzz",
  "animanga.fun",
  "stellarfrontier.world",
  "lunarfrontier.website",
  "phantomharbor.website",
  "phantomharbor.space",
  "silentvoyage.space",
];

const BLOCK_ALL =
  process.env.MEIDA_BLOCK_ALL_ADS === "1"; // testes: "1" = bloqueia tudo

// O hostname termina EXACTAMENTE na entrada (ou e' igual)? Evita bloquear
// "popcash.net.ko.example.com" e "naoehpopcash.net".
function isAdHost(hostname, entry) {
  return hostname === entry || hostname.endsWith("." + entry);
}

// Devolve o hostname a que um pedido deve ser bloqueado, ou null.
function adHostFor(rawUrl) {
  if (BLOCK_ALL) return "*";
  let host;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;
  if (NEVER_BLOCK.some((safe) => host === safe || host.endsWith("." + safe))) return null;
  return AD_HOSTS.find((entry) => isAdHost(host, entry)) || null;
}

// Instala o bloqueio na sessao dada (normalmente a default). `logger` recebe
// cada bloqueio, para se poder ver o que apanhou. Idempotente.
function installAdBlock(winSession, logger) {
  if (!winSession || !winSession.webRequest) return 0;
  if (winSession.__meidaAdBlock) return 0;

  winSession.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, callback) => {
    const host = adHostFor(details.url);
    if (!host) return callback({ cancel: false });
    if (logger) logger(host, details.url, details.referrer || details.initiator);
    callback({ cancel: true });
  });

  winSession.__meidaAdBlock = true;
  return AD_HOSTS.length;
}

module.exports = { installAdBlock, adHostFor, AD_HOSTS, BLOCK_ALL };
