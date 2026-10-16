// O onboarding: quando aparece, por onde comeca, o que esta disponivel.
//
// PURE: `web/src/components/onboarding.js` nao toca em React nem no DOM.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **Uma porta de importacao so e' oferecida se for capaz de importar alguma coisa.**
//
// As tres importacoes ja existiam (`/api/mal/import`, `/api/letterboxd/import`,
// `/api/export/import`) e vivem nas Definicoes. O que faltava era o quando e o
// onde. A armadilha que decide o desenho: o unico CSV que o import aceita e' o
// exportado pela MEIDA — `toLibraryEntry()` le `o.tmdbId`, e a rota descarta o que
// nao o tem. Um CSV do Letterboxd (Date/Name/Year, **sem tmdbId**) importava
// **zero, sem erro**: um "Importados 0 titulos" que nao diz a ninguem que o
// ficheiro estava no formato errado.
//
// Por isso o `ficheiro` e' a unica porta sempre oferecida, e o `mal`/`anilist`
// so aparecem com as DUAS metades — servidor configurado **e** conta ligada.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PASSOS,
  ULTIMO,
  MAX_GENEROS,
  primeiroPasso,
  passoSeguinte,
  deveMostrar,
  opcoesDe,
  portaEmPrimeiro,
  generosParaOferecer,
  alternaGenero,
  generosParaDiscover,
  fechoDe,
} from "../web/src/components/onboarding.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSX = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "Onboarding.jsx"), "utf8");
const APP = fs.readFileSync(path.join(RAIZ, "web", "src", "App.jsx"), "utf8");
const CSS = fs.readFileSync(path.join(RAIZ, "web", "src", "styles.css"), "utf8");
const LIBCTX = fs.readFileSync(path.join(RAIZ, "web", "src", "library", "LibraryContext.jsx"), "utf8");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const ids = (e) => opcoesDe(e).map((o) => o.id).join(",");

console.log("");
console.log("  1) deveMostrar: a condicao que evita o pior estrago");
{
  // O cenario que custa mais caro: mostrar o wizard a quem tem 300 titulos.
  ok_("vazio e nao dispensado -> mostra", deveMostrar({ bibliotecaVazia: true }) === true);
  ok_("com titulos -> NAO mostra", deveMostrar({ bibliotecaVazia: false }) === false);

  // **`null` e' "ainda a carregar", nao "vazio".** `count` do `LibraryContext`
  // comeca a `null`; se isto fosse truthy, o wizard aparecia no primeiro
  // segundo de quem ja tem a lista cheia — e importava por cima dela.
  ok_("**ainda a carregar (null) -> NAO mostra**", deveMostrar({ bibliotecaVazia: null }) === false, String(deveMostrar({ bibliotecaVazia: null })));
  ok_("indefinido -> NAO mostra", deveMostrar({ bibliotecaVazia: undefined }) === false);
  ok_("e so' o `true` explicito que mostra", deveMostrar({ bibliotecaVazia: true }) === true);

  ok_("ja dispensado -> NAO mostra, mesmo vazio", deveMostrar({ bibliotecaVazia: true, jaDispensado: true }) === false);
  // Quem pede explicitamente ve sempre. E' o caminho do atalho nas Definicoes.
  ok_("forcado -> mostra sempre, mesmo com titulos", deveMostrar({ forcar: true, bibliotecaVazia: false }) === true);
  ok_("forcado ganha ao ja-dispensado", deveMostrar({ forcar: true, jaDispensado: true }) === true);
  ok_("sem argumentos nao rebenta", deveMostrar() === false);
  ok_("e uma chamada normal nao mostra", deveMostrar({}) === false);
}

console.log("");
console.log("  2) os passos");
{
  ok_("quatro, pela ordem", PASSOS.join(",") === "importar,generos,cor,pronto", PASSOS.join(","));
  ok_("comeca pelo importar", primeiroPasso() === "importar");
  ok_("importar -> generos", passoSeguinte("importar") === "generos");
  ok_("generos -> cor", passoSeguinte("generos") === "cor");
  ok_("cor -> pronto", passoSeguinte("cor") === ULTIMO);
  ok_("no ultimo devolve null", passoSeguinte(ULTIMO) === null);
  ok_("um passo inventado devolve null (nao inventa um passo novo)", passoSeguinte("banana") === null);

  // Passos que o estado nao permite sao saltados: um botao "Continuar" que nao
  // leva a lado nenhum e' pior do que nao estar.
  ok_("sem generos, salta o passo dos generos", passoSeguinte("importar", { temGeneros: false }) === "cor");
  ok_("sem cores, salta o passo da cor", passoSeguinte("generos", { temCores: false }) === ULTIMO);
  ok_("sem nenhum dos dois vai do importar ao fim", passoSeguinte("importar", { temGeneros: false, temCores: false }) === ULTIMO);
  ok_("com os dois disponiveis, nao salta nada", passoSeguinte("importar", { temGeneros: true, temCores: true }) === "generos");
  ok_("e do ultimo nunca salta para fora", passoSeguinte(ULTIMO, { temGeneros: false }) === null);
}

