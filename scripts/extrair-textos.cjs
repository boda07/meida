// Extrai os textos de UI de um ficheiro React, para o i18n.
//
// PORQUE ISTO EXISTE: passar a app inteira ao ingles sao ~400 textos em 50
// ficheiros. Escreve-los a mao no dicionario e' lento, e o mais perigoso e'
// esquecer um. Este script le' um ficheiro e devolve cada texto visivel com a
// linha onde aparece, para se confirmar que a traducao cobre tudo.
//
// O QUE E' CONSIDERADO TEXTO DE UI:
//   - entre tags:            <span>Biblioteca</span>
//   - atributos de texto:    title="Entrar"  aria-label="Pesquisar"
//   - placeholder / alt
//   - confirmacoes em codigo: "Apagar este titulo?"
//
// O QUE NAO E':
//   - o que ja' passa por t()   (nao vale a pena reextrair)
//   - classes e ids de CSS: "stats-page", "nav-links", "set-row"
//   - rotas e urls: "/api/library", "movie", "tv"
//   - rotulos ja' obtidas de dados: {user.username}
//
// COMO CORRER:
//   node scripts/extrair-textos.cjs                  # todos, por ordem de tamanho
//   node scripts/extrair-textos.cjs Settings.jsx     # so' um ficheiro
//   node scripts/extrair-textos.cjs --faltam         # so' o que ainda nao traduzido
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = process.cwd();
const args = process.argv.slice(2);
const SO_FALTAM = args.includes("--faltam");
const pedido = args.find((a) => !a.startsWith("--"));

const PASTAS = ["web/src/pages", "web/src/components", "web/src/settings", "web/src/library"];
const ATRIBUTOS = ["title", "aria-label", "placeholder", "alt"];

// Uma palavra minuscula com tracos e' quase sempre uma classe de CSS, nao um
// texto. "nav-links", "stats-page", "set-row". Excepto o que tem maiusculas ou
// acentos, que ja' seria' texto ("Estatísticas").
function pareceCss(v) {
  return /^[a-z0-9]+([_-][a-z0-9]+)*$/.test(v);
}

// Carrega as chaves ja' traduzidas no dicionario.
const jaTraduzidas = new Set();
try {
  const src = fs.readFileSync(path.join(RAIZ, "web/src/i18n/traducoes.js"), "utf8");
  for (const x of src.matchAll(/^\s*["']((?:[^"'\\]|\\.)*)["']\s*:/gm)) {
    jaTraduzidas.add(x[1]);
  }
} catch {
  /* ainda nao existe */
}

/** Extrai os textos de um ficheiro, devolvendo Map(texto -> {linhas, formas}). */
function extrair(codigo) {
  const achados = new Map();

  const regista = (bruto, forma, linha) => {
    // Normaliza: o texto pode ter varias linhas e espacos dobrados. O que
    // interessa e' o texto que a pessoa le, nao a indentacao do JSX.
    const t = String(bruto).replace(/\s+/g, " ").trim();
    if (t.length < 2 || t.length > 90) return;
    if (pareceCss(t)) return;
    if (/^https?:\/\//.test(t) || /^\//.test(t)) return;      // urls e rotas
    if (/^[a-z]+:[a-z-]+/i.test(t)) return;                     // data:, blob:, http:
    if (/^\d+$/.test(t)) return;
    if (/^[{}$]/.test(t)) return;                                // {variavel}
    if (/^[A-Z_]+$/.test(t)) return;                             // constantes
    if (!achados.has(t)) achados.set(t, { linhas: new Set(), formas: new Set() });
    achados.get(t).linhas.add(linha);
    achados.get(t).formas.add(forma);
  };

  const linhas = codigo.split(/\r?\n/);
  linhas.forEach((linha, i) => {
    const n = i + 1;
    // Ja' traduzido: nao reextrair (o t("...") ja' esta' tratado).
    if (/\bt\(\s*"/.test(linha)) return;

    for (const attr of ATRIBUTOS) {
      const re = new RegExp(`${attr}="([^"]{2,90})"`, "g");
      let m;
      while ((m = re.exec(linha))) regista(m[1], `  ${attr}`, n);
    }

    // Texto entre tags. Cuidado com `=>` (uma seta de arrow function tambem
    // tem `>`): por isso o texto tem de comecar por letra, numero ou aspa —
    // nunca por um simbolo de codigo.
    const reTexto = />([A-Za-zÀ-ÿ0-9"'«(][^<>{}]{1,89})/g;
    let m;
    while ((m = reTexto.exec(linha))) regista(m[1], "  texto", n);

    // Confirmacoes e mensagens em codigo: uma frase acabada em ponto.
    const reCodigo = /"([^"\n]{6,90}[.!?…])"/g;
    while ((m = reCodigo.exec(linha))) regista(m[1], "  codigo", n);
  });

  return achados;
}

// Ficheiros a processar.
const ficheiros = [];
if (pedido) {
  const directos = [
    path.join("web/src/pages", pedido),
    path.join("web/src/components", pedido),
    path.join("web/src/settings", pedido),
    pedido,
  ];
  const achado = directos.find((f) => fs.existsSync(path.join(RAIZ, f)));
  if (!achado) {
    console.error("  nao encontrei " + pedido);
    process.exit(1);
  }
  ficheiros.push(achado);
} else {
  for (const p of PASTAS) {
    const dir = path.join(RAIZ, p);
    if (!fs.existsSync(dir)) continue;
    for (const nome of fs.readdirSync(dir)) {
      if (/\.jsx?$/.test(nome)) ficheiros.push(path.join(p, nome));
    }
  }
}

const resultados = [];
for (const rel of ficheiros) {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) continue;
  const achados = extrair(fs.readFileSync(abs, "utf8"));
  if (achados.size) {
    resultados.push({
      ficheiro: rel,
      itens: [...achados.entries()].map(([texto, r]) => ({ texto, ...r })),
    });
  }
}

resultados.sort((a, b) => b.itens.length - a.itens.length);

let total = 0;
for (const { ficheiro, itens } of resultados) {
  const lista = SO_FALTAM ? itens.filter((i) => !jaTraduzidas.has(i.texto)) : itens;
  if (!lista.length) continue;
  console.log("");
  console.log("== " + ficheiro.split("/").pop() + "  (" + lista.length + "/" + itens.length + ")");
  for (const it of lista) {
    total++;
    const linha = [...it.linhas][0];
    console.log("  L" + String(linha).padStart(4) + "  " + it.texto);
  }
}
console.log("");
console.log("  " + total + " textos" + (SO_FALTAM ? " por traduzir" : " no interface"));