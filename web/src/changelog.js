// Novidades por versao, em linguagem simples (sem termos tecnicos). Mostradas no
// "o que mudou" depois de o utilizador atualizar a app. Mais recente em cima.
export const CHANGELOG = [
  {
    version: "0.5.1",
    items: [
      "Nos torrents de anime, o filtro \"Legendado\" passa a tirar mesmo tudo o que tem dobragem (incluindo as versões com áudio duplo). Cada torrent mostra agora um selo DUB/DUAL.",
    ],
  },
  {
    version: "0.5.0",
    items: [
      "Só conta como \"a ver\" depois de 5 minutos com algo aberto — abrir e fechar logo já não vai para o \"Continua a ver\".",
    ],
  },
  {
    version: "0.4.9",
    items: [
      "No início, a recomendação ocupa o ecrã todo; ao fazer scroll, o \"Continua a ver\" e o resto aparecem com uma transição suave.",
    ],
  },
  {
    version: "0.4.8",
    items: [
      "Sempre que atualizares a app, passas a ver um resumo das novidades (como este).",
    ],
  },
  {
    version: "0.4.7",
    items: [
      "Torrents de anime: podes escolher entre Legendado e Dobrado.",
      "Os torrents passam a descarregar só o episódio que escolheste, e não a série toda.",
    ],
  },
  {
    version: "0.4.6",
    items: [
      "Na tua lista, o filtro de género está agora separado por Filmes, Séries e Anime.",
    ],
  },
  {
    version: "0.4.5",
    items: [
      "Podes mudar o fundo da app nas Definições: padrões à escolha ou uma imagem tua (como o wallpaper do WhatsApp).",
    ],
  },
  {
    version: "0.4.4",
    items: ["Os cartazes no início aparecem agora no idioma que escolheste."],
  },
  {
    version: "0.4.3",
    items: [
      "Os cartazes da tua lista e watchlist deixam de ficar em inglês e seguem o teu idioma.",
    ],
  },
  {
    version: "0.4.2",
    items: [
      "Voltou a opção de Torrents nos animes.",
      "As páginas de detalhe ficaram mais bonitas (fundo tipo wallpaper) e o cartaz muda com o idioma.",
      "O diário passa a importar as datas em que viste anime (MyAnimeList) e filmes (Letterboxd).",
    ],
  },
  {
    version: "0.4.0",
    items: [
      "O filtro de géneros na tua lista deixou de ser só para anime — funciona também com filmes e séries.",
      "Títulos e géneros aparecem no teu idioma.",
    ],
  },
];

// Versao atual: a instalada (Electron) ou, em dev/web, a injetada no build.
export async function getAppVersion() {
  try {
    if (typeof window !== "undefined" && window.electronAPI?.appVersion) {
      const v = await window.electronAPI.appVersion();
      if (v) return v;
    }
  } catch {
    /* segue para o fallback */
  }
  try {
    return __APP_VERSION__;
  } catch {
    return null;
  }
}

// Compara versoes "a.b.c": >0 se a > b, <0 se a < b, 0 se iguais.
export function cmpVersion(a, b) {
  const pa = String(a || "0").split(".").map(Number);
  const pb = String(b || "0").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
