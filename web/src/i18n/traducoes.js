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
    // --- definicoes ---
    "Autoriza no browser e volta a esta janela.":
      "Autoriza no browser e volta a esta janela.",
    "Entra": "Entra",
    "A importar...": "A importar...",
    "Desligar conta": "Desligar conta",
    "Falha na sincronização.": "Falha na sincronização.",
    "A sincronizar...": "A sincronizar...",
    "Conta ligada. Carrega em Importar para trazer os teus filmes.":
      "Conta ligada. Carrega em Importar para trazer os teus filmes.",
    "username do Letterboxd": "username do Letterboxd",
    "A ligar...": "A ligar...",
    "Real-Debrid ligado. Os torrents em cache no DeBrid reproduzem logo.":
      "Real-Debrid ligado. Os torrents em cache no DeBrid reproduzem logo.",
    "token do Real-Debrid": "token do Real-Debrid",
    "Não foi possível guardar.": "Não foi possível guardar.",
    "Guardado. A reiniciar...": "Guardado. A reiniciar...",
    "Ficheiro descarregado. Vai à pasta de downloads do teu sistema.":
      "Ficheiro descarregado. Vai à pasta de downloads do teu sistema.",
    "Não foi possível exportar.": "Não foi possível exportar.",
    "Não foi possível importar.": "Não foi possível importar.",
    "Servidor": "Servidor",
    "Este computador": "Este computador",
    "Servidor remoto": "Servidor remoto",
    "Endereço do servidor": "Endereço do servidor",
    "Sinopses": "Sinopses",
    "Idioma das descrições/sinopses.": "Idioma das descrições/sinopses.",
    "Géneros": "Géneros",
    "Idioma dos géneros e temas (na tua lista, filtros e detalhes).":
      "Idioma dos géneros e temas (na tua lista, filtros e detalhes).",
    "Legendas": "Legendas",
    "Anime: áudio": "Anime: áudio",
    "Anime: títulos": "Anime: títulos",
    "Conteúdo adulto (anime)": "Conteúdo adulto (anime)",
    "Separador inicial": "Separador inicial",
    "Onde abrir por defeito ao ver um título.":
      "Onde abrir por defeito ao ver um título.",
    "Tamanho dos cartazes": "Tamanho dos cartazes",
    "Largura": "Largura",
    "Altura": "Altura",
    "Cor de destaque": "Cor de destaque",
    "Cor de fundo": "Cor de fundo",
    "Estilo de fundo": "Estilo de fundo",
    "Cola o URL de uma imagem (https://...)":
      "Cola o URL de uma imagem (https://...)",
    "MyAnimeList": "MyAnimeList",
    "AniList": "AniList",
    "Os teus dados": "Os teus dados",
    "A exportar...": "A exportar...",
    "Discord": "Discord",
    "Mostrar no Discord o que estou a ver":
      "Mostrar no Discord o que estou a ver",
    "Importar dados": "Importar dados",
    "Letterboxd": "Letterboxd",
    "Real-Debrid": "Real-Debrid",
    "Bio": "Bio",
    "Uma frase sobre os teus gostos...": "Uma frase sobre os teus gostos...",
    "Avatar": "Avatar",
    "...ou cola o URL de uma imagem (https://...)":
      "...ou cola o URL de uma imagem (https://...)",
    "Estado dos providers": "Estado dos providers",
    "A testar providers...": "A testar providers...",
    "Sem informação.": "Sem informação.",
    "Atualizado há 24h+": "Atualizado há 24h+",
    "Atualizações": "Atualizações",
    "Desinstalar": "Desinstalar",
    // --- definicoes ---
    "A guardar...": "A guardar...",
    "Guardar e reiniciar": "Guardar e reiniciar",
    "O servidor remoto tem de correr o MEIDA com a web incluída (ex.: {cmd}).":
      "O servidor remoto tem de correr o MEIDA com a web incluída (ex.: {cmd}).",
    "Importar lista do MAL": "Importar lista do MAL",
    // --- resto da app ---
    "Mangá, Manhwa &amp; Manhua": "Mangá, Manhwa &amp; Manhua",
    "A ver o que andas a ler": "A ver o que andas a ler",
    "Tipo (vazio = todos)": "Tipo (vazio = todos)",
    "Com base em:": "Com base em:",
    "A escolher recomendações": "A escolher recomendações",
    "A procurar mais...": "A procurar mais...",
    "A carregar a tua lista": "A carregar a tua lista",
    "Estado (vazio = qualquer)": "Estado (vazio = qualquer)",
    "Ordenar": "Ordenar",
    "Tem de ter todos os géneros escolhidos":
      "Tem de ter todos os géneros escolhidos",
    "Basta ter um dos géneros escolhidos": "Basta ter um dos géneros escolhidos",
    "Opções": "Opções",
    "Precisa de teres o MyAnimeList ligado":
      "Precisa de teres o MyAnimeList ligado",
    "Procurar género/tema (ex.: time travel)":
      "Procurar género/tema (ex.: time travel)",
    "A carregar géneros...": "A carregar géneros...",
    "Perfil privado": "Perfil privado",
    "em pausa": "em pausa",
    "média": "média",
    "Segue o utilizador, mas a biblioteca só ele a vê.":
      "Segue o utilizador, mas a biblioteca só ele a vê.",
    "Entra para o adicionares.": "Entra para o adicionares.",
    "A biblioteca está vazia.": "A biblioteca está vazia.",
    "Ainda sem listas.": "Ainda sem listas.",
    "Esta lista está vazia.": "Esta lista está vazia.",
    "Ninguém por aqui.": "Ninguém por aqui.",
    "Este título não tem IMDB id — torrents indisponiveis.":
      "Este título não tem IMDB id — torrents indisponiveis.",
    "A procurar torrents...": "A procurar torrents...",
    "Nenhum torrent encontrado.": "Nenhum torrent encontrado.",
    "A preparar stream no Real-Debrid...": "A preparar stream no Real-Debrid...",
    "Mais seeders": "Mais seeders",
    "Qualidade": "Qualidade",
    "Maior tamanho": "Maior tamanho",
    "Menor tamanho": "Menor tamanho",
    "Só torrents que já estão em cache no Real-Debrid (reproduzem logo)":
      "Só torrents que já estão em cache no Real-Debrid (reproduzem logo)",
    "Só torrents x264 (mais compatíveis com o browser)":
      "Só torrents x264 (mais compatíveis com o browser)",
    "Só torrents x265/HEVC (mais pequenos, mas o browser não reproduz)":
      "Só torrents x265/HEVC (mais pequenos, mas o browser não reproduz)",
    "Já está em cache no Real-Debrid — reproduz logo":
      "Já está em cache no Real-Debrid — reproduz logo",
    "Reproduz nativamente no browser (mp4/webm)":
      "Reproduz nativamente no browser (mp4/webm)",
    ".mkv x265 — o Chrome/Safari não reproduzem este codec. Prefere .mp4 x264.":
      ".mkv x265 — o Chrome/Safari não reproduzem este codec. Prefere .mp4 x264.",
    "Nenhum torrent nesta qualidade.": "Nenhum torrent nesta qualidade.",
    "Guardado no diário.": "Guardado no diário.",
    "Sem sinopse.": "Sem sinopse.",
    "Temporada:": "Temporada:",
    "A carregar fontes...": "A carregar fontes...",
    "Torrents": "Torrents",
    "Sem anúncios": "Sem anúncios",
    "Se gostaste disto": "Se gostaste disto",
    "Ordenar por": "Ordenar por",
    "Renomear": "Renomear",
    "Apagar lista": "Apagar lista",
    "Ex.: Para ver com amigos": "Ex.: Para ver com amigos",
    "Limpar watchlist": "Limpar watchlist",
    "Filtrar por género/tema": "Filtrar por género/tema",
    "Nada nesta categoria.": "Nada nesta categoria.",
    "Ir para esse comentário": "Ir para esse comentário",
    "Comentário apagado": "Comentário apagado",
    "Responder": "Responder",
    "Apagar este comentário?": "Apagar este comentário?",
    "Comentários": "Comentários",
    "Diz o que achaste... (escreve @ para chamar alguém)":
      "Diz o que achaste... (escreve @ para chamar alguém)",
    "Momento do vídeo (opcional). Aceita 2:05 ou 125.":
      "Momento do vídeo (opcional). Aceita 2:05 ou 125.",
    "Usar o momento em que estás": "Usar o momento em que estás",
    "A carregar comentários...": "A carregar comentários...",
    "Ainda sem comentários. Sê o primeiro.":
      "Ainda sem comentários. Sê o primeiro.",
    "Baixar 1": "Baixar 1",
    "Baixar": "Baixar",
    "Subir 1": "Subir 1",
    "Aumentar": "Aumentar",
    "A carregar a tua lista...": "A carregar a tua lista...",
    "Filtra por tipo:": "Filtra por tipo:",
    "séries": "séries",
    "Estão bem assim — vai para o próximo par":
      "Estão bem assim — vai para o próximo par",
    "Manter e próximo": "Manter e próximo",
    "Começou:": "Começou:",
    "Acabou:": "Acabou:",
    "A ver": "A ver",
    "Terminado": "Terminado",
    "A média bate certo com a mediana, por isso as notas estão todas pela mesma banda.":
      "A média bate certo com a mediana, por isso as notas estão todas pela mesma banda.",
    "A tua nota": "A tua nota",
    "Comparar avaliação": "Comparar avaliação",
    "Já viste": "Já viste",
    "Copiado!": "Copiado!",
    "O teu nome": "O teu nome",
    "Como queres aparecer": "Como queres aparecer",
    "ou entrar numa sala": "ou entrar numa sala",
    "Codigo da sala": "Codigo da sala",
    "Comecei mas parei": "Comecei mas parei",
    "Não vou acabar isto": "Não vou acabar isto",
    "Abrir no Letterboxd": "Abrir no Letterboxd",
    "Comparar com a comunidade": "Comparar com a comunidade",
    "Comunidade:": "Comunidade:",
    "Tu:": "Tu:",
    "com nota": "com nota",
    "Ao longo do ano": "Ao longo do ano",
    "As tuas notas": "As tuas notas",
    "sem nota": "sem nota",
    "Nada encontrado com esses filtros. Tira alguns e tenta de novo.":
      "Nada encontrado com esses filtros. Tira alguns e tenta de novo.",
    "não quero": "não quero",
    "A escolher...": "A escolher...",
    "A tua escolha": "A tua escolha",
    "A carregar conquistas": "A carregar conquistas",
    "dias de racha": "dias de racha",
    "melhor:": "melhor:",
    "Nada encontrado com estes filtros.": "Nada encontrado com estes filtros.",
    "Filtrar por género": "Filtrar por género",
    "Falhou ao adicionar.": "Falhou ao adicionar.",
    "Falhou ao criar a lista.": "Falhou ao criar a lista.",
    "Adicionar a que lista?": "Adicionar a que lista?",
    "Ainda nao tens listas.": "Ainda nao tens listas.",
    "Nome da nova lista": "Nome da nova lista",
    "A extrair stream sem anúncios...": "A extrair stream sem anúncios...",
    "Sem stream direto para este título de momento.":
      "Sem stream direto para este título de momento.",
    "Providers": "Providers",
    "Carregar o video": "Carregar o video",
    "Carregar video": "Carregar video",
    "Recarregar fonte (se nao carregar / erro 520)":
      "Recarregar fonte (se nao carregar / erro 520)",
    "Recarregar fonte": "Recarregar fonte",
    "Escreve algo na pesquisa.": "Escreve algo na pesquisa.",
    "Sem resultados para": "Sem resultados para",
    "Resultados para": "Resultados para",
    "Escreve um nome de utilizador...": "Escreve um nome de utilizador...",
    "Nenhum utilizador encontrado.": "Nenhum utilizador encontrado.",
    "Fonte:": "Fonte:",
    "em baixo": "em baixo",
    "Site externo:": "Site externo:",
    "Procurar este filme/episódio no Google":
      "Procurar este filme/episódio no Google",
    "Não consegui carregar o catálogo:": "Não consegui carregar o catálogo:",
    "Sem stream sem anúncios para este episódio de momento.":
      "Sem stream sem anúncios para este episódio de momento.",
    "O extrator não devolveu fontes.": "O extrator não devolveu fontes.",
    "Fontes": "Fontes",
    "Continua a ver": "Continua a ver",
    "Remover de Continua a ver": "Remover de Continua a ver",
    "Anterior": "Anterior",
    "Seguinte": "Seguinte",
    "Avançar": "Avançar",
    "Scroll esquerda": "Scroll esquerda",
    "Scroll direita": "Scroll direita",
    "Notificações": "Notificações",
    "Nada por aqui. Quando alguém responder a um comentário teu ou gostar dele, aparece um aviso aqui.":
      "Nada por aqui. Quando alguém responder a um comentário teu ou gostar dele, aparece um aviso aqui.",
    "Legendas:": "Legendas:",
    "Desligadas": "Desligadas",
    "Trailer": "Trailer",
    "Ecra inteiro": "Ecra inteiro",
    "Novidades": "Novidades",
    "Algo correu mal": "Algo correu mal",
    "Sem fonte.": "Sem fonte.",
    "A parar...": "A parar...",
    // --- final ---
    "A carregar o diário": "A carregar o diário",
    "Editar —": "Editar —",
    "Visto": "Visto",
    "A carregar...": "A carregar...",
    "A carregar o perfil": "A carregar o perfil",
    "a ver agora": "a ver agora",
    "A ver ...": "A ver ...",
    "A carregar": "A carregar",
    "não": "não",
    // --- pesquisa e hero ---
    "A procurar \"{q}\"": "A procurar \"{q}\"",
    "Sem resultados para \"{q}\".": "Sem resultados para \"{q}\".",
    "Resultados para \"{q}\"": "Resultados para \"{q}\"",
    "Série": "Série",
    "Nada por aqui. Quando alguém responder a um comentário teu ou gostar dele, aparece aqui.":
      "Nada por aqui. Quando alguém responder a um comentário teu ou gostar dele, aparece aqui.",
    "A procurar \"{q}\" em categorias...": "A procurar \"{q}\" em categorias...",
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
    // --- definicoes ---
    "Autoriza no browser e volta a esta janela.":
      "Authorize in the browser and come back to this window.",
    "Entra": "Log in",
    "A importar...": "Importing...",
    "Desligar conta": "Disconnect account",
    "Falha na sincronização.": "Sync failed.",
    "A sincronizar...": "Syncing...",
    "Conta ligada. Carrega em Importar para trazer os teus filmes.":
      "Account connected. Click Import to bring in your movies.",
    "username do Letterboxd": "Letterboxd username",
    "A ligar...": "Connecting...",
    "Real-Debrid ligado. Os torrents em cache no DeBrid reproduzem logo.":
      "Real-Debrid connected. Cached torrents on DeBrid start right away.",
    "token do Real-Debrid": "Real-Debrid token",
    "Não foi possível guardar.": "Couldn't save.",
    "Guardado. A reiniciar...": "Saved. Restarting...",
    "Ficheiro descarregado. Vai à pasta de downloads do teu sistema.":
      "File downloaded. Check your system's downloads folder.",
    "Não foi possível exportar.": "Couldn't export.",
    "Não foi possível importar.": "Couldn't import.",
    "Servidor": "Server",
    "Este computador": "This computer",
    "Servidor remoto": "Remote server",
    "Endereço do servidor": "Server address",
    "Sinopses": "Synopses",
    "Idioma das descrições/sinopses.": "Language of descriptions/synopses.",
    "Géneros": "Genres",
    "Idioma dos géneros e temas (na tua lista, filtros e detalhes).":
      "Language for genres and themes (in your library, filters and details).",
    "Legendas": "Subtitles",
    "Anime: áudio": "Anime: audio",
    "Anime: títulos": "Anime: titles",
    "Conteúdo adulto (anime)": "Adult content (anime)",
    "Separador inicial": "Default page",
    "Onde abrir por defeito ao ver um título.":
      "Where to open by default when you open a title.",
    "Tamanho dos cartazes": "Poster size",
    "Largura": "Width",
    "Altura": "Height",
    "Cor de destaque": "Accent color",
    "Cor de fundo": "Background color",
    "Estilo de fundo": "Background style",
    "Cola o URL de uma imagem (https://...)": "Paste an image URL (https://...)",
    "MyAnimeList": "MyAnimeList",
    "AniList": "AniList",
    "Os teus dados": "Your data",
    "A exportar...": "Exporting...",
    "Discord": "Discord",
    "Mostrar no Discord o que estou a ver": "Show on Discord what I'm watching",
    "Importar dados": "Import data",
    "Letterboxd": "Letterboxd",
    "Real-Debrid": "Real-Debrid",
    "Bio": "Bio",
    "Uma frase sobre os teus gostos...": "A line about what you like...",
    "Avatar": "Avatar",
    "...ou cola o URL de uma imagem (https://...)":
      "...or paste an image URL (https://...)",
    "Estado dos providers": "Provider status",
    "A testar providers...": "Testing providers...",
    "Sem informação.": "No information.",
    "Atualizado há 24h+": "Updated 24h+ ago",
    "Atualizações": "Updates",
    "Desinstalar": "Uninstall",
    // --- definicoes ---
    "A guardar...": "Saving...",
    "Guardar e reiniciar": "Save and restart",
    "O servidor remoto tem de correr o MEIDA com a web incluída (ex.: {cmd}).":
      "The remote server must run MEIDA with the web included (e.g. {cmd}).",
    "Importar lista do MAL": "Import MAL list",
    // --- resto da app ---
    "Mangá, Manhwa &amp; Manhua": "Manga, Manhwa & Manhua",
    "A ver o que andas a ler": "See what you're reading",
    "Tipo (vazio = todos)": "Type (empty = all)",
    "Com base em:": "Based on:",
    "A escolher recomendações": "Picking recommendations",
    "A procurar mais...": "Looking for more...",
    "A carregar a tua lista": "Loading your library",
    "Estado (vazio = qualquer)": "Status (empty = any)",
    "Ordenar": "Sort",
    "Tem de ter todos os géneros escolhidos": "Must have all the selected genres",
    "Basta ter um dos géneros escolhidos": "Needs any one of the selected genres",
    "Opções": "Options",
    "Precisa de teres o MyAnimeList ligado": "You need MyAnimeList connected",
    "Procurar género/tema (ex.: time travel)":
      "Search genre/theme (e.g. time travel)",
    "A carregar géneros...": "Loading genres...",
    "Perfil privado": "Private profile",
    "em pausa": "on pause",
    "média": "average",
    "Segue o utilizador, mas a biblioteca só ele a vê.":
      "You follow this user, but only they can see their library.",
    "Entra para o adicionares.": "Log in to follow them.",
    "A biblioteca está vazia.": "The library is empty.",
    "Ainda sem listas.": "No lists yet.",
    "Esta lista está vazia.": "This list is empty.",
    "Ninguém por aqui.": "Nobody here.",
    "Este título não tem IMDB id — torrents indisponiveis.":
      "This title has no IMDB id — torrents unavailable.",
    "A procurar torrents...": "Searching torrents...",
    "Nenhum torrent encontrado.": "No torrents found.",
    "A preparar stream no Real-Debrid...": "Preparing stream on Real-Debrid...",
    "Mais seeders": "More seeders",
    "Qualidade": "Quality",
    "Maior tamanho": "Larger size",
    "Menor tamanho": "Smaller size",
    "Só torrents que já estão em cache no Real-Debrid (reproduzem logo)":
      "Only torrents already cached on Real-Debrid (start right away)",
    "Só torrents x264 (mais compatíveis com o browser)":
      "Only x264 torrents (more browser-compatible)",
    "Só torrents x265/HEVC (mais pequenos, mas o browser não reproduz)":
      "Only x265/HEVC torrents (smaller, but the browser can't play them)",
    "Já está em cache no Real-Debrid — reproduz logo":
      "Already cached on Real-Debrid — starts right away",
    "Reproduz nativamente no browser (mp4/webm)":
      "Plays natively in the browser (mp4/webm)",
    ".mkv x265 — o Chrome/Safari não reproduzem este codec. Prefere .mp4 x264.":
      ".mkv x265 — Chrome/Safari can't play this codec. Prefer .mp4 x264.",
    "Nenhum torrent nesta qualidade.": "No torrents in this quality.",
    "Guardado no diário.": "Saved to the diary.",
    "Sem sinopse.": "No synopsis.",
    "Temporada:": "Season:",
    "A carregar fontes...": "Loading sources...",
    "Torrents": "Torrents",
    "Sem anúncios": "Ad-free",
    "Se gostaste disto": "If you liked this",
    "Ordenar por": "Sort by",
    "Renomear": "Rename",
    "Apagar lista": "Delete list",
    "Ex.: Para ver com amigos": "E.g. To watch with friends",
    "Limpar watchlist": "Clear watchlist",
    "Filtrar por género/tema": "Filter by genre/theme",
    "Nada nesta categoria.": "Nothing in this category.",
    "Ir para esse comentário": "Go to that comment",
    "Comentário apagado": "Comment deleted",
    "Responder": "Reply",
    "Apagar este comentário?": "Delete this comment?",
    "Comentários": "Comments",
    "Diz o que achaste... (escreve @ para chamar alguém)":
      "Say what you thought... (type @ to call someone)",
    "Momento do vídeo (opcional). Aceita 2:05 ou 125.":
      "Video moment (optional). Accepts 2:05 or 125.",
    "Usar o momento em que estás": "Use the moment you're at",
    "A carregar comentários...": "Loading comments...",
    "Ainda sem comentários. Sê o primeiro.": "No comments yet. Be the first.",
    "Baixar 1": "Down 1",
    "Baixar": "Down",
    "Subir 1": "Up 1",
    "Aumentar": "Up",
    "A carregar a tua lista...": "Loading your library...",
    "Filtra por tipo:": "Filter by type:",
    "séries": "shows",
    "Estão bem assim — vai para o próximo par":
      "These are fine — go to the next pair",
    "Manter e próximo": "Keep and next",
    "Começou:": "Started:",
    "Acabou:": "Finished:",
    "A ver": "Watching",
    "Terminado": "Finished",
    "A média bate certo com a mediana, por isso as notas estão todas pela mesma banda.":
      "The average matches the median, so your ratings are all in the same band.",
    "A tua nota": "Your rating",
    "Comparar avaliação": "Compare ratings",
    "Já viste": "You've watched it",
    "Copiado!": "Copied!",
    "O teu nome": "Your name",
    "Como queres aparecer": "How you want to appear",
    "ou entrar numa sala": "or join a room",
    "Codigo da sala": "Room code",
    "Comecei mas parei": "Started but stopped",
    "Não vou acabar isto": "I'm not finishing this",
    "Abrir no Letterboxd": "Open on Letterboxd",
    "Comparar com a comunidade": "Compare with the community",
    "Comunidade:": "Community:",
    "Tu:": "You:",
    "com nota": "with a rating",
    "Ao longo do ano": "Throughout the year",
    "As tuas notas": "Your ratings",
    "sem nota": "no rating",
    "Nada encontrado com esses filtros. Tira alguns e tenta de novo.":
      "Nothing found with those filters. Remove some and try again.",
    "não quero": "don't want",
    "A escolher...": "Picking...",
    "A tua escolha": "Your pick",
    "A carregar conquistas": "Loading achievements",
    "dias de racha": "day streak",
    "melhor:": "best:",
    "Nada encontrado com estes filtros.": "Nothing found with these filters.",
    "Filtrar por género": "Filter by genre",
    "Falhou ao adicionar.": "Failed to add.",
    "Falhou ao criar a lista.": "Failed to create the list.",
    "Adicionar a que lista?": "Add to which list?",
    "Ainda nao tens listas.": "You don't have any lists yet.",
    "Nome da nova lista": "Name of the new list",
    "A extrair stream sem anúncios...": "Extracting ad-free stream...",
    "Sem stream direto para este título de momento.":
      "No direct stream for this title right now.",
    "Providers": "Providers",
    "Carregar o video": "Load the video",
    "Carregar video": "Load video",
    "Recarregar fonte (se nao carregar / erro 520)":
      "Reload source (if it doesn't load / error 520)",
    "Recarregar fonte": "Reload source",
    "Escreve algo na pesquisa.": "Type something in the search.",
    "Sem resultados para": "No results for",
    "Resultados para": "Results for",
    "Escreve um nome de utilizador...": "Type a username...",
    "Nenhum utilizador encontrado.": "No users found.",
    "Fonte:": "Source:",
    "em baixo": "below",
    "Site externo:": "External site:",
    "Procurar este filme/episódio no Google":
      "Search this movie/episode on Google",
    "Não consegui carregar o catálogo:": "Couldn't load the catalog:",
    "Sem stream sem anúncios para este episódio de momento.":
      "No ad-free stream for this episode right now.",
    "O extrator não devolveu fontes.": "The extractor returned no sources.",
    "Fontes": "Sources",
    "Continua a ver": "Continue watching",
    "Remover de Continua a ver": "Remove from Continue watching",
    "Anterior": "Previous",
    "Seguinte": "Next",
    "Avançar": "Go forward",
    "Scroll esquerda": "Scroll left",
    "Scroll direita": "Scroll right",
    "Notificações": "Notifications",
    "Nada por aqui. Quando alguém responder a um comentário teu ou gostar dele, aparece um aviso aqui.":
      "Nothing here. When someone replies to your comment or likes it, a notice shows up here.",
    "Legendas:": "Subtitles:",
    "Desligadas": "Off",
    "Trailer": "Trailer",
    "Ecra inteiro": "Fullscreen",
    "Novidades": "What's new",
    "Algo correu mal": "Something went wrong",
    "Sem fonte.": "No source.",
    "A parar...": "Stopping...",
    // --- final ---
    "A carregar o diário": "Loading the diary",
    "Editar —": "Edit —",
    "Visto": "Watched",
    "A carregar...": "Loading...",
    "A carregar o perfil": "Loading the profile",
    "a ver agora": "watching now",
    "A ver ...": "Watching ...",
    "A carregar": "Loading",
    "não": "not",
    // --- pesquisa e hero ---
    "A procurar \"{q}\"": "Searching \"{q}\"",
    "Sem resultados para \"{q}\".": "No results for \"{q}\".",
    "Resultados para \"{q}\"": "Results for \"{q}\"",
    "Série": "TV show",
    "Nada por aqui. Quando alguém responder a um comentário teu ou gostar dele, aparece aqui.":
      "Nothing here. When someone replies to your comment or likes it, a notice shows up here.",
    "A procurar \"{q}\" em categorias...": "Searching categories for \"{q}\"...",
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