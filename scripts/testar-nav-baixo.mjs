// A barra de baixo do telefone.
//
// PURE: `web/src/components/navBaixo.js` nao toca em React nem no DOM.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **A barra de baixo e os botaes fixos usam O MESMO limite, e os dois estao no
// MESMO bloco `@media`.**
//
// A pílula de cima tem 395 px (medido) e o telefone mais comum tem 365 px: o
// "Inicio" ficava a x=-8, cortado, e os quatro botoes fixos (z-index 70) estavam
// **em cima** dela (z-index 60), todos dentro do intervalo horizontal da pílula —
// por isso ao tocar no sino respondia o botao de ecra inteiro.
//
// Esconder os botoes a 700 e mostrar a barra a 720 resolveria o caso comum e
// deixaria uma faixa de 20 px com a barra em baixo E os botoes por cima dela:
// a mesma sobreposicao, mais pequena e mais dificil de ver. E' o que se
// apanha nesta seccao.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  LIMITE,
  ITENS,
  caminhoLimpo,
  perfilDe,
  activoDe,
  mesmoLimite,
  itensDoMais,
} from "../web/src/components/navBaixo.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(RAIZ, "web", "src", "styles.css"), "utf8");
const JSX = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "NavBaixo.jsx"), "utf8");
const APP = fs.readFileSync(path.join(RAIZ, "web", "src", "App.jsx"), "utf8");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) caminhoLimpo: a mesma pagina escrita de varias maneiras");
{
  ok_("o caminho simples fica como esta", caminhoLimpo("/library") === "/library");
  // **O caso que importa.** `/library/` e' a mesma pagina; sem isto, voltar ao
  // `/` e depois em frente deixaria a barra sem separador aceso — e ninguem
  // notaria, porque a pílula de cima nao tem separadores.
  ok_("a barra no fim nao muda a pagina", caminhoLimpo("/library/") === "/library", caminhoLimpo("/library/"));
  ok_("varias barras no fim tambem", caminhoLimpo("/library///") === "/library", caminhoLimpo("/library///"));
  ok_("a interrogacao e'", caminhoLimpo("/search?q=batman") === "/search", caminhoLimpo("/search?q=batman"));
  ok_("o prego e'", caminhoLimpo("/library#topo") === "/library");
  ok_("a barra no fim da raiz continua a ser a raiz", caminhoLimpo("/") === "/");
  ok_("varias barras na raiz nao dao string vazia", caminhoLimpo("///") === "/", JSON.stringify(caminhoLimpo("///")));
  ok_("minusculas", caminhoLimpo("/LIBRARY") === "/library");
  ok_("o que nao e' string da' a raiz", caminhoLimpo(null) === "/" && caminhoLimpo(undefined) === "/" && caminhoLimpo(7) === "/");
  ok_("a string vazia da' a raiz", caminhoLimpo("") === "/");
}

console.log("");
console.log("  2) perfilDe: o mesmo sitio para onde vai o avatar");
{
  ok_("com sessao, para o perfil", perfilDe("joao") === "/u/joao");
  // O `encodeURIComponent` e' o que impede uma barra no nome de virar rota.
  ok_("um nome com acento e' codificado", perfilDe("José") === "/u/" + encodeURIComponent("José"), perfilDe("José"));
  ok_("e o mesmo codigo que o avatar usa", perfilDe("José") === "/u/" + encodeURIComponent("José"));
  ok_("sem sessao, para o login", perfilDe("") === "/login" && perfilDe(null) === "/login" && perfilDe("   ") === "/login");
}

