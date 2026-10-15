// A barra de pesquisa: quando abre, quando fecha, e o que fica escrito.
//
// O comportamento pedido: escreve-se, a barra volta ao normal com os botoes do
// menu, e tocar outra vez na pesquisa traz o que se escreveu para a poder
// ajustar. Duas coisas que um teste so' de "a barra fecha" nao apanha:
// que o `query` SOBREVIVE ao fecho, e que tocar no botao da propria pesquisa nao
// a fecha (senao fecha no blur e abre no click, a oscilar no mesmo toque).

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { abreAoMontar, fechaNoBlur, textoParaGuardar } from "../web/src/components/headerPesquisa.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) abreAoMontar: so' abre na pagina de pesquisa E sem texto");
{
  ok_("/search sem ?q= abre (e' o convite a escrever)", abreAoMontar("", true) === true);
  ok_("/search?q=onepiece NAO abre", abreAoMontar("onepiece", true) === false);
  // Um `?q=` so com espacos e' o mesmo que nada: `/search?q=%20`.
  ok_("so' espacos e' o mesmo que vazio", abreAoMontar("   ", true) === true);
  ok_("undefined e' o mesmo que vazio", abreAoMontar(undefined, true) === true);
  ok_("null e' o mesmo que vazio", abreAoMontar(null, true) === true);
  ok_("o texto sobrevive ao teste (a funcao nao altera nada)", abreAoMontar("abc", true) === false);

  // O caso que a primeira versao errou: FORA da pagina de pesquisa nao ha
  // `?q=`, o texto e' sempre "", e "sem texto" devolvia true — a barra aparecia
  // aberta em `/` sem a pessoa tocar em nada. Medido no browser.
  ok_("em /, sem texto: NAO abre", abreAoMontar("", false) === false);
  ok_("em /movies, sem texto: NAO abre", abreAoMontar("", false) === false);
  ok_("e o segundo argumento tem de ser explicito", abreAoMontar("onepiece", false) === false);
  ok_("mesmo sem o segundo argumento, nao abre (defensivo)", abreAoMontar("onepiece") === false);
}

console.log("");
console.log("  2) fechaNoBlur: o relatedTarget e' o que separa 'saiu' de 'tocou aqui'");
{
  const form = { contido: true, contains(el) { return el && el.dentroDoForm; } };
  const dentro = { dentroDoForm: true };
  const fora = { dentroDoForm: false };

  ok_("foco para o nada (clique fora) FECHA", fechaNoBlur(null, form) === true);
  ok_("foco para fora do form FECHA", fechaNoBlur(fora, form) === true);
  ok_("foco para DENTRO do form (o botao do icone) NAO fecha", fechaNoBlur(dentro, form) === false);
  ok_("sem form nenhum, fecha na mesma (nao fica presa aberta)", fechaNoBlur(fora, undefined) === true);
  ok_("form sem `contains` nao parte: fecha", fechaNoBlur(fora, {}) === true);
}

console.log("");
console.log("");
console.log("  3) o ciclo completo, como a pessoa usa");
{
  // A barra tem DOIS estados independentes: `aberta` (o que se ve) e
  // `escrito` (o que a pessoa escreveu, que sobrevive ao fecho). E
  // simulados a parte para nao ser so' um teste de funcoes isoladas.
  let aberta = false;
  let escrito = "";
  const abrir = () => { aberta = true; };
  const fechar = () => { aberta = false; };
  const escrever = (v) => { escrito = v; };

  // 1. Toca na pesquisa: abre, e o campo esta' vazio.
  abrir();
  ok_("ao abrir, o campo esta' vazio", aberta && escrito === "");

  // 2. Escreve. A barra fica aberta: e' a pesquisa a vivo.
  escrever("one piece");
  ok_("a barra fica aberta enquanto se escreve", aberta === true);

  // 3. Enter: fecha, e o texto SOBREVIVE.
  fechar();
  ok_("ao carregar Enter a barra fecha", aberta === false);
  ok_("e o que se escreveu fica para a proxima", escrito === "one piece");

  // 4. Toca outra vez: abre COM o texto la dentro.
  abrir();
  ok_("ao tocar outra vez abre de novo", aberta === true);
  ok_("e traz o texto anterior", escrito === "one piece");

  // 5. Apaga tudo e fecha: o texto e' uma pesquisa vazia, nao o anterior.
  escrever("");
  fechar();
  abrir();
  ok_("abre com o campo vazio, para se poder recomecar", aberta === true && escrito === "");

  // 6. Escreve outra vez: o texto novo substitui o apagado.
  escrever("naruto");
  fechar();
  abrir();
  ok_("um texto novo fica, e o apagado nao volta", escrito === "naruto");

  // 7. Fechar NUNCA limpa o texto — e' o que permite corrigir depois.
  fechar();
  ok_("fechar nao apaga o que se escreveu", escrito === "naruto");
}

