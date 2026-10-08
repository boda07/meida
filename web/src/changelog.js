// Novidades por versao, em linguagem simples (sem termos tecnicos). Mostradas no
// "o que mudou" depois de o utilizador atualizar a app. Mais recente em cima.
export const CHANGELOG = [
  {
    version: "1.3.7",
    items: [
      "Corrigido: ao abrir a ficha de um anime, série ou filme, aparecia o ecrã de erro “Algo correu mal”. A app não abria nenhum título — era preciso reiniciar depois de atualizar para 1.3.6. Desculpa: foi um erro meu na 1.3.6.",
      "Corrigido: o atalho da MEIDA no menu Iniciar apontava para uma pasta de compilação em vez da app instalada, e por isso deixava de funcionar. Se te aparece um atalho que não abre, apaga-o: a 1.3.7 cria-o no sítio certo.",
    ],
  },
  {
    version: "1.3.6",
    items: [
      "Corrigido: o que aparecia no Discord já não contava tempo quando o vídeo está parado. Agora aparece “Pausado” e o contador pára. Antes só parava quando saías do episódio.",
      "Corrigido: nos servidores de vídeo que são uma janela por cima (o MegaPlay, o VidLove e outros), o Discord já não fica a dizer “Pausado” o tempo todo. Não sabemos se estão a dar, por isso agora aparece só o título, sem tempo a contar e sem dizer que está em pausa. Continua a aparecer que estás a ver.",
      "Corrigido: escolher um servidor de vídeo já não põe nada no Discord antes de carregares no play.",
    ],
  },
  {
    version: "1.3.5",
    items: [
      "Corrigido: quando escolhias um servidor de vídeo, ele mudava sozinho passados uns segundos — chegaste a escolher o VidLove e aparecia o VidLink sem teres pedido nada. Agora a fonte que escolhes fica até mudares de escolha.",
      "Corrigido: a barra do topo já não se mexe ao escrever na pesquisa — o fundo desfocado saltava de lado.",
      "Corrigido: ao escrever na pesquisa, o campo não aparece por cima dos botões de navegação. Agora ocupa o lugar deles.",
      "Corrigido: o campo da pesquisa já não é uma caixa de cor diferente dentro da barra.",
      "Corrigido: a linha vermelha que aparecia ao escrever na pesquisa já não sai para fora da barra.",
      "Corrigido: a barra do topo já não fica esticada com um espaço vazio quando a pesquisa está fechada.",
    ],
  },
  {
    version: "1.3.4",
    items: [
      "Corrigido: o aviso “a carregar” ficava no canto do vídeo mesmo com o vídeo a passar, e o servidor de vídeo mudava sozinho uns segundos depois de começares. Acontecia por causa de uma verificação interna que acabava a correr duas vezes.",
      "Novo: a tua biblioteca no perfil passou a ter páginas. Antes eram as 700 ou tal títulos todos de uma vez, sem se ver o fim; agora são 60 por página.",
      "Novo: podes dar “gostar” a um comentário. Antes o coração lá estava mas não se percebia que era um botão, e o número só aparecia quando alguém já tinha gostado. Agora a contagem está sempre visível e o coração fica preenchido quando já deste gosto.",
      "Novo: as datas dos comentários passaram a ser relativas: “agora mesmo”, “há 10 segundos”, “há 3 minutos”, “há 2 dias”. Passa a data só depois de uma semana.",
      "Corrigido: no comentário já não se escreve o tempo em segundos. Podes escrever 2:05 ou 125, e há um botão que põe o momento em que estás a ver.",
      "Novo: sino de notificações no topo. Avisa-te quando alguém responde a um comentário teu, quando alguém gosta de um comentário teu, ou quando alguém começa a seguir-te.",
      "Corrigido: nas estatísticas do perfil, “vistos” e “para ver” apareciam em branco.",
      "Melhorado: os nomes dos géneros nas estatísticas estão agora em português.",
      "Corrigido: ao escrever na pesquisa, o fundo desfocado da barra mexia de lado.",
      "Corrigido: ao filtrar a biblioteca, se estavas numa página alta, saltavas para o fim da lista filtrada em vez de para o início.",
    ],
  },
  {
    version: "1.3.3",
    items: [
      "Corrigido: com o autoplay desligado nas definições, o vídeo do MegaPlay começava na mesma. Não há forma de o travar pelo lado do sítio, por isso agora o vídeo só carrega depois de carregares nele — assim funciona com todos os sítios, e não só com os que respeitam a definição.",
      "Novo: podes marcar um título como “Em pausa” ou “Abandonado” na ficha. Aparecem também como filtros na tua biblioteca e entram nas estatísticas do perfil.",
      "Corrigido: o perfil dizia que estavas “a ver” 389 coisas, quando era a tua lista de “para ver”. Agora são duas coisas separadas: “para ver” é a lista, e “a ver agora” é o que realmente começaste.",
      "Melhorado: as estatísticas do perfil deixaram de mostrar um gráfico que não dizia nada — quase todas as notas caíam em duas barras. Agora mostram onde estão a tua nota mais baixa, a mediana e a mais alta.",
      "Corrigido: a lista que se chamava “Mais vistos” mostrava os títulos com nota mais alta. Passou a chamar-se “Melhores notas”.",
    ],
  },
  {
    version: "1.3.2",
    items: [
      "Novo: o perfil tem uma aba de Estatísticas, com os teus géneros mais vistos, que tipos vês, como se distribuem as tuas notas e os títulos que mais te marcaram.",
      "Melhorado: o perfil deixou de ter aquela faixa com uma imagem esticada no topo, que tapava o teu nome e ficava esquisita quando o ecrã era grande. O nome é agora a coisa maior do perfil, e o bloco usa a largura toda do ecrã.",
      "Corrigido: quando acabavas um episódio de anime, o título saía do “Continua a ver” em vez de passar ao episódio seguinte. Só sai mesmo quando já não há episódios a seguir — e numa série, quando acaba a temporada, passa para a primeira da seguinte.",
      "Corrigido: as legendas deixavam de aparecer em alguns episódios. Era o mesmo problema do aviso que fica no ecrã: a app achava que o vídeo não carregou e mudava de servidor a meio, já com o vídeo a dar.",
      "Corrigido: o aviso “a carregar” ficava no canto do vídeo mesmo depois de o vídeo estar a passar.",
      "Novo: o áudio (legendado ou dobrado) fica agora guardado por título. Antes tinhas de escolher de todas as vezes, porque não se guardava — e como há animes que só existem dobrados, a escolha nas definições não resolvia.",
      "Corrigido: o 111Movies deixou de funcionar (o sítio desapareceu da internet). Passou a usar o servidor de vídeo que ficou de pé, que é mais rápido e traz legendas, Chromecast e janela flutuante.",
      "Melhorado: o bloqueador de anúncios aprendeu 16 sítios novos que passavam por ele. Entre eles havia um que estava a gravar o que fazias dentro do leitor e a mandar para a Microsoft — esse já não carrega.",
      "Melhorado: quando decides se queres legendado ou dobrado dentro da lista de transferências, a escolha também fica guardada.",
    ],
  },
  {
    version: "1.3.1",
    items: [
      "Corrigido: o vídeo começava sozinho mesmo com a reprodução automática desligada nas definições.",
      "Corrigido: o player deixava de mostrar um vídeo à partida e saltava sozinho para outro servidor. Agora só usa servidores que funcionam, e se mudar de servidor avisa-te qual falhou.",
      "Corrigido: aparecia um erro a dizer que a janela ficou em branco quando a app estava perfeitamente bem. Era um aviso falso que aparecia a cada 500 ms durante o arranque.",
      "Corrigido: quando a app consegue mesmo abrir, o erro que sobra é menos barulhento e indica onde está o registo com o detalhe.",
    ],
  },
  {
    version: "1.3.0",
    items: [
      "Melhorado: a versão no browser e a app instalada passam a ver as mesmas coisas — a mesma conta, a mesma biblioteca, os mesmos comentários. Antes cada uma tinha os seus dados.",
      "Melhorado: já não é preciso reinstalar a app para trocar de servidor de dados. Agora dá para mudar uma definição e pronto.",
      "Corrigido: se escolheste usar a app semligação partilhada, os teus dados deixam de ir para o servidor sem isso acontecer.",
    ],
  },
  {
    version: "1.2.9",
    items: [
      "Corrigido: a app deixava de abrir em vários computadores depois de uma atualização, sem dar nenhum erro — o ecrã ficava preto. Agora, antes de cada versão ser publicada, a app é verificada automaticamente e esse tipo de problema já não consegue passar despercebido.",
      "Melhorado: as versões publicadas passam por uma conferência que abre o instalador e confirma que está tudo bem dentro dele, em vez de confiar que está.",
    ],
  },
  {
    version: "1.2.8",
    items: [
      "Corrigido: os links magneto voltam a funcionar — agora sim, em qualquer computador, tanto nos de processador normal como nos mais novos.",
      "Corrigido: quando fazes a app, o programa de origem dos ficheiros é colocado já no formato certo para cada tipo de computador. Antes ia sempre o do meu computador, e por isso não funcionava nos outros.",
    ],
  },
  {
    version: "1.2.7",
    items: [
      "Corrigido: a app não abria de todo em vários computadores. Acontecia porque um componente de origem dos ficheiros tinha um programa próprio para o tipo de processador do meu computador, e em vez de mostrar a app dava um erro. Se não te abria, atualiza para esta versão.",
      "Corrigido: se usas links magneto para ver vídeos, eles deixam de funcionar em alguns computadores — o resto da app funciona normalmente.",
      "Corrigido: a app não fica mais presa numa versão antiga das novidades depois de atualizar.",
      "Corrigido: o servidor interno já não morre em silêncio — escreve um registo e mostra o erro na janela.",
    ],
  },
  {
    version: "1.2.6",
    items: [
      "Corrigido: a app abria com a janela preta. Acontecia quando o servidor interno não conseguia arrancar porque a porta já estava ocupada — fechavas a app e reabrias, e a nova não tinha tempo de ficar com a porta. Agora o servidor usa outra porta automaticamente.",
      "Corrigido: quando a app não consegue abrir, agora aparece uma janela a dizer porquê e onde está o registo do erro. Antes a janela ficava preta sem explicar nada.",
      "Corrigido: a app limpa o cache da interface ao arrancar, para as novidades não ficarem presas numa versão antiga.",
      "Corrigido: o servidor agora escreve um registo do que faz, para se poder ver o que está errado quando algo falha.",
    ],
  },
  {
    version: "1.2.5",
    items: [
      "Corrigido: a app não abria — aparecia um erro em vez de mostrar o conteúdo. Acontecia porque o programa de instalação vinha com a versão errada do motor que faz a app correr. Se a tua app está a dar erro ao abrir, atualiza para esta versão e fica resolvido.",
      "Corrigido: o botão para procurar atualizações já não precisa de ter conta. Fica também em Definições › Avançado › Atualizações, para quem ainda não criou conta.",
      "Melhorado: ao entrar na conta, o botão mostra agora uma animação de espera, para ficar claro que a app está a trabalhar e não encravada.",
      "Corrigido: o script que instala a app em PCs onde a instalação ficou a meio foi melhorado — diz o tipo de processador do PC, confirma que o programa instalado é do tipo certo e apanha a versão mais recente.",
    ],
  },
  {
    version: "1.2.4",
    items: [
      "Corrigido: se já tinhas usado a app antes de atualizar, podia acontecer a janela abrir ainda com a versão antiga em memória — a lista de novidades aparecia desatualizada e por vezes dava erro \"fail to fetch\". Agora a app vai sempre buscar a versão nova ao arrancar, por isso deixa de ficar presa na versão antiga.",
    ],
  },
  {
    version: "1.2.3",
    items: [
      "Corrigido: a app não instalava em Almost todos os computadores. O ficheiro que era descarregado tinha sido feito para o tipo de processador errado, por isso o instalador acabava sem pôr a app — só sobrando o ícone de desinstalar. Se ficaste com a app a meio, volta a instalar esta versão e fica resolvido.",
      "Novo: se a instalação correr mal, agora há um script que apaga as sobras e instala de novo sozinho, conferindo que o ficheiro não chega cortado.",
      "Melhorado: a versão web está publicada em meida.onrender.com — dá para usar a MEIDA no navegador, sem instalar nada.",
    ],
  },
  {
    version: "1.2.2",
    items: [
      "Novo: os animes ganharam uma fonte de reprodução nova, que é a primeira da lista. Traz as legendas já ligadas, vai a 1080p e, ao contrário das outras, não enche o ecrã de anúncios.",
      "Novo: a app bloqueia os anúncios dos sites de vídeo. Não tens de instalar nada — funciona dentro da app e vale para todos os sites, e o vídeo continua a passar.",
      "Corrigido: na lista de fontes de anime já não aparecem duas entradas iguais do mesmo site.",
      "Melhorado: as Definições deixaram de ser uma parede comprida para rolar. Agora estão divididas em abas (Perfil, Aparência, Reprodução, Conteúdo, Contas, Dados, Avançado) e a app lembra em qual ficaste da última vez.",
      "Melhorado: a marca de \"visto\" nos cartazes passou a ser um visto bem desenhado, em vez do rabisco que o Windows desenhava.",
      "Corrigido: às vezes a atualização não chegava a instalar e o ícone do Menu Iniciar ficava a apontar para o sítio errado, sem a app abrir. Agora a app espera pelo servidor interno antes de se atualizar.",
    ],
  },
  {
    version: "1.2.1",
    items: [
      "Novo: o Discord passa a mostrar o que estás a ver, como no Stremio — o nome do título, o episódio e o progresso. Só funciona com a app do Discord aberta no computador e não custa nada. Podes desligar quando quiseres em Definições → Discord.",
      "Corrigido: os botões de exportar e importar dados tinham um aspecto diferente do resto dos Definições.",
    ],
  },
  {
    version: "1.2.0",
    items: [
      "Novo: a tua biblioteca, o teu diário e os teus comentários passam a ficar guardados na nuvem. Assim a tua conta é a mesma em qualquer computador — se instalares esta versão noutro PC, entras com o mesmo nome e já tens tudo lá dentro.",
      "Novo: cada pessoa tem uma página de perfil, com foto, descrição e a lista do que viu. Podes ver o que os outros viram e segui-los.",
      "Novo: uma página para procurar as pessoas que usam a MEIDA.",
      "Novo: comentários nos títulos e nos episódios. Escreves o que achaste, podes marcar o minuto do vídeo a que te referes, responder a outra pessoa e dar \"gosto\".",
      "Melhorado: o vídeo NÃO vai para a nuvem. Continua a correr no teu próprio computador, por isso não fica mais lento nem depende de mais nada para ver.",
      "Melhorado: a app está mais rápida e já não se atrapalha quando fica tempo sem ser usada.",
    ],
  },
  {
    version: "1.1.3",
    items: [
      "Adicionado: no ecrã de erro \"Algo correu mal\", já tens um botão \"Voltar atrás\" para regressares à página anterior (ou ao início) — além do \"Recarregar\".",
    ],
  },
  {
    version: "1.1.2",
    items: [
      "Corrigido: ao abrir a ficha de um título (série, filme ou anime), aparecia às vezes o ecrã de erro \"Algo correu mal — Recarrega para tentar de novo\" e nada carregava. Agora a ficha abre sempre correctamente.",
    ],
  },
  {
    version: "1.1.1",
    items: [
      "Novo: nos animes, podes escolher entre \"Legendado\" e \"Dobrado\" logo na ficha do título (em cima, antes das fontes) — só para esse título, sem alterar as tuas Definições. Útil para veres um anime dobrado sem mudar o resto.",
      "Corrigido: ao tocar em \"Continua a ver\", o título abria outra vez mas às vezes na fonte errada (a primeira disponível em vez da que estavas a usar). Agora a app lembra-se da fonte e abre a mesma.",
      "Corrigido (telemóvel/tablet): os botões do seletor \"Legendado/Dobrado\" e das fontes ficavam todos juntos em ecrãs pequenos — agora quebram a linha e ficam bem espaçados.",
    ],
  },
  {
    version: "1.1.0",
    items: [
      "Novo: Real-Debrid! Liga a tua conta nas Definições (pegando o teu token em real-debrid.com/apitoken). Os torrents que já estão na cache do Real-Debrid aparecem com um selo e dão para ver de imediato, sem descarregar nada no teu computador — o Real-Debrid descarrega e a app reproduz. Os que não estão na cache são adicionados e descarregam lá também.",
      "Melhorado (torrents): agora vêm de várias fontes (Torrentio, YTS…) agrupadas na lista, por isso há mais opções e mais hipóteses de encontrar um que dê para ver logo.",
      "Novo: nas fontes de reprodução aparece uma lista de atalhos para abrir o título em sites externos (ex.: no site original), sem sair da app.",
      "Melhorado: a app abre mais depressa — as páginas só são carregadas quando as abres, em vez de tudo de uma vez.",
      "Melhorado: os teus dados são guardados com mais segurança — a app faz uma cópia de segurança automática e, se alguma vez um ficheiro se corromper, recupera sozinha sem perderes nada.",
      "Melhorado: o Watch Party deixou de depender de um serviço externo (Supabase) — agora funciona no próprio servidor da app, por isso continua a funcionar sempre e sem precisares de contas de terceiros.",
      "Melhorado (telemóvel/tablet): em ecrãs pequenos o menu, as fichas e o slideshow adaptam-se automaticamente; e em ecrãs muito largos o conteúdo fica centrado, sem se esticar.",
      "Novo: no slideshow podes passar para o título seguinte com um gesto (arrastar para o lado) no ecrã táctil.",
    ],
  },
  {
    version: "1.0.0",
    items: [
      "Novo: conquistas e racha diário! Abre o menu da conta e carrega em 'Conquistas' para ver as tuas medalhas (ex.: 'Primeiro passo', 'Otaku', 'Implacável') e quantos dias seguidos estás ativo.",
      "Melhorado: podes agora guardar um backup da tua lista e diário. Nas Definições, em 'Os teus dados', carrega 'Exportar JSON' ou 'Exportar CSV' para descarregar tudo; e 'Importar dados' para voltar a carregar um ficheiro que exportaste antes.",
      "Melhorado: nos cartões (home, pesquisa, categorias) aparece um botão '+' para adicionar rapidamente à watchlist ou marcar como visto, sem ter de abrir cada ficha. A tua nota também aparece directamente no cartão.",
      "Melhorado: na ficha dos títulos, já vês a teu nota lado a lado com a média da comunidade numa barra, para comparares rapidamente.",
      "Corrigido: a déploy na Render falhava por não instalar as dependências da web (vite). Build reconfigurada para instalar tudo antes de compilar.",
    ],
  },
  {
    version: "0.9.9",
    items: [
      "Corrigido: quando um site de filmes deixava de funcionar, o leitor ficava preso no \"a carregar\" com o ecrã vazio. Agora, se a fonte não responder em 15 segundos, a app muda sozinha para a próxima — sem precisares de fazer nada.",
      "Melhorado: as fontes que estão em baixo aparecem riscadas na lista e a app já não as tenta usar por defeito.",
      "Melhorado: a app verifica as fontes com mais frequência (6 em 6 horas em vez de 24 em 24), para estar mais atualizada.",
      "Fontes de reprodução: removidas duas fontes que funcionavam mal — uma era muito lenta (e dava sempre o filme dobrado) e a outra mostrava a página mas o vídeo falhava. As restantes ficaram ordenadas das mais rápidas para as mais lentas.",
      "Melhorado (torrents): cada download mostra agora se dá para ver logo no browser (✓) ou se é provável que não funcione (⚠ .mkv). Novo filtro para ver só os que funcionam, e a mensagem de erro explica-te isso.",
      "Melhorado (torrents): novo botão para parar um download a meio (libera espaço e ligações). Mais formas de organizar a lista (por qualidade, por tamanho) e filtros.",
      "Melhorado (legendas): menos falhas ao carregar as legendas quando se pedem várias ao mesmo tempo.",
      "Corrigido: ao tocar em \"Continua a ver\", a série às vezes abria na temporada certa mas no episódio errado (no 1º em vez de onde ficaste) — agora retoma sempre no episódio certo.",
      "Novo: \"Compara as tuas notas\" (menu do perfil) — vês dois títulos que já viste lado a lado e, no meio, podes ajustar a tua nota de cada um (escreves na caixa ou usas ↑/↓ para subir/baixar de 1 em 1). Serve para comparares as tuas notas com as da comunidade.",
      "Novo: nas fichas dos títulos, o botão \"Comparar avaliação\" — abre uma janela em que o título atual fica de um lado e um que já viste do outro; sobes/baixas a nota do título atual com ↑/↓ e podes trocar a referência para continuares a comparar.",
      "Corrigido: as Definições podiam ficar em branco enquanto a app ainda estava a arrancar — agora mostra \"A testar fontes...\" e, se algo correr mal, aparece uma mensagem com um botão para recarregar.",
    ],
  },
  {
    version: "0.9.6",
    items: [
      "Novo: liga a tua conta AniList nas Definições. A app passa a marcar episódios vistos no AniList automaticamente (quando o MyAnimeList não está ligado) e, se ligares **as duas**, faz uma sincronização entre elas: compara o progresso entre as duas contas e usa sempre a mais avançada — nada do que já marcaste se perde.",
      "Importa a tua lista completa do AniList (o que já viste, a ver, watchlist, notas) com um botão, e podes sincronizar de novo a qualquer momento.",
      "Melhorado: catálogos e pesquisas agora ficam guardados no computador — se um site de informação estiver em baixo, a app usa os últimos dados em vez de ficar sem resultados.",
    ],
  },
  {
    version: "0.9.5",
    items: [
      "Novo: modo offline da \"A minha lista\" — sem internet, a lista continua a abrir com os títulos, cartazes, notas e géneros que já tinham sido carregados alguma vez (um aviso discreto diz que estás sem internet; os dados em falta são preenchidos quando a rede voltar).",
    ],
  },
  {
    version: "0.9.4",
    items: [
      "Melhorado: \"A minha lista\" abre agora quase instantaneamente — as notas do Letterboxd e as fichas são carregadas em segundo plano e aparecem mal estejam prontas (antes podia demorar vários segundos sempre que a app arrancava).",
      "Acessibilidade: ao navegar com o teclado (Tab) aparece agora um contorno visível à volta da opção onde estás, e os botões que só mostram um ícone passaram a ter descrição para leitores de ecrã.",
    ],
  },
  {
    version: "0.9.3",
    items: [
      "Corrigido: ao abrir um filme, série ou anime, o ecrã podia ficar preto (a página não abria) — agora os detalhes abrem normalmente.",
    ],
  },
  {
    version: "0.9.2",
    items: [
      "Nova animação de carregamento: enquanto a app está a trabalhar (por exemplo, ao mudar de Filmes/Séries/Anime ou a abrir páginas), aparece um anel animado com \"A carregar\" e pontinhos a mexer — já não ficas sem saber se está mesmo a funcionar.",
      "O \"o que mudou\" passou a abrir sempre na versão certa, mesmo quando a versão instalada não está na lista de novidades.",
      "Nas Definições, o idioma dos títulos passou a mostrar primeiro \"Português\" e depois \"Inglês\", como nas outras opções de idioma.",
      "Corrigido: mudar o idioma das sinopses já não muda o idioma dos géneros ao mesmo tempo (os géneros ficam no idioma que estavam).",
      "Novas fontes de reprodução: SuperEmbed, VidAPI e MegaEmbed (filmes e séries).",
      "Novas fontes de reprodução: SMASHYStream (filmes e séries) — player com legendas em vários idiomas.",
      "Legendas: o português de Portugal (PT) passou a ser preferido em relação ao português do Brasil (PT-BR) — nos resultados do OpenSubtitles e na escolha automática da legenda.",
      "Corrigido: no \"Escolhe algo para mim\" de anime, os géneros podiam não carregar e a escolha podia falhar quando o MyAnimeList estava instável — agora carregam e a escolha usa a AniList como reserva.",
      "Anime: nova fonte MegaVid (legendado/dobrado), agora também a fonte default do anime.",
      "Anime: removida a fonte MegaPlay, que deixou de funcionar (dava erro para todos os títulos).",
      "Anime: removida a fonte VidPlus, que deixou de funcionar e ficou redundante com o MegaVid.",
      "Anime: removida a fonte VidLink (no anime não devolvia stream; continua a funcionar em filmes e séries).",
      "Corrigido: quando o MyAnimeList falha, a app passa a usar automaticamente uma fonte alternativa de catálogo (Tenrai) antes de desistir — catálogo, pesquisa, géneros e episódios continuam a funcionar.",
      "Melhorado: as fichas de anime (catálogo, pesquisa, detalhes e episódios) ficam agora guardadas no computador — se o MyAnimeList e a fonte alternativa estiverem ambos em baixo, a app usa os últimos dados conhecidos em vez de mostrar páginas vazias.",
      "Novo: atalhos de teclado no player — Espaço ou K para reproduzir/pausar, setas ←/→ para saltar 10 segundos, setas ↑/↓ para o volume, M para mudo e F para ecrã inteiro.",
      "Corrigido: no manga, os géneros podiam não carregar quando o MyAnimeList estava instável — agora usam a fonte alternativa e o que ficou guardado, como o anime.",
      "Melhorado: quando o MyAnimeList está em baixo, a app demora agora muito menos a obter catálogo, géneros e episódios (passa logo para a fonte alternativa em vez de insistir várias vezes).",
      "Novo: botão \"Trailer\" nas fichas de filmes, séries e anime — abre o trailer oficial (YouTube) sem sair da app.",
      "Novo: as fontes de reprodução são agora testadas automaticamente 1x por dia — as que estiverem em baixo aparecem sinalizadas na lista (riscadas, com \"em baixo\") e a app deixa de escolher por defeito uma fonte partida.",
      "Novo: listas personalizadas — podes criar as tuas listas (\"Para ver\", \"Favoritos\", listas temáticas), adicionar filmes/séries/anime com o botão \"+ Lista\" nas fichas, e vê-las na página \"A minha lista\" (criar, renomear, apagar e remover títulos).",
      "Novo: \"Continua a ver\" retoma agora mesmo a meio de um episódio — nos torrents e nos players sem anúncios, a posição é guardada automaticamente e os cards mostram uma barra de progresso; ao voltar, o vídeo começa onde ficaste (se mudares de episódio, recomeça do início).",
    ],
  },
  {
    version: "0.9.1",
    items: [
      "A aba Anime volta a carregar mesmo quando o MyAnimeList está em baixo: a app usa a AniList como reserva para manter catálogo, pesquisa e filtros a funcionar.",
      "A pesquisa de anime ficou mais resistente a falhas temporárias dos sites de onde vêm os dados.",
    ],
  },
  {
    version: "0.9.0",
    items: [
      "Removidas as fontes que não funcionavam (VidSrc.cc, VidSrc, VidSrc.su e Embed.su): davam erro de vídeo e/ou eram bloqueadas por alguns operadores, obrigando a mexer no DNS. Ficam as que funcionam sem mexer em nada: VidFast, VidLink, MoviesAPI, 2Embed e 111Movies.",
      "A aba \"Sem anúncios\" (filmes/séries) deixa de aparecer quando não está configurada — só confundia. Para legendas em português usa os Torrents: o leitor próprio liga a legenda PT automaticamente.",
    ],
  },
  {
    version: "0.8.9",
    items: [
      "Fontes atualizadas: removido o AutoEmbed (domínio morto), o VidSrc.vip passou a VidSrc.su e o MoviesAPI passou para o domínio novo (moviesapi.to).",
    ],
  },
  {
    version: "0.8.8",
    items: [
      "A fila \"Filmes mais bem avaliados\" (Início e Filmes) passou a ser ordenada pela nota da comunidade do Letterboxd, não pela do TMDB — deixam de aparecer lá estreias com poucos votos e nota inflacionada (ex.: o \"Swapped\").",
    ],
  },
  {
    version: "0.8.7",
    items: [
      "Notas de filmes mais fiáveis: passam a ser a média da comunidade do Letterboxd (em vez do TMDB, que em estreias com poucos votos dava notas erradas, tipo 9 num filme fraco). Aplica-se aos detalhes e à tua lista (corrige também as que já estavam guardadas).",
    ],
  },
  {
    version: "0.8.6",
    items: [
      "Mangá \"Para ler\": nos géneros podes escolher entre \"Todos (E)\" — tem de ter todos — e \"Qualquer (OU)\" — basta ter um.",
    ],
  },
  {
    version: "0.8.5",
    items: [
      "Mangá \"Para ler\": passou a ter também filtro por Estado (Completo, A publicar, Em pausa, Descontinuado), e os cartões mostram esse estado.",
    ],
  },
  {
    version: "0.8.4",
    items: [
      "Mangá \"Para ti\": o botão passou a ser \"Mais recomendações\" e traz títulos NOVOS de cada vez (deixou de repetir os mesmos).",
      "Mangá \"Para ler\": já dá para filtrar por tipo e género e ordenar por nota ou título (crescente/decrescente).",
    ],
  },
  {
    version: "0.8.3",
    items: [
      "O Mangá saiu da barra de cima (estava a deixá-la grande) e passou a ser uma opção dentro de \"Escolhe algo para mim\" (o dado).",
      "Na procura de mangá já podes escolher vários estados ao mesmo tempo (ex.: Completo + A publicar).",
      "Nova ordenação por Nota, crescente ou decrescente, na procura de mangá.",
      "Corrigida a escrita: passou a dizer \"Mangá\".",
    ],
  },
  {
    version: "0.8.2",
    items: [
      "Manga: já podes escolher vários tipos ao mesmo tempo (ex.: Manhwa + Manhua).",
      "Manga: nova opção \"Esconder o que já tenho na lista\" na procura por filtros — só te mostra coisas novas (precisa do MyAnimeList ligado).",
      "Manga: novo separador \"Para ler\" que mostra a tua lista de plan to read do MyAnimeList (como uma watchlist).",
      "As recomendações \"Para ti\" deixaram de sugerir títulos que já tens na lista.",
    ],
  },
  {
    version: "0.8.1",
    items: [
      "Nova secção Manga (Manhwa & Manhua)! Em \"Para ti\", recomendamos com base nas tags que mais lês na tua lista do MyAnimeList. Em \"Procurar por filtros\", escolhes o tipo (manhwa/manhua/...), o estado (completo, a publicar...) e os géneros/temas (ex.: Romance, Viagem no tempo) e trazemos títulos com essas tags. Os cartões abrem a página do MAL para leres/adicionares à lista.",
      "A sinopse do slideshow ficou com uma sombra mais forte (lê-se melhor sobre imagens claras).",
    ],
  },
  {
    version: "0.8.0",
    items: [
      "No slideshow (sobretudo no Anime), os títulos muito grandes deixam de empurrar a informação e os botões para fora — o título encolhe conforme o tamanho e limita-se a 2 linhas.",
    ],
  },
  {
    version: "0.7.9",
    items: [
      "Podes escolher o idioma dos géneros (Português ou Inglês) à parte das sinopses, nas Definições.",
    ],
  },
  {
    version: "0.7.8",
    items: [
      "No slideshow, o título fica em cima e a informação/sinopse/botões em baixo.",
      "O slideshow de Anime passou a ter o mesmo tamanho dos outros, e a sinopse usa reticências quando é grande (deixa de cortar de forma estranha).",
    ],
  },
  {
    version: "0.7.7",
    items: [
      "Nova opção nas Definições: mostrar conteúdo adulto de anime (NSFW/hentai) na pesquisa, nos filtros de género e no \"Escolhe algo para mim\". Vem desligada por defeito.",
    ],
  },
  {
    version: "0.7.6",
    items: [
      "Já dá mesmo para usar uma imagem do PC como avatar (antes dava erro \"avatar inválido\").",
      "No slideshow, o título e a informação passam para o topo.",
    ],
  },
  {
    version: "0.7.5",
    items: [
      "O estilo de fundo (padrão ou imagem) passa a cobrir a página toda, mesmo ao fazer scroll — acabou aquele retângulo só com a cor.",
      "O avatar de perfil também pode ser uma imagem do teu computador (não só um link).",
    ],
  },
  {
    version: "0.7.4",
    items: [
      "Slideshow do Anime: a caixa ficou mais baixa para os banners (que são largos e baixos) encaixarem sem ficarem ampliados.",
    ],
  },
  {
    version: "0.7.3",
    items: [
      "Slideshow: título e descrição com sombra (lê-se melhor) e afastados da seta da esquerda.",
      "Slideshow: as imagens ficam menos \"esticadas\"/com menos zoom.",
      "Nas páginas de detalhe, o teu wallpaper volta a aparecer à volta da imagem (sem ficar um bloco escuro).",
    ],
  },
  {
    version: "0.7.2",
    items: [
      "Atualizações mais leves: o instalador deixou de incluir ficheiros desnecessários, por isso ocupa menos espaço e descarrega mais depressa (continua a baixar só o que mudou).",
    ],
  },
  {
    version: "0.7.1",
    items: [
      "O slideshow passou a aparecer também na página de Anime (com as imagens widescreen do AniList).",
    ],
  },
  {
    version: "0.7.0",
    items: [
      "O slideshow do banner passou a ter setas para a esquerda/direita, além das bolinhas.",
    ],
  },
  {
    version: "0.6.9",
    items: [
      "O slideshow do banner passou a ser uma caixa arredondada por cima do fundo (estilo miruro) — o teu wallpaper aparece à volta, sem misturas estranhas.",
      "Nas páginas de detalhe, o fundo deixou de estar desfocado e o texto ganhou sombra para se ler bem.",
      "Os géneros do \"Escolhe algo para mim\" aparecem agora no teu idioma (filmes, séries e anime).",
      "O botão \"Procurar atualização\" está sempre visível e diz-te quando já estás na versão mais recente.",
    ],
  },
  {
    version: "0.6.8",
    items: [
      "O destaque no Início, Filmes, Séries e Anime passou a ser um slideshow que vai rodando entre vários títulos (com bolinhas para navegar).",
      "Novo botão \"Procurar atualização\" no menu da conta.",
    ],
  },
  {
    version: "0.6.7",
    items: [
      "O botão das novidades passou a ser um botão isolado no canto superior direito.",
      "Nas páginas de detalhe, a imagem de fundo deixa de ficar sobreposta ao teu wallpaper — fica limpa, a fundir-se no fundo da página.",
      "Novo ícone de câmara de cinema para os Filmes.",
    ],
  },
  {
    version: "0.6.6",
    items: [
      "Na janela das novidades há agora uma lista de versões à esquerda — podes ver também as atualizações antigas (abre na mais recente).",
    ],
  },
  {
    version: "0.6.5",
    items: [
      "A janela das novidades volta a aparecer centrada no ecrã (estava a ficar cortada no topo).",
    ],
  },
  {
    version: "0.6.4",
    items: [
      "Novo botão de avançar (→) ao lado do voltar atrás.",
      "As novidades passam a ter um botão no topo (📢) para as veres quando quiseres — com um aviso quando há algo novo.",
      "O fundo das páginas de detalhe funde-se agora com o teu wallpaper, seja qual for a cor (deixa de ficar aquele tom azul estranho).",
      "Detalhes de anime: o fundo passa a ser a imagem widescreen do AniList, em vez do cartaz repetido.",
    ],
  },
  {
    version: "0.6.3",
    items: [
      "Watch Party: o reproduzir/pausa/avançar passa a sincronizar de verdade — se um dá play, pausa ou salta à frente, o outro acompanha (nos separadores Sem anúncios e Torrents).",
      "Watch Party: quem entra a meio começa logo no ponto e no estado (a tocar ou em pausa) em que a sala está.",
      "Watch Party: aviso claro de que nas fontes externas o play/pausa não dá para sincronizar.",
    ],
  },
  {
    version: "0.6.2",
    items: [
      "Watch Party: quem entra agora vai parar ao mesmo sítio onde está o anfitrião (antes, se já tinhas aberto o episódio, o convidado ficava na página inicial).",
      "Watch Party: a fonte que o anfitrião escolhe passa a ser a mesma para todos — já não ficas numa fonte partida a ver um ecrã vazio.",
      "Watch Party: o teu nome fica guardado e é mesmo o teu nome a aparecer ao entrares numa sala.",
    ],
  },
  {
    version: "0.6.1",
    items: [
      "Datas do diário (MyAnimeList): quando o MAL não tem o dia exato, deixamos de inventar o dia 1 (que dava casos de \"acabei antes de começar\"). Os terminados sem data mostram \"data não disponível\". Reimporta a lista do MAL para corrigir as antigas.",
    ],
  },
  {
    version: "0.6.0",
    items: [
      "Já podes usar uma imagem do teu computador como fundo da app (Definições → Estilo de fundo → Imagem → \"Escolher do PC\"), sem precisares de um URL.",
      "Os géneros e temas (incluindo os de anime) passam a aparecer todos no teu idioma, sem misturar inglês.",
      "Quando os títulos estão em português, os cartazes deixam de aparecer com texto em português do Brasil — preferem uma versão sem texto.",
      "Nos detalhes de um anime, o fundo passa a ser uma imagem própria (em vez do cartaz repetido) e fica menos desfocado.",
      "No início, a imagem da recomendação funde-se suavemente na tua cor de fundo ao fazer scroll — sem aquela linha de corte.",
    ],
  },
  {
    version: "0.5.1",
    items: [
      "Nos torrents de anime, o filtro \"Legendado\" passa a tirar mesmo tudo o que tem dobragem (incluindo as versões com áudio duplo). Cada torrent mostra agora um selo DUB/DUAL.",
    ],
  },
  {
    version: "0.5.0",
    items: [
      "Só conta como \"a ver\" depois de 5 minutos com algo aberto — abrir e fechar logo já não vai para o \"Continua a ver\".",
    ],
  },
  {
    version: "0.4.9",
    items: [
      "No início, a recomendação ocupa o ecrã todo; ao fazer scroll, o \"Continua a ver\" e o resto aparecem com uma transição suave.",
    ],
  },
  {
    version: "0.4.8",
    items: [
      "Sempre que atualizares a app, passas a ver um resumo das novidades (como este).",
    ],
  },
  {
    version: "0.4.7",
    items: [
      "Torrents de anime: podes escolher entre Legendado e Dobrado.",
      "Os torrents passam a descarregar só o episódio que escolheste, e não a série toda.",
    ],
  },
  {
    version: "0.4.6",
    items: [
      "Na tua lista, o filtro de género está agora separado por Filmes, Séries e Anime.",
    ],
  },
  {
    version: "0.4.5",
    items: [
      "Podes mudar o fundo da app nas Definições: padrões à escolha ou uma imagem tua (como o wallpaper do WhatsApp).",
    ],
  },
  {
    version: "0.4.4",
    items: ["Os cartazes no início aparecem agora no idioma que escolheste."],
  },
  {
    version: "0.4.3",
    items: [
      "Os cartazes da tua lista e watchlist deixam de ficar em inglês e seguem o teu idioma.",
    ],
  },
  {
    version: "0.4.2",
    items: [
      "Voltou a opção de Torrents nos animes.",
      "As páginas de detalhe ficaram mais bonitas (fundo tipo wallpaper) e o cartaz muda com o idioma.",
      "O diário passa a importar as datas em que viste anime (MyAnimeList) e filmes (Letterboxd).",
    ],
  },
  {
    version: "0.4.0",
    items: [
      "O filtro de géneros na tua lista deixou de ser só para anime — funciona também com filmes e séries.",
      "Títulos e géneros aparecem no teu idioma.",
    ],
  },
];

// Versao atual: a instalada (Electron) ou, em dev/web, a injetada no build.
export async function getAppVersion() {
  try {
    if (typeof window !== "undefined" && window.electronAPI?.appVersion) {
      const v = await window.electronAPI.appVersion();
      if (v) return v;
    }
  } catch {
    /* segue para o fallback */
  }
  try {
    return __APP_VERSION__;
  } catch {
    return null;
  }
}

// Compara versoes "a.b.c": >0 se a > b, <0 se a < b, 0 se iguais.
export function cmpVersion(a, b) {
  const pa = String(a || "0").split(".").map(Number);
  const pb = String(b || "0").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
