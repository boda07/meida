// Apanha o erro do "temporal dead zone" nos ARRAYS DE DEPENDENCIAS dos ganchos
// do React.
//
// Porque e' que isto merece um teste: ja aconteceu DUAS vezes, e das duas o
// resultado foi o ecra "Algo correu mal" ao abrir QUALQUER ficha. A primeira foi
// na v1.1.1 (o `embeds`); a segunda na v1.3.6 (o `active`, meu). Nem o lint nem
// o `npm run build` apanham: o Vite compila isto sem dizer nada, e a app so'
// rebenta quando alguem abre um titulo.
//
// A regra: um ARRAY DE DEPENDENCIAS so' pode citar `const` JA declaradas acima.
// O CORPO do efeito pode usar o que quiser, porque so' corre depois do render —
// por isso `reportPos`, que usa refs no corpo, e' seguro em qualquer sitio. E' o
// array que o React avalia no sitio da chamada, ainda dentro do corpo do
// componente, e dai o
//   ReferenceError: Cannot access 'x' before initialization
//
// Este teste le o ficheiro e compara as posicoes. Nao substitui abrir a app —
// que e' como o bug foi descoberto — mas apanha a proxima vez que alguem
// inserir um efeito acima da declaracao de que depende.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.argv[2] || "web/src";

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}

// Todos os .jsx
const ficheiros = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".jsx")) ficheiros.push(p);
  }
})(RAIZ);

/**
 * @returns {Array<{gancho:number, deps:number, nome:string, declarada:number}>}
 */
function dependenciasTardeDemais(linhas) {
  // 0) Fronteiras de componente. Sem isto ha falsos positivos: `types` esta
  //    declarado dentro de `function Filters()`, e um `useMemo` de OUTRO
  //    componente pode citar `types` sem nenhum problema — sao nomes diferentes.
  //    Um "escopo" novo comeca sempre que comeca um componente.
  const RE_COMPONENTE =
    /^\s*(?:export\s+)?(?:default\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/;
  const RE_COMPONENTE_SETA =
    /^\s*(?:export\s+)?(?:default\s+)?const\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?(?:\(|function\b)/;
  let escopo = 0;

  // 1) Onde e' declarada cada `const`, e em que escopo.
  const declaracoes = new Map(); // nome -> { linha, escopo }
  linhas.forEach((l, k) => {
    // Um componente comeca aqui?
    if (RE_COMPONENTE.test(l) || RE_COMPONENTE_SETA.test(l)) {
      escopo++;
      return;
    }
    if (!/^ {2}const\s/.test(l)) return;
    // Nao e' uma declaracao: e' um `const` de topo (CONFIG, REPO, ...) ou um
    // comentario.
    if (/^ {2}const\s+[A-Z_][A-Z_0-9]*\s*=/.test(l)) return;
    const m = /^ {2}const\s+\[?\s*([A-Za-z_$][\w$]*)/.exec(l);
    if (m) declaracoes.set(m[1], { linha: k + 1, escopo });
  });

  // 2) Os ganchos, com o seu escopo.
  const ganchos = [];
  let escopoGancho = 0;
  linhas.forEach((l, k) => {
    if (RE_COMPONENTE.test(l) || RE_COMPONENTE_SETA.test(l)) {
      escopoGancho++;
      return;
    }
    const m = /^ {2}(?:const\s+\w+\s*=\s*)?use(Effect|Callback|Memo)\(/.exec(l);
    if (m) ganchos.push({ inicio: k + 1, tipo: m[1], escopo: escopoGancho });
  });

  const problemas = [];
  for (const g of ganchos) {
    // Procura a linha de deps para a frente, ate ao proximo gancho (no maximo
    // 200 linhas: um efeito nao deve ser tao grande).
    const limite = ganchos.find((x) => x.inicio > g.inicio)?.inicio ?? linhas.length;
    for (let k = g.inicio; k < Math.min(limite, g.inicio + 200); k++) {
      const t = linhas[k].trim();
      if (!/^(\},\s*\[|\[)/.test(t)) continue;
      if (!/\]\s*\)?\s*;?\s*$/.test(t)) continue;
      const dentro = t.replace(/^\},\s*\[|\[|\]?\s*\)?\s*;?$/g, "");
      for (const nome of dentro.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        const id = nome[1];
        // `details?.x` e' seguro: acesso opcional a um objeto ja inicializado.
        if (id === "details") continue;
        const d = declaracoes.get(id);
        // So' e' problema se for do MESMO componente. Se for de um componente
        // mais para dentro, e' outro nome (o do outro componente).
        if (d && d.escopo === g.escopo && d.linha > g.inicio) {
          problemas.push({
            gancho: g.inicio,
            deps: k + 1,
            nome: id,
            declarada: d.linha,
            tipo: g.tipo,
          });
        }
      }
      break;
    }
  }
  return problemas;
}

let total = 0;
for (const f of ficheiros) {
  const linhas = readFileSync(f, "utf8").split(/\r?\n/);
  const probs = dependenciasTardeDemais(linhas);
  if (!probs.length) continue;
  total += probs.length;
  console.log(`  MAU   ${f}`);
  for (const p of probs) {
    console.log(
      `         use${p.tipo} na L${p.gancho}, deps na L${p.deps}: '${p.nome}' declarado na L${p.declarada} ` +
        `(${p.declarada - p.gancho} linhas depois)`
    );
    console.log(`         -> ReferenceError: Cannot access '${p.nome}' before initialization`);
  }
}

ok(`${ficheiros.length} ficheiros .jsx analisados`, ficheiros.length > 20);
ok("nenhuma dependencia citada antes de ser declarada", total === 0);
if (total) {
  console.log(
    `\n  ${total} problema(s). O sintoma para quem usa a app e' o ecra "Algo correu mal" ao abrir qualquer titulo.`
  );
}
console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);
