// O MoviesAPI abria no browser do sistema a cada episodio (2026-11-10).
//
// Causa: o `will-redirect` do Electron tambem dispara para SUBFRAMES. O
// moviesapi.to responde 302 para o vidspark.to dentro do <iframe> do player; o
// handler antigo via uma origem diferente da app, fazia preventDefault() e
// shell.openExternal(). O iframe ficava sem player e o browser abria.
//
// Este teste cobre tres coisas:
//   1) `electron/navegacao.cjs` — a decisao, com casos sinteticos (incluindo o
//      iframe, que e' o caso que falhava).
//   2) `electron/main.cjs` — a ligacao: os dois eventos usam a funcao e ja' nao
//      abrem o browser.
//   3) `Player.jsx` — o iframe tem `sandbox` sem allow-popups nem
//      allow-top-navigation: mesmo que o anuncio tente, o Chromium nao deixa.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LER = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const NAVEGACAO = LER("electron/navegacao.cjs");
const MAIN = LER("electron/main.cjs");
const PLAYER = LER("web/src/components/Player.jsx");
const ESTE = fileURLToPath(import.meta.url);

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra) {
  if (cond) {
    console.log("  OK    " + nome);
    ok++;
  } else {
    console.log("  FALHA " + nome + (extra ? " -> " + extra : ""));
    falhou++;
  }
}

// Carrega uma versao do modulo a partir do texto (para as mutacoes).
function carregar(src) {
  const module = { exports: {} };
  new Function("module", "exports", src)(module, module.exports);
  return module.exports;
}

