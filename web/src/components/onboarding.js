// O onboarding: os primeiros 60 segundos depois de criar a conta.
//
// PURE: nao toca em React, nem no DOM, nem faz pedidos. A componente
// `Onboarding.jsx` desenha e despacha; aqui decide-se **quando aparece**, **por
// onde comeca** e **o que esta disponivel**.
//
// ---------------------------------------------------------------------------
// O QUE MUDOU EM RELACAO A IDEIA ORIGINAL
// ---------------------------------------------------------------------------
// A ideia dizia "importar de MAL, Letterboxd ou CSV". **As tres importacoes ja
// existem** (`/api/mal/import`, `/api/letterboxd/import`, `/api/export/import`)
// e vivem nas Definicoes. O que faltava era o **quando** e o **onde**: quem
// entrava via `/register` ia direitinho para `/` e via a app vazia, sem nenhuma
// pista de que havia tres portas de entrada.
//
// E aqui esta' a armadilha que decide o desenho: **o CSV da MEIDA e' o unico
// CSV que o import aceita.** `toLibraryEntry()` le `o.tmdbId`, e a rota descarta
// o que nao o tem (`if (!e.type || !e.tmdbId) continue`). Um CSV do Letterboxd
// exportado pela propria Letterboxd tem `Date, Name, Year, Letterboxd URI,
// Rating` — **nenhum tmdbId** — e importava **zero, sem erro nenhum**: um
// "Importados 0 titulos" que nao diz a ninguem que o ficheiro estava no formato
// errado.
//
// Daqui a regra que custa mais a provar, e que e' o coracao deste ficheiro:
// **uma porta de importacao so e' oferecida se for capaz de importar alguma
// coisa.** Ver `opcoesDe()` e a nota la.
//
// ---------------------------------------------------------------------------
// POR QUE "VAZIO" E NAO "NOVO"
// ---------------------------------------------------------------------------
// O onboarding mostra-se a quem **nao tem nada**, e nao a quem se registou ha
// pouco. Sao coisas diferentes: quem ja tem 400 titulos importados nao precisa de
// um wizard que lhe pergunte de onde os trouxe — e mostrar-lhe isso e' a
// maneira de transformar uma ajuda num anuncio.

/** Os passos, por ordem. A ordem e' a da interface. */
export const PASSOS = ["importar", "generos", "cor", "pronto"];

/** O passo final. */
export const ULTIMO = PASSOS[PASSOS.length - 1];

/**
 * Quantos generos se podem escolher.
 *
 * **Quatro, e nao "quantos quiseres".** O passo e' rapido de proposito: quem
 * esta a responder a "o que te gosta" com vinte opcoes nao esta a responder,
 * esta a trabalhar. E a escolha alimenta uma linha em `/discover`, que le melhor
 * tres ou quatro generos do que trinta.
 */
export const MAX_GENEROS = 4;

/**
 * O onboarding deve aparecer?
 *
 * @param {object} e
 * @param {boolean} [e.forcar]           a pessoa pediu (nas Definicoes): mostra
 *   sempre, mesmo com titulos. E' o unico caminho para o wizard depois do
 *   primeiro dia.
 * @param {boolean} e.bibliotecaVazia    a lista esta mesmo vazia? `null` (ainda a
 *   carregar) conta como **nao** — ver a nota no corpo.
 * @param {boolean} [e.jaDispensado]     ja se fechou ou se fez, e nao vale repetir
 */
export function deveMostrar(e = {}) {
  if (e.forcar) return true; // pediu-se explicitamente (nas Definicoes)
  if (e.jaDispensado) return false; // ja disse nao, ou ja fez
  // **`=== true`, nao truthy.** `count` vem do `LibraryContext` e e' `null`
  // enquanto a biblioteca carrega; `null === 0` e' falso, que e' o que se quer.
  return e.bibliotecaVazia === true;
}

/**
 * Por onde o onboarding comeca.
 *
 * Sempre pelo passo de importar. A raza de a funcao existir, devolve sempre a
 * mesma coisa, e' deixar a DECISAO escrita num sitio e nao espalhada por tres
 * `if`: quando houver um segundo caminho de entrada - quem vem de
 * `/library?importar`, ou quem ja importou e quer so ajustar o resto - e' uma
 * linha mudada.
 */
export function primeiroPasso() {
  return "importar";
}

/**
 * O passo seguinte, ou `null` no ultimo.
 *
 * Passos que o estado actual **nao permite** sao saltados: nao ha `generos` para
 * escolher se `/api/genres` nao respondeu, e oferecer um botao "Continuar" que
 * nao leva a lado nenhum e' pior que nao o ter.
 *
 * @param {string} passo
 * @param {object} [e]
 * @param {boolean} [e.temGeneros]  ha generos para oferecer?
 * @param {boolean} [e.temCores]    ha presets de cor?
 */
export function passoSeguinte(passo, e = {}) {
  const i = PASSOS.indexOf(passo);
  if (i < 0 || i >= PASSOS.length - 1) return null;
  let j = i + 1;
  while (j < PASSOS.length - 1) {
    const prox = PASSOS[j];
    if (prox === "generos" && e.temGeneros === false) { j++; continue; }
    if (prox === "cor" && e.temCores === false) { j++; continue; }
    break;
  }
  return PASSOS[j] || null;
}

