// Prova a regra de `web.js`: quando e' que o botao "descarregar a app" aparece.
//
// Nao ha `window` nem `location` aqui: `ehVersaoWeb()` recebe o que precisa
// como argumento. E' o que torna a regra testavel sem um browser.
//
// A mutacao no fim e' o que da valor a este ficheiro: um teste que passa
// porque o codigo esta' certo nao prova nada — prova que o codigo esta' certo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ehVersaoWeb, URL_RELEASE } from "../web/src/lib/web.js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

let ok = 0;
let falhou = 0;

function ok_(nome, condicao) {
  if (condicao) {
    ok++;
    console.log("  OK    " + nome);
  } else {
    falhou++;
    console.log("  FALHA " + nome);
  }
}

/* ---------- 1) A app de desktop: NUNCA aparece ---------- */

// Electron com dados LOCAIS (o default da app).
ok_(
  "app de desktop em modo local nao mostra",
  ehVersaoWeb({ electronAPI: { appVersion: () => "1.4.0" }, hostname: "" }) === false
);

// Electron em modo "remoto", apontando ao servidor partilhado. E' o caso em que
// `MEIDA_REMOTE_DATA_BASE` esta' preenchido — ou seja, o `runtime-config` nao
// serviria para distinguir, porque a app e' que vai buscar a configuracao ao
// processo principal. Ainda assim nao ha botao, porque e' a app.
ok_(
  "app de desktop em modo remoto nao mostra",
  ehVersaoWeb({ electronAPI: {}, hostname: "meida.onrender.com" }) === false
);

/* ---------- 2) O site hospedado: SEMPRE mostra ---------- */

ok_("render mostra", ehVersaoWeb({ hostname: "meida.onrender.com" }) === true);
ok_("qualquer outro dominio mostra", ehVersaoWeb({ hostname: "exemplo.pt" }) === true);
ok_("dominio com www mostra", ehVersaoWeb({ hostname: "www.meida.pt" }) === true);

/* ---------- 3) Desenvolvimento local: NUNCA mostra ---------- */
// Sem isto, quem esta' a desenvolver via o botao no ecra e vai parar ao site
// publico em vez do que tem a frente.

ok_("localhost nao mostra", ehVersaoWeb({ hostname: "localhost" }) === false);
ok_("localhost com porta nao mostra", ehVersaoWeb({ hostname: "localhost:5173" }) === false);
ok_("127.0.0.1 nao mostra", ehVersaoWeb({ hostname: "127.0.0.1" }) === false);
ok_("127.0.0.1 com porta nao mostra", ehVersaoWeb({ hostname: "127.0.0.1:8080" }) === false);
ok_("ipv6 ::1 nao mostra", ehVersaoWeb({ hostname: "::1" }) === false);
ok_("ipv6 com porta nao mostra", ehVersaoWeb({ hostname: "[::1]:5173" }) === false);

// Electron E localhost na mesma: qualquer um dos dois chega para esconder.
ok_(
  "electron em localhost nao mostra",
  ehVersaoWeb({ electronAPI: {}, hostname: "localhost" }) === false
);

/* ---------- 4) Casos limpos ---------- */

// Sem informacao nenhuma: esconde. Preferimos um botao a menos a um botao
// errado (que aponta para o site publico de quem esta' a testar).
ok_("sem hostname nao mostra", ehVersaoWeb({}) === false);
ok_("sem argumentos nao mostra", ehVersaoWeb() === false);

// Maiusculas/minusculas: `LOCALHOST` e' o mesmo host.
ok_("LOCALHOST nao mostra", ehVersaoWeb({ hostname: "LOCALHOST" }) === false);
// O Electron expoe o objecto no `window`, por isso um truthy e' o suficiente.
ok_("electronAPI truthy nao mostra", ehVersaoWeb({ electronAPI: true, hostname: "meida.onrender.com" }) === false);

/* ---------- 5) O link ---------- */

ok_(
  "o link vai para a release do GitHub",
  URL_RELEASE === "https://github.com/boda07/meida/releases/latest"
);

/* ---------- 6) MUTACAO ---------- */
// Se a regra deixar de distinguir a app do site, isto tem de falhar.

console.log("");
const ficheiro = path.join(AQUI, "..", "web", "src", "lib", "web.js");
const fonte = fs.readFileSync(ficheiro, "utf8");

const MUTACOES = [
  ["sem o teste do Electron",
    "if (electronAPI) return false;",
    "if (false) return false;"],
  ["sem o teste do localhost",
    "if (host === \"localhost\" || host === \"127.0.0.1\" || host === \"::1\") {",
    "if (false) {"],
];

for (const [i, [nome, de, para]] of MUTACOES.entries()) {
  if (!fonte.includes(de)) {
    console.log("  *** MUTACAO IMPOSSIVEL: " + nome + " (o codigo mudou) ***");
    falhou++;
    continue;
  }
  // O ficheiro vai para a pasta temporaria do SISTEMA, nunca para `web/src`:
  // ai o `eslint` do `npm run build` o apanhava a meio (uma corrida anterior
  // deixou `web/src/lib/_mut-web.mjs` com tres erros), e um teste nao pode
  // partir o codigo que esta' a testar.
  //
  // O nome tem de ser UNICO por iteracao: o `import()` do Node guarda em cache
  // pelo URL, e com o mesmo nome a segunda mutacao receberia a primeira versao
  // (ou seja, nao seria testada).
  const tmp = path.join(os.tmpdir(), "meida-mut-web-" + process.pid + "-" + i + ".mjs");
  let partido;
  try {
    fs.writeFileSync(tmp, fonte.replace(de, para));
    partido = (await import("file:///" + tmp.replace(/\\/g, "/"))).ehVersaoWeb;
  } catch (e) {
    console.log("  *** MUTACAO NAO APLICAVEL: " + nome + " (" + e.message + ") ***");
    falhou++;
    continue;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  if (typeof partido !== "function") {
    console.log("  *** MUTACAO NAO APLICAVEL: " + nome + " ***");
    falhou++;
    continue;
  }

  // A mutacao tem de partir pelo menos um caso de "nao mostra".
  const casos = [
    partido({ electronAPI: {}, hostname: "meida.onrender.com" }) === false,
    partido({ hostname: "localhost:5173" }) === false,
  ];
  const partedAlgum = casos.some((c) => !c);
  if (!partedAlgum) {
    console.log("  *** MUTACAO NAO DETECTADA: " + nome + " ***");
    falhou++;
  } else {
    console.log("  MUTACAO (" + nome + "): o botao passava a aparecer onde nao deve — o teste apanha");
    ok++;
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);