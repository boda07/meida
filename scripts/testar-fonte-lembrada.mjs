// Lembrar a fonte escolhida, por tipo de titulo.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **A fonte lembrada e' POR TIPO, e o `playerIndex` tem de andar com o `active`.**
//
// Havia uma implementacao que nao funcionava, e por duas razoes ao mesmo tempo:
//
//  1. A chave de guarda tinha o episodio dentro — `meida:last-source:${type}:${season}:${episode}`.
//     Guardar "a ultima fonte do episodio 3" e' tautologico: o episodio 3 ja
//     esta' a ser visto. A escolha nunca chegava ao episodio seguinte, que e'
//     exactamente o que a funcionalidade existe para evitar.
//
//  2. O `Player` arrancava sempre no indice 0. O `active` mudava (e o botao
//     aparecia marcado), mas o video comecava noutra fonte. Mesmo com a chave
//     certa, o sintoma permanecia — e sem dar erro nenhum.
//
// As duas sao testadas. A segunda e' a que da menos vontade de se corrigir,
// porque o codigo "parece" funcionar: o seletor marca a fonte certa.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS } from "../web/src/api/client.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DETAILS = fs.readFileSync(path.join(RAIZ, "web", "src", "pages", "Details.jsx"), "utf8");
const CLIENT = fs.readFileSync(path.join(RAIZ, "web", "src", "api", "client.js"), "utf8");
const SETTINGS = fs.readFileSync(path.join(RAIZ, "web", "src", "settings", "SettingsContext.jsx"), "utf8");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) a definicao: uma fonte por TIPO");
{
  ok_("existe `lastSource` nas Definicoes", "lastSource" in DEFAULT_SETTINGS);
  const ls = DEFAULT_SETTINGS.lastSource;
  ok_("e e um objecto", !!ls && typeof ls === "object");
  // Os tres tipos que o servidor devolve. Faltar um e' esse tipo voltar ao
  // primeiro provider sem ninguem perceber porque.
  for (const t of ["movie", "tv", "anime"]) {
    ok_("tem a chave " + t, Object.prototype.hasOwnProperty.call(ls, t), JSON.stringify(Object.keys(ls)));
    ok_("e comeca vazia (" + t + ")", ls[t] === "", JSON.stringify(ls[t]));
  }
  ok_("nao ha chaves a mais", Object.keys(ls).length === 3, Object.keys(ls).join(","));
}

