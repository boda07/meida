// O botao da velocidade tinha o proprio triangulo do play dentro do SVG, com
// as linhas e o "1x" desenhados por cima. O resultado eram dois desenhos
// sobrepostos — um deles igual ao botao de play — e o utilizador via "um
// icone que parece um play" junto com o texto.
//
// A correcao e' o botao mostrar apenas o multiplicador (1x, 1.5x, 2x): nao ha'
// nada que se possa confundir com play. Este teste le o componente e o CSS e
// falha se o triangulo voltar, se o multiplicador desaparecer ou se o botao
// deixar de ciclar as quatro velocidades.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PC = path.join(RAIZ, "web", "src", "components", "PlayerControls.jsx");
const CSS = path.join(RAIZ, "web", "src", "styles.css");
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

const pc = fs.readFileSync(PC, "utf8");
const css = fs.readFileSync(CSS, "utf8");

// O bloco da funcao IconVelocidade: do `function` ate' ao proximo `function`
// do modulo. Tudo o que la' estiver e' o que o botao desenha.
function blocoVelocidade(src) {
  const inicio = src.indexOf("function IconVelocidade");
  if (inicio === -1) return "";
  const resto = src.slice(inicio + "function IconVelocidade".length);
  const fim = resto.indexOf("\nfunction ");
  return fim === -1 ? src.slice(inicio) : src.slice(inicio, inicio + "function IconVelocidade".length + fim);
}

const bloco = blocoVelocidade(pc);

console.log("  1) o icone da velocidade nao tem o desenho do play");
ok_("o bloco IconVelocidade existe", bloco.length > 0);
ok_("nao tem <svg>", !/<svg/i.test(bloco));
ok_("nao tem <polygon> (o triangulo)", !/<polygon/i.test(bloco));
ok_("nao tem o triangulo do play nos points", !/5\s+3\s+19\s+12\s+5\s+21/.test(bloco));
ok_("nao tem <path>", !/<path/i.test(bloco));
ok_("nao usa o IconPlay", !bloco.includes("IconPlay"));
ok_(
  "mostra o multiplicador como texto",
  /<span className="pc-velocidade">\{velocidade\}x<\/span>/.test(bloco),
  bloco.trim().slice(0, 120)
);

// O play verdadeiro continua a existir: o teste nao pode passar so' porque
// alguem apagou o triangulo de toda a app.
ok_("o play verdadeiro continua a existir", /M8 5v14l11-7z/.test(pc));

console.log("  2) o botao continua a ciclar as velocidades");
ok_("as quatro velocidades estao la", /VELOCIDADES = \[0\.5, 1, 1\.5, 2\]/.test(pc));
ok_("o botao chama alternarVelocidade", /onClick=\{alternarVelocidade\}/.test(pc));
ok_(
  "o title e o aria-label dizem Velocidade",
  pc.includes('x${velocidade} ${t("Velocidade")}') &&
    (pc.match(/x\$\{velocidade\} \$\{t\("Velocidade"\)\}/g) || []).length >= 2
);

console.log("  3) o CSS do multiplicador");
ok_("existe .pc-velocidade", /\.pc-velocidade\s*\{/.test(css));
ok_(
  "usa numeros tabulares (o 1x nao salta para 1.5x)",
  /\.pc-velocidade\s*\{[^}]*font-variant-numeric:\s*tabular-nums/.test(css)
);
ok_("nao esconde o texto", !/\.pc-velocidade\s*\{[^}]*display:\s*none/.test(css));
ok_("o botao continua com 34x34", /\.pc-btn\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/.test(css));

console.log("  4) mutacoes");
{
  const casos = [
    {
      nome: "o triangulo do play volta ao icone",
      fonte: pc,
      mutar: (s) =>
        s.replace(
          '<span className="pc-velocidade">{velocidade}x</span>',
          '<svg><polygon points="5 3 19 12 5 21" /><text>{velocidade}x</text></svg>'
        ),
      passa: (s) => !/<polygon/i.test(blocoVelocidade(s)),
    },
    {
      nome: "o multiplicador deixa de ser mostrado",
      fonte: pc,
      mutar: (s) => s.replace('className="pc-velocidade">{velocidade}x<', 'className="pc-velocidade">x<'),
      passa: (s) => blocoVelocidade(s).includes("{velocidade}x"),
    },
    {
      nome: "a classe do CSS desaparece do span",
      fonte: pc,
      mutar: (s) => s.replace('className="pc-velocidade"', 'className=""'),
      passa: (s) => /className="pc-velocidade"/.test(blocoVelocidade(s)),
    },
    {
      nome: "a regra .pc-velocidade desaparece do CSS",
      fonte: css,
      mutar: (s) => s.replace(/\.pc-velocidade\s*\{[^}]*\}/, ""),
      passa: (s) => /\.pc-velocidade\s*\{/.test(s),
    },
  ];

  for (const c of casos) {
    const mutado = c.mutar(c.fonte);
    if (mutado === c.fonte) {
      console.log("  FALHA MUTACAO IMPOSSIVEL (o texto mudou): " + c.nome);
      falhou++;
      continue;
    }
    if (c.passa(mutado)) {
      console.log("  FALHA MUTACAO NAO DETECTADA: " + c.nome);
      falhou++;
    } else {
      console.log("  OK    MUTACAO apanhada: " + c.nome);
      ok++;
    }
  }
}

console.log("  5) higiene");
for (const [nome, texto] of [
  ["PlayerControls.jsx", pc],
  ["styles.css", css],
  ["testar-icone-velocidade.mjs", fs.readFileSync(ESTE, "utf8")],
]) {
  ok_(nome + " sem CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(texto));
  ok_(nome + " sem caractere de substituicao", !texto.includes("\uFFFD"));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