console.log("");
console.log("  3) as portas: so as que sao capazes  <-- a assercao central");
{
  // So ficheiro, sem nada ligado.
  ok_("sem nada ligado, so o ficheiro", ids({}) === "ficheiro", ids({}));

  // **O MAL precisa das DUAS metades.** Sem `MAL_CLIENT_ID` o link de
  // autorizacao da' 500 — oferecer o botao e' pior que nao oferecer nada.
  ok_("MAL so com conta ligada E servidor", ids({ malLigado: true, malNoServidor: true }) === "mal,ficheiro");
  ok_("MAL com conta mas SEM servidor -> nao", !ids({ malLigado: true, malNoServidor: false }).includes("mal"), ids({ malLigado: true, malNoServidor: false }));
  ok_("MAL com servidor mas SEM conta -> nao", !ids({ malLigado: false, malNoServidor: true }).includes("mal"), ids({ malLigado: false, malNoServidor: true }));
  ok_("idem para o AniList", ids({ anilistLigado: true, anilistNoServidor: true }) === "anilist,ficheiro");
  ok_("AniList sem servidor -> nao", !ids({ anilistLigado: true, anilistNoServidor: false }).includes("anilist"));

  // O Letterboxd so precisa da conta ligada: escreve-se um username.
  ok_("Letterboxd com conta ligada", ids({ letterboxdLigado: true }) === "letterboxd,ficheiro");

  ok_("todas ligadas, sao quatro", ids({ malLigado: true, malNoServidor: true, anilistLigado: true, anilistNoServidor: true, letterboxdLigado: true }).split(",").length === 4);
  ok_("o ficheiro esta SEMPRE la, mesmo com tudo ligado",
    ids({ malLigado: true, malNoServidor: true, anilistLigado: true, anilistNoServidor: true, letterboxdLigado: true }).includes("ficheiro"));
  ok_("e e a ultima da lista", ids({ malLigado: true, malNoServidor: true, letterboxdLigado: true }) === "mal,letterboxd,ficheiro");
  ok_("nunca da' null", opcoesDe({}).length > 0);
  ok_("sem argumentos nao rebenta", Array.isArray(opcoesDe()) && opcoesDe().length === 1);
}

console.log("");
console.log("  4) a porta em primeiro: a MAIS BARATA, nao a mais popular");
{
  // Quem ve primeiro a porta cara tem mais probabilidade de desistir antes de
  // chegar a uma que resolve o problema em dez segundos.
  ok_("so Letterboxd -> Letterboxd", portaEmPrimeiro({ letterboxdLigado: true }) === "letterboxd");
  ok_("Letterboxd ganha ao MAL", portaEmPrimeiro({ letterboxdLigado: true, malLigado: true, malNoServidor: true }) === "letterboxd");
  ok_("sem Letterboxd, o MAL", portaEmPrimeiro({ malLigado: true, malNoServidor: true }) === "mal");
  ok_("sem Letterboxd nem MAL, o AniList", portaEmPrimeiro({ anilistLigado: true, anilistNoServidor: true }) === "anilist");
  ok_("so ficheiro -> null (nao ha primeira)", portaEmPrimeiro({}) === null);
  ok_("nada ligado -> null", portaEmPrimeiro() === null);
  // **Nunca pode ser o `ficheiro`**, que e' a opcao sem ligacao nenhuma.
  ok_("o ficheiro nunca e' a primeira porta", portaEmPrimeiro({ malLigado: true, malNoServidor: true, letterboxdLigado: true }) !== "ficheiro");
}

