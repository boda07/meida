// Gera build/icon.ico a partir de build/icon.svg (varias resolucoes).
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIcoMod = require("png-to-ico");
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const svg = path.join(__dirname, "icon.svg");
const sizes = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  const pngs = await Promise.all(
    sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
  );
  const ico = await pngToIco(pngs);
  fs.writeFileSync(path.join(__dirname, "icon.ico"), ico);
  // PNG grande tambem (util para outras plataformas / janela em dev).
  await sharp(svg).resize(512, 512).png().toFile(path.join(__dirname, "icon.png"));
  console.log("icon.ico + icon.png gerados");
})();
