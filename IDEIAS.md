# IDEIAS — MEIDA

Lista viva de ideias para a app.

**Como se organiza:**
- As secções com `[ ]` são o que **ainda não está feito**.
- **Decidido não fazer** fecha o que não avança, com o motivo, para não voltar à mesa.
- **Feitas** guarda o *como* e o *porquê* que não se lê no código — comprimido ao que interessa.
- **Social / comunidade** e **O CSS e as estatísticas** são análises ao projeto antigo; o que lá está `[ ]` é trabalho por fazer.

## Antes de escolher uma ideia: o servidor adormece

O servidor partilhado (FadeHost) e o Render **hibernam**. Acordam ao primeiro pedido, em ~50 s — na prática, o processo está a dormir fora do horário em que alguém o usa.

- **Nada acontece a uma hora marcada sem alguém a usar a app.** Não há cron nem scheduler nas dependências do servidor.
- **"Notifica quando sai o próximo episódio" e "aviso do Watch Party agendado" são um problema de arquitectura, não de código.**
- O ecrã de arranque (1.4.9+) tapou o sintoma do primeiro pedido lento. Tapar não é resolver.

| Modelo | Custa |
| --- | --- |
| **Polling no cliente** (recomendado) — a app pergunta "houve estreia?" enquanto está aberta; ao abrir, acorda o servidor. | Nada. Não avisa com a app fechada — mas com a app fechada o servidor também está adormecido. |
| Serviço que não dorme — worker pago, ou trigger externo (o cron do GitHub Actions). | Dinheiro, ou uma dependência nova. |
| Web Push (Service Worker + VAPID) — o browser entrega com a app fechada. | Chaves VAPID **e** alguém acordado para enviar. Não resolve sozinho. |

**Regra:** nenhuma ideia de notificação começa antes desta tabela estar decidida. O calendário de estreias (a **vista**, não o aviso) não tem este bloqueio.

## Língua / tradução

- [ ] **Traduzir comentários, um a um, com um botão** (como o Instagram e o TikTok). Decidido a 2026-10-13: **só comentários**, e **sob procura**, nunca automático.
  - **Não** se traduz o que o utilizador escreve (títulos de listas, notas pessoais): é dele, e traduzi-lo sem pedir seria pior do que não traduzir. Traduz-se o que **os outros** escreveram noutra língua.
  - **MyMemory** (`api.mymemory.translated.net`) funciona **sem chave** (~800 ms) e devolve um `match` de confiança que serve para decidir se a tradução se mostra. O endpoint do Google sem chave dá 429 — não contar com ele.
  - Um botão por comentário, nunca automático; dizer **"Traduzido de inglês"** com o original acessível; cache no servidor (`cache.js`) para não gastar a cota em cliques repetidos; o alvo é `t.idioma` (não precisa de seletor novo); a cota é por IP/dia e partilhada — avisar quando está a acabar em vez de falhar em silêncio.
  - **Privacidade:** o texto do comentário vai para um serviço terceiro, mas só quando alguém carrega no botão. Aceite a 2026-10-13.

## Estatísticas / perfil

- [ ] **Mapa de países** — a única das três vistas do perfil que falta (décadas e hora do dia já estão feitas).
  - **Não há dados, e por isso é outra coisa.** Nem a `library` tem coluna de país, nem o `normalizeMedia` do TMDB traz `origin_country` (escolhe os campos um a um e esse não está). É uma migração do esquema **mais** o campo no catálogo — não é o mesmo trabalho que os outros dois, que saíram sem tocar no servidor.
- [ ] **Metas a usarem a `watched_at`** — a meta conta pelo `updated_at` (a última vez que tocaste), por isso dar nota hoje a um filme visto em 1998 conta como 2026. A `watched_at` (migração 9) é a data real de "marquei como visto", e o heatmap já a usa. Corrigir exige decidir o que fazer aos títulos anteriores à 1.5.3, que têm `watched_at` NULL — não se preencheu com `updated_at` de propósito.

## Library / notas

- [ ] **Barra de nota visual** nos cartões (gradiente colorido por nota).
- [ ] **Marcar como visto ao dar nota** (uma ação única).
- [ ] **Histórico de visionamento por episódio** — a `watched_at` resolve "quando marquei este filme como visto", mas **não** "quando acabei o episódio 12". O `progress` tem **uma linha por título, não por episódio** (o `patchProgress` reescreve), por isso `finishedAt` é a data de agora sempre que se avança, e o histórico some. A correção é uma tabela nova de progresso por episódio, não mexer na atual — e é o que falta para "quantos episódios por mês" ou "a que horas vejo séries" valer.

## Recomendações / descoberta

- [ ] **Calendário de estreias ("esta semana")** — a **metade visual** de "notifica quando sai o próximo episódio", e que se faz sem depender de notificações: é um ecrã, não um aviso. Vem do `next_episode_to_air` do TMDB e do `nextAiringEpisode` do AniList, com contagem decrescente.
- [ ] **Plano de maratona** — dizes "acabar até dia X" e a app calcula episódios por dia a partir da duração média **real** dessa série (que se sabe do progresso), não de uma média genérica. É isso que o ajusta ao teu ritmo.
- [ ] **"Onde ver"** — o `watch/providers` do TMDB. Nota: **não é plano B para quando as fontes falham**; as fontes da MEIDA são o próprio conteúdo, o TMDB diz onde comprar/alugar. Duas coisas diferentes, com expectativas diferentes.
- [ ] **Notifica quando sai o próximo episódio** dos teus em seguimento. **Bloqueado pelo "servidor adormece"**: sem trigger externo, o aviso só sai com a app aberta.
- [ ] **Top semanal** — ranking da tua lista por trending ou nota.
- [ ] **"Podias gostar"** — recomendações a partir das notas altas (similaridade de géneros/tags).

## Multi-utilizador / social