/**
 * As portas de importacao que fazem sentido, **e que sao capazes de importar**.
 *
 * @param {object} e
 * @param {boolean} [e.malLigado]        a conta do MAL esta ligada a este perfil?
 * @param {boolean} [e.malNoServidor]    o servidor tem `MAL_CLIENT_ID`?
 * @param {boolean} [e.anilistLigado]    idem para o AniList
 * @param {boolean} [e.anilistNoServidor]
 * @param {boolean} [e.letterboxdLigado]
 * @returns {{ id: string, precisaLigar: boolean }[]}
 */
export function opcoesDe(e = {}) {
  const out = [];
  // O MAL so e' oferecido com as DUAS metades: o servidor configurado **e** a
  // conta ligada. Sem o `MAL_CLIENT_ID` o link de autorizacao da' 500, e oferecer
  // um botao que rebenta e' pior do que nao oferecer botao nenhum.
  if (e.malLigado && e.malNoServidor) out.push({ id: "mal", precisaLigar: false });
  if (e.anilistLigado && e.anilistNoServidor) out.push({ id: "anilist", precisaLigar: false });

  // O Letterboxd e' o unico que se liga **sem OAuth**: escreve-se o username.
  // E' a porta mais barata e por isso a que o texto pune primeiro.
  if (e.letterboxdLigado) out.push({ id: "letterboxd", precisaLigar: false });

  // O ficheiro entra sempre, e e' a unica que precisa de uma accao **antes** de
  // estar pronta: ate haver ficheiro escolhido nao ha nada que importar.
  out.push({ id: "ficheiro", precisaLigar: true });

  return out;
}

/**
 * A porta que o texto de "para onde vao os teus titulos" poe em primeiro.
 *
 * E' a **mais barata**, nao a mais popular: o Letterboxd escreve-se um username
 * e ja esta; o MAL e o AniList sao dois cliques com o browser a sair da app.
 * Uma pessoa que ve primeiro a porta cara tem mais probabilidade de desistir
 * antes de chegar a uma que resolve o problema em dez segundos.
 *
 * @returns {string|null} o id, ou `null` se so houver a de ficheiro
 */
export function portaEmPrimeiro(e = {}) {
  const ids = opcoesDe(e).map((o) => o.id);
  for (const preferido of ["letterboxd", "mal", "anilist"]) {
    if (ids.includes(preferido)) return preferido;
  }
  // So' ficheiro (ou nada): nao ha "primeira" porta a destacar, porque so ha uma.
  return null;
}

/**
 * A lista de generos que merece a pena oferecer.
 *
 * Sao os **generos do TMDB** (`getGenres`), e nao os que aparecem na biblioteca
 * de quem importa: essa lista depende do que a pessoa ja viu, e quem acabou de
 * criar a conta nao viu nada. Um onboarding que oferece "os teus generos"
 * quando nao ha "os teus" nenhum e' um formulario em branco.
 *
 * @param {{ id: number, name: string }[]} todos  de `/api/genres`
 * @param {number} [quantos]
 * @returns {{ id: number, name: string }[]}
 */
export function generosParaOferecer(todos, quantos = 12) {
  if (!Array.isArray(todos)) return [];
  const limpos = todos.filter((g) => g && Number.isFinite(Number(g.id)) && String(g.name || "").trim());
  if (limpos.length <= quantos) return limpos;
  // **Nao cortamos os doze primeiros.** O TMDB devolve os generos por ordem, e
  // cortar a lista dava sempre as mesmas opcoes a toda a gente - quem goste de
  // terror nunca veria "Terror" num sitio onde ha de escolher.
  //
  // E a lista **muda de sessao para sessao** de proposito: quem recusa a
  // primeira volta e ve outras, em vez da mesma que ja recusou.
  //
  // **A semente e' um contador, nao `Date.now()`.** Com `Date.now()` duas
  // chamadas no mesmo segundo davam a mesma lista - que era exactamente o que
  // se queria evitar, e o teste apanhou porque chama duas vezes seguidas.
  sementeAtual = (sementeAtual + 1) >>> 0;
  const sorteio = limpos
    .slice()
    .sort((a, b) => hashDaSemente(sementeAtual, Number(a.id)) - hashDaSemente(sementeAtual, Number(b.id)));
  return sorteio.slice(0, quantos);
}

/**
 * Um hash simples: o mesmo par (semente, id) da sempre o mesmo numero.
 *
 * Nao e' criptografico e nao precisa de ser - so' tem de espalhar bem o id.
 * Com ids consecutivos (28, 29, 30...) e um factor multiplicativo comum, os
 * numeros saiam muito parecidos e o "sorteio" voltava a dar a ordem
 * original. E' por isso que `Math.imul` e' bit a bit e nao `*`: em JavaScript
 * um `*` de dois numeros de 32 bits pode dar mais de 2^53 e perder precisao.
 */
