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
    // --- changelog ---
    "Fixe!": "Fixe!",
    // --- erros do servidor ---
    "a lista precisa de um nome": "a lista precisa de um nome",
    "AniList nao configurado no servidor.":
      "AniList nao configurado no servidor.",
    "Anime nao encontrado no AniList": "Anime nao encontrado no AniList",
    "Cola o teu token do Real-Debrid.": "Cola o teu token do Real-Debrid.",
    "Comentario a responder nao existe.": "Comentario a responder nao existe.",
    "Comentario nao existe.": "Comentario nao existe.",
    "Conta AniList nao ligada.": "Conta AniList nao ligada.",
    "Conta MAL nao ligada.": "Conta MAL nao ligada.",
    "Escreve alguma coisa.": "Escreve alguma coisa.",
    "Esse utilizador ja existe.": "Esse utilizador ja existe.",
    "Este perfil é privado.": "Este perfil é privado.",
    "Extrator de anime nao configurado.": "Extrator de anime nao configurado.",
    "falta o parametro tmdb": "falta o parametro tmdb",
    "falta o parametro url": "falta o parametro url",
    "faltam parametros id e season": "faltam parametros id e season",
    "faltam parametros type e id": "faltam parametros type e id",
    "faltam tmdb e title": "faltam tmdb e title",
    "faltam tmdbId e type": "faltam tmdbId e type",
    "faltam type e tmdb": "faltam type e tmdb",
    "faltam type e tmdbId": "faltam type e tmdbId",
    "faltam type, tmdbId e position": "faltam type, tmdbId e position",
    "formato invalido": "formato invalido",
    "Indica o teu username do Letterboxd.":
      "Indica o teu username do Letterboxd.",
    "Liga primeiro a tua conta Letterboxd.":
      "Liga primeiro a tua conta Letterboxd.",
    "Liga primeiro o Real-Debrid.": "Liga primeiro o Real-Debrid.",
    "Nao autenticado.": "Nao autenticado.",
    "Não consegui adicionar o magnet no Real-Debrid.":
      "Não consegui adicionar o magnet no Real-Debrid.",
    "Nao encontrado.": "Nao encontrado.",
    "Nao podes seguir-te a ti proprio.": "Nao podes seguir-te a ti proprio.",
    "Nome de utilizador do Letterboxd invalido.":
      "Nome de utilizador do Letterboxd invalido.",
    "O comentario e' demasiado longo.": "O comentario e' demasiado longo.",
    "Password tem de ter 4+ caracteres.": "Password tem de ter 4+ caracteres.",
    "Real-Debrid não devolveu link para o ficheiro.":
      "Real-Debrid não devolveu link para o ficheiro.",
    "room e client sao obrigatorios.": "room e client sao obrigatorios.",
    "room e kind sao obrigatorios.": "room e kind sao obrigatorios.",
    "score tem de estar entre 1 e 100": "score tem de estar entre 1 e 100",
    "series precisam de season e episode": "series precisam de season e episode",
    "So podes apagar os teus comentarios.":
      "So podes apagar os teus comentarios.",
    "status invalido (paused|dropped|null)":
      "status invalido (paused|dropped|null)",
    "Stream expirado ou inexistente.": "Stream expirado ou inexistente.",
    "tmdbId e type (movie|tv|anime) sao obrigatorios":
      "tmdbId e type (movie|tv|anime) sao obrigatorios",
    "tmdbId invalido": "tmdbId invalido",
    "Token do Real-Debrid inválido ou expirado.":
      "Token do Real-Debrid inválido ou expirado.",
    "torrent nao ativo": "torrent nao ativo",
    "type invalido": "type invalido",
    "type tem de ser 'movie' ou 'tv'": "type tem de ser 'movie' ou 'tv'",
    "type tem de ser movie, tv ou anime": "type tem de ser movie, tv ou anime",
    "Utilizador nao encontrado.": "Utilizador nao encontrado.",
    "Utilizador ou password invalidos.": "Utilizador ou password invalidos.",
    "Utilizador tem de ter 3+ caracteres.":
      "Utilizador tem de ter 3+ caracteres.",
    "Lista nao encontrada.": "Lista nao encontrada.",
    // --- erros do servidor ---
    "lista nao encontrada": "lista nao encontrada",
    "MAL nao configurado no servidor.": "MAL nao configurado no servidor.",
    "entrada nao encontrada": "entrada nao encontrada",
    "este titulo nao tem IMDB id": "este titulo nao tem IMDB id",
    // --- auditoria 2 ---
    "Diz o que achaste...  (escreve @ para chamar alguém)":
      "Diz o que achaste...  (escreve @ para chamar alguém)",
    "Adicionar à minha lista": "Adicionar à minha lista",
    "{quem} respondeu ao teu comentário": "{quem} respondeu ao teu comentário",
    "{quem} gostou do teu comentário": "{quem} gostou do teu comentário",
    "alguém": "alguém",
    "como visto na ficha do título (ou na \"A minha lista\") e volta aqui.":
      "como visto na ficha do título (ou na \"A minha lista\") e volta aqui.",
    "Esta lista esta vazia. Abre um filme/série e usa o botao \"+ Lista\".":
      "Esta lista esta vazia. Abre um filme/série e usa o botao \"+ Lista\".",
    "A tua lista esta vazia. Abre um filme/série e adiciona a watchlist, marca como visto ou da nota.":
      "A tua lista esta vazia. Abre um filme/série e adiciona a watchlist, marca como visto ou da nota.",
    "Remover {t} da lista": "Remover {t} da lista",
    "Importados {n} filmes vistos.": "Importados {n} filmes vistos.",
    "Importados {n} vistos + {w} da watchlist.":
      "Importados {n} vistos + {w} da watchlist.",
    "Importados {n} títulos e {d} entradas do diário.":
      "Importados {n} títulos e {d} entradas do diário.",
    "Guardar perfil": "Guardar perfil",
    "A média está acima da mediana: poucos títulos com nota muito alta estão a puxar a média para cima.":
      "A média está acima da mediana: poucos títulos com nota muito alta estão a puxar a média para cima.",
    "A média está abaixo da mediana: há muitos títulos bem avaliados a puxar a média para baixo.":
      "A média está abaixo da mediana: há muitos títulos bem avaliados a puxar a média para baixo.",
    "Sem ligação ao Watch Party.": "Sem ligação ao Watch Party.",
    // --- auditoria 2 ---
    "Ainda não tens pelo menos 2 títulos marcados como vistos. Marca algo como visto na ficha do título (ou na \"A minha lista\") e volta aqui.":
      "Ainda não tens pelo menos 2 títulos marcados como vistos. Marca algo como visto na ficha do título (ou na \"A minha lista\") e volta aqui.",
    // --- auditoria 2 ---
    "Importados {n} animes para a tua lista.":
      "Importados {n} animes para a tua lista.",
    "✓ Marcar como visto": "✓ Marcar como visto",
    "✓ Terminei o episódio {n}": "✓ Terminei o episódio {n}",
    "{nome}: abrir {o} num novo separador":
      "{nome}: abrir {o} num novo separador",
    "o filme": "o filme",
    "o episódio": "o episódio",
    // --- textos das notificacoes ---
    "{quem} começou a seguir-te": "{quem} começou a seguir-te",
    "{quem} chamou-te num comentário": "{quem} chamou-te num comentário",
    "Novidade": "Novidade",
    // --- auditoria: textos de 1 palavra e atributos ---
    "Sair de ecra inteiro": "Sair de ecra inteiro",
    "Sem fontes internas disponíveis.": "Sem fontes internas disponíveis.",
    "+ Lista": "+ Lista",
    "Mais recentes": "Mais recentes",
    "para veres as tuas conquistas.": "para veres as tuas conquistas.",
    "Episódio {n}": "Episódio {n}",
    "Atualizaste a MEIDA para a versão {v}. Novidades:":
      "Atualizaste a MEIDA para a versão {v}. Novidades:",
    "Destaques": "Destaques",
    "Popularidade": "Popularidade",
    "Nota": "Nota",
    // --- auditoria completa ---
    "(com anúncios) ou": "(com anúncios) ou",
    "). É um serviço pago (mas barato) que guarda os torrents em cache — por isso o stream começa imediatamente, como no Stremio.":
      "). É um serviço pago (mas barato) que guarda os torrents em cache — por isso o stream começa imediatamente, como no Stremio.",
    "...": "...",
    "A entrar": "A entrar",
    "A extrair stream sem anúncios (a 1a vez pode demorar ~30s a acordar o servidor)...":
      "A extrair stream sem anúncios (a 1a vez pode demorar ~30s a acordar o servidor)...",
    "Ainda nao ha titulos na biblioteca, por isso ainda nao ha nada para contar.":
      "Ainda nao ha titulos na biblioteca, por isso ainda nao ha nada para contar.",
    "Ainda não tens outros títulos marcados como vistos para comparar. Marca algo como visto e volta aqui.":
      "Ainda não tens outros títulos marcados como vistos para comparar. Marca algo como visto e volta aqui.",
    "Apagar esta lista? Os títulos continuam na biblioteca, só saem da lista.":
      "Apagar esta lista? Os títulos continuam na biblioteca, só saem da lista.",
    "Aparece ao lado do teu nome no Discord o que estás a ver, como no Stremio. Só funciona com a app do Discord aberta neste computador, e nada é enviado para a internet — a MEIDA escreve directamente no Discord do teu PC.":
      "Aparece ao lado do teu nome no Discord o que estás a ver, como no Stremio. Só funciona com a app do Discord aberta neste computador, e nada é enviado para a internet — a MEIDA escreve directamente no Discord do teu PC.",
    "Autoplay liga/desliga o arranque automático. Autoskip tenta saltar a intro/genéricos (funciona nos nossos players; nos providers externos depende do site).":
      "Autoplay liga/desliga o arranque automático. Autoskip tenta saltar a intro/genéricos (funciona nos nossos players; nos providers externos depende do site).",
    "Carrega um ficheiro JSON ou CSV exportado da MEIDA para voltar a carregar a tua biblioteca e diário. É um merge: não apaga notas nem visto que o ficheiro não traga.":
      "Carrega um ficheiro JSON ou CSV exportado da MEIDA para voltar a carregar a tua biblioteca e diário. É um merge: não apaga notas nem visto que o ficheiro não traga.",
    "Carregar mais": "Carregar mais",
    "Compara com o que já viste e ajusta a tua nota com ↑/↓ (ou escreve-a na caixa). A nota deste título é guardada de imediato.":
      "Compara com o que já viste e ajusta a tua nota com ↑/↓ (ou escreve-a na caixa). A nota deste título é guardada de imediato.",
    "Cor dos botões e realces. Predefinidas, as tuas últimas escolhas, ou o picker.":
      "Cor dos botões e realces. Predefinidas, as tuas últimas escolhas, ou o picker.",
    "Criar e adicionar": "Criar e adicionar",
    "Cross-sync concluído: +{m} no MAL, +{a} no AniList.":
      "Cross-sync concluído: +{m} no MAL, +{a} no AniList.",
    "Descarrega a tua biblioteca e diário. Em JSON (para fazer backup ou voltar a usar depois) ou CSV (para abrir no Excel/Sheets).":
      "Descarrega a tua biblioteca e diário. Em JSON (para fazer backup ou voltar a usar depois) ou CSV (para abrir no Excel/Sheets).",
    "Episódio": "Episódio",
    "Erro {n}": "Erro {n}",
    "Escolhe outra": "Escolhe outra",
    "Escolhe um ou mais tipos, um ou mais estados e os géneros/temas (ex.: Romance, Viagem no tempo) — eu trago títulos com essas tags.":
      "Escolhe um ou mais tipos, um ou mais estados e os géneros/temas (ex.: Romance, Viagem no tempo) — eu trago títulos com essas tags.",
    "Escolher do PC": "Escolher do PC",
    "Escreve o teu nome, depois cria uma sala e envia o codigo ao teu amigo — ou entra com o codigo dele.":
      "Escreve o teu nome, depois cria uma sala e envia o codigo ao teu amigo — ou entra com o codigo dele.",
    "Esse momento não se percebe. Escreve 2:05 ou 125.":
      "Esse momento não se percebe. Escreve 2:05 ou 125.",
    "Fontes de stream usadas no player (embeds). Quando um está morto fica riscado e é saltado na escolha automática.":
      "Fontes de stream usadas no player (embeds). Quando um está morto fica riscado e é saltado na escolha automática.",
    "Fontes dedicadas de anime (sub/dub via MyAnimeList). O seletor de áudio em cima só afeta este título.":
      "Fontes dedicadas de anime (sub/dub via MyAnimeList). O seletor de áudio em cima só afeta este título.",
    "Fundo da app. Predefinidas (escuras, texto legível), as tuas últimas escolhas, ou o picker.":
      "Fundo da app. Predefinidas (escuras, texto legível), as tuas últimas escolhas, ou o picker.",
    "Importa todos os filmes vistos (com as tuas notas) e/ou a watchlist completa. Em listas grandes pode demorar alguns segundos. Em cada filme tens um botao para o abrir no Letterboxd.":
      "Importa todos os filmes vistos (com as tuas notas) e/ou a watchlist completa. Em listas grandes pode demorar alguns segundos. Em cada filme tens um botao para o abrir no Letterboxd.",
    "Importados {n} da watchlist.": "Importados {n} da watchlist.",
    "Importar lista do AniList": "Importar lista do AniList",
    "Importar vistos": "Importar vistos",
    "Indica o teu username do Letterboxd para importar a tua watchlist e os filmes vistos (com as tuas notas), e usar a nota da comunidade do Letterboxd.":
      "Indica o teu username do Letterboxd para importar a tua watchlist e os filmes vistos (com as tuas notas), e usar a nota da comunidade do Letterboxd.",
    "Legenda preferida (ativada automaticamente nos players sem anúncios e de torrents).":
      "Legenda preferida (ativada automaticamente nos players sem anúncios e de torrents).",
    "Legendado (sub) ou dobrado (dub). Aplica-se às fontes dedicadas de anime (MegaPlay/VidLink/VidSrc.cc por MyAnimeList).":
      "Legendado (sub) ou dobrado (dub). Aplica-se às fontes dedicadas de anime (MegaPlay/VidLink/VidSrc.cc por MyAnimeList).",
    "Liga a tua conta MyAnimeList para receberes recomendações com base no que lês (e já leste).":
      "Liga a tua conta MyAnimeList para receberes recomendações com base no que lês (e já leste).",
    "Liga a tua conta para importar a tua lista e marcar episódios vistos.":
      "Liga a tua conta para importar a tua lista e marcar episódios vistos.",
    "Ligado como {u}. A nota da comunidade dos teus filmes":
      "Ligado como {u}. A nota da comunidade dos teus filmes",
    "Ligado como {u}. Nos torrents, os que estiverem em cache no Real-Debrid reproduzem {logo} (sem esperar por peers).":
      "Ligado como {u}. Nos torrents, os que estiverem em cache no Real-Debrid reproduzem {logo} (sem esperar por peers).",
    "Ligado como {u}. Os episódios de anime que vires são marcados no teu MAL automaticamente.":
      "Ligado como {u}. Os episódios de anime que vires são marcados no teu MAL automaticamente.",
    "Ligado como {u}. Quando não tens o MyAnimeList":
      "Ligado como {u}. Quando não tens o MyAnimeList",
    "Melhores notas": "Melhores notas",
    "Na lista": "Na lista",
    "Nota:": "Nota:",
    "Notas entre {a} e {b}, em {n} títulos.":
      "Notas entre {a} e {b}, em {n} títulos.",
    "Notas entre {a} e {b}.": "Notas entre {a} e {b}.",
    "Não consegui recomendar nada com estes tipos. Tira alguns filtros, ou lê (e marca no MAL) títulos com géneros, e tenta de novo.":
      "Não consegui recomendar nada com estes tipos. Tira alguns filtros, ou lê (e marca no MAL) títulos com géneros, e tenta de novo.",
    "Não tens conta?": "Não tens conta?",
    "O browser não consegue reproduzir este ficheiro (provavelmente .mkv ou codec x265). Usa o filtro {filtro} na lista de torrents e escolhe um {formato}.":
      "O browser não consegue reproduzir este ficheiro (provavelmente .mkv ou codec x265). Usa o filtro {filtro} na lista de torrents e escolhe um {formato}.",
    "O servidor não tem o AniList configurado (falta ANILIST_CLIENT_ID).":
      "O servidor não tem o AniList configurado (falta ANILIST_CLIENT_ID).",
    "O servidor não tem o MyAnimeList configurado (falta MAL_CLIENT_ID).":
      "O servidor não tem o MyAnimeList configurado (falta MAL_CLIENT_ID).",
    "O tempo visto só conta a partir de agora — a app nunca mediu tempo, e não há como saber quanto viste antes disto. Volta a ver alguma coisa e o número começa a aparecer.":
      "O tempo visto só conta a partir de agora — a app nunca mediu tempo, e não há como saber quanto viste antes disto. Volta a ver alguma coisa e o número começa a aparecer.",
    "Ocorreu um erro ao mostrar esta página. Recarrega para tentar de novo.":
      "Ocorreu um erro ao mostrar esta página. Recarrega para tentar de novo.",
    "Procura uma versão nova da MEIDA. Não precisas de ter conta.":
      "Procura uma versão nova da MEIDA. Não precisas de ter conta.",
    "Remove a MEIDA do computador. A app fecha e o desinstalador abre.":
      "Remove a MEIDA do computador. A app fecha e o desinstalador abre.",
    "Remove os títulos da watchlist (os que já viste ou avaliaste ficam, só perdem a marca de watchlist). Que watchlist queres apagar?":
      "Remove os títulos da watchlist (os que já viste ou avaliaste ficam, só perdem a marca de watchlist). Que watchlist queres apagar?",
    "Remover avatar": "Remover avatar",
    "Remover {titulo} da lista": "Remover {titulo} da lista",
    "Rever agora": "Rever agora",
    "Sair da sala": "Sair da sala",
    "Sem internet — a mostrar os dados guardados.":
      "Sem internet — a mostrar os dados guardados.",
    "Simples (só a cor), um padrão por cima, ou uma imagem tua (como o fundo do WhatsApp). O padrão usa a tua cor de destaque.":
      "Simples (só a cor), um padrão por cima, ou uma imagem tua (como o fundo do WhatsApp). O padrão usa a tua cor de destaque.",
    "Sincronizar com MAL": "Sincronizar com MAL",
    "Usar URL": "Usar URL",
    "Verifica que criaste {ficheiro} com a tua chave do TMDB.":
      "Verifica que criaste {ficheiro} com a tua chave do TMDB.",
    "a mais alta": "a mais alta",
    "a mais baixa": "a mais baixa",
    "agora mesmo": "agora mesmo",
    "data não disponível": "data não disponível",
    "para comentar.": "para comentar.",
    "para comparares as notas dos títulos que viste.":
      "para comparares as notas dos títulos que viste.",
    "para ligares o AniList.": "para ligares o AniList.",
    "para ligares o Letterboxd.": "para ligares o Letterboxd.",
    "para ligares o MyAnimeList.": "para ligares o MyAnimeList.",
    "para ligares o Real-Debrid.": "para ligares o Real-Debrid.",
    // --- auditoria completa 2 ---
    "para marcares como visto e dares nota.":
      "para marcares como visto e dares nota.",
    "para veres a tua lista.": "para veres a tua lista.",
    "para veres as tuas estatísticas. Só tu as vês.":
      "para veres as tuas estatísticas. Só tu as vês.",
    "para veres o teu diário.": "para veres o teu diário.",
    "{n} {r} atras": "{n} {r} atras",
    "{r} ({n})": "{r} ({n})",
    "sem legendas": "sem legendas",
    "{n} legendas": "{n} legendas",
    // --- auditoria completa 3 ---
    "É o que os outros veem quando visitam o teu perfil. A biblioteca e as listas só aparecem se o perfil estiver público.":
      "É o que os outros veem quando visitam o teu perfil. A biblioteca e as listas só aparecem se o perfil estiver público.",
    "🎲 Escolhe algo para mim": "🎲 Escolhe algo para mim",
    "📚 Recomendar": "📚 Recomendar",
    // --- textos encontrados pela regra de frase ---
    "Criar sala": "Criar sala",
    "Desinstalar MEIDA": "Desinstalar MEIDA",
    "Este título": "Este título",
    "Guarda no diário e avança o {b} para o próximo episódio":
      "Guarda no diário e avança o {b} para o próximo episódio",
    "Importar tudo": "Importar tudo",
    "Importar watchlist": "Importar watchlist",
    "Ligar AniList": "Ligar AniList",
    "Ligar MyAnimeList": "Ligar MyAnimeList",
    "Próximo par →": "Próximo par →",
    "Seguinte →": "Seguinte →",
    "Trocar referência ↻": "Trocar referência ↻",
    "Ver detalhes": "Ver detalhes",
    "Vês as notas da comunidade de 2 coisas que já viste. No meio podes ajustar a tua nota de cada uma: nota exata na caixa, ou ↑/↓ (↑/↓ no teclado ajustam a esquerda). Espaço ou \"Manter e próximo\" passa ao próximo par.":
      "Vês as notas da comunidade de 2 coisas que já viste. No meio podes ajustar a tua nota de cada uma: nota exata na caixa, ou ↑/↓ (↑/↓ no teclado ajustam a esquerda). Espaço ou \"Manter e próximo\" passa ao próximo par.",
    "Watch Party": "Watch Party",
    "a mediana": "a mediana",
    "← Anterior": "← Anterior",
    "⏱ neste momento": "⏱ neste momento",
    "⚖ Comparar avaliação": "⚖ Comparar avaliação",
    "🔍 Pesquisar no Google ↗": "🔍 Pesquisar no Google ↗",
    // --- placeholder de resposta ---
    "Responder a {u}...  (escreve @ para chamar alguém)":
      "Responder a {u}...  (escreve @ para chamar alguém)",
    // --- audio do torrent ---
    "DUB": "DUB",
    "Legendado": "Legendado",
    // --- chaves em falta 2 ---
    " (agora está privado: só tu vês)": " (agora está privado: só tu vês)",
    "\"Escolhe algo para mim\". Desligado por defeito.":
      "\"Escolhe algo para mim\". Desligado por defeito.",
    "+ Nova lista": "+ Nova lista",
    ". Depois carrega no botao.": ". Depois carrega no botao.",
    "A procura mais...": "A procura mais...",
    "A tua lista de \"para ler\" está vazia. Adiciona mangá ao plan to read no MAL.":
      "A tua lista de \"para ler\" está vazia. Adiciona mangá ao plan to read no MAL.",
    "Ajusta a largura e a altura dos posters (útil em ecrãs pequenos).":
      "Ajusta a largura e a altura dos posters (útil em ecrãs pequenos).",
    "Autoplay desligado": "Autoplay desligado",
    "Autoplay ligado": "Autoplay ligado",
    "Autoskip desligado": "Autoskip desligado",
    "Autoskip ligado": "Autoskip ligado",
    "Como mostrar os nomes dos animes (catálogo, pesquisa e a tua lista).":
      "Como mostrar os nomes dos animes (catálogo, pesquisa e a tua lista).",
    "Editar perfil": "Editar perfil",
    "Entra para gostar": "Entra para gostar",
    "Escolher ficheiro": "Escolher ficheiro",
    "Estás em desenvolvimento — esta opção só se aplica à app instalada.":
      "Estás em desenvolvimento — esta opção só se aplica à app instalada.",
    "Fonte: {p}": "Fonte: {p}",
    "Gostar": "Gostar",
    "Há mais respostas aqui abaixo que não foi possível mostrar.":
      "Há mais respostas aqui abaixo que não foi possível mostrar.",
    "Imagem do computador": "Imagem do computador",
    "Imagem por URL": "Imagem por URL",
    "Isto só funciona na app de computador (Electron), não na versão web.":
      "Isto só funciona na app de computador (Electron), não na versão web.",
    "Liga a tua conta MyAnimeList para veres aqui a tua lista de \"para ler\"":
      "Liga a tua conta MyAnimeList para veres aqui a tua lista de \"para ler\"",
    "Ligar o MyAnimeList nas Definições": "Ligar o MyAnimeList nas Definições",
    "Mais info": "Mais info",
    "Mais recomendações": "Mais recomendações",
    "Minuto do vídeo: {t} ({s} segundos)": "Minuto do vídeo: {t} ({s} segundos)",
    "Nada na tua lista com estes filtros.":
      "Nada na tua lista com estes filtros.",
    "Nome da lista:": "Nome da lista:",
    "Nova lista": "Nova lista",
    "Onde ficam os teus dados. {a} guarda tudo localmente.":
      "Onde ficam os teus dados. {a} guarda tudo localmente.",
    "Os títulos que marcaste como \"para ler\" (plan to read) no MyAnimeList{n}.":
      "Os títulos que marcaste como \"para ler\" (plan to read) no MyAnimeList{n}.",
    "Para ler": "Para ler",
    "Para ti": "Para ti",
    "Perfil atualizado. ✓": "Perfil atualizado. ✓",
    "Procurar por filtros": "Procurar por filtros",
    "Remover imagem": "Remover imagem",
    "Renomear lista": "Renomear lista",
    "Repor tamanho": "Repor tamanho",
    "Reproduzir": "Reproduzir",
    "Sem ficheiro": "Sem ficheiro",
    "Tirar o gosto": "Tirar o gosto",
    "para editares o teu perfil.": "para editares o teu perfil.",
    "para escolheres um avatar.": "para escolheres um avatar.",
    "{a} liga a app a um MEIDA alojado noutro sítio, para partilhares conta, biblioteca, seguidores e comentários entre dispositivos.":
      "{a} liga a app a um MEIDA alojado noutro sítio, para partilhares conta, biblioteca, seguidores e comentários entre dispositivos.",
    "{e} {c} — pode não reproduzir no browser. Prefere .mp4.":
      "{e} {c} — pode não reproduzir no browser. Prefere .mp4.",
    "⚡ Debrid": "⚡ Debrid",
    "✓ Reproduz no browser": "✓ Reproduz no browser",
    "✓ Visto": "✓ Visto",
    "✓ browser": "✓ browser",
    // --- botao de descarregar a app (so no site) ---
    "Descarregar a app": "Descarregar a app",
    "Descarregar a app para o computador": "Descarregar a app para o computador",
    // --- textos que estavam por traduzir (achados pelo auditor: JSX misturado com expressao) ---
    "Debrid indisponível, a tocar via torrent local":
      "Debrid indisponível, a tocar via torrent local",
    "{erro} — usa o separador {separador}.":
      "{erro} — usa o separador {separador}.",
    "Fonte: {fonte} · {audio} · {n} legendas (liga/desliga no player)":
      "Fonte: {fonte} · {audio} · {n} legendas (liga/desliga no player)",
    "Dobrado": "Dobrado",
    "Os extractores gratuitos são instaveis. Usa o separador {a} (com anúncios) ou {b}.":
      "Os extractores gratuitos são instaveis. Usa o separador {a} (com anúncios) ou {b}.",
    "Para reprodução sem anúncios fiavel, liga um extractor (Consumet) em {chave} no {onde}.":
      "Para reprodução sem anúncios fiavel, liga um extractor (Consumet) em {chave} no {onde}.",
    "título": "título",
    "{titulos} com actividade nos últimos {n} meses. O que conta é a última vez que mexeste em cada um — a nota que deste, o momento em que o puseste na lista.":
      "{titulos} com actividade nos últimos {n} meses. O que conta é a última vez que mexeste em cada um — a nota que deste, o momento em que o puseste na lista.",
    "{titulos} com nota, por faixa de 10 pontos. Passa o rato sobre uma barra para o número exacto.":
      "{titulos} com nota, por faixa de 10 pontos. Passa o rato sobre uma barra para o número exacto.",
    "{nome} · a carregar...": "{nome} · a carregar...",
    "{fonte} nao carregou · a usar {nome}":
      "{fonte} nao carregou · a usar {nome}",
    "{n} com nota": "{n} com nota",
    "{pct}% · 👤 {peers} peers · ⬇ {vel} MB/s":
      "{pct}% · 👤 {peers} peers · ⬇ {vel} MB/s",
    "{a} de {b} conquistadas": "{a} de {b} conquistadas",
    "A carregar {titulo}": "A carregar {titulo}",
    "A tua nota: {nota}": "A tua nota: {nota}",
    "Não consegui carregar o catálogo: {erro}":
      "Não consegui carregar o catálogo: {erro}",
    "Página {p} de {n} · {t} títulos": "Página {p} de {n} · {t} títulos",
    "Recomendações com base nas tags que mais lês na tua lista do MAL{analisados}. Nunca te recomendo nada que já tenhas na lista.":
      "Recomendações com base nas tags que mais lês na tua lista do MAL{analisados}. Nunca te recomendo nada que já tenhas na lista.",
    "({n} títulos analisados)": "({n} títulos analisados)",
    "Esconder o que já tenho na lista": "Esconder o que já tenho na lista",
    "Cola o teu token do Real-Debrid (obtém-no em {ligacao}){fim}":
      "Cola o teu token do Real-Debrid (obtém-no em {ligacao}){fim}",
    "A ligar a: {destino}": "A ligar a: {destino}",
    "servidor local deste computador": "servidor local deste computador",
    "Perfil público — qualquer pessoa pode ver a tua biblioteca e listas.{estado}":
      "Perfil público — qualquer pessoa pode ver a tua biblioteca e listas.{estado}",
    "Mostrar anime adulto (NSFW/hentai) na pesquisa, nos filtros de género e no \"Escolhe algo para mim\". Desligado por defeito.":
      "Mostrar anime adulto (NSFW/hentai) na pesquisa, nos filtros de género e no \"Escolhe algo para mim\". Desligado por defeito.",
    "média {media} · mediana {mediana}": "média {media} · mediana {mediana}",
    "A década conta {ano} dos {n} títulos: os restantes ainda não têm ano guardado. Abre a ficha de alguns, ou corre o preenchimento, e este número fica mais firme.":
      "A década conta {ano} dos {n} títulos: os restantes ainda não têm ano guardado. Abre a ficha de alguns, ou corre o preenchimento, e este número fica mais firme.",
    "{n} a seguir": "{n} a seguir",
    "🔒 Este perfil é privado.": "🔒 Este perfil é privado.",
    // --- Details.jsx: legendas, avisos do iframe e o botao de terminar episodio ---
    "As legendas próprias (incl. português) só funcionam no separador {torrents}{extra} (os Providers são páginas externas em iframe).":
      "As legendas próprias (incl. português) só funcionam no separador {torrents}{extra} (os Providers são páginas externas em iframe).",
    "🔴 Watch Party: aqui (Providers) o play/pausa {nao} sincroniza — usem {torrents}{extra} para verem em sincronia.":
      "🔴 Watch Party: aqui (Providers) o play/pausa {nao} sincroniza — usem {torrents}{extra} para verem em sincronia.",
    "Guarda no diário e avança o {b} para o próximo episódio{mal}":
      "Guarda no diário e avança o {b} para o próximo episódio{mal}",
    "(e marca no MAL)": "(e marca no MAL)",
    // --- Details.jsx: separadores e avisos ---
    "Áudio deste título:": "Áudio deste título:",
    "🔴 Watch Party: estas fontes são em iframe, o play/pausa {nao} sincroniza — usem {torrents} para verem em sincronia.":
      "🔴 Watch Party: estas fontes são em iframe, o play/pausa {nao} sincroniza — usem {torrents} para verem em sincronia.",
    // --- texto de uma palavra dentro de tags (o auditor nao os via) ---
    "abandonados": "abandonados",
    "mediana": "mediana",
    "segues": "segues",
    "Todas": "Todas",
    "Ordenar:": "Ordenar:",
    "Todos": "Todos",
    "Veem o mesmo ao mesmo tempo. Pausa/play e sincronizado nos separadores {a} e {b}.":
      "Veem o mesmo ao mesmo tempo. Pausa/play e sincronizado nos separadores {a} e {b}.",
    "Copiar codigo": "Copiar codigo",
    "melhor: {n}": "melhor: {n}",
    "Aplicar": "Aplicar",
    "Limpar{n}": "Limpar{n}",
    "Tudo": "Tudo",
    "todos": "todos",
    "filmes": "filmes",
    "animes": "animes",
    "Já tens conta?": "Já tens conta?",
    "{n} seguidores": "{n} seguidores",
    "Toca nos géneros: 1x = {quero}, 2x = {nao}. Depois carrega no botão.":
      "Toca nos géneros: 1x = {quero}, 2x = {nao}. Depois carrega no botão.",
    "quero": "quero",
    "Estado": "Estado",
    "Começou": "Começou",
    "Acabou": "Acabou",
    "Temporada": "Temporada",
    "Começou: {data}": "Começou: {data}",
    // --- identicos nos dois idiomas (codecs, unidades, marcas) ---
    "x264": "x264",
    "x265": "x265",
    "min": "min",
    // --- LibraryControls.jsx: watchlist, pausa, abandonar e a barra de comunidade ---
    "✓ Na watchlist": "✓ Na watchlist",
    "+ Watchlist": "+ Watchlist",
    "✓ Em pausa": "✓ Em pausa",
    "Pausar": "Pausar",
    "✓ Abandonado": "✓ Abandonado",
    "Abandonar": "Abandonar",
    "Comunidade: {n}": "Comunidade: {n}",
    "Tu: {n}": "Tu: {n}",
    // --- Library/Stats: Guardar/Criar e a frase do tempo visto ---
    "Criar": "Criar",
    "{n} medido{nome} até agora. Avançar no vídeo não conta; recuar para ver de novo também não.":
      "{n} medido{nome} até agora. Avançar no vídeo não conta; recuar para ver de novo também não.",
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
    "em baixo": "down",
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
    // --- changelog ---
    "Fixe!": "Got it!",
    // --- erros do servidor ---
    "a lista precisa de um nome": "the list needs a name",
    "AniList nao configurado no servidor.":
      "AniList is not configured on the server.",
    "Anime nao encontrado no AniList": "Anime not found on AniList",
    "Cola o teu token do Real-Debrid.": "Paste your Real-Debrid token.",
    "Comentario a responder nao existe.":
      "The comment you're replying to doesn't exist.",
    "Comentario nao existe.": "Comment doesn't exist.",
    "Conta AniList nao ligada.": "AniList account not connected.",
    "Conta MAL nao ligada.": "MyAnimeList account not connected.",
    "Escreve alguma coisa.": "Write something.",
    "Esse utilizador ja existe.": "That username already exists.",
    "Este perfil é privado.": "This profile is private.",
    "Extrator de anime nao configurado.": "Anime extractor not configured.",
    "falta o parametro tmdb": "missing the tmdb parameter",
    "falta o parametro url": "missing the url parameter",
    "faltam parametros id e season": "missing id and season parameters",
    "faltam parametros type e id": "missing type and id parameters",
    "faltam tmdb e title": "missing tmdb and title",
    "faltam tmdbId e type": "missing tmdbId and type",
    "faltam type e tmdb": "missing type and tmdb",
    "faltam type e tmdbId": "missing type and tmdbId",
    "faltam type, tmdbId e position": "missing type, tmdbId and position",
    "formato invalido": "invalid format",
    "Indica o teu username do Letterboxd.": "Enter your Letterboxd username.",
    "Liga primeiro a tua conta Letterboxd.":
      "Connect your Letterboxd account first.",
    "Liga primeiro o Real-Debrid.": "Connect Real-Debrid first.",
    "Nao autenticado.": "Not signed in.",
    "Não consegui adicionar o magnet no Real-Debrid.":
      "Couldn't add the magnet on Real-Debrid.",
    "Nao encontrado.": "Not found.",
    "Nao podes seguir-te a ti proprio.": "You can't follow yourself.",
    "Nome de utilizador do Letterboxd invalido.": "Invalid Letterboxd username.",
    "O comentario e' demasiado longo.": "The comment is too long.",
    "Password tem de ter 4+ caracteres.":
      "Password must be at least 4 characters.",
    "Real-Debrid não devolveu link para o ficheiro.":
      "Real-Debrid didn't return a link for the file.",
    "room e client sao obrigatorios.": "room and client are required.",
    "room e kind sao obrigatorios.": "room and kind are required.",
    "score tem de estar entre 1 e 100": "score must be between 1 and 100",
    "series precisam de season e episode": "series need season and episode",
    "So podes apagar os teus comentarios.":
      "You can only delete your own comments.",
    "status invalido (paused|dropped|null)":
      "invalid status (paused|dropped|null)",
    "Stream expirado ou inexistente.": "Stream expired or doesn't exist.",
    "tmdbId e type (movie|tv|anime) sao obrigatorios":
      "tmdbId and type (movie|tv|anime) are required",
    "tmdbId invalido": "invalid tmdbId",
    "Token do Real-Debrid inválido ou expirado.":
      "Real-Debrid token invalid or expired.",
    "torrent nao ativo": "torrent not active",
    "type invalido": "invalid type",
    "type tem de ser 'movie' ou 'tv'": "type must be 'movie' or 'tv'",
    "type tem de ser movie, tv ou anime": "type must be movie, tv or anime",
    "Utilizador nao encontrado.": "User not found.",
    "Utilizador ou password invalidos.": "Wrong username or password.",
    "Utilizador tem de ter 3+ caracteres.":
      "Username must be at least 3 characters.",
    "Lista nao encontrada.": "List not found.",
    // --- erros do servidor ---
    "lista nao encontrada": "list not found",
    "MAL nao configurado no servidor.":
      "MyAnimeList is not configured on the server.",
    "entrada nao encontrada": "entry not found",
    "este titulo nao tem IMDB id": "this title has no IMDB id",
    // --- auditoria 2 ---
    "Diz o que achaste...  (escreve @ para chamar alguém)":
      "Say what you thought...  (type @ to mention someone)",
    "Adicionar à minha lista": "Add to my list",
    "{quem} respondeu ao teu comentário": "{quem} replied to your comment",
    "{quem} gostou do teu comentário": "{quem} liked your comment",
    "alguém": "someone",
    "como visto na ficha do título (ou na \"A minha lista\") e volta aqui.":
      "as watched on the title page (or in \"My list\") and come back here.",
    "Esta lista esta vazia. Abre um filme/série e usa o botao \"+ Lista\".":
      "This list is empty. Open a movie/series and use the \"+ List\" button.",
    "A tua lista esta vazia. Abre um filme/série e adiciona a watchlist, marca como visto ou da nota.":
      "Your library is empty. Open a movie/series and add it to your watchlist, mark it as watched or rate it.",
    "Remover {t} da lista": "Remove {t} from the list",
    "Importados {n} filmes vistos.": "Imported {n} watched films.",
    "Importados {n} vistos + {w} da watchlist.":
      "Imported {n} watched + {w} from the watchlist.",
    "Importados {n} títulos e {d} entradas do diário.":
      "Imported {n} titles and {d} diary entries.",
    "Guardar perfil": "Save profile",
    "A média está acima da mediana: poucos títulos com nota muito alta estão a puxar a média para cima.":
      "The average is above the median: a few very highly rated titles are pulling the average up.",
    "A média está abaixo da mediana: há muitos títulos bem avaliados a puxar a média para baixo.":
      "The average is below the median: many well-rated titles are pulling the average down.",
    "Sem ligação ao Watch Party.": "Not connected to the Watch Party.",
    // --- auditoria 2 ---
    "Ainda não tens pelo menos 2 títulos marcados como vistos. Marca algo como visto na ficha do título (ou na \"A minha lista\") e volta aqui.":
      "You don't have at least 2 titles marked as watched yet. Mark something as watched on the title page (or in \"My list\") and come back here.",
    // --- auditoria 2 ---
    "Importados {n} animes para a tua lista.":
      "Imported {n} anime to your library.",
    "✓ Marcar como visto": "✓ Mark as watched",
    "✓ Terminei o episódio {n}": "✓ I finished episode {n}",
    "{nome}: abrir {o} num novo separador": "{nome}: open {o} in a new tab",
    "o filme": "the movie",
    "o episódio": "the episode",
    // --- textos das notificacoes ---
    "{quem} começou a seguir-te": "{quem} started following you",
    "{quem} chamou-te num comentário": "{quem} mentioned you in a comment",
    "Novidade": "Something new",
    // --- auditoria: textos de 1 palavra e atributos ---
    "Sair de ecra inteiro": "Exit fullscreen",
    "Sem fontes internas disponíveis.": "No internal sources available.",
    "+ Lista": "+ List",
    "Mais recentes": "Most recent",
    "para veres as tuas conquistas.": "to see your achievements.",
    "Episódio {n}": "Episode {n}",
    "Atualizaste a MEIDA para a versão {v}. Novidades:":
      "You updated MEIDA to version {v}. What's new:",
    "Destaques": "Featured",
    "Popularidade": "Popularity",
    "Nota": "Rating",
    // --- auditoria completa ---
    "(com anúncios) ou": "(with ads) or",
    "). É um serviço pago (mas barato) que guarda os torrents em cache — por isso o stream começa imediatamente, como no Stremio.":
      "). It's a paid service (but cheap) that keeps torrents in cache — so the stream starts right away, like in Stremio.",
    "...": "...",
    "A entrar": "Signing in",
    "A extrair stream sem anúncios (a 1a vez pode demorar ~30s a acordar o servidor)...":
      "Extracting an ad-free stream (the first time can take ~30s to wake the server)...",
    "Ainda nao ha titulos na biblioteca, por isso ainda nao ha nada para contar.":
      "There are no titles in your library yet, so there's nothing to count.",
    "Ainda não tens outros títulos marcados como vistos para comparar. Marca algo como visto e volta aqui.":
      "You don't have any other titles marked as watched to compare. Mark something as watched and come back here.",
    "Apagar esta lista? Os títulos continuam na biblioteca, só saem da lista.":
      "Delete this list? The titles stay in your library, they just leave the list.",
    "Aparece ao lado do teu nome no Discord o que estás a ver, como no Stremio. Só funciona com a app do Discord aberta neste computador, e nada é enviado para a internet — a MEIDA escreve directamente no Discord do teu PC.":
      "What you're watching shows next to your name on Discord, like in Stremio. It only works with the Discord app open on this computer, and nothing is sent to the internet — MEIDA writes directly to the Discord on your PC.",
    "Autoplay liga/desliga o arranque automático. Autoskip tenta saltar a intro/genéricos (funciona nos nossos players; nos providers externos depende do site).":
      "Autoplay turns automatic start on/off. Autoskip tries to skip the intro/opening (it works on our own players; on external providers it depends on the site).",
    "Carrega um ficheiro JSON ou CSV exportado da MEIDA para voltar a carregar a tua biblioteca e diário. É um merge: não apaga notas nem visto que o ficheiro não traga.":
      "Loads a JSON or CSV file exported from MEIDA to reload your library and diary. It's a merge: it doesn't delete ratings or watched entries the file doesn't have.",
    "Carregar mais": "Load more",
    "Compara com o que já viste e ajusta a tua nota com ↑/↓ (ou escreve-a na caixa). A nota deste título é guardada de imediato.":
      "Compare with what you've already seen and adjust your rating with ↑/↓ (or type it in the box). The rating for this title is saved immediately.",
    "Cor dos botões e realces. Predefinidas, as tuas últimas escolhas, ou o picker.":
      "Button and highlight colours. The defaults, your recent choices, or the picker.",
    "Criar e adicionar": "Create and add",
    "Cross-sync concluído: +{m} no MAL, +{a} no AniList.":
      "Cross-sync complete: +{m} on MAL, +{a} on AniList.",
    "Descarrega a tua biblioteca e diário. Em JSON (para fazer backup ou voltar a usar depois) ou CSV (para abrir no Excel/Sheets).":
      "Downloads your library and diary. As JSON (to back up or reuse later) or CSV (to open in Excel/Sheets).",
    "Episódio": "Episode",
    "Erro {n}": "Error {n}",
    "Escolhe outra": "Pick another",
    "Escolhe um ou mais tipos, um ou mais estados e os géneros/temas (ex.: Romance, Viagem no tempo) — eu trago títulos com essas tags.":
      "Pick one or more types, one or more statuses and the genres/themes (e.g.: Romance, Time travel) — I'll bring titles with those tags.",
    "Escolher do PC": "Choose from PC",
    "Escreve o teu nome, depois cria uma sala e envia o codigo ao teu amigo — ou entra com o codigo dele.":
      "Type your name, then create a room and send the code to your friend — or join with their code.",
    "Esse momento não se percebe. Escreve 2:05 ou 125.":
      "Can't tell what moment that is. Write 2:05 or 125.",
    "Fontes de stream usadas no player (embeds). Quando um está morto fica riscado e é saltado na escolha automática.":
      "Stream sources used in the player (embeds). When one is dead it gets struck through and is skipped by the automatic choice.",
    "Fontes dedicadas de anime (sub/dub via MyAnimeList). O seletor de áudio em cima só afeta este título.":
      "Dedicated anime sources (sub/dub via MyAnimeList). The audio selector above only affects this title.",
    "Fundo da app. Predefinidas (escuras, texto legível), as tuas últimas escolhas, ou o picker.":
      "App background. The defaults (dark, readable text), your recent choices, or the picker.",
    "Importa todos os filmes vistos (com as tuas notas) e/ou a watchlist completa. Em listas grandes pode demorar alguns segundos. Em cada filme tens um botao para o abrir no Letterboxd.":
      "Imports all watched films (with your ratings) and/or the full watchlist. On large lists it can take a few seconds. Every film has a button to open it on Letterboxd.",
    "Importados {n} da watchlist.": "Imported {n} from the watchlist.",
    "Importar lista do AniList": "Import AniList list",
    "Importar vistos": "Import watched",
    "Indica o teu username do Letterboxd para importar a tua watchlist e os filmes vistos (com as tuas notas), e usar a nota da comunidade do Letterboxd.":
      "Enter your Letterboxd username to import your watchlist and watched films (with your ratings), and to use Letterboxd's community ratings.",
    "Legenda preferida (ativada automaticamente nos players sem anúncios e de torrents).":
      "Preferred subtitle language (enabled automatically on ad-free and torrent players).",
    "Legendado (sub) ou dobrado (dub). Aplica-se às fontes dedicadas de anime (MegaPlay/VidLink/VidSrc.cc por MyAnimeList).":
      "Subtitled (sub) or dubbed (dub). Applies to the dedicated anime sources (MegaPlay/VidLink/VidSrc.cc via MyAnimeList).",
    "Liga a tua conta MyAnimeList para receberes recomendações com base no que lês (e já leste).":
      "Connect your MyAnimeList account to get recommendations based on what you read (and have already read).",
    "Liga a tua conta para importar a tua lista e marcar episódios vistos.":
      "Connect your account to import your list and mark episodes as watched.",
    "Ligado como {u}. A nota da comunidade dos teus filmes":
      "Connected as {u}. The community rating of your films",
    "Ligado como {u}. Nos torrents, os que estiverem em cache no Real-Debrid reproduzem {logo} (sem esperar por peers).":
      "Connected as {u}. On torrents, the ones already in the Real-Debrid cache play {logo} (without waiting for peers).",
    "Ligado como {u}. Os episódios de anime que vires são marcados no teu MAL automaticamente.":
      "Connected as {u}. Anime episodes you watch are marked on your MAL automatically.",
    "Ligado como {u}. Quando não tens o MyAnimeList":
      "Connected as {u}. When you don't have MyAnimeList",
    "Melhores notas": "Top ratings",
    "Na lista": "On the list",
    "Nota:": "Rating:",
    "Notas entre {a} e {b}, em {n} títulos.":
      "Ratings between {a} and {b}, across {n} titles.",
    "Notas entre {a} e {b}.": "Ratings between {a} and {b}.",
    "Não consegui recomendar nada com estes tipos. Tira alguns filtros, ou lê (e marca no MAL) títulos com géneros, e tenta de novo.":
      "I couldn't recommend anything with these filters. Remove some filters, or read (and mark on MAL) titles with genres, and try again.",
    "Não tens conta?": "Don't have an account?",
    "O browser não consegue reproduzir este ficheiro (provavelmente .mkv ou codec x265). Usa o filtro {filtro} na lista de torrents e escolhe um {formato}.":
      "The browser can't play this file (probably .mkv or x265 codec). Use the {filtro} filter in the torrent list and pick an {formato}.",
    "O servidor não tem o AniList configurado (falta ANILIST_CLIENT_ID).":
      "The server doesn't have AniList configured (ANILIST_CLIENT_ID is missing).",
    "O servidor não tem o MyAnimeList configurado (falta MAL_CLIENT_ID).":
      "The server doesn't have MyAnimeList configured (MAL_CLIENT_ID is missing).",
    "O tempo visto só conta a partir de agora — a app nunca mediu tempo, e não há como saber quanto viste antes disto. Volta a ver alguma coisa e o número começa a aparecer.":
      "Watch time only counts from now on — the app never measured time, and there's no way to know how much you watched before this. Watch something and the number starts showing.",
    "Ocorreu um erro ao mostrar esta página. Recarrega para tentar de novo.":
      "Something went wrong showing this page. Reload to try again.",
    "Procura uma versão nova da MEIDA. Não precisas de ter conta.":
      "Looks for a newer version of MEIDA. You don't need an account.",
    "Remove a MEIDA do computador. A app fecha e o desinstalador abre.":
      "Removes MEIDA from the computer. The app closes and the uninstaller opens.",
    "Remove os títulos da watchlist (os que já viste ou avaliaste ficam, só perdem a marca de watchlist). Que watchlist queres apagar?":
      "Removes the titles from the watchlist (the ones you've watched or rated stay, they just lose the watchlist flag). Which watchlist do you want to delete?",
    "Remover avatar": "Remove avatar",
    "Remover {titulo} da lista": "Remove {titulo} from the list",
    "Rever agora": "Check again",
    "Sair da sala": "Leave the room",
    "Sem internet — a mostrar os dados guardados.":
      "No internet — showing the saved data.",
    "Simples (só a cor), um padrão por cima, ou uma imagem tua (como o fundo do WhatsApp). O padrão usa a tua cor de destaque.":
      "Plain (colour only), a pattern on top, or your own image (like the WhatsApp wallpaper). The pattern uses your accent colour.",
    "Sincronizar com MAL": "Sync with MAL",
    "Usar URL": "Use URL",
    "Verifica que criaste {ficheiro} com a tua chave do TMDB.":
      "Check that you created {ficheiro} with your TMDB key.",
    "a mais alta": "highest",
    "a mais baixa": "lowest",
    "agora mesmo": "just now",
    "data não disponível": "date unavailable",
    "para comentar.": "to comment.",
    "para comparares as notas dos títulos que viste.":
      "to compare the ratings of the titles you've seen.",
    "para ligares o AniList.": "to connect AniList.",
    "para ligares o Letterboxd.": "to connect Letterboxd.",
    "para ligares o MyAnimeList.": "to connect MyAnimeList.",
    "para ligares o Real-Debrid.": "to connect Real-Debrid.",
    // --- auditoria completa 2 ---
    "para marcares como visto e dares nota.":
      "to mark as watched and give a rating.",
    "para veres a tua lista.": "to see your list.",
    "para veres as tuas estatísticas. Só tu as vês.":
      "to see your statistics. Only you can see them.",
    "para veres o teu diário.": "to see your diary.",
    "{n} {r} atras": "{n} {r} ago",
    "{r} ({n})": "{r} ({n})",
    "sem legendas": "no subtitles",
    "{n} legendas": "{n} subtitles",
    // --- auditoria completa 3 ---
    "É o que os outros veem quando visitam o teu perfil. A biblioteca e as listas só aparecem se o perfil estiver público.":
      "What others see when they visit your profile. Your library and lists only show if the profile is public.",
    "🎲 Escolhe algo para mim": "🎲 Pick something for me",
    "📚 Recomendar": "📚 Recommend",
    // --- textos encontrados pela regra de frase ---
    "Criar sala": "Create room",
    "Desinstalar MEIDA": "Uninstall MEIDA",
    "Este título": "This title",
    "Guarda no diário e avança o {b} para o próximo episódio":
      "Saved to the diary and moves \"{b}\" to the next episode",
    "Importar tudo": "Import everything",
    "Importar watchlist": "Import watchlist",
    "Ligar AniList": "Connect AniList",
    "Ligar MyAnimeList": "Connect MyAnimeList",
    "Próximo par →": "Next pair →",
    "Seguinte →": "Next →",
    "Trocar referência ↻": "Swap reference ↻",
    "Ver detalhes": "See details",
    "Vês as notas da comunidade de 2 coisas que já viste. No meio podes ajustar a tua nota de cada uma: nota exata na caixa, ou ↑/↓ (↑/↓ no teclado ajustam a esquerda). Espaço ou \"Manter e próximo\" passa ao próximo par.":
      "You see the community ratings of 2 things you've already watched. In the middle you can adjust your own rating for each: the exact rating in the box, or ↑/↓ (↑/↓ on the keyboard adjust it leftwards). Space or \"Keep and next\" moves to the next pair.",
    "Watch Party": "Watch Party",
    "a mediana": "the median",
    "← Anterior": "← Previous",
    "⏱ neste momento": "⏱ at this moment",
    "⚖ Comparar avaliação": "⚖ Compare rating",
    "🔍 Pesquisar no Google ↗": "🔍 Search on Google ↗",
    // --- placeholder de resposta ---
    "Responder a {u}...  (escreve @ para chamar alguém)":
      "Reply to {u}...  (type @ to mention someone)",
    // --- audio do torrent ---
    "DUB": "DUB",
    "Legendado": "Subtitled",
    // --- chaves em falta 2 ---
    " (agora está privado: só tu vês)": "(now private: only you see it)",
    "\"Escolhe algo para mim\". Desligado por defeito.":
      "\"Pick something for me\". Off by default.",
    "+ Nova lista": "+ New list",
    ". Depois carrega no botao.": ". Then click the button.",
    "A procura mais...": "Searching more...",
    "A tua lista de \"para ler\" está vazia. Adiciona mangá ao plan to read no MAL.":
      "Your \"plan to read\" list is empty. Add manga to the plan to read in MAL.",
    "Ajusta a largura e a altura dos posters (útil em ecrãs pequenos).":
      "Adjust the width and height of the posters (useful on small screens).",
    "Autoplay desligado": "Autoplay off",
    "Autoplay ligado": "Autoplay on",
    "Autoskip desligado": "Autoskip off",
    "Autoskip ligado": "Autoskip on",
    "Como mostrar os nomes dos animes (catálogo, pesquisa e a tua lista).":
      "How to show anime names (catalogue, search and your library).",
    "Editar perfil": "Edit profile",
    "Entra para gostar": "Log in to like",
    "Escolher ficheiro": "Choose file",
    "Estás em desenvolvimento — esta opção só se aplica à app instalada.":
      "You're in development — this option only applies to the installed app.",
    "Fonte: {p}": "Source: {p}",
    "Gostar": "Like",
    "Há mais respostas aqui abaixo que não foi possível mostrar.":
      "There are more replies below that couldn't be shown.",
    "Imagem do computador": "Image from computer",
    "Imagem por URL": "Image by URL",
    "Isto só funciona na app de computador (Electron), não na versão web.":
      "This only works in the desktop app (Electron), not in the web version.",
    "Liga a tua conta MyAnimeList para veres aqui a tua lista de \"para ler\"":
      "Connect your MyAnimeList account to see your \"plan to read\" list here",
    "Ligar o MyAnimeList nas Definições": "Connect MyAnimeList in Settings",
    "Mais info": "More info",
    "Mais recomendações": "More recommendations",
    "Minuto do vídeo: {t} ({s} segundos)": "Video minute: {t} ({s} seconds)",
    "Nada na tua lista com estes filtros.":
      "Nothing on your list with these filters.",
    "Nome da lista:": "List name:",
    "Nova lista": "New list",
    "Onde ficam os teus dados. {a} guarda tudo localmente.":
      "Where your data is stored. {a} keeps everything locally.",
    "Os títulos que marcaste como \"para ler\" (plan to read) no MyAnimeList{n}.":
      "The titles you marked as \"plan to read\" (plan to read) in MyAnimeList{n}.",
    "Para ler": "Plan to read",
    "Para ti": "For you",
    "Perfil atualizado. ✓": "Profile updated. ✓",
    "Procurar por filtros": "Search by filters",
    "Remover imagem": "Remove image",
    "Renomear lista": "Rename list",
    "Repor tamanho": "Reset size",
    "Reproduzir": "Play",
    "Sem ficheiro": "No file",
    "Tirar o gosto": "Remove the like",
    "para editares o teu perfil.": "to edit your profile.",
    "para escolheres um avatar.": "to choose an avatar.",
    "{a} liga a app a um MEIDA alojado noutro sítio, para partilhares conta, biblioteca, seguidores e comentários entre dispositivos.":
      "{a} connects the app to a MEIDA hosted elsewhere, so you can share account, library, followers and comments across devices.",
    "{e} {c} — pode não reproduzir no browser. Prefere .mp4.":
      "{e} {c} — may not play in the browser. Prefer .mp4.",
    "⚡ Debrid": "⚡ Debrid",
    "✓ Reproduz no browser": "✓ Plays in browser",
    "✓ Visto": "✓ Watched",
    "✓ browser": "✓ browser",
    // --- botao de descarregar a app (so no site) ---
    "Descarregar a app": "Download the app",
    "Descarregar a app para o computador": "Download the app for your computer",
    // --- textos que estavam por traduzir (achados pelo auditor: JSX misturado com expressao) ---
    "Debrid indisponível, a tocar via torrent local":
      "Debrid unavailable, playing via local torrent",
    "{erro} — usa o separador {separador}.": "{erro} — use the {separador} tab.",
    "Fonte: {fonte} · {audio} · {n} legendas (liga/desliga no player)":
      "Source: {fonte} · {audio} · {n} subtitles (turn on/off in the player)",
    "Dobrado": "Dubbed",
    "Os extractores gratuitos são instaveis. Usa o separador {a} (com anúncios) ou {b}.":
      "The free extractors are unreliable. Use the {a} tab (with ads) or {b}.",
    "Para reprodução sem anúncios fiavel, liga um extractor (Consumet) em {chave} no {onde}.":
      "For reliable ad-free playback, set up an extractor (Consumet) at {chave} in {onde}.",
    "título": "title",
    "{titulos} com actividade nos últimos {n} meses. O que conta é a última vez que mexeste em cada um — a nota que deste, o momento em que o puseste na lista.":
      "{titulos} with activity in the last {n} months. What counts is the last time you touched each one — the rating you gave, the moment you added it to your list.",
    "{titulos} com nota, por faixa de 10 pontos. Passa o rato sobre uma barra para o número exacto.":
      "{titulos} rated, in bands of 10 points. Hover a bar for the exact number.",
    "{nome} · a carregar...": "{nome} · loading...",
    "{fonte} nao carregou · a usar {nome}": "{fonte} did not load · using {nome}",
    "{n} com nota": "{n} rated",
    "{pct}% · 👤 {peers} peers · ⬇ {vel} MB/s":
      "{pct}% · 👤 {peers} peers · ⬇ {vel} MB/s",
    "{a} de {b} conquistadas": "{a} of {b} unlocked",
    "A carregar {titulo}": "Loading {titulo}",
    "A tua nota: {nota}": "Your rating: {nota}",
    "Não consegui carregar o catálogo: {erro}":
      "Couldn't load the catalogue: {erro}",
    "Página {p} de {n} · {t} títulos": "Page {p} of {n} · {t} titles",
    "Recomendações com base nas tags que mais lês na tua lista do MAL{analisados}. Nunca te recomendo nada que já tenhas na lista.":
      "Recommendations based on the tags you read most in your MAL list{analisados}. I never recommend anything you already have.",
    "({n} títulos analisados)": "({n} titles analysed)",
    "Esconder o que já tenho na lista": "Hide what I already have in my list",
    "Cola o teu token do Real-Debrid (obtém-no em {ligacao}){fim}":
      "Paste your Real-Debrid token (get it at {ligacao}){fim}",
    "A ligar a: {destino}": "Connecting to: {destino}",
    "servidor local deste computador": "this computer's local server",
    "Mostrar anime adulto (NSFW/hentai) na pesquisa, nos filtros de género e no \"Escolhe algo para mim\". Desligado por defeito.":
      'Show adult anime (NSFW/hentai) in search, in the genre filters and in "Pick something for me". Off by default.',
    "Perfil público — qualquer pessoa pode ver a tua biblioteca e listas.{estado}":
      "Public profile — anyone can see your library and lists.{estado}",
    "média {media} · mediana {mediana}": "average {media} · median {mediana}",
    "A década conta {ano} dos {n} títulos: os restantes ainda não têm ano guardado. Abre a ficha de alguns, ou corre o preenchimento, e este número fica mais firme.":
      "The decade accounts for {ano} of the {n} titles: the rest have no year stored yet. Open a few of them, or run the fill-in, and this number gets more solid.",
    "{n} a seguir": "{n} following",
    "🔒 Este perfil é privado.": "🔒 This profile is private.",
    // --- Details.jsx: legendas, avisos do iframe e o botao de terminar episodio ---
    "As legendas próprias (incl. português) só funcionam no separador {torrents}{extra} (os Providers são páginas externas em iframe).":
      "The app's own subtitles (including Portuguese) only work in the {torrents}{extra} tab (Providers are external pages in an iframe).",
    "🔴 Watch Party: aqui (Providers) o play/pausa {nao} sincroniza — usem {torrents}{extra} para verem em sincronia.":
      "🔴 Watch Party: here (Providers) play/pause does {nao} sync — use {torrents}{extra} to watch in sync.",
    "Guarda no diário e avança o {b} para o próximo episódio{mal}":
      "Saves to the diary and moves \"{b}\" to the next episode{mal}",
    "(e marca no MAL)": "(and marks it on MAL)",
    // --- Details.jsx: separadores e avisos ---
    "Áudio deste título:": "Audio for this title:",
    "🔴 Watch Party: estas fontes são em iframe, o play/pausa {nao} sincroniza — usem {torrents} para verem em sincronia.":
      "🔴 Watch Party: these sources are in an iframe, so play/pause does {nao} sync — use {torrents} to watch in sync.",
    // --- texto de uma palavra dentro de tags (o auditor nao os via) ---
    "abandonados": "abandoned",
    "mediana": "median",
    "segues": "following",
    "Todas": "All",
    "Ordenar:": "Sort by:",
    "Todos": "All",
    "Veem o mesmo ao mesmo tempo. Pausa/play e sincronizado nos separadores {a} e {b}.":
      "Watch the same thing at the same time. Play/pause syncs on the {a} and {b} tabs.",
    "Copiar codigo": "Copy code",
    "melhor: {n}": "best: {n}",
    "Aplicar": "Apply",
    "Limpar{n}": "Clear{n}",
    "Tudo": "All",
    "todos": "all",
    "filmes": "movies",
    "animes": "anime",
    "Já tens conta?": "Already have an account?",
    "{n} seguidores": "{n} followers",
    "Toca nos géneros: 1x = {quero}, 2x = {nao}. Depois carrega no botão.":
      "Tap the genres: 1x = {quero}, 2x = {nao}. Then press the button.",
    "quero": "want",
    "Estado": "Status",
    "Começou": "Started",
    "Acabou": "Finished",
    "Temporada": "Season",
    "Começou: {data}": "Started: {data}",
    // --- identicos nos dois idiomas (codecs, unidades, marcas) ---
    "x264": "x264",
    "x265": "x265",
    "min": "min",
    // --- LibraryControls.jsx: watchlist, pausa, abandonar e a barra de comunidade ---
    "✓ Na watchlist": "✓ In your watchlist",
    "+ Watchlist": "+ Watchlist",
    "✓ Em pausa": "✓ On hold",
    "Pausar": "Put on hold",
    "✓ Abandonado": "✓ Dropped",
    "Abandonar": "Drop",
    "Comunidade: {n}": "Community: {n}",
    "Tu: {n}": "You: {n}",
    // --- Library/Stats: Guardar/Criar e a frase do tempo visto ---
    "Criar": "Create",
    "{n} medido{nome} até agora. Avançar no vídeo não conta; recuar para ver de novo também não.":
      "",
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