- [ ] **Escolher para os dois** — junta o `/pick` com o `/compare` e a interseção das duas watchlists, e guarda o resultado numa lista partilhada. O `/pick` e o `/compare` já existem; falta a interseção e a lista de dois.
- [ ] **Compatibilidade de gosto** — percentagem e as maiores divergências em `/u/:username` e no `/users`. Sai de comparar as notas sobre os títulos que **os dois** viram (com guarda: sem isso a percentagem mede títulos que um deles nem viu).
- [ ] **Watch Party agendada** — dia e hora, link de convite e aviso quando começa. **O aviso depende do "servidor adormece"**: sem trigger externo só avisa com a app aberta.
- [ ] **Comentários no minuto certo** (estilo Bilibili) — o minuto já está guardado no comentário; falta mostrá-los quando o vídeo lá chega e **esconder os que estejam à frente do progresso**, que é o que resolve o spoiler. O `useVideoSync` já tem a posição sincronizada.
- [ ] **Estatísticas comparadas com a média dos utilizadores** (rating global por título).

## Player / visual

- [ ] **Dark mode unificado** + tema custom por utilizador (a app já é maioritariamente escura; falta terminar).
- [ ] **Bookmarks/timestamps por episódio** (notas de episódio, não só da série).
- [ ] **Outros serviços de debrid além do Real-Debrid** (AllDebrid, TorBox, Debrid-Link). O `debrid.js` está escrito contra a API do RD: é preciso uma camada comum (`checkToken` / `instantInfo` / `addMagnet` / `createDownload`) e um selector de serviço no campo do token em Definições. O TorBox é o único com plano grátis permanente, mas limitado a 1 download/dia.
- [ ] **Estatísticas do modo grátis** — quanto do episódio veio de P2P e quanto da net, por fonte. É o que diz se o `critical` e o `priorizarPecas` estão a servir para alguma coisa; hoje não há forma de ver.
- [ ] **Mini-player que continua a tocar enquanto se navega no catálogo**, mais um "ainda estás a ver?" depois de N episódios em autoplay. A posição já se guarda para o "continua a ver"; falta manter o vídeo vivo enquanto a rota muda.

## Providers de anime / player nativo

- [ ] **Legendas de anime em português** — o `settings.subtitleLang` vale para filmes e séries (OpenSubtitles, `subtitles.js`), mas o anime só traz o "English" do MegaPlay. O caminho limpo é procurar por **MAL id** (o `malToAnilist()` já existe, o inverso também deve dar), **não** traduzir legendas.
- [ ] **Marcar visto / dar nota a partir do player nativo** — o `AnimeExtract` já tem o botão; o `Player` não. Como a posição já entra no "Continua a ver", falta o resto: pôr na biblioteca e dar nota sem sair do vídeo.

## UX / fluxos rápidos

- [ ] **Keyboard shortcut "o"** para marcar visto/nota na Library (como no `/compare`).
- [ ] **Paleta de comandos (Ctrl/Cmd+K)** — pesquisar, navegar e agir (marcar visto, dar nota, mudar a cor, "escolhe algo para mim"). É o que faz uma app com muitas páginas ser usável sem rato.
- [ ] **Convite a instalar no ecrã principal** — não há nenhum `beforeinstallprompt` na app. A barra de baixo foi feita com essa altura em mente e é o sítio onde ele entraria.

## Importação / dados

- [ ] **Filtrar a Library por faixa de nota** — o estado, o tipo, o género e a ordenação por nota já existem; falta o intervalo (ex.: "80+").
- [ ] **Filtros e ordenação da library a viverem na URL** (`?ordem=nota&filtro=vistos&genero=Ação`). Hoje o `LibraryControls` não usa `useSearchParams`, por isso uma vista filtrada não se pode partilhar, marcar nos favoritos, nem sobreviver ao botão "voltar". O ProdSound faz isto com um helper de ~15 linhas que reescreve os parâmetros existentes em vez de os substituir (`exUrl()`), e é o que torna cada vista um link.

## Social / comunidade — o que o projeto antigo (ProdSound) já resolveu

Análise a `C:\Users\white\Documents\RAI PAP` (PHP + MySQL, 29 tabelas). **Só leitura** — a pasta não é um repo e uma alteração acidental não se recupera. Cada item foi verificado dos dois lados; o que a MEIDA já tem não está listado.

### Desfazer desfaz o aviso — a mais barata e a mais justa

> `server/src/store.js` — `unlikeComment()` e `unfollowUser()` **não** apagam a notificação que criaram. Se gostaste de um comentário e o autor recebeu o aviso, e depois tiras o gosto, **o aviso fica lá para sempre**.

O ProdSound tem isto em **6 sítios espelhados** (`toggle_repost.php:31`, `perfil.php:34,66,88,110`, `explorar.php:57`): cada `unfollow` / `unlike` / `desbloquear` faz o `DELETE FROM Notificacoes` correspondente. São duas linhas por função, mais um teste que verifica que tirar o gosto limpa o aviso. **A primeira coisa a fazer desta lista.**

### Bloquear utilizador (e o que tem de acontecer junto)

A MEIDA **não tem tabela de bloqueio nenhuma**. E não é um extra: há comentários abertos, `@menções` e `follow`. Bloquear tem de:

1. esconder o perfil e os comentários um do outro;
2. recusar as `@menções` (hoje as menções notificam sem filtro nenhum);
3. **apagar o follow nos dois sentidos** e **todas as notificações trocadas**.

O ponto 3 é o que o ProdSound faz num único `INSERT` de bloqueio (`perfil.php:83-92`) e é o que faz "desbloquear" ser de facto uma saída, e não só esconder um botão.

### "Deixar de me seguir" (remover um seguidor)

`follows` já está cá. Falta só a ação: quem é alvo de spam tira o seguidor sem ir ao perfil dele. No ProdSound é o `remove_follower` (`perfil.php:74-80`), seguro porque o `WHERE` leva `CodUtilizadorSeguido = <o meu id>` — só afeta quem me segue a mim.

### Preferências de notificação, por tipo — com uma condição

A MEIDA tem notificações (`reply`, `like`, `follow`, `mention`) e **nenhum botão** para as desligar: as Definições têm media, aspeto e integrações, mas nada sobre o sino.

**O aviso importante vem do próprio ProdSound:** ele tem um ecrã inteiro destas preferências e **nenhum dos treze `INSERT INTO Notificacoes` as consulta**. São quatro interruptores que não fazem nada — piores do que não existirem, porque dão a ilusão de controlo.

