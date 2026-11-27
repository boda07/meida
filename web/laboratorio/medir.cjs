/* global console, process */
// Mede as duas fotografias do laboratorio: a 60% e a 10% de opacidade.
//
// O que se quer provar:
//   1. o TEXTO nao apaga — os pixels das letras ficam brancos (255) nas duas;
//   2. a CAIXA muda — os pixels que estao atras das letras passam de ~51 para
//      ~115, porque o preto a 60% sobre cinza (#808080) da 51 e a 10% da 115.
//
// Como se distingue a caixa do texto e da sombra: a caixa e' a UNICA coisa que
// muda entre as duas fotos (o texto ja' era opaco e a sombra nao depende da
// opacidade). Entao "pixel de caixa" = pixel que ficou claramente mais claro,
// mas que continua escuro nas duas.
//
// Correr a partir de `web/` (a `sharp` esta' nas dependencias do web):
//   node laboratorio/medir.cjs <60.png> <10.png>
const sharp = require("sharp");

async function ler(caminho) {
  const { data, info } = await sharp(caminho)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

function luminancia(data, i) {
  return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
}

function mediana(valores) {
  if (!valores.length) return NaN;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

(async () => {
  const [a60, a10] = process.argv.slice(2);
  if (!a60 || !a10) {
    console.error("uso: node laboratorio/medir.cjs <foto-60.png> <foto-10.png>");
    process.exitCode = 2;
    return;
  }

  const A = await ler(a60);
  const B = await ler(a10);
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    console.error("as duas fotos tem de ter o mesmo tamanho");
    process.exitCode = 2;
    return;
  }

  const { width, height, channels } = A.info;

  // O rectangulo do video descobre-se pelo cinza #808080 do fundo. Nao basta a
  // caixa de todos os pixeis cinzentos: o texto branco do cabecalho tem bordas
  // anti-aliased que caem exactamente no 128 e estragavam a caixa. So' contam
  // as LINHAS com muitos pixeis cinzentos (as do video), e depois as colunas
  // dentro dessas linhas.
  const ehCinza = (i) =>
    Math.abs(A.data[i] - 128) <= 2 &&
    Math.abs(A.data[i + 1] - 128) <= 2 &&
    Math.abs(A.data[i + 2] - 128) <= 2;

  const linhas = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (ehCinza((y * width + x) * channels)) n++;
    linhas.push(n);
  }

  const minimoLinha = Math.max(20, Math.round(width * 0.35));
  let vy0 = -1;
  let vy1 = -1;
  for (let y = 0; y < height; y++) {
    if (linhas[y] >= minimoLinha) {
      if (vy0 < 0) vy0 = y;
      vy1 = y;
    }
  }

  let vx0 = width;
  let vx1 = 0;
  if (vy0 >= 0) {
    for (let x = 0; x < width; x++) {
      let n = 0;
      for (let y = vy0; y <= vy1; y++) if (ehCinza((y * width + x) * channels)) n++;
      if (n >= Math.max(10, Math.round((vy1 - vy0) * 0.3))) {
        if (x < vx0) vx0 = x;
        if (x > vx1) vx1 = x;
      }
    }
  }
  if (vx1 <= vx0 || vy1 <= vy0) {
    console.error("nao encontrei o video (cinza #808080) nas fotos");
    process.exitCode = 2;
    return;
  }

  const largura = vx1 - vx0 + 1;
  const altura = vy1 - vy0 + 1;

  // So' a faixa de baixo do video, onde a legenda do Chrome e' desenhada, e sem
  // a zona do botao das legendas (canto inferior direito, que tem um icone
  // branco que nao e' texto de legenda).
  const yDe = vy0 + Math.round(altura * 0.7);
  const yAte = vy1;
  const xDe = vx0;
  const xAte = vx0 + Math.round(largura * 0.84);

  console.log("video detectado:", `${largura} x ${altura} px`, `em (${vx0}, ${vy0})`);

  const caixa60 = [];
  const caixa10 = [];
  const texto60 = [];
  const texto10 = [];
  let mudaram = 0;
  let pixeis = 0;

  for (let y = yDe; y < yAte; y++) {
    for (let x = xDe; x < xAte; x++) {
      const i = (y * width + x) * channels;
      const l60 = luminancia(A.data, i);
      const l10 = luminancia(B.data, i);
      pixeis++;

      // Texto: branco nas duas fotos (o texto sempre foi opaco). O limiar e'
      // 244 e nao 255 por causa do anti-aliasing das letras: as bordas dos
      // glifos misturam-se com a caixa e ficam um pouco abaixo do branco.
      if (l60 >= 244 && l10 >= 244) {
        texto60.push(l60);
        texto10.push(l10);
        continue;
      }

      // Caixa: claramente mais claro na foto dos 10%, mas ainda escuro nas duas.
      // (51 -> 115 a 60% -> 10%; uma sombra fica escura nas duas e nao entra.)
      if (l60 < 150 && l10 < 170 && l10 - l60 > 25) {
        caixa60.push(l60);
        caixa10.push(l10);
        mudaram++;
      }
    }
  }

  const m60 = mediana(caixa60);
  const m10 = mediana(caixa10);

  console.log("faixa medida:", `${xAte - xDe} x ${yAte - yDe} px`, `(x ${xDe}-${xAte}, y ${yDe}-${yAte})`);
  console.log("pixeis na faixa:", pixeis);
  console.log("");
  console.log("TEXTO  (pixeis brancos nas duas fotos):");
  console.log("  quantidade a 60%:", texto60.length, "| a 10%:", texto10.length);
  console.log("  brilho mediano a 60%:", mediana(texto60).toFixed(1), "| a 10%:", mediana(texto10).toFixed(1));
  console.log("  brilho maximo a 60%:", Math.max(...texto60).toFixed(1), "| a 10%:", Math.max(...texto10).toFixed(1));
  console.log("");
  console.log("CAIXA  (pixeis que ficaram mais claros):");
  console.log("  quantidade:", mudaram);
  console.log("  brilho mediano a 60%:", m60.toFixed(1), "| a 10%:", m10.toFixed(1));
  console.log("  razao 10%/60%:", (m10 / m60).toFixed(2), "(esperado ~2.25 para preto 0.6 -> 0.1 sobre o mesmo fundo)");
  console.log("");

  const textoOk =
    mediana(texto60) >= 244 &&
    mediana(texto10) >= 244 &&
    Math.abs(mediana(texto60) - mediana(texto10)) < 3 &&
    texto60.length > 200 &&
    texto10.length >= texto60.length;
  const caixaOk = m60 > 30 && m60 < 75 && m10 > 95 && m10 < 135 && mudaram > 500;
  console.log("VEREDITO:");
  console.log("  texto nao apaga (branco nas duas):", textoOk ? "OK" : "FALHOU");
  console.log("  opacidade e' da caixa (a caixa muda, o texto nao):", caixaOk ? "OK" : "FALHOU");

  if (!textoOk || !caixaOk) process.exitCode = 1;
})();
