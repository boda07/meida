// As traducoes da interface.
//
// A CHAVE E' O PROPRIO TEXTO EM PORTUGUES. Nao e' por preguiça: e' o que faz o
// `t()` nunca falhar. Se uma chave nao existe no ingles, sai o portugues em vez
// de um `nav.home` no ecra. `scripts/testar-i18n.mjs` avisa das faltantes.
//
// COMO ACRESCENTAR UM TEXTO:
//   1. No componente: `t("O texto em portugues")` — o texto tem de ser um
//      LITERAL, nunca uma variavel. `t("texto")` traduz, `t(variavel)` nao.
//   2. Aqui: acrescenta a linha no bloco certo, nos dois idiomas.
//
// COMO ACRESCENTAR UMA LINGUA:
//   1. `IDIOMAS` em baixo ganha o codigo ("es", "fr", ...).
//   2. `detectarIdioma()` em `I18nContext.jsx` compara com `IDIOMAS`, por isso
//      passa a funcionar sem mais alteracoes.
//   3. Um bloco novo nesta pagina com `{ ... }` para o novo idioma.
//
// NOTA SOBRE O INGLES: e' americano neutro. "Watchlist" fica "Watchlist" (e' o
// que toda a gente reconhece), mas "a ver agora" e' "Watching now" e nao
// "Currently watching" — mais curto, cabe no menu, e e' o que se espera ver.
export const IDIOMAS = ["pt", "en"];

export const NOMES_IDIOMA = {
  pt: "Português",
  en: "English",
};

/**
 * O dicionario. Cada idioma tem o SEU objecto com TODAS as chaves — nao se
 * parte de PT e se junta o resto, porque assim uma chave que falte num dos
 * lados e' visivel aqui (e o teste apanha) em vez de virar um undefined
 * silencioso em runtime.
 */