Se se fizer: cada opção tem de ter um `if` que a consome **no caminho da escrita**, no mesmo sítio onde a notificação é criada. E convém ficar escrito num teste.

### Notificações em tempo real (a infra já existe)

Hoje o sino faz `setInterval` de **60 s** (`NotificationBell.jsx`). Mas a watch party **já tem SSE** (`watchparty/WatchPartyContext.jsx` usa `EventSource`). Reaproveitar o mesmo canal troca um pedido por minuto por cliente por um evento push, sem dependências novas.

O ProdSound faz o contrário (poll de 10 s, depois 30 s) e tem lá o comentário certo: um endpoint que só lê tem de largar o lock da sessão antes de ir à base de dados, ou trava os outros pedidos da mesma sessão.

### Reações com emoji nos comentários

A MEIDA não tem reações em lado nenhum. O ProdSound tem-nas nas mensagens (`MensagensReacoes`) e a forma está bem escolhida: **uma por utilizador**, com toggle — carregar no mesmo emoji desliga, carregar noutro troca (`ON DUPLICATE KEY UPDATE Emoji = VALUES(Emoji)`). Não é o "contador de reações" do Facebook; é o que a pessoa quer mesmo.

### Denúncias e registo de auditoria

A rota `admin.js` da MEIDA é **só** a migração de dados (`/api/admin/seed`). Não há moderação nenhuma, e o servidor partilhado já tem utilizadores reais.

O que o ProdSound ensina:

- **A denúncia é uma caixa de entrada, não um canal.** Resolver uma lá é um `UPDATE` de 14 linhas: não apaga nada, não bane ninguém, não notifica ninguém e não fica registado. É a maior fraqueza estrutural do sistema dele.
- **O registo de auditoria faz duplo papel.** A tabela `LogAdmin` é `(quem, ação, alvo, codAlvo, ip, quando)`, e a **justificação do banimento é guardada dentro do próprio log** em vez de criar colunas novas (`banuti.php:29-33`). Depois é lida no login falhado para explicar ao utilizador *porque* está suspenso (`proclogin.php:66-73`). Uma tabela resolve auditoria **e** "porque é que estou suspenso".

Para a MEIDA basta o essencial: `reports` (com estado), um caminho para o admin resolver **com uma ação real** (remover comentário, avisar, bloquear) e `audit_log`. **Não precisa** de hierarquia de três níveis — o `podeModerar()` do ProdSound (Master > Admin > Comum) só faz sentido quando há mais do que um tipo de staff, e hoje não há.

### Eliminar a conta

A MEIDA **não tem** rota para isto, e tem uma vantagem que o ProdSound não tem: o avatar é um `data:` URL ou `emoji:` guardado **na base de dados** (`Avatar.jsx`), não um ficheiro em disco. Não há ficheiros para limpar depois do `commit()` — é tudo `ON DELETE CASCADE`, que a MEIDA já tem em todo o lado.

Duas coisas que valem copiar:

- **Escrever `DELETE` para confirmar** (literalmente a palavra), com o botão desativado até bater certo.
- **Apagar na base primeiro, ficheiros só depois.** Nele é obrigatório (áudio e fotos), mas o hábito de separar as duas coisas evita apagar ficheiros de alguém e depois a escrita falhar.

O que **não** copiar: ele faz *hard delete* e deixa umas dez tabelas com linhas órfãs. A MEIDA, se tiver contas reais no servidor partilhado, tem de decidir o que se anonimiza em vez de apagar.

### Recuperar a senha — sem email, se não houver

A MEIDA **não tem campo de email nenhum**. Não há verificação de conta nem recuperação de senha.

O ProdSound tem as duas coisas (código de 6 dígitos, expira em 15 min, 5 tentativas), mas isso exige SMTP — e a regra da MEIDA é não usar nada pago. O caminho grátis é o admin repor a senha a quem perdeu o acesso, com o mesmo registo de auditoria. A decisão fica para o utilizador; o que **não** se faz é inventar um email falso no registo só para ter o campo.

### Elenco e realizadores de anime — hoje está vazio

O `cast` do anime está **hardcoded a vazio** (`jikan.js`) e a AniList **nunca é perguntada por `staff`**. Os filmes tiram o elenco do TMDB, mas um anime não tem.

A AniList devolve `staff` (com a ocupação principal de cada pessoa) e `studios` na mesma consulta que já é feita. Passar de `cast: []` para a lista real é uma alteração pequena, e o ganho é grande: o anime é metade do catálogo.

### "Partilha" / recomendar a quem segues

O ProdSound tem três ações separadas, e separá-las é a ideia:

| ação | quem vê | avisa? |
| --- | --- | --- |
| like | público | sim |
| favorito | **privado** | não |
| partilha / repost | **público**, entra no feed de quem segues | sim |

Para a MEIDA: *gostar* de um título (público) é distinto de o pôr na watchlist (privado) e de o **recomendar aos meus seguidores** (público, aparece no feed deles).

### Feed dos seguidos

Com `follows` já populado, falta a página: o que as pessoas que sigo viram, avaliaram ou comentaram ultimamente. O ProdSound faz isto com um `UNION ALL` entre o original de quem segues e as partilhas (`explorar.php:145-180`), que é o mesmo mecanismo.

**Atenção ao aspeto feio:** um feed destes é um convite a seguir bots. Vira-se contra eles com o bloqueio e com o `remove_follower` acima.

### Ver o perfil como os outros veem

O ProdSound tem um link "ver perfil público" nas preferências (`preferencias.php:43-44`). Na MEIDA o `is_public` já existe e já é respeitado; falta só a pré-visualização. Duas linhas.

## O CSS e as estatísticas — o que o ProdSound faz melhor

O utilizador gostou do aspeto do projeto antigo. Analisei o `style.css` (749 linhas) e a forma como as estatísticas são mostradas no perfil e no dashboard.

### O problema: o CSS da MEIDA não tem sistema

Medido, não estimado:

| | ProdSound | MEIDA |
| --- | --- | --- |
| ficheiro de estilos | 749 linhas | **7.562 linhas** |
| tokens com nome | ~30 | **16** |
| brancos `rgba(255,255,255,…)` à mão | poucos | **193** |

