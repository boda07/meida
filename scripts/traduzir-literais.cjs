// Substitui literais exactos por {t("...")} num ficheiro.
//
// Mais seguro que regex: compara o texto byte a byte, por isso nunca toca no
// que nao e' literalmente igual. E' o que permite processar 300 textos sem
// medo de partir um ficheiro.
//
// COMO CORRER:
//   node scripts/traduzir-literais.cjs <ficheiro> <ficheiro-de-pares>
//
// O ficheiro de pares tem uma linha por texto:
//   PT|||EN
// (o separador ||| existe porque o texto pode conter |)
const fs = require("node:fs");

const [, , ficheiro, ficheiroPares] = process.argv;
if (!ficheiro || !ficheiroPares) {
  console.error("uso: node scripts/traduzir-literais.cjs <ficheiro.jsx> <pares.txt>");
  process.exit(1);
}

const caminho = ficheiro.includes("/") ? ficheiro : "web/src/pages/" + ficheiro;
if (!fs.existsSync(caminho)) {
  console.error("  nao existe: " + caminho);
  process.exit(1);
}

const pares = fs
  .readFileSync(ficheiroPares, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const i = l.indexOf("|||");
    return i < 0 ? null : { pt: l.slice(0, i), en: l.slice(i + 3) };
  })
  .filter(Boolean);

// As funcoes que recebem uma mensagem de estado. Nao ha' lista completa — esta
// cobre as usadas na app; o que sobrar aparece nos "nao encontrados".
const CHAMADORES = [
  "setMsg", "setErro", "setError", "setNotice", "setInfo", "setToast",
  "setHint", "setTxt", "setLabel", "setCaption", "setTitle", "setNota",
  "showToast", "toast", "alertError",
  "setSrvMsg", "setExportMsg", "setImportMsg", "setUpdMsg", "setMalMsg",
  "setSynMsg", "setDebridMsg", "setDiscordMsg", "setWarn",
];

let src = fs.readFileSync(caminho, "utf8");
let aplicadas = 0;
const naoEncontradas = [];
const jaTraduzidas = [];

for (const { pt } of pares) {
  // Ja' envolvido em t()? conta como feito, nao toca.
  if (src.includes(`t("${pt}")`) || src.includes(`t('${pt}')`)) {
    jaTraduzidas.push(pt);
    continue;
  }

  // Casos por ordem: o mais especifico primeiro, para nao substituir um
  // pedaco de um texto maior.
  const casos = [
    // title="X", aria-label="X", placeholder="X", alt="X"
    [`="${pt}"`, `={t("${pt}")}`],
    // <span>X</span> — so' entre tags, com texto puro dos dois lados
    [`>${pt}<`, `>{t("${pt}")}<`],
  ];

  let feito = false;
  // 1) Atributos: title="X", aria-label="X", placeholder="X", alt="X".
  //    NOTA: isto apanha tambem `value="X"` e strings em expressoes, que e'
  //    exactamente o que se quer nestas paginas.
  for (const attr of ["title", "aria-label", "placeholder", "alt"]) {
    const de = attr + '="' + pt + '"';
    if (!src.includes(de)) continue;
    src = src.split(de).join(attr + '={t("' + pt + '")}');
    aplicadas++;
    feito = true;
    break;
  }
  if (feito) continue;

  // 2) Texto entre tags: >X<  (so' texto puro dos dois lados).
  if (src.includes(">" + pt + "<")) {
    src = src.split(">" + pt + "<").join(">{t(\"" + pt + "\")}<");
    aplicadas++;
    feito = true;
  }
  if (feito) continue;

  // 3) Ternario em JSX: cond ? "X" : "Y"  ->  cond ? t("X") : "Y"
  //    IMPORTANTE: consome a aspa de fecho tambem, senao fica `t("X")"` — que
  //    e' sintaxe invalida. E' o bug que a primeira versao tinha.
  if (src.includes('? "' + pt + '"')) {
    src = src.split('? "' + pt + '"').join('? t("' + pt + '")');
    aplicadas++;
    feito = true;
  }
  if (feito) continue;

  // 4) Mensagem em JS: setMsg("X")  ->  setMsg(t("X"))
  for (const chamador of CHAMADORES) {
    const de = chamador + '("' + pt + '"';
    if (!src.includes(de)) continue;
    src = src.split(de).join(chamador + '(t("' + pt + '")');
    aplicadas++;
    feito = true;
    break;
  }
  if (feito) continue;

  // 5) Fallback de um `||`: setMsg(e.message || "X")  ->  setMsg(e.message || t("X"))
  //    E' o ultimo caso porque e' o mais largo: apanha tudo o que estiver numa
  //    string dentro de codigo. Cuidado para nao traduzir o que ja' esta' em t().
  if (src.includes('|| "' + pt + '"')) {
    src = src.split('|| "' + pt + '"').join('|| t("' + pt + '")');
    aplicadas++;
    feito = true;
  }
  if (!feito) naoEncontradas.push(pt);
}

fs.writeFileSync(caminho, src);
console.log(`  ${aplicadas} aplicados, ${jaTraduzidas.length} ja' estavam, ${naoEncontradas.length} nao encontrados  (${caminho})`);
if (naoEncontradas.length) {
  for (const t of naoEncontradas.slice(0, 12)) console.log("    - " + t);
  if (naoEncontradas.length > 12) console.log(`    ... e mais ${naoEncontradas.length - 12}`);
}