console.log("");
console.log("  5) os generos: escolha curta, sem repetir, sem passar do maximo");
{
  const T = (id, name) => ({ id, name });
  ok_("o maximo e' 4", MAX_GENEROS === 4);

  ok_("escolhe um", alternaGenero([], T(27, "Terror"))[0].name === "Terror");
  ok_("**e guarda o ID tambem** (o discover so' aceita ids)", alternaGenero([], T(27, "Terror"))[0].id === 27);
  ok_("acrescenta", alternaGenero([T(27, "Terror")], T(35, "Comédia")).length === 2);
  // **Tirar e' carregar outra vez**, e compara-se pelo **nome**: o que se guarda e'
  // um objeto, e `includes(g.name)` daria sempre falso — o botao nunca marcava.
  ok_("carregar outra vez tira", alternaGenero([T(27, "Terror")], T(27, "Terror")).length === 0);
  ok_("tirar um de varios deixa os outros", alternaGenero([T(27, "Terror"), T(35, "Comédia")], T(27, "Terror")).map((x) => x.name).join(",") === "Comédia");

  // **O quinto nao substitui o primeiro.** Substituir apagava a escolha sem
  // aviso, e quem clica no quinto nao sabe que perdeu o primeiro.
  const cheio = [T(1, "A"), T(2, "B"), T(3, "C"), T(4, "D")];
  const quinto = alternaGenero(cheio, T(5, "E"));
  ok_("o quinto nao entra", quinto.length === MAX_GENEROS, "n=" + quinto.length);
  ok_("e o primeiro nao desapareceu", quinto[0].name === "A", JSON.stringify(quinto.map((x) => x.name)));

  // Uma string simples continua a aceitar-se: a funcao nao obriga a uma forma.
  ok_("aceita uma string (sem id)", alternaGenero([], "Terror")[0] === "Terror");

  ok_("nome vazio nao faz nada", alternaGenero([T(1, "A")], "").length === 1);
  ok_("e sem valor nenhum", alternaGenero([T(1, "A")], null).length === 1);
  ok_("corta espacos", alternaGenero([], T(1, "  Terror  "))[0].name === "Terror");
  ok_("a lista inicial nao e' um array, nao rebenta", Array.isArray(alternaGenero(null, T(1, "A"))));

  // **Devolve um array novo.** Mutar o antigo fazia o React nao redesenhar.
  const antes = [T(1, "A")];
  const depois = alternaGenero(antes, T(2, "B"));
  ok_("devolve um array novo", depois !== antes);
  ok_("e o original nao foi tocado", antes.length === 1 && antes[0].name === "A");
}

console.log("");
console.log("  6) generosParaOferecer: a lista nao pode ser sempre a mesma");
{
  const muitos = Array.from({ length: 20 }, (_, i) => ({ id: 28 + i, name: "Genero " + i }));
  const a = generosParaOferecer(muitos, 12);
  const b = generosParaOferecer(muitos, 12);
  ok_("limita ao pedido", a.length === 12, "n=" + a.length);
  ok_("todos vem da lista original", a.every((g) => muitos.some((x) => x.id === g.id)));
  ok_("sem repetidos", new Set(a.map((g) => g.id)).size === a.length);

  // **A lista tem de mudar entre chamadas.** Cortar os doze primeiros dava sempre
  // as mesmas opcoes a toda a gente — e quem goste de terror nunca via "Terror".
  ok_("duas chamadas nao dao a mesma lista", JSON.stringify(a) !== JSON.stringify(b), a.map((g) => g.name).join(",") + " | " + b.map((g) => g.name).join(","));

  // **E tem de mudar TODAS as vezes.** A primeira versao da funcao sorteava com
  // `Date.now()`, que dentro do mesmo segundo dá sempre o mesmo numero: as duas
  // chamadas do teste caem no mesmo segundo, e a lista saia igual. Um contador
  // e' o que resolve — e a raza de a verificacao estar escrita assim, e nao
  // "pelo menos uma vez diferente".
  const todas = new Set();
  for (let i = 0; i < 6; i++) todas.add(JSON.stringify(generosParaOferecer(muitos, 12)));
  ok_("**seis chamadas seguidas dao seis listas diferentes**", todas.size === 6, "distintas=" + todas.size);
  ok_("e nenhuma volta a repetir ao fim de um ciclo", (() => {
    const l1 = generosParaOferecer(muitos, 12).map((g) => g.id).join(",");
    const l2 = generosParaOferecer(muitos, 12).map((g) => g.id).join(",");
    return l1 !== l2;
  })());

  // **A ordem original nao pode sobreviver ao "sorteio".** Com ids consecutivos e
  // um factor multiplicativo comum os hashes saiam tao proximos que o sort era
  // praticamente um no-op, e a lista voltava a ser a do TMDB.
  const foraDaOrdem = generosParaOferecer(muitos, 12).map((g) => g.id);
  ok_("a lista sai fora da ordem do servidor", JSON.stringify(foraDaOrdem) !== JSON.stringify(muitos.slice(0, 12).map((g) => g.id)), foraDaOrdem.join(","));

  ok_("poucos generos passam todos", generosParaOferecer(muitos.slice(0, 5), 12).length === 5);
  ok_("lista vazia da' vazia", generosParaOferecer([], 12).length === 0);
  ok_("null nao rebenta", generosParaOferecer(null).length === 0);
  ok_("descarta os generos sem id ou sem nome",
    generosParaOferecer([{ name: "sem id" }, { id: 5 }, { id: 6, name: "  " }, { id: 7, name: "Bom" }], 12).length === 1);
}