Os brancos aparecem repetidos com alfa `0.08`, `0.1`, `0.14` e **nenhum passa por um token**. A MEIDA não tem `--line`, `--surface-3`, `--radius-sm`, nem `--danger` / `--success` / `--warning`. Mudar a cor de uma borda é procurar 193 sítios.

### O que lá está bem pensado, e vale trazer

**1. Um sistema com intenção escrita.** O `style.css` abre com a frase que decide tudo o resto: *dark-first, monochrome + one signal accent. Flat surfaces, hairline borders, no gradients, no glow, no scale/translate hovers.* É o que a MEIDA não tem: tokens sem uma regra que diga porque existem (e ainda tem gradientes e glows, `--shadow-nav` e `--shadow-card-hover`).

**2. `--ps-fill`, um fundo que aguenta texto nos dois temas.** Substituiu uns roxos que só se liam bem num dos temas; o novo valor é **igual em claro e em escuro**, por isso o texto claro carrega sempre.

**3. Aliases velhos que apontam para os novos.** `--primary-color`, `--shadow-light`, `--transition-smooth` são reapontados para os tokens do sistema, e os estilos inline antigos herdam o aspeto novo **sem editar página por página** — essencial durante uma remodelação.

**4. O gráfico do perfil é CSS puro, sem biblioteca.** Seis meses em colunas flex, barra com `height: X%`, topo arredondado, número em cima, mês em baixo. O detalhe que faz funcionar: `min-height: 4px` — um mês a zero mostra risca, não desaparece. (A MEIDA já pensa assim no `ProfileStats.jsx`, com o comentário do "Series 12 que virava um risco de 1px".)

**5. A faixa de números do perfil.** Cinco números grandes na cor de destaque, rótulo em maiúsculas de 11px por baixo, separados por **linhas verticais de 1px**, e os dois interativos (seguidores / a seguir) são links que abrem modal. Lê-se de relance.

**6. As métricas privadas só aparecem no perfil de quem é dono.** O gráfico está dentro de `if ($idPerfil == $meuID)`. Separar "o que os outros veem" de "o que eu vejo" é o que impede a MEIDA de mostrar um número de biblioteca a quem não deve.

### O que a MEIDA já faz e não há que trazer

- **`prefers-reduced-motion`** — já tem, em três sítios.
- **Barras em vez de gráficos circulares**, com o motivo escrito (`ProfileStats.jsx`): cinco a oito categorias com contagens muito diferentes comparam-se melhor em barra.
- **A barra cresce contra o maior do bloco, não contra o total** — feito e documentado.

Ou seja: o **raciocínio** já é o mesmo. O que falta é o **sistema visual**.

### O trabalho, por ordem

- [ ] **Tokens de superfície e de traço**: `--line`, `--line-soft`, `--bg-surface3`, `--radius-sm`, e `--danger` / `--success` / `--warning`. Substituir os 193 valores crus por referências. **Não muda o aspeto** — é o que torna o próximo passo possível.
- [ ] **Escrever a regra do aspeto** num sítio único (um comentário em cima do `:root`), para as decisões deixarem de ser implícitas.
- [ ] **Faixa de números no perfil** com os tokens acima — número grande na cor de destaque, rótulo em maiúsculas, linha vertical de 1px, e seguidores / a seguir a abrir a lista em vez de só mostrarem um número.
- [ ] **Separar o público do privado** nas estatísticas do perfil: números de biblioteca e seguidores são públicos; o gráfico de meses e a distribuição por estado são só de quem é dono.

### Nota sobre os gráficos: sem biblioteca, e não por princípio

Cheguei a escrever que o Chart.js do dashboard do ProdSound não valia a pena por ser dependência nova — **estava a responder ao ecrã errado** (um ecrã de administração que ninguém vê). Nas estatísticas do perfil, que todos veem, um gráfico é o sítio certo.

Feito com SVG à mão na mesma, mas por uma razão prática: uma coluna é um `<rect>`, o ficheiro inteiro tem menos de 4 KB contra +70 a +200 KB, e o que a biblioteca traria (pan, zoom, animações) não se usa num gráfico de 12 barras. Se algum dia o gráfico passar a 3 ou 4 séries com cursor e *tooltip* detalhado, a conta muda e a biblioteca passa a compensar.

## Dívida técnica

- [ ] **react-router 7.18+** — o `npm audit` marca **duas** vulnerabilidades (GHSA-wrjc-x8rr-h8h6 e GHSA-337j-9hxr-rhxg) e nenhuma se corrige dentro da major 6. A subida toca 29 ficheiros de `web/src`. A mitigação atual (validar o caminho antes do `navigate`, no servidor e no cliente) fecha o caminho de exploração; falta decidir se a subida de major compensa.
- [ ] **Duplicação no `npm test`** — o `testar-watchparty-seguranca.mjs` está listado **duas vezes** no script do `package.json` e corre duas vezes sem necessidade.

## Decidido não fazer

Ideias fechadas por medição ou por decisão. Ficam com o motivo, para não voltarem à mesa.

- **Modo cinema** (fullscreen com UI limpa e auto-hide) — o fullscreen/auto-hide nativo do `<video>` chega; um modo próprio duplicaria o que o browser já faz.
- **Sagas e ordem de visionamento via `relations` do AniList** — as relations são ruidosas e inconsistentes; "por onde começar" derivado delas dá recomendações erradas com mais confiança do que a informação merece. Se se quiser, fazer com uma lista curada à mão.
- **Menu de qualidade no player nativo** — medido em 5 episódios a 2026-10-12: o `master.m3u8` do MegaPlay traz **uma só variante jogável** (1080p) mais um `#EXT-X-I-FRAME-STREAM-INF` (360p, que é para saltar no vídeo). O `hls.js` reporta `levels.length === 1` e o menu esconde-se — o que está certo. Só passa a fazer sentido se a fonte der mais variantes; aí o menu aparece sozinho (`niveis.length > 1`).

## O que **não** há que ir buscar lá (anotado para não voltar)

Regra geral: **copiar a decisão, nunca o código.** O ProdSound é PHP com SQL dentro do código, passwords em `md5` sem sal, e há código morto espalhado.

