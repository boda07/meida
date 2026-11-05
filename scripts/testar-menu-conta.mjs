// O menu do icone de conta — sobretudo o que se ve SEM sessao.
//
// O bug que isto guarda: o icone era um link directo para /login, portanto quem
// nao tinha conta nao tinha caminho NENHUM para /settings (as Definicoes nao
// pedem login; as seccoes que precisam mostram "Entra para..."). Agora o
// mesmo icone abre um menu com Entrar, Criar conta e Definicoes.
//
// Este teste le o componente (nao o monta): o que interessa aqui e' a
// EXISTENCIA dos tres destinos no ramo sem sessao e o facto de o menu nao
// voltar a ser um link unico. Para o resto (abrir/fechar, clicar fora) ve o
// `testar-nav-baixo.mjs`, que tem o mesmo padrao de fora-para-dentro.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LER = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const MENU = LER("web/src/components/ProfileMenu.jsx");
const TRAD = LER("web/src/i18n/traducoes.js");

let n = 0;
let falhou = 0;
function ok(nome, cond, extra = "") {
  if (cond) {
    n += 1;
    console.log("  OK    " + nome);
  } else {
    falhou += 1;
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
  }
}

/* ---------- 1) O menu existe nos dois estados ---------- */

console.log("  1) um so' menu, com e sem sessao");
ok(
  "sem `if (!user) return` (o icone ja' nao e' um link unico)",
  !/if\s*\(\s*!user\s*\)/.test(MENU)
);
ok(
  "o gatilho e' um <button> com aria-expanded",
  /<button[\s\S]{0,220}aria-expanded=\{open\}/.test(MENU)
);
ok(
  "o gatilho muda de avatar para icone conforme a sessao",
  /className=\{user \? "avatar" : "icon-btn"\}/.test(MENU)
);

/* ---------- 2) Sem sessao: os tres destinos ---------- */

console.log("  2) sem sessao: entrar, registar e definicoes");
// O ramo sem sessao e' o `) : (` depois do ramo com utilizador.
const posRamo = MENU.indexOf(") : (");
ok("ha' um ramo para quem nao tem sessao", posRamo > -1);
const semSessao = posRamo > -1 ? MENU.slice(posRamo) : "";

ok("tem Entrar -> /login", /to="\/login"[\s\S]{0,80}t\("Entrar"\)/.test(semSessao));
ok("tem Criar conta -> /register", /to="\/register"[\s\S]{0,80}t\("Criar conta"\)/.test(semSessao));
ok("tem Definicoes -> /settings", /to="\/settings"[\s\S]{0,80}t\("Definições"\)/.test(semSessao));

/* ---------- 3) Com sessao: o menu de sempre nao se perdeu ---------- */

console.log("  3) com sessao: o menu de sempre");
ok("continuam as Definicoes", /to="\/settings"/.test(MENU));
ok("continua o Sair", /t\("Sair"\)/.test(MENU));
ok(
  "sair fecha o menu antes de terminar a sessao (senao ficava aberto)",
  /setOpen\(false\);\s*logout\(\);/.test(MENU)
);

/* ---------- 4) As etiquetas estao traduzidas ---------- */

console.log("  4) traducao das etiquetas novas");
for (const texto of ["Entrar", "Criar conta", "Definições"]) {
  ok(`"${texto}" usa t(...)`, MENU.includes(`t("${texto}")`));
  const ocorrencias = TRAD.split(`"${texto}":`).length - 1;
  ok(`"${texto}" existe no dicionario (pt e en)`, ocorrencias >= 2, `${ocorrencias} ocorrencia(s)`);
}

/* ---------- 5) Fechar ao clicar fora continua ligado ---------- */

console.log("  5) fechar ao clicar fora");
ok(
  "o listener de mousedown continua",
  /document\.addEventListener\("mousedown"/.test(MENU) &&
    /setOpen\(false\)/.test(MENU)
);

/* ---------- Resumo ---------- */

console.log(`\n${n} ok, ${falhou} falha(s)`);
process.exitCode = falhou ? 1 : 0;
