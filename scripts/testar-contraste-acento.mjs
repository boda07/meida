// Teste do rácio de contraste do texto de destaque (--accent-text) sobre o fundo.
//
// Sao duas linhas: calcular o rácio a partir da cor escolhida e avisar se ficar
// abaixo de 4,5:1 (WCAG 2.1 AA, texto normal). Hoje o acento e' livre e e' o
// texto que tem de se aguentar.
//
// `luminancia`, `contraste`, `textoAcento` e `precisaAviso` sao puras e
// testadas diretamente. O `useEffect` do contexto chama esta cadeia e escreve
// `avisoAcento`; como nao ha jsdom nem testing-library, o aviso em si testa-se
// por mutacao (tirar o shade() ou inverter a decisao faz o teste falhar).
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD = path.join(RAIZ, "web", "src", "settings", "acento.js");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

const {
  luminancia,
  contraste,
  textoAcento,
  precisaAviso,
} = await import(
  "file:///" + MOD.replace(/\\/g, "/") + "?v=" + Date.now()
);

// ---------- 1) luminancia ----------
console.log("");
console.log("  1) luminancia relativa (WCAG 2.1)");
ok_("preto e' quase zero", luminancia("#000000") < 0.05);
ok_("branco e' 1", Math.abs(luminancia("#ffffff") - 1) < 0.001);
ok_("cinzento medio (128) fica a meio", Math.abs(luminancia("#808080") - 0.22) < 0.01);
ok_("vermelho e' mais escuro que o verde para a mesma luz",
  luminancia("#ff0000") < luminancia("#00ff00"),
  "vermelho=" + luminancia("#ff0000").toFixed(3) + " verde=" + luminancia("#00ff00").toFixed(3));

// ---------- 2) contraste ----------
console.log("");
console.log("  2) razao de contraste");
ok_("branco sobre preto e' 21:1", Math.abs(contraste("#ffffff", "#000000") - 21) < 0.01);
ok_("a ordem nao importa", contraste("#000000", "#ffffff") === contraste("#ffffff", "#000000"));
ok_("cores iguais dao 1:1", Math.abs(contraste("#c90303", "#c90303") - 1) < 0.001);

// ---------- 3) texto de destaque ----------
console.log("");
console.log("  3) o acento escolhido e' legível sobre o fundo");
const fundo = "#070708"; // fundo por omissao
ok_("branco sobre o fundo por omissao passa",
  contraste(textoAcento("#ffffff"), fundo) >= 4.5);
ok_("vermelho por omissao clareado 35% passa (medido ~5,46:1)",
  contraste(textoAcento("#c90303"), fundo) >= 4.5,
  "ra=" + contraste(textoAcento("#c90303"), fundo).toFixed(2));
ok_("preto puro sobre o fundo NAO passa",
  contraste(textoAcento("#000000"), fundo) < 4.5);
ok_("cor igual sobre si mesma NAO passa",
  contraste(textoAcento("#c90303"), "#c90303") < 4.5);

// ---------- 4) a decisao de aviso ----------
console.log("");
console.log("  4) quando se deve avisar");
ok_("raio 4.0 (abaixo de 4,5) avisa", precisaAviso(4.0) === true);
ok_("raio 4.5 (no limite) NAO avisa", precisaAviso(4.5) === false);
ok_("raio 5.0 (acima) NAO avisa", precisaAviso(5.0) === false);

/* ---------- MUTACOES ---------- */
// Um teste que passa porque o codigo esta certo nao prova nada. Parte-se o
// codigo de proposito e confirma-se que o teste o apanha.
// A copia mutada importa este mesmo ficheiro, cortado aqui (antes do array),
// e aponta para o ficheiro partido via `const MOD = ...`.

const MUTACOES = [
  [
    "textoAcento deixa de clarear (devolve o acento cheio)",
    "  return shade(accent || \"#c90303\", 0.35);",
    "  return accent || \"#c90303\";",
  ],
  [
    "inverter a decisao do aviso (avisa quando ja esta bem)",
    "  return ratio < CONTRASTE_MINIMO;",
    "  return ratio > CONTRASTE_MINIMO;",
  ],
];

const fs = await import("node:fs");
const original = fs.default.readFileSync(MOD, "utf8");
const originalLf = original.replace(/\r\n/g, "\n");

for (const [nome, de, para] of MUTACOES) {
  if (!originalLf.includes(de)) {
    ok_("MUTACAO " + nome + " (o codigo mudou, a mutacao nao aplica)", false);
    continue;
  }
  const dirMut = fs.default.mkdtempSync(path.join(RAIZ, "scripts", ".mut-"));
  const modMut = path.join(dirMut, "acento.js");
  fs.default.writeFileSync(modMut, originalLf.replace(de, para));

  const CAUDA =
    "\nconsole.log('');\n" +
    "console.log('  ' + ok + ' ok, ' + falhou + ' falha(s)');\n" +
    "process.exit(falhou ? 1 : 0);\n";
  const testeMut = path.join(dirMut, "t.mjs");
  fs.default.writeFileSync(
    testeMut,
    fs.default
      .readFileSync(path.join(RAIZ, "scripts", "testar-contraste-acento.mjs"), "utf8")
      .split("/* ---------- MUTACOES ---------- */")[0]
      .replace(/const MOD = [^\n]+;/, 'const MOD = ' + JSON.stringify(modMut) + ";")
      .replace(/const RAIZ = [^\n]+;/, 'const RAIZ = ' + JSON.stringify(RAIZ) + ";") + CAUDA
  );

  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [testeMut], { encoding: "utf8" });
  const saida = (r.stdout || "") + (r.stderr || "");
  const apanhou = r.status !== 0 && /FALHA/.test(saida);
  ok_("MUTACAO apanhada: " + nome, apanhou);

  if (!apanhou) {
    console.log("        (status " + r.status + ") " + saida.split(/\r?\n/).filter((l) => l.trim()).slice(-4).join(" | ").slice(0, 150));
  }

  fs.default.rmSync(dirMut, { recursive: true, force: true });
}

fs.default.writeFileSync(MOD, original); // restaura sempre

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);

/* ---------- MUTACOES ---------- */