// Tira as linhas que sao SO' comentario. Sem isto o comentario que explica
// porque nao se abre o browser ("shell.openExternal") faria o teste passar por
// engano — a licao do auditor de i18n: comentario nao e' codigo.
function semComentarios(src) {
  return src
    .split(/\r?\n/)
    .filter((linha) => !/^\s*\/\//.test(linha))
    .join("\n");
}

const ORIGENS = new Set(["http://localhost:5173", "https://meida.onrender.com"]);
const deveBloquear = require("../electron/navegacao.cjs").deveBloquear;

console.log("  1) a decisao: iframes passam, a janela para fora nao");

const casos = [
  // [nome, details, origens, esperado]
  [
    "iframe do moviesapi a saltar para o vidspark (o bug)",
    { url: "https://vidspark.to/tv/1399/1/1", isMainFrame: false },
    ORIGENS,
    false,
  ],
  [
    "iframe a ir para a origem da app tambem passa",
    { url: "https://meida.onrender.com/watch/1", isMainFrame: false },
    ORIGENS,
    false,
  ],
  [
    "frame principal para fora: bloqueia",
    { url: "https://vidspark.to/tv/1399/1/1", isMainFrame: true },
    ORIGENS,
    true,
  ],
  [
    "frame principal para a app: deixa",
    { url: "https://meida.onrender.com/details/tv/1399", isMainFrame: true },
    ORIGENS,
    false,
  ],
  [
    "frame principal para o servidor remoto: deixa",
    { url: "https://meida.fadehost.app/api/library", isMainFrame: true },
    new Set([...ORIGENS, "https://meida.fadehost.app"]),
    false,
  ],
  [
    "sem isMainFrame conta como frame principal",
    { url: "https://vidspark.to/" },
    ORIGENS,
    true,
  ],
  ["URL invalido: bloqueia", { url: "nao-e-url", isMainFrame: true }, ORIGENS, true],
  ["sem details: bloqueia", undefined, ORIGENS, true],
  ["url vazio: bloqueia", { url: "", isMainFrame: true }, ORIGENS, true],
];

for (const [nome, details, origens, esperado] of casos) {
  let obtido;
  try {
    obtido = deveBloquear(details, origens);
  } catch (e) {
    obtido = "ATIROU: " + e;
  }
  ok_(nome, obtido === esperado, "esperado " + esperado + ", obtido " + obtido);
}

console.log("  2) main.cjs liga os dois eventos a mesma decisao");

const blocoNavegar = (() => {
  const ini = MAIN.indexOf("function aoNavegar");
  if (ini === -1) return "";
  const fim = MAIN.indexOf("\n  }", ini);
  const bruto = fim === -1 ? MAIN.slice(ini) : MAIN.slice(ini, fim + 4);
  return semComentarios(bruto);
})();

ok_("importa ./navegacao.cjs", /require\("\.\/navegacao\.cjs"\)/.test(MAIN));
ok_("aoNavegar existe", blocoNavegar.length > 0);
ok_("aoNavegar chama deveBloquear", /deveBloquear\(d,\s*origensPermitidas\)/.test(blocoNavegar));
ok_(
  "aoNavegar aceita a porta onde a janela esta' (backend em 5176)",
  /getURL\(\)/.test(blocoNavegar) && /origensPermitidas\.add\(/.test(blocoNavegar)
);
ok_(
  "will-navigate usa aoNavegar",
  /on\("will-navigate",\s*aoNavegar\)/.test(MAIN)
);
ok_(
  "will-redirect usa aoNavegar (o que disparava no iframe)",
  /on\("will-redirect",\s*aoNavegar\)/.test(MAIN)
);
ok_(
  "aoNavegar NAO abre o browser",
  !/shell\.openExternal\s*\(/.test(blocoNavegar),
  blocoNavegar.split(/\r?\n/).slice(0, 3).join(" | ")
);
ok_(
  "shell.openExternal so' fica no IPC open-external",
  (MAIN.match(/shell\.openExternal\s*\(/g) || []).length === 1,
  String((MAIN.match(/shell\.openExternal\s*\(/g) || []).length)
);
ok_(
  "origemPermitida() tem DEFINICAO (a 1.7.2 deixou-a por definir e a app morria)",
  (MAIN.match(/origemPermitida\(/g) || []).length === 0 ||
    /function\s+origemPermitida\s*\(/.test(MAIN)
);

console.log("  3) o iframe do player tem sandbox");

function blocoIframe(src) {
  const i = src.indexOf("src={finalSrc}");
  if (i === -1) return "";
  const ini = src.lastIndexOf("<iframe", i);
  const fim = src.indexOf("/>", i);
  return ini === -1 || fim === -1 ? "" : src.slice(ini, fim + 2);
}

const iframe = blocoIframe(PLAYER);
const sandbox = (iframe.match(/sandbox="([^"]*)"/) || [])[1] || "";

ok_("o iframe do player existe", iframe.length > 0);
ok_("sem sandbox (provedores precisam de popups e navegacao livre)", sandbox.length === 0, iframe.slice(0, 120));
ok_("allowFullScreen continua", /allowFullScreen/.test(iframe));

console.log("  4) mutacoes");

const mutacoes = [
  {
    nome: "o iframe volta a ser tratado como a janela",
    fonte: NAVEGACAO,
    mutar: (s) => s.replace("if (details && details.isMainFrame === false) return false;", ""),
    // com o guarda removido, o caso do iframe externo passa a true
    passa: (s) => {
      const f = carregar(s).deveBloquear;
      return f({ url: "https://vidspark.to/tv/1399/1/1", isMainFrame: false }, ORIGENS) === false;
    },
  },
  {
    nome: "a janela para fora deixa de ser bloqueada",
    fonte: NAVEGACAO,
    mutar: (s) => s.replace("return !origensPermitidas.has(new URL(url).origin);", "return false;"),
    passa: (s) => {
      const f = carregar(s).deveBloquear;
      return f({ url: "https://vidspark.to/", isMainFrame: true }, ORIGENS) === true;
    },
  },
  {
    nome: "main.cjs deixa de usar a decisao",
    fonte: MAIN,
    mutar: (s) =>
      s.replace(
        "if (deveBloquear(d, origensPermitidas)) detalhes.preventDefault();",
        "detalhes.preventDefault();"
      ),
    passa: (s) => {
      const b = (() => {
        const ini = s.indexOf("function aoNavegar");
        const fim = s.indexOf("\n  }", ini);
        return ini === -1 ? "" : semComentarios(s.slice(ini, fim + 4));
      })();
      return /deveBloquear\(/.test(b);
    },
  },
  {
    nome: "o handler volta a abrir o browser",
    fonte: MAIN,
    mutar: (s) =>
      s.replace(
        "if (deveBloquear(d, origensPermitidas)) detalhes.preventDefault();",
        "if (deveBloquear(d, origensPermitidas)) { detalhes.preventDefault(); shell.openExternal(d.url); }"
      ),
    passa: (s) => {
      const b = (() => {
        const ini = s.indexOf("function aoNavegar");
        const fim = s.indexOf("\n  }", ini);
        return ini === -1 ? "" : semComentarios(s.slice(ini, fim + 4));
      })();
      return !/shell\.openExternal\s*\(/.test(b);
    },
  },
  {
    nome: "deixa de aceitar a porta onde a janela esta'",
    fonte: MAIN,
    mutar: (s) => s.replace("origensPermitidas.add(new URL(atual).origin);", "void atual;"),
    passa: (s) => {
      const b = (() => {
        const ini = s.indexOf("function aoNavegar");
        const fim = s.indexOf("\n  }", ini);
        return ini === -1 ? "" : semComentarios(s.slice(ini, fim + 4));
      })();
      return /origensPermitidas\.add\(/.test(b);
    },
  },
  {
    nome: "apaga a definicao de origemPermitida (a app morria no arranque)",
    fonte: MAIN,
    mutar: (s) => s.replace("  function origemPermitida(url) {", "  function __semDefinicao(url) {"),
    passa: (s) => /function\s+origemPermitida\s*\(/.test(s),
  },
  {
    nome: "o iframe ganha sandbox (provedores quebram)",
    fonte: PLAYER,
    mutar: (s) =>
      s.replace(
        /<iframe[\s\S]*?allowFullScreen/,
        (m) => m.replace("allowFullScreen", 'sandbox="allow-scripts" allowFullScreen')
      ),
    passa: (s) => !/sandbox=/.test(s),
  },
];

for (const m of mutacoes) {
  const mutado = m.mutar(m.fonte);
  if (mutado === m.fonte) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o texto mudou): " + m.nome);
    falhou++;
    continue;
  }
  if (m.passa(mutado)) {
    console.log("  FALHA MUTACAO NAO DETECTADA: " + m.nome);
    falhou++;
  } else {
    console.log("  OK    MUTACAO apanhada: " + m.nome);
    ok++;
  }
}

console.log("  5) higiene");
for (const [nome, texto] of [
  ["navegacao.cjs", NAVEGACAO],
  ["main.cjs", MAIN],
  ["Player.jsx", PLAYER],
  ["testar-navegacao-embed.mjs", fs.readFileSync(ESTE, "utf8")],
]) {
  ok_(nome + " sem CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(texto));
  ok_(nome + " sem caractere de substituicao", !texto.includes("\uFFFD"));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