| Não portar | Porquê |
| --- | --- |
| **"Explorar" como recomendação** | Não existe lá para portar: é `ORDER BY DataP DESC`. E para uma biblioteca pessoal seria **errado** recomendar o que a pessoa já curou. A descoberta na MEIDA vem do catálogo (AniList/MAL), não dos dados próprios. |
| **"Tendências"** | O ranking dele filtra pela data de **publicação** e nunca pela data da **interação** (`tendencias.php:13`), apesar de a coluna `DataLike` existir e não ser usada. Se fizermos "top semanal", tem de ser pela data da interação — senão ganha sempre o título mais antigo. |
| **Streak / racha diária** | **A MEIDA está à frente** — no ProdSound não há racha nenhuma, nem níveis, nem XP, nem raridade. |
| **i18n** | 626 chaves × 2 idiomas, com cerca de 20% realmente traduzidas e o backoffice inteiro em português duro. Para uma app pt-PT o ganho é zero. |
| **Níveis / progresso dos badges** | Lá o badge é binário ("tens 50 seguidores, já cá está"). Falta mostrar "faltam 2" — que é o que dá vontade de continuar. |
| **Comentários aninhados** | Já cá está (`.comment-cita`). |
| **Notificações com `ENUM`** | Já cá está, em `kind` + `refId`. |
| **Upload de ficheiros** | Os validadores são bons (extensão **e** MIME, `random_bytes`), mas uma app de filmes não tem porque guardar o filme. |
| **Tipos de publicação como interruptor de formulário** | Lá são 2 tipos com números mágicos escritos em 4 ficheiros. Na MEIDA `anime`/`filme`/`manga` é uma faceta de filtro, não uma regra de validade. |
| **`md5()` sem sal** | A MEIDA usa bcrypt. Nunca voltar atrás. |
| **Ações destrutivas em `?action=` de GET sem CSRF** | Um `<img src="perfil?action=bloquear">` num site terceiro bloqueia outra pessoa. Em React o CSRF está resolvido por defeito, mas o padrão de origem importa. |
| **Preferências que não fazem nada** | Ver a secção de cima. É o contra-exemplo mais útil de lá. |
| **Enumeração de emails** | ("esse email não está registado") — a MEIDA tem servidor público. |
| **Hard delete sem anonimizar** | Se houver contas reais, é preciso decidir o que se guarda. |

## Feitas

O que já está na app, com a decisão que não se reconstrói a ler o código.

### Língua / tradução

- **Interface inteira em português e inglês** — escolha nas Definições (Detalhe → Conteúdo), detetada do browser na primeira vez e memorizada. Tradução só do lado do cliente: o servidor não sabe o idioma do pedido e a chave é o próprio texto em português. Uma função pura (`web/src/i18n/traduzir.js`) é usada pelo contexto e pelo `api/client.js`, para as mensagens de erro do servidor também saírem traduzidas.
- **Auditor que garante que nada fica por traduzir** — `scripts/auditar-pt-por-traduzir.cjs`, no `npm test`. Apanha texto em JSX, atributos, strings e templates. **Já teve seis buracos**, e o pior foi **o `//` de um URL lido como comentário**, que apagava o resto da linha *com a aspa de fecho* e deixava o scanner a ler até ao fim do ficheiro: em `Settings.jsx` isso escondia **1207 linhas (73%)** e **477 linhas em todo o `web/src`**. A lição: "não há nada por traduzir" nunca é resposta suficiente — mutar, e desconfiar de um auditor que diz que está tudo limpo sobre um ficheiro que não conseguiu ler.

### Library / notas

- **Nota rápida no cartão** — a tua nota (0-100) num badge no canto inferior-direito, com SVG de estrela, a partir do cache da library (sem pedidos extra).
- **Vista timeline** (2026-10-14, botão "Ver por data") — não havia histórico nenhum: a `library` só tinha `updated_at` e o `progress` tem uma linha por título.
  - **Migração 9: `watched_at`**, gravada quando `watched` passa a 1. **Não se preenche com `updated_at`** — seria dar a data do último toque a tudo o que já estava visto. NULL significa "não se sabe" e a interface diz isso.
  - **A regra de escrita tem três casos:** marcar como não visto apaga a data; marcar como visto pela **primeira** vez grava a de agora; **já estar visto mantém a data antiga mesmo que venha NULL**. O terceiro é o erro fácil — um `COALESCE` simples apagaria a data ao dar nota a um filme já visto.
  - A timeline **nunca** usa o `updatedAt` como data de visionamento; quem não tem `watchedAt` vai para um grupo "sem data" no fim, sem ponto na linha. O import/export leva a data (JSON `watchedAt`, CSV `visto_em`) e o import **não fabrica datas**.
  - Testes: `testar-timeline.mjs` (75 verificações) e `testar-timeline-fim.mjs` (com servidor a sério — os três casos só existem quando o SQL corre).

### Visual / interface

- **Acento sempre legível** — o problema era real: dois presets de oito não passam para texto normal (`#c90303` dava 3,30:1 e `#e50914` 4,20:1).
  - A solução é **uma variável**, `--accent-text`, calculada em `SettingsContext.jsx` com o `shade()` que já existia. `styles.css` fica com `#dc5b5b` fixo — exatamente o que `shade('#c90303', 0.35)` dá — para o ecrã de arranque ter a cor certa antes de o React montar.
  - `#dc5b5b` dá **5,36:1** sobre o fundo da página e **4,84:1** sobre a superfície de um cartão (AA para texto normal é 4,5:1). O acento inteiro continua nos 3,30:1.
  - **Texto sobre o acento inteiro tem de ser escuro, e é:** os botões com acento no fundo põem `#fff` ou `--bg-main`. **Nenhum usa `--accent-text` sobre `--accent`** (daria 1,3:1). Bordas e fundos ficam com a cor cheia.

### Estatísticas / perfil