console.log("");
console.log("  7) generosParaDiscover: o que alimenta o /api/discover");
{
  /*
   * **IDS, NAO NOMES.** Medido no servidor: `/api/discover?type=movie&genres=Terror`
   * devolve **0 itens** e `?genres=27` devolve **20**. A rota mete o valor
   * directo no `with_genres` do TMDB, que so' aceita ids.
   *
   * E o pior tipo de bug: um nome passa pelo TMDB **sem erro nenhum** — devolve
   * uma lista vazia. A linha desaparece em silencio e a Home fica igual, como se
   * nao houver generos escolhidos.
   */
  ok_("manda o ID, nunca o nome", generosParaDiscover([{ id: 27, name: "Terror" }]) === "27");
  ok_("junta varios", generosParaDiscover([{ id: 27, name: "Terror" }, { id: 35, name: "Comédia" }]) === "27,35");
  ok_("aceita o id solto tambem", generosParaDiscover([27, 35]) === "27,35");
  ok_("vazio da' string vazia (e nao undefined)", generosParaDiscover([]) === "");
  ok_("null da' string vazia", generosParaDiscover(null) === "");
  ok_("descarta o que nao tem id numerico", generosParaDiscover([{ id: 0, name: "X" }, { id: 27, name: "Terror" }, { id: "abc", name: "Y" }]) === "27");
  ok_("e o que traz so' nome nao entra", generosParaDiscover(["Terror"]) === "");
  // `27.0` ou `"27"` tem de dar `27`, nao `27.0`.
  ok_("normaliza para inteiro", generosParaDiscover([{ id: 27.9, name: "Terror" }]) === "27");
}

console.log("");
console.log("  8) fechoDe: quando o numero aparece, e qual");
{
  // **Um "pronto!" com o zero de lado e' pior do que nao dizer nada**: quem
  // esperou dois minutos por um import e viu "0 titulos" vai supor que a app
  // esta partida.
  ok_("sem nada, NAO mostra numeros", fechoDe({ total: 0 }).mostrarNumeros === false);
  ok_("e o total zero", fechoDe({ total: 0 }).n === 0);
  ok_("com titulos, mostra", fechoDe({ total: 12 }).mostrarNumeros === true);
  ok_("so total, mostra o total", fechoDe({ total: 12 }).n === 12);

  // **O numero e' o que foi importado quando houve alguma coisa.** Se a pessoa
  // ja tinha titulos e o import falhou, dizer "0" seria mentira.
  ok_("com import, mostra o importado", fechoDe({ total: 40, importados: 12 }).n === 12);
  ok_("importou 0 mas tem 40 -> mostra 40, nunca 0", fechoDe({ total: 40, importados: 0 }).n === 40, "n=" + fechoDe({ total: 40, importados: 0 }).n);
  ok_("importou tudo -> mostra o importado", fechoDe({ total: 12, importados: 12 }).n === 12);

  ok_("sem argumentos nao rebenta", fechoDe().mostrarNumeros === false);
  ok_("total em texto tambem conta", fechoDe({ total: "7" }).mostrarNumeros === true && fechoDe({ total: "7" }).n === 7);
  ok_("as fontes passam limpas", fechoDe({ total: 3, fontes: ["mal", "", null, "letterboxd"] }).fontes.join(",") === "mal,letterboxd");
  // **Nao ha texto em portugues.** Era `texto: "nenhum titulo"` e o auditor
  // acusou o ficheiro — com razao: sai em portugues com a app em ingles.
  ok_("e NAO devolve texto pronto (isso e' do JSX, dentro de t())", !("texto" in fechoDe({ total: 0 })));
}

