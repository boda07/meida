// O feed de atividade: as ligacoes, as frases e a traducao.
//
// O `server/test/activity.test.js` prova o que fica gravado e quem o pode ler.
// Este ficheiro prova o que a PESSOA ve:
//   * "viu o episodio 3" abre a ficha NO episodio 3 (e nao no 1);
//   * um filme nao ganha "temporada 0";
//   * um anime sem temporadas nao inventa uma;
//   * as frases existem em portugues e em ingles, com os mesmos marcadores.
//
// A lista e' RENDERIZADA a serio (react-dom/server), como no
// `testar-comentarios-render.mjs`: um teste que so' leia o texto do componente
// passava com o `linkDaAtividade` a devolver outra coisa qualquer.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import { linkDaAtividade } from "../web/src/lib/atividade.js";
import { juntarPagina } from "../web/src/activity/itensAtividade.js";
import { traduzir } from "../web/src/i18n/traduzir.js";
import { DICIONARIO } from "../web/src/i18n/traducoes.js";

const RAIZ = resolve(process.argv[2] || ".");

let n = 0;
let mau = 0;
function ok(rotulo, cond, extra = "") {
  if (cond) {
    n++;
    console.log("  OK    " + rotulo);
  } else {
    mau++;
    console.log("  FALHA " + rotulo + (extra ? "  ->  " + extra : ""));
  }
}

console.log("");
console.log("  1) a ligacao leva ao episodio certo, nao ao primeiro");
{
  const filme = { type: "movie", tmdbId: 603, kind: "movie", season: null, episode: null };
  ok("um filme abre a ficha sem parametros", linkDaAtividade(filme) === "/details/movie/603", linkDaAtividade(filme));

  const ep = { type: "tv", tmdbId: 1000, kind: "episode", season: 2, episode: 3 };
  ok(
    "um episodio leva temporada e episodio",
    linkDaAtividade(ep) === "/details/tv/1000?s=2&e=3",
    linkDaAtividade(ep)
  );

  const anime = { type: "anime", tmdbId: 88, kind: "episode", season: null, episode: 12 };
  ok(
    "um anime sem temporadas leva so' o episodio (sem s=0)",
    linkDaAtividade(anime) === "/details/anime/88?e=12",
    linkDaAtividade(anime)
  );

  const semNumero = { type: "tv", tmdbId: 9, kind: "episode", season: null, episode: null };
  ok("sem numero nenhum nao inventa parametros", linkDaAtividade(semNumero) === "/details/tv/9", linkDaAtividade(semNumero));

  // O `type` vem do servidor e e' um de tres valores, mas um id de tipo com
  // espacos ou acentos nao pode partir o caminho.
  const estranho = { type: "a b", tmdbId: 1, kind: "movie" };
  ok("o tipo e' codificado no caminho", linkDaAtividade(estranho) === "/details/a%20b/1", linkDaAtividade(estranho));
}

console.log("");
console.log("  2) as frases existem nos dois idiomas, com os mesmos marcadores");
{
  const CHAVES = [
    "Atividade",
    "A tua rede",
    "O que andam a ver",
    "A atividade recente de quem segues.",
    "Descobrir pessoas",
    "A carregar a atividade",
    "Não foi possível carregar a atividade: {erro}",
    "Sem título",
    "Alguém",
    "{user} viu o filme {title}",
    "{user} viu a série {title}",
    "{user} viu {title}",
    "{user} viu o episódio {ep} da temporada {season} de {title}",
    "{user} viu o episódio {ep} de {title}",
    "Ainda não há atividade.",
    "Ainda não há atividade. Marca um episódio ou um filme como visto e aparece aqui.",
    "Ainda não há atividade por aqui.",
    "Segue pessoas para veres o que andam a ver — ou marca um episódio como visto.",
    "Carregar mais",
    "A carregar...",
  ];

  const marcadores = (s) => (String(s).match(/\{[a-z]+\}/gi) || []).sort().join(",");

  for (const chave of CHAVES) {
    const en = DICIONARIO.en[chave];
    ok("PT tem a chave: " + chave, Object.hasOwn(DICIONARIO.pt, chave));
    ok("EN tem a chave: " + chave, typeof en === "string" && en.length > 0);
    if (typeof en === "string") {
      ok(
        "os marcadores batem certo: " + chave,
        marcadores(chave) === marcadores(en),
        marcadores(chave) + " vs " + marcadores(en)
      );
    }
  }

  // A frase do episodio e' a que mais depende da traducao: em ingles a ordem
  // "season 2, episode 3" e' a natural, e um marcador trocado dava "3, 2".
  const epPt = traduzir(
    "{user} viu o episódio {ep} da temporada {season} de {title}",
    { user: "Ana", ep: 3, season: 2, title: "Série X" },
    "pt"
  );
  const epEn = traduzir(
    "{user} viu o episódio {ep} da temporada {season} de {title}",
    { user: "Ana", ep: 3, season: 2, title: "Show X" },
    "en"
  );
  ok("PT diz o episodio e a temporada", epPt === "Ana viu o episódio 3 da temporada 2 de Série X", epPt);
  ok("EN diz season 2, episode 3", epEn === "Ana watched season 2, episode 3 of Show X", epEn);
  ok("nenhum marcador fica a nu", !/\{[a-z]+\}/i.test(epPt + epEn));
}

