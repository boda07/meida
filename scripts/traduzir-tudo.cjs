// Aplica um ficheiro de pares (PT|||EN) a TODOS os ficheiros de interface.
//
// Ao contrario do `traduzir-literais.cjs`, que precisa de um ficheiro de cada
// vez, este le' o mapa uma vez e aplica a todos os ficheiros que encontra.
// O que sobra (nao encontrado) e' impresso por ficheiro, para se saber onde
// falta mexer a mao.
//
// COMO CORRER:
//   node scripts/traduzir-tudo.cjs <pares.txt>
//   node scripts/traduzir-tudo.cjs <pares.txt> --so Settings.jsx
const fs = require("node:fs");
const path = require("node:path");

const [, , ficheiroPares, ...resto] = process.argv;
if (!ficheiroPares) {
  console.error("uso: node scripts/traduzir-tudo.cjs <pares.txt>");
  process.exit(1);
}
const SO = resto.find((a) => a.startsWith("--so="));
const soFich = SO ? SO.slice("--so=".length) : null;

// Os chamadores cujo valor e' uma mensagem de estado (ver traduzir-literais.cjs).
const CHAMADORES = [
  "setMsg", "setErro", "setError", "setNotice", "setInfo", "setToast",
  "setHint", "setTxt", "setLabel", "setCaption", "setTitle", "setNota",
  "showToast", "toast", "alertError",
  "setSrvMsg", "setExportMsg", "setImportMsg", "setUpdMsg", "setMalMsg",
  "setSynMsg", "setDebridMsg", "setDiscordMsg", "setWarn",
];

// O ficheiro de pares tem blocos `# nome.jsx` para separar por pagina, e linhas
// `PT|||EN` soltas (que valem para todas).
const blocos = new Map(); // "Settings.jsx" -> [{pt,en}]
const global = [];
let actual = null;
for (const linha of fs.readFileSync(ficheiroPares, "utf8").split(/\r?\n/)) {
  const t = linha.trim();
  if (!t) continue;
  if (t.startsWith("# ")) {
    actual = t.slice(2).trim();
    if (!blocos.has(actual)) blocos.set(actual, []);
    continue;
  }
  const i = t.indexOf("|||");
  if (i < 0) continue;
  const par = { pt: t.slice(0, i), en: t.slice(i + 3) };
  if (actual) blocos.get(actual).push(par);
  else global.push(par);
}

// Os ficheiros a varrer.
const PASTAS = ["web/src/pages", "web/src/components", "web/src/settings", "web/src/library"];
const ficheiros = [];
if (soFich) {
  for (const p of PASTAS) {
    const c = path.join(p, soFich);
    if (fs.existsSync(c)) ficheiros.push(c);
  }
  if (!ficheiros.length) ficheiros.push(soFich);
} else {
  for (const p of PASTAS) {
    if (!fs.existsSync(p)) continue;
    for (const nome of fs.readdirSync(p)) {
      if (/\.jsx?$/.test(nome)) ficheiros.push(path.join(p, nome));
    }
  }
}

const NAO_ENCONTRADOS = [];
let totalAplicado = 0;

for (const rel of ficheiros) {
  if (!fs.existsSync(rel)) continue;
  let src = fs.readFileSync(rel, "utf8");
  const nome = path.basename(rel);
  const meus = [...global, ...(blocos.get(nome) || [])];
  if (!meus.length) continue;

  let aplicados = 0;
  const naoFound = [];

  for (const { pt } of meus) {
    if (src.includes(`t("${pt}")`) || src.includes(`t('${pt}')`)) continue;

    const casos = [
      [`="${pt}"`, `={t("${pt}")}`],
      [`>${pt}<`, `>{t("${pt}")}<`],
      [`? "${pt}"`, `? t("${pt}")`],
      [`|| "${pt}"`, `|| t("${pt}")`],
    ];
    let feito = false;
    for (const [de, para] of casos) {
      if (!src.includes(de)) continue;
      src = src.split(de).join(para);
      aplicados++;
      feito = true;
      break;
    }
    if (feito) continue;

    for (const c of CHAMADORES) {
      const de = c + `("${pt}"`;
      if (!src.includes(de)) continue;
      src = src.split(de).join(c + `(t("${pt}")`);
      aplicados++;
      feito = true;
      break;
    }
    if (feito) continue;

    // Sem espaco em volta: `{cond && "X"}`, `{algo ? "X" : "Y"}` sem o `? `.
    if (src.includes(`"${pt}"`)) {
      // Ja' tentados os casos com prefixo; este e' o fallback para texto
      // solto dentro de JSX ou JS que nao tem `>` nem `=` nem `?` antes.
      src = src.split(`"${pt}"`).join(`{t("${pt}")}`);
      aplicados++;
      feito = true;
    }
    if (!feito) naoFound.push(pt);
  }

  if (aplicados) {
    fs.writeFileSync(rel, src);
    totalAplicado += aplicados;
    console.log("  " + String(aplicados).padStart(3) + "  " + rel);
  }
  if (naoFound.length) {
    NAO_ENCONTRADOS.push({ nome, naoFound });
  }
}

console.log("");
console.log("  total aplicado: " + totalAplicado);
if (NAO_ENCONTRADOS.length) {
  console.log("  nao encontrados:");
  for (const { nome, naoFound } of NAO_ENCONTRADOS) {
    console.log("    " + nome + ": " + naoFound.join(" | "));
  }
}