console.log("");
console.log("  2) a chave antiga, com o episodio dentro, foi embora");
{
  ok_("nao ha nenhuma chave `meida:last-source`", !/meida:last-source/.test(DETAILS));
  // A chave com o episodio era a causa do sintoma, e voltar a escreve-la em
  // silencio repete o bug sem dar erro.
  ok_("nem nenhuma escrita directa em localStorage pela fonte",
    !/localStorage\.setItem\(\s*`?meida:/.test(DETAILS));
  // E a leitura tem de ser pelas Definicoes.
  ok_("a fonte guardada vem das Definicoes", /settings\.lastSource/.test(DETAILS));
  ok_("indexada pelo tipo do titulo", /porTipo\[tipo\]/.test(DETAILS),
    "a fonte tem de ser lida pela chave do TIPO, e nao do episodio nem do titulo");
}

console.log("");
console.log("  3) o `playerIndex` anda com o `active` (o bug invisivel)");
{
  // A funcao que abre: tem de posicionar o player E ativo.
  const fn = DETAILS.slice(DETAILS.indexOf("function abrirEscolhendo"));
  const corpo = fn.slice(0, fn.indexOf("\n}"));
  ok_("existe `abrirEscolhendo`", !!fn);
  ok_("escolhe a fonte", /pickDefault\(embedsList,/.test(corpo));
  ok_("ativa essa fonte", /setActive\(escolhido\)/.test(corpo));
  ok_("**e posiciona o player nela**", /setPlayerIndex\(idx >= 0 \? idx : 0\)/.test(corpo),
    "o Player arrancava no indice 0 e o video comecava noutra fonte");
  // E os dois sítios onde as fontes chegam tem de a usar, senao um dos dois
  // caminhos (anime e filme/serie) fica com o bug e o outro nao.
  const usos = DETAILS.split("abrirEscolhendo(d.embeds)").length - 1;
  ok_("e usada nos dois sitios onde as fontes chegam", usos === 2, usos + " uso(s)");
  ok_("e nao sobra nenhum `setActive(pickDefault(...))", !/setActive\(pickDefault/.test(DETAILS));

  // **O bug do fecho de caixa.** `fonteSalva` era um VALOR calculado no render a
  // partir do `embeds` do estado. Quando as fontes chegam, dentro do `.then`,
  // esse `embeds` ainda era o antigo (vazio): a fonte guardada dava `null` e o
  // player arrancava na primeira. O botao do seletor aparecia certo, porque e'
  // desenhado num render seguinte com a lista ja cheia — "esta' marcada mas o
  // video e' outro", que e' a situacao mais enganadora que ha.
  ok_("a fonte guardada e' uma funcao, nao um valor do render",
    /function fonteGuardada\(tipo, lista\)/.test(DETAILS),
    "se for um valor calculado no render, a lista ainda esta' vazia quando as fontes chegam");
  ok_("e recebe a lista a usar, em vez de a ir buscar ao fecho",
    /fonteGuardada\(details\?\.type, embedsList\)/.test(DETAILS));
  // E tem de USAR o argumento: reescreve-lo com o valor do fecho (que e' o
  // mesmo bug com outra roupa) passava o teste anterior.
  const corpoPick = DETAILS.slice(DETAILS.indexOf("function pickDefault"))
    .slice(0, DETAILS.indexOf("function pickDefault") + 700)
    .split("\n}")[0];
  ok_("pickDefault NAO reescreve o argumento `saved` com o do fecho",
    !/saved\s*=/.test(corpoPick), "esta a ignorar o que lhe passou");
  ok_("pickDefault recebe a fonte guardada como argumento",
    /function pickDefault\(embedsList, saved\)/.test(DETAILS) &&
    /pickDefault\(embedsList, fonteGuardada/.test(DETAILS),
    "sem o argumento, volta a ler a do render");
}

console.log("");
console.log("  4) escolher guarda, e a escolha nao se perde nos outros tipos");
{
  const fn = DETAILS.slice(DETAILS.indexOf("function escolherFonte"));
  const corpo = fn.slice(0, fn.indexOf("\n}"));
  ok_("existe `escolherFonte`", !!fn);
  ok_("abre na fonte escolhida", /setActive\(e\)/.test(corpo));
  ok_("posiciona o player", /setPlayerIndex\(idx >= 0 \/ 0|setPlayerIndex\(idx >= 0 \? idx : 0\)/.test(corpo));
  ok_("tranca o auto-fallback", /setFonteManual\(true\)/.test(corpo));
  ok_("guarda nas Definicoes", /update\(\{/.test(corpo) && /lastSource/.test(corpo));
  // **O que se perde aqui e' o que o utilizador vai reclamar:** escolher o
  // MegaPlay para anime nao pode apagar a fonte escolhida para filmes.
  ok_("funde com o que ja estava gravado", /\.\.\.\(settings\.lastSource \|\| \{\}\)/.test(corpo),
    "sem isto, escolher para anime apaga o que foi escolhido para filme");
  ok_("e escreve so' na chave do tipo deste titulo", /\[\s*tipo\s*\]:\s*e\.provider/.test(corpo));
  ok_("as tres chaves ficam garantidas", /movie:\s*""[\s\S]*tv:\s*""[\s\S]*anime:\s*""/.test(corpo));
}

console.log("");
console.log("  5) os dois SourceSelector usam a mesma funcao");
{
  const usos = DETAILS.split("onSelect={escolherFonte}").length - 1;
  ok_("os dois botoes de fonte chamam a mesma funcao", usos === 2, usos + " uso(s)");
  ok_("nao ha nenhum `onSelect` com a logica escrita a ma", !/onSelect=\{\(e\) =>/.test(DETAILS));
}

console.log("");
console.log("  6) o que continua a ser verdade depois disto");
{
  ok_("a fonte guardada so' vale se o provider ainda existir",
    /\(lista \|\| \[\]\)\.some\(\(e\) => e\.provider === v\)/.test(DETAILS));
  ok_("um tipo sem fonte guardada da null (primeira viva)", /return null;/.test(DETAILS));
  ok_("a tranca do auto-fallback solta-se ao mudar de titulo", /setFonteManual\(false\)/.test(DETAILS));
  ok_("o guarda da watch party tem prioridade sobre a guardada",
    /want && \(alive\.find/.test(DETAILS));
  // A fonte da watch party e' do HOST, nao da pessoa: nao se deve ir para as
  // Definicoes. Se alguem mexer aqui, esta assercao da pelo dente.
  const fn = DETAILS.slice(DETAILS.indexOf("function escolherFonte"));
  ok_("a escolha da watch party nao e' gravada como escolha da pessoa",
    !/wantedSourceRef/.test(fn.slice(0, fn.indexOf("\n}"))));
}

console.log("");
console.log("  7) higiene");
{
  ok_("as Definicoes savam o que recebe", /function update\(patch\)/.test(SETTINGS) || /settingsStore\.set/.test(SETTINGS));
  const todo = DETAILS + CLIENT;
  ok_("sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(todo));
  ok_("sem caractere de substituicao", !/[\uFFFD]/.test(todo));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);