- **Mapa de calor de atividade por dia** (o `heatmap` do GitHub) — as datas já existiam na `library` e na `progress`. SVG à mão, abaixo de 4 KB. Feito em 2026-10-13.
- **Décadas** — a API já devolvia `decadas` desde sempre e nada o desenhava (só o número da "década favorita").
- **Hora do dia** — sai do `updated_at`, mas o servidor pode estar em UTC. Por isso devolve `horasUtc` (24 baldes) e **o cliente roda o histograma**: um histograma rodado é exato e custa 24 números em vez de milhares de datas.
- **Metas e desafios** (2026-10-14, `/achievements`) — "50 filmes este ano" com anel de progresso, e desafios como "um filme de uma década que ainda não viste".
  - **A meta conta o que MARCASTE COMO VISTO neste ano, não o que viste** — e os textos dizem "marcaste". Mas ainda conta pelo `updated_at`, não pela `watched_at` (que só existe desde a 1.5.3): dar nota hoje a um filme visto em 1998 conta como 2026. Filmes na watchlist não contam (`watched = 0`), e a limitação está escrita em `server/src/metas.js`.
  - **O alvo é escolha da pessoa** (10/25/50/100/200/365), na coluna `meta` (migração 8). A lista de valores é do servidor e a interface lê-a da resposta — escrever os números no JSX mostrava um botão que o servidor recusa com 400.
  - **O ano é do cliente:** o servidor manda três anos em UTC e o cliente escolhe o dele com o relógio de casa, senão as 00:30 de 1 de janeiro reiniciavam a meta na hora errada.
  - O desafio das décadas é **só contar** (1930 até à década corrente), sem ir ao TMDB: não sugere filmes, que era a opção mais cara e podia falhar. `AnelMeta.jsx` em SVG; geometria em `metas.js`; `testar-metas.mjs` (86 verificações).
- **Cartão de partilha em imagem** (2026-10-14, fim do `/stats`) — um cartão do teu ano, por link de download (`meida-<ano>.png`), sem IPC: funciona no site e no desktop.
  - **As fontes são web fonts** (Manrope e Archivo). No `document.fonts` havia pesos `unloaded` e o canvas **cai para a fonte do sistema em silêncio**; `carregaFontes()` pede cada peso pelo nome, porque `fonts.ready` não espera por pesos que ninguém desenhou.
  - **`escalaRetina()`** cria o canvas grande e o `ctx.scale()` reduz as coordenadas (dpr limitado a 3 — a 4 dava 23 megapíxeis).
  - **O que rebenta tudo:** um `drawImage` de um host sem CORS deixa o canvas "tainted" e o `toBlob()` lança `SecurityError`. O CDN do TMDB e o do MAL mandam `access-control-allow-origin: *`, mas só se pedir a imagem com `crossOrigin="anonymous"`, posto **antes** do `src`.
  - O canvas vive em `display: none` — com `width: 0` o PNG saía de 0 bytes. Os números são **todos deste ano** e os cartazes são **só filmes**, para não contar uma coisa e mostrar outra.
  - **`statsFor` passa as linhas CRUAS do SQLite** (`media_type`, `updated_at`) mas as funções de `metas.js` esperam a forma de `listLibrary` (`type`, `updatedAt`). Sem o `toApi` contava **zero, sem erro nenhum**, com o build e 86 testes a passar — nenhum executa SQL. Daí `testar-cartao-fim.mjs` arrancar o servidor a sério.

### Multi-utilizador / social

- **Discord Rich Presence** — título, `S1E2`, `12:34 / 45:00` e cartaz no perfil do Discord. Protocolo RPC à mão em `electron/discord-presence.cjs`, zero dependências, sem servidor nem API paga. Interruptor em Definições → Discord. Só no desktop; nos iframes só se sabe que a fonte foi escolhida.
- **Perfis e listas públicas** — `/u/:username` com biblioteca e listas, privacidade à escolha, seguir utilizadores e pesquisa de pessoas (`/users`).
- **Comentários por episódio** — respostas a respostas, gostos e minuto no vídeo.
- **Compara as tuas notas** (`/compare`) e **Comparar avaliação** (`CompareRating`).

### Player / visual

- **Lembrar a fonte escolhida** — `settings.lastSource` por tipo (filme / série / anime). Ao mudar de episódio, o `Player` arranca nessa fonte se ainda existir e não estiver morta; senão cai na primeira viva.
- **Mostrar o estado das fontes** — as mortas ficam riscadas com a etiqueta "em baixo" e o `Player` salta-as na escolha automática.
- **Avisar no Watch Party quando a fonte não sincroniza** — nas fontes em iframe aparece um aviso na barra da sala e na página do título: o `postMessage` não atravessa o cross-origin. O aviso diz que Torrents e "Sem anúncios" sincronizam, em vez de parecer que a app está partida.
- **Picture-in-Picture** — botão no player (`requestPictureInPicture`), com saída por `exitPictureInPicture`. Onde o browser não suporta, o erro é ignorado em silêncio. Feito na 1.6.2.
- **Real-Debrid** — token em Definições; torrents em cache no RD reproduzem logo. Sem cache, cai para o WebTorrent local. Badge "⚡ Debrid", filtro só cache e os instant no topo. Rotas `/api/debrid/*`.
- **Multi-provider de torrents** — agregador no backend (`server/src/services/providers/`) que junta Torrentio + YTS. Adicionar um provider = criar um ficheiro na pasta `providers/` e registá-lo no `index.js`. Badge da fonte em cada torrent.
- **Links para sites externos** — abrir no RidoMovies (slug exato por série/época/episódio ou filme) e pesquisa no Google quando os providers internos falham ou a pedido.
- **P2P que começa logo** — em vez de esperar pelo ficheiro inteiro (`ready`), resolve nos `metadata` e vai buscar as peças de que precisa. Peças priorizadas com `torrent.critical`, janela de 8 MB a partir da posição de leitura. Torrent sem seeds dá erro em vez de esperar para sempre (`torrentEngine.js`, `stream.js`).
- **Anikoto como fonte extra de anime** (`anikotoapi.site`) — apanha episódios que o MegaPlay não resolve na rota `/ani/`. O `embed_url` é o próprio **MegaPlay por `/stream/s-2/{id}`**: o mesmo site por um caminho que resolve títulos diferentes. Aparece **depois** das providers normais e nunca as substitui.
  - Endpoints `/recent-anime?page=N` e `/series/{id}`; a chave é o `embed_url.sub/dub` de cada episódio, não `ani_id`; `mal_id`/`ani_id` vêm como texto, com `""` nos que não têm.
  - Catálogo em SQLite (`anikoto_series`, migração 7) com rasteio incremental: 2 páginas ao arrancar, mais 3 por título desconhecido, com 1,4 s de pausa. Separar "catálogo conhecido" de "embeds buscados" guarda ~100 títulos por página com 1 pedido, em vez de pedir `/series/{id}` a todos.