export const DICIONARIO = {
  pt: {
    // --- navegacao (Header.jsx) ---
    "Início": "Início",
    "Filmes": "Filmes",
    "Séries": "Séries",
    "Anime": "Anime",
    "Pesquisar": "Pesquisar",
    "Títulos, pessoas, géneros": "Títulos, pessoas, géneros",
    "Escolhe algo para mim": "Escolhe algo para mim",

    // --- menu do perfil (ProfileMenu.jsx) ---
    "Biblioteca": "Biblioteca",
    "Diário": "Diário",
    "Conquistas": "Conquistas",
    // "Estatísticas" esta' mais abaixo, na secção das estatísticas.
    "Compara as tuas notas": "Compara as tuas notas",
    "Definições": "Definições",
    "Sair": "Sair",

    // --- accoes e estados comuns ---
    "A carregar…": "A carregar…",
    "Carregando…": "Carregando…",
    "Tentar outra vez": "Tentar outra vez",
    "Voltar atrás": "Voltar atrás",
    "Recarregar": "Recarregar",
    "Fechar": "Fechar",
    "Guardar": "Guardar",
    "Cancelar": "Cancelar",
    "Apagar": "Apagar",
    "Remover": "Remover",
    "Editar": "Editar",
    "Continuar": "Continuar",
    "Ver tudo": "Ver tudo",

    // --- biblioteca ---
    "Vistos": "Vistos",
    "Para ver": "Para ver",
    "A ver agora": "A ver agora",
    "Em pausa": "Em pausa",
    "Abandonados": "Abandonados",
    "Marcar como visto": "Marcar como visto",
    "Marcar como não visto": "Marcar como não visto",
    "Adicionar à lista": "Adicionar à lista",
    "Remover da lista": "Remover da lista",
    "A tua biblioteca está vazia": "A tua biblioteca está vazia",

    // --- estatisticas (Stats.jsx, ProfileStats.jsx) ---
    "Estatísticas": "Estatísticas",
    "títulos": "títulos",
    "vistos": "vistos",
    "para ver": "para ver",
    "género mais visto": "género mais visto",
    "nota mais alta": "nota mais alta",
    "década favorita": "década favorita",
    "tempo visto": "tempo visto",
    "Só tu vês isto. Os números saem da tua biblioteca.":
      "Só tu vês isto. Os números saem da tua biblioteca.",
    "O resto": "O resto",
    "Como distribuis as notas": "Como distribuis as notas",
    "Ainda não há títulos na biblioteca, por isso ainda não há nada para contar.":
      "Ainda não há títulos na biblioteca, por isso ainda não há nada para contar.",
    "Ainda não deste nota a nenhum título. Dá nota a um e o histograma aparece aqui.":
      "Ainda não deste nota a nenhum título. Dá nota a um e o histograma aparece aqui.",

    // --- login / conta ---
    "Entrar": "Entrar",
    "Criar conta": "Criar conta",
    "Utilizador": "Utilizador",
    "Password": "Password",
    "Utilizador ou password inválidos.": "Utilizador ou password inválidos.",

    // --- definicoes ---
    "Geral": "Geral",
    "Aparência": "Aparência",
    "Reprodução": "Reprodução",
    "Conta": "Conta",
    "Dados": "Dados",
    "Avançado": "Avançado",
    "Perfil": "Perfil",
    "Conteúdo": "Conteúdo",
    "Idioma da interface": "Idioma da interface",
    "Títulos": "Títulos",
    "Idioma dos nomes de filmes, séries e anime.":
      "Idioma dos nomes de filmes, séries e anime.",
    "Procurar atualização": "Procurar atualização",
    "Atualizações automáticas só na app instalada.":
      "Atualizações automáticas só na app instalada.",
    "A procurar...": "A procurar...",
    "Nova versão {v} — a descarregar...": "Nova versão {v} — a descarregar...",
    "Já tens a versão mais recente. ✓": "Já tens a versão mais recente. ✓",
    "Indisponível em desenvolvimento.": "Indisponível em desenvolvimento.",
    "Não foi possível verificar agora.": "Não foi possível verificar agora.",
    "A minha lista": "A minha lista",
    "O meu perfil": "O meu perfil",
    "Encontrar pessoas": "Encontrar pessoas",
    "Contas": "Contas",
    "Secções das definições": "Secções das definições",
    "A lingua dos botoes, menus e textos da app.":
      "A lingua dos botoes, menus e textos da app.",
  },

  en: {
    // --- navegacao (Header.jsx) ---
    "Início": "Home",
    "Filmes": "Movies",
    "Séries": "TV Shows",
    "Anime": "Anime",
    "Pesquisar": "Search",
    "Títulos, pessoas, géneros": "Titles, people, genres",
    "Escolhe algo para mim": "Pick something for me",

    // --- menu do perfil (ProfileMenu.jsx) ---
    "Biblioteca": "Library",
    "Diário": "Diary",
    "Conquistas": "Achievements",
    // "Estatísticas" esta' mais abaixo, na secção das estatísticas.
    "Compara as tuas notas": "Rate things",
    "Definições": "Settings",
    "Sair": "Log out",

    // --- accoes e estados comuns ---
    "A carregar…": "Loading…",
    "Carregando…": "Loading…",
    "Tentar outra vez": "Try again",
    "Voltar atrás": "Go back",
    "Recarregar": "Reload",
    "Fechar": "Close",
    "Guardar": "Save",
    "Cancelar": "Cancel",
    "Apagar": "Delete",
    "Remover": "Remove",
    "Editar": "Edit",
    "Continuar": "Continue",
    "Ver tudo": "See all",

    // --- biblioteca ---
    "Vistos": "Watched",
    "Para ver": "Plan to watch",
    "A ver agora": "Watching now",
    "Em pausa": "Paused",
    "Abandonados": "Dropped",
    "Marcar como visto": "Mark as watched",
    "Marcar como não visto": "Mark as not watched",
    "Adicionar à lista": "Add to list",
    "Remover da lista": "Remove from list",
    "A tua biblioteca está vazia": "Your library is empty",

    // --- estatisticas (Stats.jsx, ProfileStats.jsx) ---
    "Estatísticas": "Statistics",
    "títulos": "titles",
    "vistos": "watched",
    "para ver": "to watch",
    "género mais visto": "most-watched genre",
    "nota mais alta": "highest rating",
    "década favorita": "favourite decade",
    "tempo visto": "time watched",
    "Só tu vês isto. Os números saem da tua biblioteca.":
      "Only you can see this. The numbers come from your library.",
    "O resto": "The rest",
    "Como distribuis as notas": "How your ratings are spread",
    "Ainda não há títulos na biblioteca, por isso ainda não há nada para contar.":
      "There are no titles in your library yet, so there is nothing to count.",
    "Ainda não deste nota a nenhum título. Dá nota a um e o histograma aparece aqui.":
      "You haven't rated anything yet. Rate something and the histogram shows up here.",

    // --- login / conta ---
    "Entrar": "Log in",
    "Criar conta": "Sign up",
    "Utilizador": "Username",
    "Password": "Password",
    "Utilizador ou password inválidos.": "Wrong username or password.",

    // --- definicoes ---
    "Geral": "General",
    "Aparência": "Appearance",
    "Reprodução": "Playback",
    "Conta": "Account",
    "Dados": "Data",
    "Avançado": "Advanced",
    "Perfil": "Profile",
    "Conteúdo": "Content",
    "Idioma da interface": "Interface language",
    "Títulos": "Titles",
    "Idioma dos nomes de filmes, séries e anime.":
      "Idioma dos nomes de filmes, séries e anime.",
    "Procurar atualização": "Check for updates",
    "Atualizações automáticas só na app instalada.":
      "Automatic updates only work in the installed app.",
    "A procurar...": "Checking...",
    "Nova versão {v} — a descarregar...":
      "New version {v} — downloading...",
    "Já tens a versão mais recente. ✓": "You're on the latest version. ✓",
    "Indisponível em desenvolvimento.": "Unavailable in development.",
    "Não foi possível verificar agora.": "Couldn't check right now.",
    "A minha lista": "My list",
    "O meu perfil": "My profile",
    "Encontrar pessoas": "Find people",
    "Contas": "Accounts",
    "Secções das definições": "Settings sections",
    "A lingua dos botoes, menus e textos da app.":
      "The language of buttons, menus and app text.",
  },
};

/**
 * Os textos que dependem de numeros. Ficam aqui e nao espalhados pelos
 * componentes para o plural ser resolvido num sitio so (e para o ingles ter o
 * "1 title" vs "2 titles" certo, que o portugues nao tem).
 *
 * `{n}` e' substituido pelo valor. O `plural` e' a forma de ingles: 1 usa a
 * primeira, o resto a segunda.
 */
export const PLURAIS = {
  pt: {
    titulos: (n) => `${n} títulos`,
    dias: (n) => `${n} dias`,
    horas: (n) => `${n} horas`,
    horasMin: (h, m) => `${h} h ${m} min`,
  },
  en: {
    titulos: (n) => (n === 1 ? "1 title" : `${n} titles`),
    dias: (n) => (n === 1 ? "1 day" : `${n} days`),
    horas: (n) => (n === 1 ? "1 hour" : `${n} hours`),
    horasMin: (h, m) => (h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`),
  },
};