function hashDaSemente(semente, id) {
  let h = (semente ^ Math.imul(id | 0, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A semente do proximo sorteio.
 *
 * Comeca num numero **aleatorio a serio**, para que a primeira lista de cada
 * sessao tambem varie: comecar a 1 daria sempre a mesma ordem a quem abre a
 * app pela primeira vez.
 *
 * E' estado do modulo, e nao uma variavel de topo inicializada uma vez - que
 * seria o mesmo. O que o torna seguro e' **nao mudar nada visivel**: a lista
 * e' sorteada de novo a cada montagem e nada guarda a ordem.
 */
let sementeAtual = (Math.random() * 0xffffffff) >>> 0;

/**
 * Acrescentar um genero a escolha, **sem passar do maximo e sem repetir**.
 *
 * Recebe o genero como vem de `/api/genres` — `{ id, name }` — e guarda as
 * **duas** coisas: o nome para mostrar, e o id para o `/api/discover`, que
 * so' aceita ids (ver `generosParaDiscover`).
 *
 * @param {({ id: number, name: string }|string)[]} atuais
 * @param {{ id: number, name: string }|string} genero
 * @returns {({ id: number, name: string }|string)[]} **um array novo** — quem
 *   chama e' que decide quando guardar, e mutar o antigo fazia o React nao
 *   redesenhar
 */
export function alternaGenero(atuais, genero) {
  const lista = Array.isArray(atuais) ? atuais : [];
  // Aceita `{ id, name }` (o que o `/api/genres` devolve) ou uma string. Com a
  // string so' o nome, que serve para mostrar mas **nao** para o discover.
  const nome = typeof genero === "object" && genero ? genero.name : genero;
  const id = typeof genero === "object" && genero ? genero.id : null;
  const limpo = String(nome || "").trim();
  if (!limpo) return lista;
  if (lista.some((x) => (typeof x === "object" ? x.name : x) === limpo)) {
    return lista.filter((x) => (typeof x === "object" ? x.name : x) !== limpo);
  }
  if (lista.length >= MAX_GENEROS) return lista; // **nao substitui**: escolher o quinto nao pode apagar o primeiro
  return [...lista, id != null ? { id: Number(id), name: limpo } : limpo];
}

/**
 * Onde param os generos escolhidos.
 *
 * O consumidor **ja existe**: `/api/discover?genres=27,35` devolve uma linha do
 * catalogo com esses generos, e a Home mostra-a como a primeira.
 *
 * **O `/api/discover` quer IDs, nao nomes.** Medido: `?genres=Terror` devolve
 * **0 itens** e `?genres=27` devolve **20** — a rota passa o valor directo para
 * o `with_genres` do TMDB, que e' uma lista de ids numericos. Por isso aqui se
 * guardam os **ids**, e o nome e' so para mostrar.
 *
 * (Um nome passa pelo TMDB sem erro nenhum: devolve uma lista vazia, e a linha
 * desaparece em silencio. Foi assim que se descobriu — a Home ficava igual,
 * como se nao houver generos escolhidos.)
 *
 * @param {{ id: number|string }[]} escolhidos
 * @returns {string} o valor de `genres` para o `/api/discover`, ou ""
 */
export function generosParaDiscover(escolhidos) {
  const lista = Array.isArray(escolhidos) ? escolhidos : [];
  return lista
    .map((g) => {
      // Aceita o objeto `{ id }` ou o id solto, para o chamador nao ter de
      // saber em que forma estao guardados.
      const bruto = g && typeof g === "object" ? g.id : g;
      const n = Number(bruto);
      return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : "";
    })
    .filter(Boolean)
    .join(",");
}

/**
 * O fecho — **decide se o numero aparece**, mas NAO escreve a frase.
 *
 * Um "pronto!" com o zero de lado e' pior do que nao dizer nada: quem esperou
 * dois minutos por um import e viu "0 titulos" vai supor que a app esta
 * partida. Por isso so se mostra o total quando **trouxe alguma coisa**.
 *
 * A frase fica no JSX, dentro de `t("...")`, e e' a **decisao** — numero ou
 * "esta vazia" — que sai daqui. Um `texto: "nenhum titulo"` devolvido daqui era
 * o auditor de traducao a acusar o ficheiro certo pela razao errada: e' texto
 * de interface dentro de um modulo puro, e sairia em portugues com a app em
 * ingles.
 *
 * @param {{ total?: number, importados?: number, fontes?: string[] }} r
 * @returns {{ mostrarNumeros: boolean, n: number, total: number, importados: number }}
 */
export function fechoDe(r = {}) {
  const total = Number(r.total) || 0;
  const importados = Number(r.importados) || 0;
  const fontes = Array.isArray(r.fontes) ? r.fontes.filter(Boolean) : [];
  const mostrarNumeros = total > 0;
  // **O numero e' o que foi importado quando houve alguma coisa, e o total caso
  // contrario.** Se a pessoa ja tinha titulos e o import falhou, dizer "0" seria
  // mentira; dizer o total da' a comparar com o que viu na lista.
  const n = importados > 0 ? importados : total;
  return { mostrarNumeros, n, total, importados, fontes };
}