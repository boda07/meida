// A barra de navegacao de baixo do telefone.
//
// PURE: nao toca em React, nem no DOM, nem le o `window`. A componente
// `NavBaixo.jsx` desenha; aqui decide-se o que esta aceso e o que vai no "mais".
//
// ---------------------------------------------------------------------------
// POR QUE ISTO E' UM FICHEIRO E NAO UM `.map()` DENTRO DO JSX
// ---------------------------------------------------------------------------
// O separador que fica aceso e' a unica coisa aqui que dá para errar sem erro
// nenhum: uma classe `active` trocada da para ver a pílula de cima, que nao
// tem classes, e a app continua a funcionar. O mesmo vale para a regra do
// "Descarregar a app" so aparecer no site. Escrito no JSX, nenhum dos dois
// alcancava um teste.
//
// ---------------------------------------------------------------------------
// A REGRA QUE ESTA SECCAO DEVE RESPONDER
// ---------------------------------------------------------------------------
// A pílula de cima tem **395 px** (medido) e o telefone mais comum que ainda se
// vende tem **365 px** de largura util. Transborda, e "Início" fica cortado de
// fora. Pior: os quatro botoes fixos (`z-index: 70`) estao **em cima** dela
// (`z-index: 60`) — todos os quatro dentro do intervalo horizontal da pílula —
// por isso ao tocar no sino quem reage e' o botao de ecra inteiro.
//
// A barra de baixo resolve as duas coisas, e por isso os dois limites tem de ser
// **o mesmo numero**. Se a barra aparecesse a 720 e os botoes se escondessem a
// 700, havia uma faixa de 20 px com a barra em baixo E os botoes por cima dela
// — a sobreposicao que a ideia mandava eliminar, só que mais pequena e mais
// difícil de ver. Ver `mesmoLimite()`.

// Abaixo disto (px de largura da janela): a barra de baixo aparece, a pílula de
// cima perde os links de categoria, e os quatro botões fixos desaparecem.
//
// **720 e nao 700** porque ja havia um `@media (max-width: 720px)` no `styles.css`
// (o "Descarregar a app" perde o texto). Ficar no mesmo sitio evita duas quebras
// lado a lado, e esconder os botoes um bocado mais cedo e' o lado seguro: mais
// tempo sem eles, nunca mais tempo com eles por cima da barra.
export const LIMITE = 720;

/**
 * A barra de baixo entra a `LIMITE`… e os botoes fixos saem **no mesmo sitio**.
 *
 * Recebe os dois numeros como argumentos em vez de os comparar a si mesmo:
 * `LIMITE === LIMITE` e' sempre verdadeiro e nao testa nada. Quem chama passa os
 * dois valores que leu — de preferencia do `styles.css` — e o teste passa valores
 * **diferentes** a proposito para ver a regra devolver `iguais: false`.
 */
export function mesmoLimite(barra = LIMITE, fixos = LIMITE) {
  return { barra, fixos, iguais: barra === fixos };
}

/**
 * Os cinco separadores, por ordem. A ordem e' a da esquerda para a direita e
 * **nao se muda em lnguas diferentes** — e' posicao, nao texto.
 *
 * `para` comeca por `/`, o que permite o `NavLink` tratar o "activo" sozinho.
 * O `perfil` e' o unico que **nao tem `para`**: depende de quem esta com a
 * sessao iniciada, e um `NavLink` com `para=""` manda para a pagina actual em
 * vez de para o perfil.
 *
 * **NAO ha rotulos aqui, de proposito.** Um rotulo e' interface; este ficheiro
 * e' logica. O auditor de traducao so sabe ler `t("...")`, e da primeira vez que
 * poe "Séries" aqui acusou o ficheiro inteiro — o que estava certo. Os rotulos
 * vivem em `NavBaixo.jsx`, e `scripts/testar-nav-baixo.mjs` verifica que cada
 * `id` deste ficheiro tem o seu `t("...")`. E' mais forte do que o auditor:
 * apanha tambem um `id` escrito wrong no JSX.
 */
export const ITENS = [
  { id: "inicio", para: "/" },
  { id: "pesquisa", para: "/search" },
  { id: "biblioteca", para: "/library" },
  { id: "perfil", para: null },
  { id: "mais", para: null },
];

/**
 * Normaliza um caminho para comparar: sem barra no fim, sem interrogacao nem
 * `#`, minusculas.
 *
 * **A barra no fim e' o caso que importa.** O `/library/` e' a mesma pagina que
 * o `/library`; sem isto, voltar para o `/` e depois em frente para a
 * biblioteca deixaria a barra sem separador aceso, e ninguem notaria porque a
 * pílula de cima nao tem separadores.
 */
