// Aplica o t() a um ficheiro, usando um mapa de traducoes.
//
// COMO USAR:
//   1. Escreve as traducoes em TRADUCOES (abaixo), com a chave = o texto EXACTO
//      em portugues como aparece no ficheiro.
//   2. Corre: node scripts/traduzir-ficheiro.cjs Settings.jsx
//   3. O script so' toca no que esta' no mapa. O que nao estiver, fica como
//      esta' — e o `extrair-textos.cjs --faltam` mostra o que faltou.
//
// NAO TRADUZ: classes, ids, rotas, imports, numeros, `t("...")` ja' feito.
// Preserva o CRLF/LF do ficheiro (o repo tem os dois).
const fs = require("node:fs");
const path = require("node:path");

const ficheiro = process.argv[2];
if (!ficheiro) {
  console.error("uso: node scripts/traduzir-ficheiro.cjs <ficheiro.jsx>");
  process.exit(1);
}
const caminho = ficheiro.includes("/") ? ficheiro : "web/src/pages/" + ficheiro;
if (!fs.existsSync(caminho)) {
  console.error("  nao existe: " + caminho);
  process.exit(1);
}

// === As traducoes deste ficheiro: PT -> EN ===
const TRADUCOES = {
  // --- MyAnimeList ---
  "Autoriza no browser e volta a esta janela.": "Authorize in the browser and come back to this window.",
  "Entra": "Log in",
  "A importar...": "Importing...",
  "Desligar conta": "Disconnect account",
  "Falha na sincronização.": "Sync failed.",
  "A sincronizar...": "Syncing...",
  "Conta ligada. Carrega em Importar para trazer os teus filmes.":
    "Account connected. Click Import to bring in your movies.",
  "username do Letterboxd": "Letterboxd username",
  "A ligar...": "Connecting...",
  "Real-Debrid ligado. Os torrents em cache no DeBrid reproduzem logo.":
    "Real-Debrid connected. Cached torrents on DeBrid start right away.",
  "token do Real-Debrid": "Real-Debrid token",

  // --- actualizacoes ---
  "A procurar...": "Checking...",
  "Indisponível em desenvolvimento.": "Unavailable in development.",
  "Não foi possível verificar agora.": "Couldn't check right now.",
  "Não foi possível guardar.": "Couldn't save.",
  "Guardado. A reiniciar...": "Saved. Restarting...",
  "Ficheiro descarregado. Vai à pasta de downloads do teu sistema.":
    "File downloaded. Check your system's downloads folder.",
  "Não foi possível exportar.": "Couldn't export.",
  "Não foi possível importar.": "Couldn't import.",

  // --- servidor ---
  "Definições": "Settings",
  "Servidor": "Server",
  "Este computador": "This computer",
  "Servidor remoto": "Remote server",
  "Endereço do servidor": "Server address",

  // --- idiomas ---
  "Idioma dos nomes de filmes, séries e anime.": "Language for movie, TV and anime titles.",
  "Sinopses": "Synopses",
  "Idioma das descrições/sinopses.": "Language of descriptions/synopses.",
  "Géneros": "Genres",
  "Idioma dos géneros e temas (na tua lista, filtros e detalhes).":
    "Language for genres and themes (in your library, filters and details).",

  // --- legendas / anime ---
  "Legendas": "Subtitles",
  "Anime: áudio": "Anime: audio",
  "Anime: títulos": "Anime: titles",
  "Conteúdo adulto (anime)": "Adult content (anime)",
  "Separador inicial": "Default page",
  "Onde abrir por defeito ao ver um título.": "Where to open by default when you open a title.",

  // --- reproducao / aparencia ---
  "Reprodução": "Playback",
  "Tamanho dos cartazes": "Poster size",
  "Largura": "Width",
  "Altura": "Height",
  "Cor de destaque": "Accent color",
  "Cor de fundo": "Background color",
  "Estilo de fundo": "Background style",
  "Cola o URL de uma imagem (https://...)": "Paste an image URL (https://...)",

  // --- contas ---
  "MyAnimeList": "MyAnimeList",
  "AniList": "AniList",
  "Os teus dados": "Your data",
  "A exportar...": "Exporting...",
  "Discord": "Discord",
  "Mostrar no Discord o que estou a ver": "Show on Discord what I'm watching",
  "Importar dados": "Import data",
  "Letterboxd": "Letterboxd",
  "Real-Debrid": "Real-Debrid",

  // --- perfil ---
  "Perfil": "Profile",
  "Bio": "Bio",
  "Uma frase sobre os teus gostos...": "A line about what you like...",
  "Avatar": "Avatar",
  "...ou cola o URL de uma imagem (https://...)": "...or paste an image URL (https://...)",

  // --- providers / avancado ---
  "Estado dos providers": "Provider status",
  "A testar providers...": "Testing providers...",
  "Sem informação.": "No information.",
  "Atualizado há 24h+": "Updated 24h+ ago",
  "Atualizações": "Updates",
  "Desinstalar": "Uninstall",
};

// === Aplica ===
let src = fs.readFileSync(caminho, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const original = src;

let aplicadas = 0;
const naoEncontradas = [];

for (const [pt, en] of Object.entries(TRADUCOES)) {
  // 1) texto entre tags:  >Biblioteca<
  const reTags = new RegExp(">([^<>{}]*)\\b" + escapar(pt) + "\\b([^<>{}]*)<", "g");
  const antes = src;
  src = src.replace(reTags, (todo, antes_, depois) => {
    // Ja' traduzido? nao mexer.
    if (antes_ + depois + pt === todo) return todo;
    aplicadas++;
    return ">" + antes_ + '{t("' + pt + '")}' + depois + "<";
  });
  if (antes !== src) continue;

  // 2) atributos:  title="..." aria-label="..."
  for (const attr of ["title", "aria-label", "placeholder", "alt"]) {
    const reAttr = new RegExp(attr + '="' + escapar(pt) + '"', "g");
    if (reAttr.test(src)) {
      src = src.replace(reAttr, attr + '={t("' + pt + '")}');
      aplicadas++;
    }
  }
  if (!src.includes(pt)) naoEncontradas.push(pt);
}

function escapar(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (aplicadas === 0) {
  console.log("  nada aplicado em " + caminho);
} else {
  fs.writeFileSync(caminho, src);
  console.log("  " + aplicadas + " textos traduzidos em " + caminho);
}
if (naoEncontradas.length) {
  console.log("  nao encontrados (" + naoEncontradas.length + "): " + naoEncontradas.slice(0, 8).join(" | "));
}