- **MegaPlay nativo, sem iframe** — o `getSources` dá as legendas em `.vtt` e o vídeo num campo `enc` cifrado (AES-CBC, chave e IV em texto simples no `newclient.min.js`); descifra-se e reproduz-se com o nosso player. Ganha legendas escolhíveis, play/pausa que sincroniza no Watch Party e posição no "Continua a ver".
  - Entra como **entrada separada** ("MegaPlay (nativo)"), ao lado do iframe. Se não conseguir desencriptar, devolve `native: false` e o `Player` cai no iframe da mesma fonte — a falha é invisível.
  - `getSources` exige `Referer`, o `data-id` está na página (não no URL), e `/ani/` e `/mal/` resolvem títulos diferentes — só `/ani/` entra, para não duplicar.
- **Saltar a abertura e o fim** — o `getSources` devolve `intro` e `outro`, e **`{start: 0, end: 0}` quando o episódio não tem fim**. Sem o filtro, o botão aparecia aos 0 segundos de qualquer episódio. Também vem `undefined` quando `native` é `false`.
  - A decisão está em **`pularIntro.js`**, toda pura: uma janela só vale se `Number.isFinite` nos dois lados e `end - start >= 1`, e o salto é limitado ao fim do vídeo. Com o Autoskip ligado salta sozinho uma vez, sem botão.

### Providers de anime

- **Health-check do nativo separado do iframe** — o `probeNativo()` segue o mesmo caminho do player (página → `data-id` → `getSources` → desencriptar o `enc` e confirmar que sai JSON). As duas entradas do MegaPlay têm estado próprio, apesar de partilharem o URL; sem isto, a página responder 200 dava "ok" às duas.

### UX / fluxos rápidos

- **Barra de navegação em baixo no telemóvel** (2026-10-15) — Início, Pesquisa, Biblioteca, Perfil e "mais".
  - **O problema estava medido:** a pílula de cima tem **395 px** e o telefone mais comum tem **365 px** úteis — "Início" começava em x = −8. Pior: os quatro botões fixos (`z-index: 70`) estavam **em cima** dela (`z-index: 60`), e ao tocar no sino respondia o botão de ecrã inteiro. Depois da barra, a pílula ficou com 149 px e os quatro botões `display: none`.
  - **Os dois limites são o mesmo número, de propósito (720).** Esconder os botões a 700 e mostrar a barra a 720 deixaria uma faixa de 20 px com os dois. O teste lê os dois números **do CSS** e compara-os.
  - **Só por CSS**, não por `useState` com `window.innerWidth` — um listener de resize acende e apaga o separador enquanto o dedo arrasta.
  - A folha do "mais" é `role="dialog"` com `aria-modal`; fecha pelo fundo, pelo X, pelo Escape, e navegar também fecha. O separador aceso pinta o ícone com `--accent-text` e deixa o texto branco (3,3:1 seria o acento inteiro). `padding-bottom: env(safe-area-inset-bottom)` e `.app { padding-bottom: 56px }`.
  - **Os rótulos vivem no JSX**, não no ficheiro puro: `navBaixo.js` tem os `id` e os `para`, os textos estão em `t("...")`, que é o único sítio que o auditor sabe ler. O teste confere que cada `id` tem o seu `t("...")`.
- **Onboarding nos primeiros 60 segundos** (2026-10-15) — importar de MAL, Letterboxd ou CSV, escolher géneros e cor, para o perfil nascer cheio.
  - **Mostra-se a quem está VAZIO, não a quem se registou há pouco.** A condição é `count === 0` do `LibraryContext`, e `null` significa *ainda a carregar* — que **não** é zero. Mostrar o wizard a quem tem 300 títulos porque o pedido não voltou era o estrago mais caro.
  - **Uma porta só é oferecida se for capaz de importar.** O único CSV aceite é o exportado pela MEIDA (`toLibraryEntry()` lê `o.tmdbId`); um CSV do Letterboxd importava **zero, sem erro**. Daí o MAL/AniList só aparecerem com as **duas** metades (servidor configurado *e* conta ligada) — sem `MAL_CLIENT_ID`, o link dá 500.
  - **A porta em primeiro é a mais barata, não a mais popular:** o Letterboxd é um username; MAL e AniList são dois cliques com o browser a sair da app.
  - **Folha de lado, não modal** (`aria-modal="false"`): em `/library` o contexto importa. Monta-se **fora do `ErrorBoundary`**, com `z-index: 75` (acima da barra, abaixo do Changelog).
  - **A cor aplica-se AO CLICAR**, não no fim — senão fechar pelo X perdia-a sem uma palavra. **Os géneros guardam `{ id, name }` e mandam só o id:** o `/api/discover` mete o valor direto no `with_genres` do TMDB, e `?genres=Terror` devolve 0 itens **sem erro**.
  - O campo que diz "isto está ligado" é diferente em rotas que fazem o mesmo: `/api/letterboxd/status` responde `{ username }` e o MAL/AniList `{ linked }`. O `catch` de cada pedido devolve a **mesma forma** que o sucesso.
  - Máximo 4 géneros, e o quinto **não** substitui o primeiro. Os nomes mudam com um contador, não com `Date.now()` (duas chamadas no mesmo segundo davam a mesma lista).
  - **Um bug que só o browser apanhou:** o `useState` estava declarado 60 linhas abaixo de quem o lê durante o desenho — `ReferenceError` no bundle minificado, **ecrã em branco**. Nem ESLint, nem `node --check`, nem build, nem testes puros. Há uma secção que verifica a **ordem das declarações** como texto.
  - Fica o atalho "Assistente de importação" nas Definições (`window.abrirOnboarding`) para quem já tem títulos.