console.log("");
console.log("  9) a ligacao ao resto da app");
{
  ok_("esta montado pelo App", /<Onboarding /.test(APP));
  ok_("**FORA do ErrorBoundary** (quem cria a conta pode estar a ver um erro)", (() => {
    const iOn = APP.indexOf("<Onboarding");
    const iB = APP.indexOf("<ErrorBoundary>");
    return iOn > 0 && iOn < iB;
  })(), "Onboarding=" + APP.indexOf("<Onboarding") + " boundary=" + APP.indexOf("<ErrorBoundary>"));
  // **So com sessao**: sem ela nao ha perfil para importar.
  ok_("e so com sessao", /\{user && \(\s*<Onboarding/.test(APP));
  ok_("e o atalho das Definicoes existe e e' limpo ao fechar", /window\.abrirOnboarding = /.test(APP) && /delete window\.abrirOnboarding/.test(APP));

  // O `count` e' a condicao, e o `null` tem de estar protegido no provider.
  ok_("o LibraryContext expoe `count`", /count,\s*refresh/.test(LIBCTX) || /count,\s*refresh/.test(LIBCTX.replace(/\s+/g, " ")));
  ok_("e expoe `refresh` (depois de um import tem de recarregar)", /refresh/.test(LIBCTX));
  ok_("**`count` comeca a `null`, nao a 0**", /const \[count, setCount\] = useState\(null\)/.test(LIBCTX));
  /*
 * **O `catch` nao pode tocar no `count`.**
 *
 * A primeira versao desta verificaçao aceitava `LIBCTX.includes("Falhou**")` —
 * ou seja, bastava o comentario existir. Meti `setCount(0)` dentro do `catch` e
 * o teste passou com a mutaçao aplicada, o que provou que a verificaçao nao via
 * nada. Agora le o corpo do `catch` e procura um `setCount` dentro dele.
 */
{
  const iCatch = LIBCTX.indexOf(".catch(() => {");
  const corpo = LIBCTX.slice(iCatch, LIBCTX.indexOf("})", iCatch));
  ok_("o `catch` do carregamento foi encontrado", iCatch > 0 && corpo.length > 10);
  ok_("**e NAO mexe no `count` (uma falha nao e' uma lista vazia)**", !/setCount\s*\(/.test(corpo), corpo.trim().slice(0, 90));
  ok_("e explica porquê, em comentario", /Falhou/.test(corpo));
}

  // A folha e' de lado, nao modal: ver a biblioteca a ser escrita importa.
  ok_("a folha tem `role=\"dialog\"`", /role="dialog"/.test(JSX));
  ok_("e `aria-modal=\"false\"` — NAO e' modal, e o fundo tem de ficar visivel", /aria-modal="false"/.test(JSX));
  ok_("a folha e' `position: fixed` a toda a altura", /\.ob-folha\s*\{[^}]*position:\s*fixed/.test(CSS) && /\.ob-folha\s*\{[^}]*top:\s*0/.test(CSS));
  // Acima da pílula (60) e da barra de baixo (65); abaixo do Changelog (80).
  const z = Number((CSS.match(/\.ob-folha\s*\{[^}]*z-index:\s*(\d+)/) || [])[1] || 0);
  ok_("e o z-index esta entre a barra de baixo e o Changelog", z > 65 && z < 80, "z=" + z);
  /*
   * **`--accent-text` e' so para TEXTO.** A regra esta em `testar-acento.mjs` e
   * tem razao: e' o mesmo acento clareado, existe porque 3,3:1 nao chega para
   * texto normal. Numa borda de 1 px ou numa barra de 3 px nao ha texto nenhum, e
   * clarear a cor faz o elemento parecer cinzento em vez de da cor escolhida.
   *
   * Usei `--accent-text` nos dois na primeira versao e o `npm test` apanhou.
   */
  ok_("**nenhum elemento grafico do onboarding usa `--accent-text`**",
    !/border-color:\s*var\(--accent-text/.test(CSS) && !/\.ob-passo\.on\s*\{[^}]*var\(--accent-text/.test(CSS));
  ok_("a barra dos passos usa a cor cheia", /\.ob-passo\.on\s*\{[^}]*var\(--accent\)/.test(CSS));
  ok_("e o genero escolhido tambem", /\.ob-genero\.on\s*\{[^}]*border-color:\s*var\(--accent\)/.test(CSS));
  // O polegar: as acoes em baixo, acima da barra de navegacao.
  ok_("as acoes respeitam a area segura", /\.ob-acoes\s*\{[^}]*env\(safe-area-inset-bottom/.test(CSS));
  // A cor e' o botao inteiro: 44 px, o guideline de toque.
  ok_("cada botao de cor tem 44 px (o alvo e' o botao)", /\.ob-cor\s*\{[^}]*width:\s*44px/.test(CSS) && /\.ob-cor\s*\{[^}]*height:\s*44px/.test(CSS));
  /*
   * Os presets tem de ser os MESMOS que os das Definicoes.
   *
   * A primeira versao contava **todos** os hex de cada ficheiro e deu falha
   * com "as cores sao diferentes" — a verdade e' que as oito sao iguais. O que
   * falhava era a medicao: `Settings.jsx` tem tambem os `BG_PRESETS` e o
   * `--accent` por omissão, e a contagem dava 8 contra 15. Comparar a lista
   * **declaration** e a lista **do declaration** e' o que prova a regra.
   */
  const defs = fs.readFileSync(path.join(RAIZ, "web", "src", "pages", "Settings.jsx"), "utf8");
  const blocoDef = (defs.match(/const ACCENT_PRESETS = \[([\s\S]*?)\]/) || [])[1] || "";
  const blocoOb = (JSX.match(/export const CORES = \[([\s\S]*?)\]/) || [])[1] || "";
  const coresDef = [...blocoDef.matchAll(/"(#[0-9a-f]{6})"/gi)].map((m) => m[1]);
  const coresOb = [...blocoOb.matchAll(/"(#[0-9a-f]{6})"/gi)].map((m) => m[1]);
  ok_("as cores do onboarding sao as mesmas das Definicoes, pela ordem",
    coresOb.length > 0 && coresOb.join(",") === coresDef.join(","),
    "ob=" + coresOb.join(",") + " def=" + coresDef.join(","));
  ok_("e sao as oito de sempre", coresOb.length === 8, "n=" + coresOb.length);

  /*
   * **O nome do campo que diz "esta ligado".**
   *
   * `/api/letterboxd/status` responde `{ username }`, **nao** `{ linked }` — e o
   * `LetterboxdSection` das Definicoes le `d.username`. A primeira versao
   * perguntava por `lb.linked`, que nao existe em lado nenhum: o campo dava
   * `undefined`, a opcao do Letterboxd **nunca aparecia**, e nada dava erro.
   *
   * O mesmo para o MAL e o AniList, que respondem `{ linked }` de facto. Sao
   * nomes diferentes em rotas que fazem o mesmo, e por isso sao testados os tres.
   */
  ok_("o Letterboxd le `username`, nao `linked`", /letterboxd:\s*!!\(lb && lb\.username\)/.test(JSX));
  // **A proibicao e' sobre TODO o ficheiro, comentário incluído.** A primeira vez
  // que escrevi a regra, o proprio comentário dela continha o nome proibido e o
  // teste acusou a linha certa pela razao errada — a mesma armadilha do
  // `testar-acento.mjs` com os comentarios. Por isso o comentario do componente
  // diz "o campo que nao existe" e nao escreve o nome.
  ok_("e o campo inexistente nao aparece em lado nenhum (nem em comentario)", !/lb\s*\.\s*linked/.test(JSX));
  ok_("o catch do Letterboxd devolve a MESMA forma que o sucesso", /letterboxdStatus\(\)\.catch\(\(\) => \(\{ username: null \}\)\)/.test(JSX));
  ok_("o MAL le `linked` (a rota dele responde mesmo assim)", /mal:\s*!!\(mal && mal\.linked\)/.test(JSX));
  ok_("e o AniList tambem", /anilist:\s*!!\(al && al\.linked\)/.test(JSX));

  // E o `catch` de cada estado tem de devolver a forma do sucesso: um
  // `catch: () => ({})` daria `undefined`, que e' falsy — resultado certo por
  // acidente, e uma falha de rede indistinguivel de "nao esta ligado".
  const catches = [...JSX.matchAll(/\.(malStatus|anilistStatus|letterboxdStatus)\(\)\.catch\(\(\) => (\(\{[^}]*\}\))\)/g)];
  ok_("os tres estados tem `catch` com a forma do sucesso", catches.length === 3, "n=" + catches.length);
  ok_("e nenhum devolve um objecto vazio", !JSX.includes(".catch(() => ({}))"), "um `{}` daria `undefined`");

  /*
 * **A ORDEM DAS DECLARACOES dentro do componente.**
 *
 * Este e' o teste que vale mais do que todos os outros juntos, e a raza e' uma
 * classe de bug que **ninguem dos outros apanha**.
 *
 * O `const [estado, setEstado]` estava 60 linhas abaixo de `deveMostrar`, que le
 * `estado.jaDispensado` **durante o desenho**. Em JS isso e' uma *temporal dead
 * zone*: o `ReferenceError: Cannot access 'ae' before initialization` acontece
 * no bundle minificado e **derruba a app inteira** — ecra em branco, sem
 * mensagem, sem nada.
 *
 * Porque e' que nada mais o apanhou:
 *   - o ESLint nao verifica ordem de declaracoes dentro de um componente;
 *   - `node --check` nao parseia JSX;
 *   - o `npm run build` passa;
 *   - os 113 testes puros passam, porque `estado` vive no JSX e nao na logica.
 *
 * **So' abrir a app no browser apanha isto.** Por isso a regra e' verificada
 * como texto: cada `useState` tem de aparecer antes da primeira linha que o usa.
 */
{
  const linhas = JSX.split(/\r?\n/);
  const linhaDe = (agulha) => linhas.findIndex((x) => x.includes(agulha));
  const isCodigo = (x) => {
    const t = x.trim();
    if (!t) return false;
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false;
    if (/^import\b/.test(t) || /^export\b/.test(t)) return false;
    return true;
  };
  // A declaracao: `const [x, setX] = useState(...)` **ou** `const x = ...` (as
  // derivadas, como `visivel` e `mostrar`, que sao `const` simples).
  const declaracao = (v) => linhas.findIndex((x) => {
    if (!isCodigo(x)) return false;
    return new RegExp("const \\[[^\\]]*\\b" + v + "\\b").test(x) || new RegExp("const \\b" + v + "\\b").test(x);
  });
  // O primeiro uso **em codigo** que nao seja a propria declaracao nem a
  // destructuracao do `useState` (que e' `const { user } = useAuth()`).
  const primeiroUso = (v) => linhas.findIndex((x) => {
    if (!isCodigo(x)) return false;
    if (declaracao(v) >= 0 && linhas[declaracao(v)] === x) return false;
    if (new RegExp("const \\{[^}]*\\b" + v + "\\b").test(x)) return false; // destructuracao
    if (new RegExp("const \\[[^\\]]*\\b" + v + "\\b").test(x)) return false; // useState
    return new RegExp("\\b" + v + "\\b").test(x);
  });

  // **`count` e `user` ficam de fora**: vem de `useLibrary()`/`useAuth()`, nao
  // sao estado local. A regra so vale para o que se declara com `const` dentro
  // do componente — que e' exactamente onde a dead zone acontece.
  for (const v of ["estado", "visivel", "mostrar", "ficheiro", "generos", "oferta", "cor", "passo"]) {
    const d = declaracao(v);
    const u = primeiroUso(v);
    ok_("`" + v + "`: declarado (L" + (d + 1) + ") antes do primeiro uso (L" + (u + 1) + ")", d >= 0 && u >= 0 && d < u, "d=" + (d + 1) + " u=" + (u + 1));
  }

  // E o caso concreto que rebentou, nomeado: `deveMostrar` le `estado`.
  const iEstado = declaracao("estado");
  const iMostrar = linhaDe("const mostrar = deveMostrar");
  ok_("**`estado` e' declarado ANTES de `deveMostrar`** (o bug da dead zone)", iEstado >= 0 && iMostrar >= 0 && iEstado < iMostrar, "estado=" + (iEstado + 1) + " mostrar=" + (iMostrar + 1));
  ok_("e `deveMostrar` le mesmo o `jaDispensado`", /deveMostrar\(\{[\s\S]{0,200}jaDispensado:\s*estado\.jaDispensado/.test(JSX));
}

/*
 * **A COR APLICA-SE AO CARREGAR, NAO NO FIM.**
 *
 * A primeira versao guardava a cor em `avancar()`, no ultimo passo. Usando a
 * folha no browser: escolher a cor, fechar pelo **X** (ou pelo link
 * "Definicoes"), e a cor **perdia-se** — voltava ao vermelho sem uma palavra.
 *
 * E aplica-se ao vivo porque e' a unica forma de ver se a cor escolhida se le no
 * fundo da app.
 */
// A janela entre `setCor(c)` e `update(...)` tem de ser generosa: ha um
// comentario de sete linhas entre os dois, e uma janela curta dava falso
// negativo — que e' pior que nao verificar.
ok_("a cor grava-se ao clicar nela", /setCor\(c\);[\s\S]{0,900}update\(\{ accent: c \}\)/.test(JSX));
ok_("e o `avancar` NAO volta a grava-la (so no fim, e perdia-se ao fechar)", !/proximo === null[\s\S]{0,200}accent/.test(JSX));
ok_("e nenhum caminho de fecho depende de gravar a cor", !/const fechar[\s\S]{0,300}accent/.test(JSX));

/*
 * **O NOME DA FUNCAO DO CONTEXTO.**
 *
 * A primeira versao escrevia `setSetting("accent", c)`. O `SettingsContext`
 * expoe `update(patch)` e **nao** `setSetting` — a chamada dava `undefined is
 * not a function` dentro do `onClick`, e a cor nao mudava **nem no ecra**.
 *
 * **O lint nao apanha isto:** `setSetting` vinha da destructuracao do
 * `useSettings()`, e o ESLint conta uma variavel destructurada como usada. O
 * unico sintoma era em cima: o botao nao fazia nada. Por isso a verificacao
 * le o contexto e compara.
 */
{
  const ctx = fs.readFileSync(path.join(RAIZ, "web", "src", "settings", "SettingsContext.jsx"), "utf8");
  const valor = (ctx.match(/<SettingsContext\.Provider value=\{\{([^}]*)\}\}/) || [])[1] || "";
  const expoe = [...valor.matchAll(/(\w+)\s*[,}]/g)].map((m) => m[1]);
  ok_("o `SettingsContext` expoe `update`", expoe.includes("update"), expoe.join(","));
  ok_("**e NAO expoe `setSetting`** (que e' o que eu usava)", !expoe.includes("setSetting"), expoe.join(","));
  // A destructuracao e' o **unico** sitio onde um nome pode nascer: uma variavel
// que nao aparece em nenhum `const { ... } = useSettings()` nunca existiu, e o
// ESLint nao diz nada porque conta uma destructuracao como uso.
ok_("**a destructuracao do `useSettings` so tem nomes que o contexto expoe**", (() => {
  const m = JSX.match(/const \{ ([^}]*) \} = useSettings\(\)/);
  if (!m) return false;
  const usados = m[1].split(",").map((x) => x.trim().split(":")[0].trim()).filter(Boolean);
  const maus = usados.filter((u) => !expoe.includes(u));
  return maus.length === 0;
})(), (JSX.match(/const \{ ([^}]*) \} = useSettings\(\)/) || ["", "?"])[1]);
}

/*
 * **OS GENEROS TEMO UM CONSUMIDOR.**
 *
 * O ponto que o proprio `onboarding.js` avisa que nao se deve falhar: uma
 * preferencia que se guarda e nunca mais se le e' pior do que nao ter a
 * preferencia. Os generos entram no `/api/discover` e mostram-se como a
 * primeira linha da Home.
 */
{
  const home = fs.readFileSync(path.join(RAIZ, "web", "src", "pages", "Home.jsx"), "utf8");
  ok_("a Home recebe os generos", /export default function Home\(\{ generos = "" \}\)/.test(home));
  // **O parametro chama-se `genres` e a propriedade `generos`.** Trocar uma
  // pela outra da' `undefined` e a linha desaparece sem erro nenhum.
  ok_("passa-os ao `/api/discover` com o nome certo", /\.discover\(\{ type: "movie", genres: generos \}\)/.test(home));
  ok_("e nao com `genres: genres` (que seria `undefined`)", !/\.discover\(\{ type: "movie", genres \}\)/.test(home));
  ok_("a linha entra ANTES do catalogo", home.indexOf("porGenero ?") >= 0 && home.indexOf("porGenero ?") < home.indexOf("rows.map("));
  ok_("e so quando ha generos", /if \(!generos\) \{[\s\S]{0,60}setPorGenero\(null\)/.test(home));
  // Falha em silencio: um erro de rede no primeiro ecra depois de criar a conta
  // nao pode mostrar a pagina como partida.
  ok_("e falha em silencio", /\.catch\(\(\) => \{ \/\* a Home fica como estava \*\/ \}\)/.test(home));
  ok_("a App so passa os generos se `jaDispensado`", /if \(!v \|\| v\.jaDispensado !== true\) return ""/.test(APP));
  ok_("e a rota Home recebe o parametro", /<Home generos=\{generosEscolhidos\(\)\} \/>/.test(APP));
  /*
   * **A App tem de extrair o ID de dentro do objeto.**
   *
   * `v.generos` guarda `{ id, name }` por elemento. Um `join(",")` no array
   * inteiro mandava `{"id":80,"name":"Crime"},{"id":12,...}` para o TMDB, que
   * devolvia uma lista vazia **sem erro** — e a linha nunca aparecia, sem
   * aviso nenhum. Foi ver no browser: o pedido ao `/api/discover` nem era feito.
   */
  ok_("**a App extrai o `id` de cada genero**", /\? g\.id : g\)/.test(APP));
  ok_("e NAO faz `join` do array inteiro (mandava os objetos inteiros)", !/v\.generos\.filter\(Boolean\)\.join\(","\)/.test(APP));
  ok_("e descarta o que nao for id numerico", /\.filter\(\(id\) => Number\.isFinite\(Number\(id\)\) && Number\(id\) > 0\)/.test(APP));
}
}

/*
 * **O texto tem de dizer que so entram ficheiros exportados da MEIDA.**
 *
 * E' a mentira que o passo "so capaz de importar" existe para evitar: o
 * `toLibraryEntry()` do servidor le `o.tmdbId`, e um CSV do Letterboxd nao tem
 * esse campo — importava **zero, sem erro**. Sem esta frase no ecra, a pessoa
 * arrasta o ficheirowrong e ve "Importados 0 titulos" sem perceber porque.
 *
 * **Esta verificacao desapareceu uma vez.** Ao reestruturar a secçao, engoli-a
 * na substitui§ao — e a mutaçao correspondente passou a dar "NAO APANHADA" sem
 * dizer nada. E o que a torna perigosa: uma verificaçao que desaparece nao
 * chora, e a mutaçao que vinha apanha-la passou a correr em silencio.
 */
ok_("o texto avisa que so entram ficheiros da MEIDA", /Só entram ficheiros exportados da MEIDA/.test(JSX));
// E tem de estar **dentro** do painel de importar, nao numa nota solta: a nota
// de rodape do painel e' o sitio onde a pessoa olha depois de escolher o
// ficheiro, que e' exactamente a altura em que a duvida aparece.
ok_("e o aviso esta dentro do painel de importar", JSX.indexOf("Só entram ficheiros") > JSX.indexOf("const passoImportar") && JSX.indexOf("Só entram ficheiros") < JSX.indexOf("const passoGeneros"));

console.log("");
console.log("  10) os ficheiros ainda ABREM");
{
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["--check", path.join(RAIZ, "web", "src", "components", "onboarding.js")], { encoding: "utf8" });
  ok_("onboarding.js faz parse", r.status === 0, ((r.stderr || "").split("\n").find((x) => x.includes("Error")) || "").trim().slice(0, 60));
  ok_("sem aspas smart no JSX", !/[“”‘’]/.test(JSX));
  ok_("e sem caracteres invalidos", !/[\uFFFD]/.test(JSX + CSS + APP));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);