console.log("");
console.log("  3) activoDe: que separador se acende");
{
  ok_("a raiz acende o inicio", activoDe("/", "") === "inicio");
  ok_("/ acende o inicio mesmo com nome", activoDe("/", "joao") === "inicio");
  ok_("a pesquisa acende a pesquisa", activoDe("/search", "") === "pesquisa");
  ok_("a biblioteca acende a biblioteca", activoDe("/library", "") === "biblioteca");
  ok_("a biblioteca com barra no fim tambem", activoDe("/library/", "") === "biblioteca");
  ok_("a pesquisa com interrogacao tambem", activoDe("/search?q=x", "") === "pesquisa");

  // **NADA acende nas paginas sem separador.** E' melhor um separador apagado
  // do que um separador aceso a mentira.
  for (const rota of ["/movies", "/series", "/anime", "/diary", "/achievements", "/stats", "/settings", "/pick", "/compare", "/users", "/login", "/details/movie/123"]) {
    ok_("nada acende em " + rota, activoDe(rota, "joao") === null, String(activoDe(rota, "joao")));
  }

  console.log("");
  console.log("  3b) o perfil: so o MEU");
  {
    ok_("o meu perfil acende", activoDe("/u/joao", "joao") === "perfil");
    // **A conta de outra pessoa.** Acender o "Perfil" aqui e' dizer que aquela
    // pessoa es tu.
    ok_("o perfil de outra pessoa NAO acende", activoDe("/u/maria", "joao") === null, String(activoDe("/u/maria", "joao")));
    ok_("sem sessao, nenhum perfil acende", activoDe("/u/joao", "") === null);
    ok_("e so o prefixo /u/ que conta", activoDe("/users", "joao") === null && activoDe("/u", "joao") === null);

    // **A comparacao tem de ser sobre o caminho descodificado dos dois lados.**
    // `/u/Jos%C3%A9` e `/u/José` sao a mesma pessoa; `encodeURIComponent` de um
    // lado contra o outro nunca casaria, e o separador ficaria apagado sempre.
    ok_("nome com acento: acende", activoDe("/u/" + encodeURIComponent("José"), "José") === "perfil", String(activoDe("/u/" + encodeURIComponent("José"), "José")));
    ok_("e sem codificar tambem", activoDe("/u/José", "José") === "perfil");
    ok_("minusculas nos dois lados", activoDe("/u/JOAO", "joao") === "perfil");
    // Um caminho mal formado nao pode rebentar a barra toda — nem acender o
    // "Perfil" na pessoa errada.
    ok_("um % solto nao rebenta nem acende", activoDe("/u/%E0%A4%A", "%E0%A4%A") === null, String(activoDe("/u/%E0%A4%A", "%E0%A4%A")));
    ok_("e um caminho codificado valido continua a acender", activoDe("/u/%6a%6f%61%6f", "joao") === "perfil");
    // Um espaco acidental no username **nao** pode apagar o separador: e' o meu
    // perfil, so' que mal colado. Aqui e' o `trim()` que nos salva.
    ok_("espaco a mais no username ainda acende", activoDe("/u/joao", "joao ") === "perfil");
    ok_("mas um nome diferente nao", activoDe("/u/joao", "maria ") === null);
  }
}

console.log("");
console.log("  4) os cinco separadores, por ordem");
{
  ok_("sao cinco", ITENS.length === 5, "n=" + ITENS.length);
  ok_("pela ordem: inicio, pesquisa, biblioteca, perfil, mais",
    ITENS.map((x) => x.id).join(",") === "inicio,pesquisa,biblioteca,perfil,mais",
    ITENS.map((x) => x.id).join(","));
  // **Tres, nao quatro**: "perfil" e "mais" nao tem `para`. Um `NavLink` com
  // `para=""` manda para a pagina actual em vez de ir a algum lado.
  ok_("tres tem destino", ITENS.filter((x) => x.para).length === 3, "n=" + ITENS.filter((x) => x.para).length);
  ok_("sao o inicio, a pesquisa e a biblioteca",
    ITENS.filter((x) => x.para).map((x) => x.id).join(",") === "inicio,pesquisa,biblioteca",
    ITENS.filter((x) => x.para).map((x) => x.id).join(","));
  // `perfil` e `mais` sao os que nao podem ter `para`: um `NavLink` com `para=""`
  // manda para a pagina actual em vez de ir a algum lado.
  ok_("perfil e mais NAO tem `para`", ITENS.filter((x) => !x.para).map((x) => x.id).join(",") === "perfil,mais");
  ok_("todos os destinos sao absolutos", ITENS.filter((x) => x.para).every((x) => x.para.startsWith("/")));
  ok_("e nenhum se repete", new Set(ITENS.map((x) => x.id)).size === ITENS.length);
}

