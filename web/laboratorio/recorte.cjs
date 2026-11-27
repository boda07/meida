/* global console, process */
// Recorta a faixa de baixo da captura, onde a legenda e' desenhada.
//
// Sem texto desenhado por cima: o `sharp` desta maquina nao tem fontes
// configuradas e o SVG com texto saia todo em quadradinhos.
//
//   node laboratorio/recorte.cjs <foto.png> <saida.png> [inicio=0.88]
const sharp = require("sharp");

(async () => {
  const [entrada, saida, inicio] = process.argv.slice(2);
  if (!entrada || !saida) {
    console.error("uso: node laboratorio/recorte.cjs <foto.png> <saida.png> [inicio]");
    process.exitCode = 2;
    return;
  }

  const fracao = Number(inicio) || 0.88;
  const { width, height } = await sharp(entrada).metadata();
  const left = Math.round(width * 0.04);
  const top = Math.round(height * fracao);

  await sharp(entrada)
    .extract({
      left,
      top,
      width: width - left * 2,
      height: height - top,
    })
    .png()
    .toFile(saida);

  console.log("recorte escrito em", saida, `${width - left * 2} x ${height - top}`);
})();
