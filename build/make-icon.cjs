// Gera build/icon.ico + build/icon.png a partir do logo.png (varias resolucoes).
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIcoMod = require("png-to-ico");
const pngToIco = pngToIcoMod.default || pngToIcoMod;

// Fonte: logo.png na raiz do projeto (fallback para o icon.svg antigo).
const root = path.join(__dirname, "..");
const src = fs.existsSync(path.join(root, "logo.png"))
  ? path.join(root, "logo.png")
  : path.join(__dirname, "icon.svg");
const sizes = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  const pngs = await Promise.all(
    sizes.map((s) => sharp(src).resize(s, s).png().toBuffer())
  );
  const ico = await pngToIco(pngs);
  fs.writeFileSync(path.join(__dirname, "icon.ico"), ico);
  // PNG grande tambem (util para outras plataformas / janela em dev).
  await sharp(src).resize(512, 512).png().toFile(path.join(__dirname, "icon.png"));
  console.log(`icon.ico + icon.png gerados de ${path.basename(src)}`);
})();