console.log("");
console.log("  4) textoParaGuardar apara, e nao faz mais nada");
{
  ok_("'  one piece  ' vira 'one piece'", textoParaGuardar("  one piece  ") === "one piece");
  ok_("'One Piece' fica como esta (nao mexemos nas maiusculas)", textoParaGuardar("One Piece") === "One Piece");
  ok_("so' espacos da' string vazia", textoParaGuardar("   ") === "");
  ok_("undefined nao rebenta", textoParaGuardar(undefined) === "");
  ok_("o valor original nao e' alterado (strings sao imutaveis)", textoParaGuardar(" a ") === "a");
}

console.log("");
console.log("  5) o `Header.jsx` usa as funcoes e nao repete a regra");
{
  const h = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "Header.jsx"), "utf8");
  ok_("importa as tres", /import \{ abreAoMontar, fechaNoBlur, textoParaGuardar \} from "\.\/headerPesquisa\.js"/.test(h));
  // O segundo argumento tem de la estar. Sem ele a barra nasce aberta em TODAS
  // as paginas — foi o primeiro erro, apanhado so' no browser.
  ok_("o estado inicial vem de `abreAoMontar`, nao de `onSearchPage`", /useState\(abreAoMontar\(textoNaUrl, onSearchPage\)\)/.test(h));
  // A regra antiga: `onSearchPage` sozinha. E' ela que mantinha a barra aberta
  // depois de escrever, e obrigava a voltar ao menu a tapar no icone.
  ok_("o `useState(onSearchPage)` antigo foi-se", !/useState\(onSearchPage\)/.test(h));
  ok_("o `onBlur` so' fecha se `fechaNoBlur` mandar", /if \(fechaNoBlur\(e\.relatedTarget, e\.currentTarget\.form\)\) setSearchOpen\(false\)/.test(h));
  // A regra antiga do blur: so' fechava com o campo VAZIO.
  ok_("o `!query.trim() && !onSearchPage` antigo foi-se", !/!query\.trim\(\) && !onSearchPage/.test(h));
  // Ao fechar tem de largar o foco, senao o teclado do telefone fica aberto a
  // escrever para um campo de 0 px.
  ok_("fecha o foco ao fechar (o teclado do telefone)", /document\.activeElement === el\) el\.blur\(\)/.test(h));
  ok_("e `submitSearch` fecha a barra", /navigate\(`\/search\?q=\$\{encodeURIComponent\(q\)\}`\);\s*\n\s*\/\/ Fecha para o menu voltar aos botoes[\s\S]{0,200}?setSearchOpen\(false\);/.test(h));
  ok_("e NAO limpa o query ao fechar (e' o que permite acertar depois)", !/setQuery\(""\)/.test(h));

  // Navegar no menu tambem fecha. O `blur` devia chegar para isto, mas depende
  // de o browser mover o foco para o link ao clicar — coisa que num separador
  // escondido nao acontece (medido em 2026-10-14: a barra ficava aberta depois
  // de clicar num link). Fecha-se a mao para nao depender disso.
  ok_("clicar num link do menu fecha a barra", /<nav className="nav-links" onClick=\{\(\) => setSearchOpen\(false\)\}>/.test(h));
}

console.log("");
console.log("  6) o CSS: fechar tem mesmo de mostrar os botoes do menu");
{
  const css = fs.readFileSync(path.join(RAIZ, "web", "src", "styles.css"), "utf8");
  // Se isto deixar de existir, a barra fecha e o menu fica com um vao vazio do
  // tamanho do nav-left — e nenhuma das funcoes acima dá conta.
  ok_(`.pesquisa-aberta encolhe o nav-left a 0`, /\.pesquisa-aberta \.nav-left \{[^}]*width: 0;/.test(css));
  ok_("e esconde (opacity: 0)", /\.pesquisa-aberta \.nav-left \{[^}]*opacity: 0;/.test(css));
  ok_("e tira-lhe o ponteiro, para nao apanhar cliques", /\.pesquisa-aberta \.nav-left \{[^}]*pointer-events: none;/.test(css));
  ok_("o input aberto tem largura", /\.search\.open input \{[^}]*width: 222px;/.test(css));
  ok_("o input fechado colapsa a 0", /\.search input \{[^}]*width: 0;/.test(css));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);