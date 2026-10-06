// Verifica a lista do bloqueador de anuncios contra os dominios MEDIDOS a
// 2026-10-06 no vidcore.org.
//
// Porque e' preciso: a lista e' escrita a mao e os sites de ads trocam de
// dominio. Um erro aqui e' silencioso e grave nos dois sentidos — deixar passar
// um anuncio (que e' o que se via) ou bloquear um servidor de video (que e' um
// player preto sem erro nenhum). Este ficheiro falla a build em vez de
// deixar isso chegar ao utilizador.
//
// Como corre: `node scripts/testar-adblock.cjs`. Nao precisa de electron —
// `adblock.cjs` recebe a sessao como parametro, por isso carrega em Node normal.
const { adHostFor } = require("../electron/adblock.cjs");

// Tem de ser bloqueado. Todos estes apareceram nos 171 pedidos do player do
// vidcore.org a 2026-10-06 (filme Inception), e nenhum deles entrega video.
const DEVEM_PASSAR = [
  // O motor de anuncios e o Clarity, trazidos no <head> da pagina.
  "https://wwr.giriudog.com/?tag=95c46893",
  "https://ssdwinz.giriupot.com/api/v1/settings",
  "https://wwpa.giriuker.com/",
  "https://x1.giriucon.com/336262f9fe95064c192.jpeg",
  "https://store-v2.adoperator.com/",
  "https://www.clarity.ms/tag/yq8ej8a33h",
  "https://scripts.clarity.ms/0.8.72-beta/clarity.js",
  "https://r.clarity.ms/collect",
  // As camadas que se desenham por cima do video.
  "https://benchform.org/1/79d1e21b1816b52e335c4561617ab5b4",
  "https://biomanos.org/15/d327acfd8d4012fc08f3b69bdb765f38",
  "https://cdn.show-sb.com/sb/au/e1/6f/bb/e16fbbe9f31c82c23d1d57f9726b5fc7/1654616215.html",
  "https://cdn.holdbitter.com/sb/ssp/in-page-push/os/android/2/css/animate.css",
  "https://cdn.storageimagedisplay.com/si/fba335ee82740d4051fff80a8ac56cfa6f2cf7604da652c65e56f846759b2b45.png",
  // Pixels de tracking e Leilao.
  "https://static.nresystems.com/img.gif?h1id=1&key=79d1e21b",
  "https://tracking.eu.erdwas.com/rtb/feedimpression_inpage?feedid=inpzone141834",
  "https://apiguinee.org/pixel/ase",
  // Do VidLove: popunders de dominios `.cfd`. Bloqueia-se pelo nome EXACTO,
  // nunca pelo TLD — ver NEVER_BLOCK em electron/adblock.cjs.
  "https://ceriphtibbit.cfd/cuid/?f=https%3A%2F%2Fplayer.vidlove.cc",
  "https://tenio.kirpankinky.cfd/qualquer.js",
];

// NUNCA pode ser bloqueado: sem isto o video fica preto, e o unico sinal para o
// utilizador e' que "o site nao funciona".
const NUNCA_BLOQUEAR = [
  "https://vidcore.org/embed/movie/27205?autoPlay=true",
  // Fontes: e' daqui que sai o endereco final do stream.
  "https://downloadhub4u.xyz/proxy.php?url=https://movish.to/player-sources/rigel/movie/27205",
  "https://vidzen.fun/api/sources?type=movie&id=27205",
  "https://vidrack.created.app/api/sources/videasy?id=27205&type=movie",
  "https://ddl.cinextream.cc/...",
  // Legendas.
  "https://sub.vdrk.site/...",
  "https://cache.vdrk.site/...",
  // Segmentos de video (HLS via MSE).
  "https://steep-glitter-3ad4.mue2q5yz593e.workers.dev/x.m3u8",
  "https://little-field-fe85.instafashion662-3d4.workers.dev/segment.ts",
  // O motor de reproducao.
  "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js",
  // O STREAM do VidLove (player.vidlove.cc) passa por dominios `.cfd` que sao,
  // ao mesmo tempo, de anuncios — e a palavra muda de sessao para sessao. Se
  // alguem bloquear o TLD `.cfd` inteiro, estas duas linhas ficam em silencio e
  // o video do VidLove deixa de dar. Por estao aqui.
  "https://a2.whysosigmabro.cfd/api?d=abc123",
  "https://d.whysosigmabro.cfd/api?d=abc123",
  // Cartazes e metadados.
  "https://image.tmdb.org/t/p/w342/poster.jpg",
  "https://api.themoviedb.org/3/movie/27205",
];

let falhas = 0;

// 1) Os anuncios tem de ser cancelados.
for (const url of DEVEM_PASSAR) {
  const host = adHostFor(url);
  if (!host) {
    console.log(`  FALHA  anuncio passa: ${url}`);
    falhas++;
  }
}

// 2) A cadeia do video tem de passar.
for (const url of NUNCA_BLOQUEAR) {
  const host = adHostFor(url);
  if (host) {
    console.log(`  FALHA  video bloqueado por "${host}": ${url}`);
    falhas++;
  }
}

// 3) O video da app nunca pode ser bloqueado, seja qual for a lista.
for (const url of [
  "http://127.0.0.1:5175/api/health",
  "http://localhost:5173/",
  "https://meida.fadehost.app/api/health",
]) {
  if (adHostFor(url)) {
    console.log(`  FALHA  servidor da app bloqueado: ${url}`);
    falhas++;
  }
}

if (falhas) {
  console.error(`\nadblock: ${falhas} problema(s). Corri electron/adblock.cjs.`);
  process.exit(1);
}
console.log(
  `  adblock ok: ${DEVEM_PASSAR.length} anuncios bloqueados, ` +
    `${NUNCA_BLOQUEAR.length} urls de video/legendas livres.`
);