console.log("");
console.log("  3) juntar paginas: sem repetir o que ja esta' a vista");
{
  // A paginacao e' por offset: uma atividade nova no topo desloca tudo e a
  // pagina seguinte repete a ultima da anterior. O id e' unico.
  const a = { id: 1 };
  const b = { id: 2 };
  const c = { id: 3 };
  ok(
    "junta so' o que e' novo",
    juntarPagina([a, b], [b, c])
      .map((x) => x.id)
      .join(",") === "1,2,3"
  );
  ok("nao duplica a primeira pagina", juntarPagina([a], [a]).length === 1);
  ok("base vazia (nada carregado ainda)", juntarPagina(null, [a, b]).length === 2);
  ok("pagina vazia (fim da lista)", juntarPagina([a], []).length === 1);
  ok("nada de nada", juntarPagina(null, null).length === 0);
}

console.log("");
console.log("  4) a lista desenhada: frases, ligacoes e estados");

// ---------------------------------------------------------------- o bundle
// O esbuild vive em web/node_modules (vem com o vite). Este ficheiro esta em
// scripts/, portanto a resolucao normal a partir daqui nao o encontra.
const req = createRequire(join(RAIZ, "web", "package.json"));
const { build } = req("esbuild");

const dir = mkdtempSync(join(tmpdir(), "meida-atividade-render-"));
const entrada = join(dir, "entrada.mjs");
const saida = join(dir, "saida.cjs");

writeFileSync(
  entrada,
  `import ActivityList from ${JSON.stringify(join(RAIZ, "web/src/components/ActivityList.jsx"))};
import FeedSection from ${JSON.stringify(join(RAIZ, "web/src/components/FeedSection.jsx"))};
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from ${JSON.stringify(join(RAIZ, "web/src/i18n/I18nContext.jsx"))};
import { SettingsProvider } from ${JSON.stringify(join(RAIZ, "web/src/settings/SettingsContext.jsx"))};

// O idioma e' fixado pelo TESTE, nao pela maquina: o Node fala "en-US" e sem
// isto o render sairia em ingles sem ninguem perceber por que.
export function definirIdioma(lang) {
  globalThis.localStorage = {
    // Só a chave do idioma tem valor; as definicoes ficam por omissao (o
    // \`settingsStore.get()\` devolve os padroes e nao escreve o aviso de
    // "definicoes corrompidas" que aparecia com o valor "pt" em todas as chaves).
    getItem: (chave) => (chave === "meida:idioma" ? lang : null),
    setItem: () => {},
    removeItem: () => {},
  };
}

// Dois avisos do React que so' existem no servidor de teste e nao sao defeito:
//   * o \`useLayoutEffect\` do react-router (nao ha DOM para medir);
//   * o array devolvido pelo \`traduzir\` quando a frase tem JSX la' dentro —
//     em producao o React nao pede chaves para os fragmentos de texto, mas no
//     build de desenvolvimento avisa. O padrao e' o mesmo dos comentarios.
const erroOriginal = console.error;
function semAvisos(fn) {
  console.error = (...a) => {
    const s = a.map(String).join(" ");
    if (
      s.includes("useLayoutEffect does nothing on the server") ||
      s.includes('unique "key" prop')
    ) {
      return;
    }
    erroOriginal(...a);
  };
  try {
    return fn();
  } finally {
    console.error = erroOriginal;
  }
}

export function renderLista(props) {
  return semAvisos(() =>
    renderToStaticMarkup(
      h(MemoryRouter, null, h(SettingsProvider, null, h(I18nProvider, null, h(ActivityList, props))))
    )
  );
}

export function renderFeed(props) {
  return semAvisos(() =>
    renderToStaticMarkup(
      h(MemoryRouter, null, h(SettingsProvider, null, h(I18nProvider, null, h(FeedSection, props))))
    )
  );
}
`
);

await build({
  entryPoints: [entrada],
  bundle: true,
  outfile: saida,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  logLevel: "error",
  absWorkingDir: join(RAIZ, "web"),
  nodePaths: [join(RAIZ, "web", "node_modules")],
});