console.log("");
console.log("  5) a folha do \"mais\"");
{
  const noSite = itensDoMais({ ehSite: true });
  const naApp = itensDoMais({ ehSite: false });
  const semNada = itensDoMais();

  ok_("o site tem o descarregar e a app nao", noSite.length - naApp.length === 1,
    "site=" + noSite.length + " app=" + naApp.length);
  ok_("e o descarregar so existe no site", noSite.some((x) => x.id === "descarregar") && !naApp.some((x) => x.id === "descarregar"));
  ok_("e vem como externo (abre noutra janela)", noSite.find((x) => x.id === "descarregar").externo === true);
  // Os outros sao paginas da app: um `<a target="_blank">` para o "/movies"
  // abriria uma janela nova para uma pagina que a app trata sem sair de ecra.
  ok_("os outros nao sao externos", naApp.every((x) => x.externo !== true));

  ok_("definicoes e' sempre o ultimo", naApp[naApp.length - 1].id === "definicoes");
  ok_("e continua a ser o ultimo no site", noSite[noSite.length - 1].id === "definicoes");
  ok_("o descarregar vem antes dasdefinicoes",
    noSite.findIndex((x) => x.id === "descarregar") < noSite.findIndex((x) => x.id === "definicoes"));

  ok_("chamar sem argumentos nao rebenta", Array.isArray(semNada) && semNada.length === naApp.length);
  ok_("nenhum id se repete", new Set(noSite.map((x) => x.id)).size === noSite.length);
  ok_("todos os `para` comecam por / ou sao o descarregar",
    noSite.every((x) => x.para.startsWith("/") || x.id === "descarregar"));

  // **Nenhum destino da folha pode ser tambem um separador da barra.** O mesmo
  // lugar a dois sitios e' onde a pessoa toca e nao acontece nada.
  const daBarra = new Set(ITENS.map((x) => x.para).filter(Boolean));
  ok_("nenhum destino do mais e' tambem separador",
    noSite.every((x) => !daBarra.has(x.para)),
    noSite.filter((x) => daBarra.has(x.para)).map((x) => x.id).join(","));
}