export function caminhoLimpo(caminho) {
  if (typeof caminho !== "string") return "/";
  let c = caminho.split("?")[0].split("#")[0].toLowerCase();
  while (c.length > 1 && c.endsWith("/")) c = c.slice(0, -1);
  return c || "/";
}

/**
 * Para onde vai o separador "Perfil".
 *
 * Sem sessao vai para `/login` — **o mesmo sitio para onde vai o avatar**, e
 * nao para um `/perfil` que nao existe. A lista de utilizadores e' `/users`.
 */
export function perfilDe(username) {
  const nome = (typeof username === "string" ? username : "").trim();
  return nome ? "/u/" + encodeURIComponent(nome) : "/login";
}

/**
 * Que separador esta aceso num caminho dado.
 *
 * Devolve `null` quando nenhum: e' melhor um separador apagado do que um
 * separador aceso a mentira. Ver as regras:
 *
 * - `/` so comeca aCountar se for **exacto** (`/inicio` nao e' o inicio).
 * - `/u/<outro>` **nao** acende o "Perfil": o separador e' o *meu* perfil, e
 *   acender o quando se esta a ver o de outra pessoa e' dizer que aquela pessoa
 *   es tu. Fica apagado, e o "Mais" tambem — que e' honesto: nao tens um
 *   separador para a pagina de outra pessoa.
 * - Tudo o resto (filmes, diario, estatisticas, `/settings`…) devolve `null`.
 *
 * @param {string} caminho  a rota actual
 * @param {string} [username] quem esta com a sessao iniciada
 */
export function activoDe(caminho, username) {
  const c = caminhoLimpo(caminho);

  if (c === "/") return "inicio";
  if (c === "/search") return "pesquisa";
  if (c === "/library") return "biblioteca";

  // `/u/...` so acende quando e' o proprio nome. A comparacao e' sobre o caminho
  // **descodificado** dos dois lados: `/u/Jos%C3%A9` e `/u/José` sao a mesma
  // pessoa, e o `encodeURIComponent` de um lado contra o outro nunca casaria.
  if (c.startsWith("/u/")) {
    let nome;
    try {
      nome = decodeURIComponent(c.slice(3));
    } catch {
      // `%` solto ou percentagem partida. **Nao se sabe quem e'**, portanto fica
      // a nulo: com a variante "deixa o texto como estava", um username
      // literalmente "%E0%A4%A" casava com um caminho mal formado e acendia o
      // "Perfil" na pessoa errada.
      nome = null;
    }
    const meu = (typeof username === "string" ? username : "").trim().toLowerCase();
    if (meu && nome !== null && nome.toLowerCase() === meu) return "perfil";
  }

  return null;
}

/**
 * O que vai na folha do "mais".
 *
 * Tudo o que **nao** tem separador proprio na barra de baixo. Devolve `id` e
 * `para` — o rotulo vem do JSX (ver a nota em `ITENS`).
 *
 * E' uma funcao e nao uma constante porque ha uma condicao: "Descarregar a app"
 * **so no site**, que na app de desktop e' absurdo oferecer o download de algo
 * que a pessoa ja tem. E' a mesma regra do cabecalho, e por isso reusa a mesma
 * funcao pura (`lib/web.js`) em vez de repetir a condicao.
 *
 * "Definições" e' sempre o ultimo: nao e' discusses, e' a ultima coisa de uma
 * lista de destinos. A ordem alfabetica puniria "Diario" a seguir a "Definicoes"
 * sem motivo nenhum.
 *
 * @param {{ ehSite?: boolean }} [opcoes]
 * @returns {{ id: string, para: string, externo?: boolean }[]}
 */
export function itensDoMais({ ehSite = false } = {}) {
  const itens = [
    { id: "filmes", para: "/movies" },
    { id: "series", para: "/series" },
    { id: "anime", para: "/anime" },
    { id: "diario", para: "/diary" },
    { id: "conquistas", para: "/achievements" },
    { id: "estatisticas", para: "/stats" },
    { id: "pick", para: "/pick" },
    { id: "comparar", para: "/compare" },
    { id: "pessoas", para: "/users" },
  ];
  if (ehSite) {
    itens.push({ id: "descarregar", para: "#descarregar", externo: true });
  }
  itens.push({ id: "definicoes", para: "/settings" });
  return itens;
}