try {
  const { definirIdioma, renderLista, renderFeed } = req(saida);
  definirIdioma("pt");

  const agora = Date.now();
  const minutosAtras = (m) => new Date(agora - m * 60_000).toISOString();

  const episodio = {
    id: 1,
    user: { id: 3, username: "ana", avatar: "emoji:🦊" },
    type: "tv",
    tmdbId: 1000,
    title: "Série X",
    poster: null,
    season: 2,
    episode: 3,
    kind: "episode",
    watchedAt: minutosAtras(5),
  };
  const filme = {
    id: 2,
    user: { id: 3, username: "ana", avatar: "emoji:🦊" },
    type: "movie",
    tmdbId: 603,
    title: "Matrix",
    poster: "/poster.jpg",
    season: null,
    episode: null,
    kind: "movie",
    watchedAt: minutosAtras(60),
  };
  const anime = {
    id: 3,
    user: { id: 4, username: "bruno", avatar: null },
    type: "anime",
    tmdbId: 88,
    title: "Anime Y",
    poster: null,
    season: null,
    episode: 12,
    kind: "episode",
    watchedAt: minutosAtras(120),
  };
  const serieInteira = {
    id: 4,
    user: { id: 4, username: "bruno", avatar: null },
    type: "tv",
    tmdbId: 2000,
    title: "Série Completa",
    poster: null,
    season: null,
    episode: null,
    kind: "series",
    watchedAt: minutosAtras(180),
  };

  const html = renderLista({
    items: [episodio, filme, anime, serieInteira],
    loading: false,
    error: null,
    empty: null,
  });
  const semAmp = html.replace(/&amp;/g, "&");

  ok("desenha um item por atividade", (html.match(/class="activity-item"/g) || []).length === 4);
  ok(
    "o episodio diz a temporada e o episodio",
    html.includes("viu o episódio 3 da temporada 2 de"),
    "frase do episodio ausente"
  );
  ok("o episodio abre no episodio certo", semAmp.includes('href="/details/tv/1000?s=2&e=3"'));
  ok("o filme diz 'viu o filme'", html.includes("viu o filme"));
  ok("o filme abre a ficha sem temporada", semAmp.includes('href="/details/movie/603"'));
  ok("um anime sem temporada diz so' o episodio", html.includes("viu o episódio 12 de") && html.includes(">Anime Y<"));
  ok("e abre so' com o episodio", semAmp.includes('href="/details/anime/88?e=12"'));
  ok("uma serie vista inteira diz 'viu a série'", html.includes("viu a série") && html.includes(">Série Completa<"));
  ok("o nome de quem viu liga ao perfil", semAmp.includes('href="/u/ana"') && html.includes(">ana<"));
  ok(
    "o cartaz aparece quando ha poster",
    html.includes('src="https://image.tmdb.org/t/p/w154/poster.jpg"'),
    html.slice(0, 300)
  );
  ok("sem poster mostra a inicial, nao um espaco vazio", html.includes("activity-poster-empty"));
  ok("a data relativa aparece", html.includes("5 min atras"), "esperava '5 min atras'");

  // O estado vazio tem de ser o do feed (com convite), nao uma linha em branco.
  const vazio = renderLista({ items: [], loading: false, error: null, empty: null });
  ok("a lista vazia diz que nao ha atividade", vazio.includes("Ainda não há atividade."));

  const aCarregar = renderLista({ items: null, loading: true, error: null, empty: null });
  ok("a carregar mostra o estado, nao a lista", aCarregar.includes("A carregar a atividade") && !aCarregar.includes("activity-item"));

  const comErro = renderLista({ items: null, loading: false, error: "falhou", empty: null });
  ok("um erro diz o que falhou", comErro.includes("Não foi possível carregar a atividade: falhou"));

  // ------------------------------------------------------------- em ingles
  definirIdioma("en");
  const htmlEn = renderLista({
    items: [episodio, filme],
    loading: false,
    error: null,
    empty: null,
  });
  ok(
    "em ingles o episodio e' 'watched season 2, episode 3 of'",
    htmlEn.includes("watched season 2, episode 3 of"),
    "frase inglesa ausente"
  );
  ok("em ingles o filme e' 'watched the movie'", htmlEn.includes("watched the movie"));
  ok("em ingles a data relativa tambem traduz", htmlEn.includes("5 min ago"), "esperava '5 min ago'");

  // ------------------------------------------------------ o cabecalho do feed
  definirIdioma("pt");
  const feed = renderFeed({ showHeader: true });
  ok("o feed da Home tem titulo", feed.includes("O que andam a ver"));
  ok("e um caminho para descobrir pessoas", semAmpFeed(feed).includes('href="/users"'));
  ok("sem atividade, convida a seguir pessoas", feed.includes("Segue pessoas para veres o que andam a ver"));

  function semAmpFeed(s) {
    return s.replace(/&amp;/g, "&");
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exitCode = mau ? 1 : 0;