- **Botão "Descarregar a app"** — no cabeçalho, só na versão web e fora de `localhost`. Aponta para a página da release no GitHub, que é um URL estável (o do `.exe` leva a versão no nome e desatualizava). Regra em `web/src/lib/web.js`.
- **Quick add à library** — ícone `+` nos cartões do catálogo (home/search/category): adiciona à watchlist ou marca como visto sem abrir a ficha, com atualização otimista. Mostra também os badges de visto/watchlist.

### Importação / dados

- **Exportar a biblioteca/diário (CSV/JSON)** — Definições → "Os teus dados". JSON para backup, CSV para Excel/Sheets; o servidor entrega o JSON em `GET /api/export` e o CSV é gerado no browser.
- **Importar o ficheiro exportado** — merge conservador (`upsertLibrarySafe` + `importProgress`): não apaga notas/visto que o ficheiro não traga; CSV parseado no backend (`parseCsv` com aspas/escapes).

### Gráficos e estatísticas

- **Gráfico de "ao longo do tempo" no perfil** — 12 meses de barras em **SVG puro** (`GraficoMensal.jsx`), alimentado por `serieMensal()`. Mede **atividade** (última vez que mexeste num título), não visionamento, e a legenda diz-o. Escala contra o **maior** mês; mês vazio fica a **4 px** (o zero é informação); o ano só aparece no eixo X quando muda; só com 3+ meses.
- **Página `/stats`** — histograma de notas (10 faixas), tempo visto (`progress.seconds_watched`), género mais visto, nota mais alta/baixa/média/mediana e década favorita.

### Gamificação

- **Conquistas/badges** — `/achievements` + link no menu: Primeiro passo, Matiné, Cinéfilo, Maratonista, Otaku, Crítico, Biblioteca, Centenário, com ícones SVG.
- **Streak/racha diária** — dias consecutivos com atividade, atual e melhor.

### Ferramentas de processo

- **`app:publish` que se cura no `422`** — o `fix-latest.cjs` repara a release pela metade e é idempotente. Falhou cinco vezes (1.2.0, 1.2.1, 1.2.2, 1.3.2 e 1.5.3), sempre com um asset diferente em falta — daí a verificação contar assets em vez de ler o log.
- **`verificar-release.mjs` ligado ao `app:publish`** — conta os 3 assets, compara o `sha512` do `.exe` público com o do `latest.yml`, confirma que a tag aponta para o `main` e que o `MEIDA.exe` é x64.
- **Teste de contraste do `--accent-text`** — `scripts/testar-contraste-acento.mjs` cobre a função pura de `acento.js`.

### Segurança

- **`/api/proxy` e `/api/subtitles/vtt` fechados** — URLs assinadas com HMAC-SHA256 válidas **12 h** (uma sessão de vídeo), bloqueio de IPs privados/loopback/link-local com resolução DNS, e redirects seguidos um a um com validação do destino em cada salto. O `.vtt` corta acima de 2 MB.
- **Autenticação** — bcrypt assíncrono, password 8-72, username `^[A-Za-z0-9_]{3,20}$`, rate limit no login/registo, `TRUST_PROXY` por ambiente (0 por omissão) e limite de falhas por (IP, utilizador).
- **Watch Party** — código `^[A-Z0-9]{6,12}$` gerado com `crypto`, limites de salas/membros, payload medido em bytes, `kind` fechado, login obrigatório, verificação de membro em `/wp/send` e caminho validado nos dois lados.
- **Avatares** — limite de ~200 KB, rota própria `/api/users/:id/avatar` com ETag (SHA-1) e `must-revalidate`, nunca inline nas listas.
- **Electron** — `will-navigate`/`will-redirect` só deixam passar a origem da app, permissões limitadas a `fullscreen` e `clipboard-sanitized-write` (com `callback(ok)`, não `return`), e todos os `ipcMain.handle` validam `isTrustedSender`.
- Testes: `testar-proxy-seguranca.mjs`, `testar-subtitles-seguranca.mjs`, `testar-proxy-redirect.mjs`, `testar-filtro-alvos.mjs`, `testar-validade-assinatura.mjs`, `testar-auth-seguranca.mjs`, `testar-rate-limit.mjs`, `testar-trust-proxy.mjs`, `testar-timing-login.mjs`, `testar-watchparty-seguranca.mjs`, `testar-wp-ip.mjs`, `testar-avatar-listas.mjs`, `testar-avatar-etag.mjs`, `testar-ecra-inteiro.mjs`.

### Dados e base

- **SQLite** (`node:sqlite`, zero dependências) com migrações, e servidor remoto no desktop (Electron 44, `node:sqlite` no Node 24).
- **Notas 0-100** em vez de 5 estrelas.

## Ferramentas de verificação (para não voltar a cair nos mesmos buracos)

- **Testes com mutação por omissão** — cada ficheiro novo em `scripts/` parte o código de propósito e confirma que o teste o apanha. Um teste que passa porque o código está certo não prova nada; um que continua a passar com o código partido prova que não está a testar nada.
- **Um teste que arranca o servidor de verdade** — na altura em que apareceu o bug do `aquecerCatalogo()` sem `return`, **nenhum** teste arrancava o `index.js`, e o servidor morreu ao arrancar sem nenhum teste dar por isso. Hoje vários arrancam, mas a lição mantém-se: **uma função pública chamada no arranque tem de ter um teste que arranque o processo**. O `npm test` tem **76 passos, 75 distintos** (o `testar-watchparty-seguranca.mjs` está duplicado).
- **Testes que batem em APIs de terceiros** (Anikoto, MegaPlay) usam uma base de dados temporária e saltam com aviso quando a rede falha, em vez de falhar — um teste que rebenta porque o outro mudou o site não diz nada sobre o código.
- **`verificar-release.mjs`** — prova uma release a sério, sem acreditar no `exit code`: conta os três assets, descarrega o `.exe` público e compara o `sha512` com o do `latest.yml`, confirma que a tag aponta para o HEAD e lê o cabeçalho PE do `MEIDA.exe`. Corre sozinho no fim do `app:publish` e pode repetir-se à mão (`node scripts/verificar-release.mjs`; a versão vem do `package.json`).
