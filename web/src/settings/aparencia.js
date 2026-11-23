// Aparência: cores predefinidas, recentes e a conversão de imagem.
//
// Funções puras (sem React) para poderem ser testadas sem montar a página.

// Cores de destaque predefinidas.
export const ACCENT_PRESETS = [
  "#c90303", // vermelho (default)
  "#e50914", // netflix
  "#1db954", // verde
  "#2563eb", // azul
  "#8b5cf6", // roxo
  "#ec4899", // rosa
  "#f59e0b", // laranja
  "#06b6d4", // ciano
];

// Cores de fundo predefinidas (escuras, para o texto branco continuar legível).
export const BG_PRESETS = [
  "#070708", // preto (default)
  "#0a1226", // navy (combina com o logo azul/dourado)
  "#0d1117", // github
  "#0a0e14", // azul-noite
  "#12101a", // roxo escuro
  "#0a0f0d", // verde escuro
  "#15100f", // castanho escuro
];

// Junta uma cor ao topo da lista de recentes (sem duplicar, max 6).
export function addRecent(list, color) {
  const c = (color || "").toLowerCase();
  if (!c) return list || [];
  return [c, ...(list || []).filter((x) => x.toLowerCase() !== c)].slice(0, 6);
}

// Le uma imagem do disco e devolve um data URL ja reduzido (cabe no localStorage,
// que e onde as definicoes ficam guardadas). Reduz a largura maxima e exporta em
// JPEG para nao ocupar megabytes.
export function imageFileToDataUrl(file, maxW = 1920) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}