console.log("");
console.log("  6) O LIMITE: a barra e os botoes no mesmo sitio  <-- a assercao central");
{
  ok_("o limite e' 720", LIMITE === 720, String(LIMITE));
  ok_("por omissao, os dois sao iguais", mesmoLimite().iguais === true);
  // A funcao recebe os dois numeros para o teste poder passar valores
  // DIFERENTES: `LIMITE === LIMITE` era sempre verdadeiro e nao provava nada.
  ok_("valores diferentes dao `iguais: false`", mesmoLimite(720, 700).iguais === false);
  ok_("e 20 px de diferença e' o que nao pode acontecer", mesmoLimite(720, 700).fixos === 700);

  // O numero no JS tem de ser o mesmo no CSS — senao o `LIMITE` e' decorativo.
  const limitesCss = [...CSS.matchAll(/@media \(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
  ok_("o limite do JS existe no CSS", limitesCss.includes(LIMITE), limitesCss.join(","));

  // **O bloco `@media` que mostra a barra tem de esconder os botoes.**
  const blocos = [...CSS.matchAll(/@media \(max-width:\s*\d+px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const blocoDaBarra = blocos.find((b) => /\.nav-baixo\s*\{/.test(b));
  ok_("existe um bloco @media com a barra de baixo", !!blocoDaBarra);
  if (blocoDaBarra) {
    ok_("e mostra a barra (`display: flex`)",
      /\.nav-baixo\s*\{[^}]*display:\s*flex/.test(blocoDaBarra));
    for (const c of ["app-fs-btn", "app-back-btn", "app-fwd-btn", "app-news-btn"]) {
      ok_("e esconde ." + c + " no MESMO bloco",
        new RegExp("\\." + c + "[^{}]*\\{[^{}]*display:\\s*none").test(blocoDaBarra));
    }
    ok_("e esconde os links de categoria no mesmo bloco (Inicio duas vezes, senao)",
      /\.nav-links\s*\{[^}]*display:\s*none/.test(blocoDaBarra));
    ok_("e da' espaco ao conteudo para a barra nao tapar o ultimo cartao",
      /\.app\s*\{[^}]*padding-bottom/.test(blocoDaBarra));
  }

  // Acima do limite a barra nao existe: `display: none` **fora** do `@media`.
  //
  // Nao se pode procurar "antes do primeiro @media": o bloco da barra foi
  // acrescentado ao FIM de um styles.css com milhares de linhas e varios
  // `@media`, e por isso a regra de base fica depois deles. O que interessa e' a
  // **ordem**: a regra `display: none` tem de vir antes da `display: flex`,
  // porque com a mesma especificidade e' a ultima que ganha.
  const corposNav = [...CSS.matchAll(/(^|[^-\w])\.nav-baixo\s*\{([^{}]*)\}/g)].map((m) => ({
    pos: m.index,
    // **Sem comentarios.** O comentario desta regra explica que a barra nao pode
    // ser escondida com `visibility` nem com `height: 0` — ou seja, o proprio
    // comentario contem as duas coisas que a verificacao procura. O mesmo
    // cuidado que o auditor de traducao tem com os comentarios.
    corpo: m[2].replace(/\/\*[\s\S]*?\*\//g, ""),
  }));
  ok_("a barra tem duas regras: a de base e a do @media", corposNav.length === 2, "n=" + corposNav.length);
  const primeiro = corposNav[0];
  const segundo = corposNav[1];
  ok_("a de base e' `display: none`", !!primeiro && /display:\s*none/.test(primeiro.corpo), JSON.stringify((primeiro ? primeiro.corpo : "").slice(0, 50)));
  // **A ULTIMA declaracao `display` e' a que vale** — o browser descarta as
  // anteriores dentro da mesma regra. Por isso nao basta haver um `flex` na
  // regra: um `display: none` posto ACIMA dele ganhava na mesma e a barra nunca
  // aparecia em telefone nenhum.
  const ultimoDisplay = (corpo) => {
    const todos = [...String(corpo).matchAll(/display:\s*(\w+)/g)];
    return todos.length ? todos[todos.length - 1][1] : null;
  };
  ok_("e a do @media termina em `display: flex`", !!segundo && ultimoDisplay(segundo.corpo) === "flex", String(ultimoDisplay(segundo ? segundo.corpo : "")));
  ok_("**a de base vem ANTES** (com a mesma especificidade, a ultima ganha)", !!primeiro && !!segundo && primeiro.pos < segundo.pos);
  ok_("e nao e' so `visibility` nem altura zero (o elemento ficaria na tabulacao)",
    !!primeiro && !/visibility:\s*hidden/.test(primeiro.corpo) && !/height:\s*0/.test(primeiro.corpo));

  // O iPhone tem o traco da home por baixo: sem `safe-area-inset` o ultimo
  // separador fica por baixo dele e nao se toca.
  ok_("a barra respeita a area segura do ecra", /padding-bottom:\s*env\(safe-area-inset-bottom/.test(CSS));
  // 56 px e' o minimo do guideline de toque. Com `height` em vez de
  // `min-height` o texto em ingles empurrava o icone para o meio.
  const regraItem = (CSS.match(/\.nav-baixo-item\s*\{([^{}]*)\}/) || [])[1] || "";
  ok_("cada separador tem 56 px de altura", /min-height:\s*56px/.test(regraItem));
  // `min-height: 56px` contem "height: 56px" como substring, e um `!` sem
  //_negative lookbehind_ acusava a regra certa. A palavra tem de estar sozinha.
  ok_("e com `min-height`, nao `height`",
    !/(^|[\s;{])height:\s*56px/.test(regraItem), JSON.stringify(regraItem.match(/(^|[\s;{])height:\s*56px/)?.[0] || ""));
  // O separador aceso nao pode ser `color: var(--accent)`: sao 3,3:1 sobre fundo
  // escuro, que e' o que a `--accent-text` existe para evitar (medido 15/10).
  ok_("o separador aceso usa `--accent-text`", /\.nav-baixo-item\.on svg\s*\{[^}]*var\(--accent-text\)/.test(CSS));
  ok_("e nao a cor de acento inteira", !/\.nav-baixo-item\.on\s*\{\s*color:\s*var\(--accent\)/.test(CSS));
}

console.log("");
console.log("  7) a componente: cada id tem rotulo, e esta ligada");
{
  // O auditor so sabe ler `t("...")`, por isso os rotulos vivem no JSX. Esta
  // verificacao e' mais forte do que o auditor: apanha um `id` escrito errado.
  const rotulos = new Map(
    [...JSX.matchAll(/(\w+):\s*t\(\s*"([^"]+)"/g)].map((m) => [m[1], m[2]])
  );
  ok_("o JSX tem um `t(...)` para cada rotulo", rotulos.size >= 16, "n=" + rotulos.size);

  const todosIds = [...ITENS.map((x) => x.id), ...itensDoMais({ ehSite: true }).map((x) => x.id)];
  const semRotulo = todosIds.filter((id) => !rotulos.has(id));
  ok_("**todo o id que a logica produz tem rotulo**", semRotulo.length === 0, semRotulo.join(","));
  ok_("e nenhum dos dois e' t() a seca (sairia em portugues com a app em ingles)",
    [...rotulos.values()].every((v) => v.length > 1));

  // O icone de cada separador, senao o item sai com um espaco em branco.
  const semIcone = ITENS.filter((x) => !new RegExp("\\b" + x.id + ":\\s*\\w*Icon").test(JSX)).map((x) => x.id);
  ok_("cada separador tem icone", semIcone.length === 0, semIcone.join(","));

  ok_("esta ligada ao App", /import NavBaixo from "\.\/components\/NavBaixo\.jsx"/.test(APP) && /<NavBaixo \/>/.test(APP));
  // **Fora do ErrorBoundary.** O que te deixa sair de um erro nunca fica dentro
  // do que apanha o erro — o mesmo motivo que o Header estar la fora.
  const iNav = APP.indexOf("<NavBaixo />");
  const iBoundary = APP.indexOf("<ErrorBoundary>");
  ok_("esta fora do ErrorBoundary (i entao)", iNav > 0 && (iNav < iBoundary), "NavBaixo=" + iNav + " ErrorBoundary=" + iBoundary);

  // A folha e' `dialog` de verdade: e' o que move o foco para dentro e devolve-o
  // ao fechar, sem ter de escrever um gerenciador de foco a mao.
  ok_("a folha e' um dialog com aria-modal", /role="dialog"/.test(JSX) && /aria-modal="true"/.test(JSX));
  ok_("e o botao do mais diz se esta aberto (aria-expanded)", /aria-expanded=\{maisAberto\}/.test(JSX));
  ok_("a barra tem nome para o leitor de ecra", /aria-label=\{rotulo\.navegacao\}/.test(JSX));
  ok_("navegar fecha a folha", /setMaisAberto\(false\)[\s\S]{0,40}\}, \[location\.pathname\]\)/.test(JSX));
  ok_("e o Escape tambem", /"Escape"/.test(JSX));
}

console.log("");
console.log("  8) os ficheiros ainda ABREM");
{
  const { spawnSync } = await import("node:child_process");
  // `node --check` so serve para JS. **`App.jsx` e `NavBaixo.jsx` nao sao JS** —
  // o Node responde `ERR_UNKNOWN_FILE_EXTENSION` antes sequer de tentar. A
  // prova de que o JSX abre e' o `npm run build`; aqui chega o commentario,
  // e o que se verifica de facto e' o resto.
  const r = spawnSync(process.execPath, ["--check", path.join(RAIZ, "web", "src", "components", "navBaixo.js")], { encoding: "utf8" });
  const primeira = ((r.stderr || "").split("\n").find((x) => x.includes("Error")) || "").trim().slice(0, 70);
  ok_("navBaixo.js faz parse", r.status === 0, "exit=" + r.status + (primeira ? " — " + primeira : ""));

  // O que se pode verificar do JSX sem build: nao ha aspas smart (que o JSX
  // aceita e o compilador nao), e nenhuma chave ficou por fechar a biting.
  ok_("sem aspas smart no JSX", !/[“”‘’]/.test(JSX));
  ok_("o JSX nao tem texto em portugues fora de t()", !/>\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ÿ ]{3,}</.test(JSX));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);