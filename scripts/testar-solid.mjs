// Guarda a regra DIP do AGENTS.md: **páginas e componentes não falam com o
// `localStorage`, com a rede nem com listeners globais.** Isso vive nos ganchos
// (`web/src/components/use*.js`) e na camada de dados (`web/src/storage/`).
//
// PORQUE É UM TESTE E NÃO SÓ ESLINT: o `addEventListener` não se restringe por
// nome de propriedade (é um método do elemento), e o ESLint não conhece a
// convenção deste repo. O teste varre o texto e diz o ficheiro e a linha.
//
// Excepção: `// solid-ok: motivo` na linha de cima (mesma convenção do `// i18n`).
// Os comentários são ignorados — um `// localStorage` explicativo não conta.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(process.argv[2] || ".");

let n = 0;
let mau = 0;
function ok(rotulo, cond, extra = "") {
  if (cond) {
    n++;
    console.log("  OK    " + rotulo);
  } else {
    mau++;
    console.log("  FALHA " + rotulo + (extra ? "  -> " + extra : ""));
  }
}

/** Remove comentários, preservando as linhas (para as linhas baterem certo). */
function semComentarios(texto) {
  let saida = "";
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    const d = texto[i + 1];
    if (c === "/" && d === "/") {
      while (i < texto.length && texto[i] !== "\n") i++;
      continue; // o \n fica para a volta seguinte
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < texto.length && !(texto[i] === "*" && texto[i + 1] === "/")) {
        if (texto[i] === "\n") saida += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      saida += c;
      i++;
      while (i < texto.length) {
        const ch = texto[i];
        if (ch === "\\") {
          saida += ch + (texto[i + 1] ?? "");
          i += 2;
          continue;
        }
        saida += ch;
        i++;
        if (ch === quote) break;
      }
      continue;
    }
    saida += c;
    i++;
  }
  return saida;
}

const PADROES = [
  { re: /\b(localStorage|sessionStorage)\b/, nome: "localStorage" },
  { re: /\bfetch\s*\(/, nome: "fetch(" },
  { re: /\b(document|window)\.addEventListener\b/, nome: "addEventListener global" },
];

// Camadas que SÃO donas destas APIs: preferências (`storage/`), sessão
// (`auth/`) e idioma da interface (`i18n/`). Todo o resto de `web/src` é desenho
// e passa pela regra. Antes olhava-se só para `pages/` e `components/`, e as
// pastas novas (`activity/`, `home/`, `library/`, `settings/`, `watchparty/`)
// escapavam — inclusive `activity/fraseAtividade.jsx`.
const IGNORAR = new Set(["auth", "i18n", "storage"]);

function ficheiros(dir) {
  const lista = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORAR.has(e.name)) lista.push(...ficheiros(p));
    } else if (e.name.endsWith(".jsx") && e.name !== "main.jsx") {
      lista.push(p);
    }
  }
  return lista;
}

const ALVOS = ficheiros(join(RAIZ, "web", "src")).filter((f) => statSync(f).isFile());

console.log("");
console.log("  --- solid: páginas e componentes sem acesso directo ---");

let total = 0;
const marcados = [];
for (const f of ALVOS) {
  const bruto = readFileSync(f, "utf8");
  const linhas = bruto.split(/\r?\n/);
  const limpo = semComentarios(bruto).split(/\r?\n/);
  for (let k = 0; k < limpo.length; k++) {
    const linha = limpo[k];
    for (const p of PADROES) {
      if (!p.re.test(linha)) continue;
      const marca = /(^|\s)\/\/\s*solid-ok:/.test(linhas[k - 1] || "");
      if (marca) {
        marcados.push(`${f.replace(RAIZ + "\\", "").replace(/\\/g, "/")}:${k + 1} (${p.nome})`);
        continue;
      }
      total++;
      console.log(
        `  MAU   ${f.replace(RAIZ + "\\", "").replace(/\\/g, "/")}:${k + 1}  ${p.nome}`
      );
      console.log(`         ${linha.trim().slice(0, 120)}`);
      console.log("         -> usa o gancho (use*.js) ou o store (web/src/storage/)");
    }
  }
}

ok(`${ALVOS.length} ficheiros .jsx analisados`, ALVOS.length > 10);
ok("nenhum acesso directo a localStorage/fetch/listeners globais", total === 0, `${total} ocorrência(s)`);
if (marcados.length) {
  console.log("");
  console.log(`  ${marcados.length} excepção(ões) declarada(s) com // solid-ok:`);
  for (const m of marcados) console.log("    " + m);
}

console.log("");
console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);