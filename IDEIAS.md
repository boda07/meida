# IDEIAS — MEIDA

Lista viva de ideias para a app.

**Como se organiza:** as secções do topo são o que **ainda não está feito** — só
listas `[ ]`. Quando uma coisa se faz, a linha vai para a secção **Feitas**, no
fim do ficheiro, e mantém o texto com a explicação do *como* e do *porquê*
(que é a parte que se perde e é a mais difícil de reconstruir). As secções
"Social / comunidade", "O CSS e as estatísticas" e "O que não há que ir buscar
lá" são análises do projeto antigo e ficam onde estão.

## Lingua / tradução
- [ ] **Traduzir também o que o utilizador escreve** (títulos de listas e notas personais)? Provavelmente não: é conteúdo dele, não interface.

## Estatísticas / perfil
- [ ] **Resumo anual/personalizado** ("o teu ano em revisão"): totais por mês, gráficos, top do ano — estilo Spotify Wrapped.

## Library / notas
- [ ] **Barra de nota visual** nos cartões (gradiente colorido por nota).
- [ ] **Marcar como visto ao dar nota** (uma ação única).
- [ ] **Vista timeline**: ordenar por data em que viste, com linhas cronológicas.

## Recomendações / descoberta
- [ ] **Notifica quando sai próximo episódio** dos teus em seguimento.
- [ ] **Top semanal**: ranking da tua lista por trending ou nota.
- [ ] **"Podias gostar"**: recomendações baseadas nas notas altas (similaridade de géneros/tags).

## Multi-utilizador / social
- [ ] **Estadísticas comparadas com a média dos utilizadores** (rating global por título).

## Player / visual
- [ ] **Modo cinema**: player em fullscreen com UI limpa e auto-hide dos controlos. **(Decidido: o fullscreen/auto-hide nativo do `<video>` chega — não fazer.)**
- [ ] **Dark mode unificado** + tema custom por utilizador (a app já é maioritariamente escura; falta terminar).
- [ ] **Bookmarks/timestamps por episódio** (notas de episódio, não só da série).
- [ ] **Outros serviços de debrid além do Real-Debrid** (AllDebrid, TorBox, Debrid-Link). O `debrid.js` está escrito contra a API do RD: é preciso uma camada comum (`checkToken` / `instantInfo` / `addMagnet` / `createDownload`) e um selector de serviço no campo do token em Definições. TorBox é o único com plano grátis permanente, mas limitado a 1 download/dia.
- [ ] **Avisar no Watch Party quando a fonte não sincroniza** — o `useVideoSync` só funciona no nosso player (o `postMessage` não atravessa o cross-origin do iframe do provider). Quem está numa sala e escolheu um iframe vê o play/pausa dos outros e o seu não mexe, e não há forma de saber se é a app ou o provider. Um aviso discreto na barra da sala evita que pareça partido.
- [ ] **Estatísticas do modo grátis**: quanto do episódio veio de P2P e quanto da net, por fonte. É o que diz se o `critical` e o `priorizarPecas` estão a servir para alguma coisa — hoje não há forma de ver.

## Providers de anime / player nativo

- [ ] **Escolher a qualidade** — o `master.m3u8` tem variantes (1080p/720p/…) e o `HlsPlayer` só usa `sources[0]`. O `hls.js` expõe `levels` e `currentLevel`, por isso é um menu e não um Decoder. Ganho real em ligações lentas.

- [ ] **Lembrar a fonte escolhida** — o `Player` tem `manual`/`fonteManual`, mas isso vive na sessão: ao mudar de episódio volta ao primeiro provider. Guardar em `settings` a última fonte por tipo (filme / série / anime) e abrir nessa. Quem escolheu o MegaPlay porque é o único com legendas não devia ter de o escolher em cada episódio.

- [ ] **Health-check do nativo separado do iframe** — o `providerHealth.js` sonda `p.url`, que é a **página** do player. O nativo pode falhar a desencriptar com a página a responder 200 (o health-check diz "ok" e o episódio não dá), e o inverso também (página morta, nativo a desencriptar à mesma). O `probe()` tem de ir buscar o `getSources` e ver se o `enc` volta em claro. As duas entradas também precisam de estado próprio — hoje têm nomes quase iguais e partilham o resultado.

- [ ] **Legendas de anime em português** — o `settings.subtitleLang` vale para filmes e séries (OpenSubtitles, `subtitles.js`), mas o anime só traz o "English" do MegaPlay. O caminho limpo é procurar por **MAL id** (o `malToAnilist()` já existe, o inverso também deve dar), **não** traduzir legendas.

- [ ] **Marcar visto / dar nota a partir do player nativo** — o `AnimeExtract` já tem o botão; o `Player` não. Como a posição agora entra no "Continua a ver", falta o resto: pôr na biblioteca e dar nota sem sair do vídeo.

## UX / fluxos rápidos
- [ ] **Keyboard shortcut "o"** para marcar visto/nota na Library (como no /compare).

## Importação / dados
- [ ] **Filtrar Library por nota/estado/tipo** (mais filtros no `LibraryControls`).
- [ ] **Filtros e ordenação da library a viverem na URL** (`?ordem=nota&filtro=vistos&genero=Ação`). Hoje o `LibraryControls` não usa `useSearchParams`, por isso uma vista filtrada não se pode partilhar, marcar nos favoritos, nem sobreviver ao botão "voltar". O ProdSound faz isto com um helper de ~15 linhas que reescreve os parâmetros existentes em vez de os substituir (`exUrl()`), e é o que torna cada vista um link.

## Social / comunidade — o que o projeto antigo (ProdSound) já resolveu

Analisei a fundo `C:\Users\white\Documents\RAI PAP` (o projeto da escola do
utilizador, PHP + MySQL, 29 tabelas) para ver o que já está pensado lá e não
aqui. **Só leitura** — a pasta não é um repo e uma alteração acidental não se
recupera.

Cada item foi verificado dos dois lados: o que o ProdSound faz (com o ficheiro) e
o que a MEIDA tem hoje (com o ficheiro). Os que já existem aqui **não** estão
listados como ideia.

### Desfazer desfaz o aviso — a mais barata e a mais justa
> `server/src/store.js` — `unlikeComment()` e `unfollowUser()` **não** apagam a
> notificação que criaram. Ora se gostaste de um comentário e o autor recebeu o
> aviso, e depois tiras o gosto, **o aviso fica lá para sempre**.

O ProdSound tem isto em **6 sítios espelhados** (`toggle_repost.php:31`,
`perfil.php:34,66,88,110`, `explorar.php:57`): cada `unfollow` / `unlike` /
`desbloquear` faz o `DELETE FROM Notificacoes` correspondente.

São duas linhas por função, mais um teste que verifica que tirar o gosto limpa o
aviso. **A primeira coisa a fazer desta lista.**

### Bloquear utilizador (e o que tem de acontecer junto)
A MEIDA **não tem tabela de bloqueio nenhum**. E não é um extra: há comentários
abertos, `@menções` e `follow`. Bloquear tem de:

1. esconder o perfil e os comentários um do outro;
2. refuse as `@menções` (hoje mentions notificam sem filtro nenhum);
3. **apagar o follow nos dois sentidos** e **todas as notificações trocadas**.

O ponto 3 é o que o ProdSound faz num único `INSERT` de bloqueio
(`perfil.php:83-92`) e é o que faz "desbloquear" ser de facto uma saída, e não
só esconder um botão.

### "Deixar de me seguir" (remover um seguidor)
`follows` já está cá. Falta só a acção: quem é alvo de spam tira o seguidor sem
ir ao perfil dele. No ProdSound é o `remove_follower` (`perfil.php:74-80`) e é
seguro porque o `WHERE` leva `CodUtilizadorSeguido = <o meu id>` — ou seja, só
afecta quem me segue a mim.

### Preferências de notificação, por tipo — **com uma condição**
A MEIDA tem notificações (`reply`, `like`, `follow`, `mention`) e **nenhum
botão** para as desligar: as Definições têm media, aspecto e integrações, mas
nada sobre o sino.

**O aviso importante vem do próprio ProdSound:** ele tem um ecrã inteiro
destas preferências (`NotificacoesLikes`, `NotificacoesComentarios`,
`NotificacoesSeguidores`, `NotificacoesEmail`) e **nenhum dos treze
`INSERT INTO Notificacoes` as consulta**. São quatro interruptores que não fazem
nada — piores do que não existirem, porque dão a ilusão de controlo.

Portanto, se se fizer: cada opção tem de ter um `if` que a consome **no caminho
da escrita**, no mesmo sítio onde a notificação é criada. E convém ficar escrito
num teste.

### Notificações em tempo real (a infra já existe)
Hoje o sino faz `setInterval` de **60 s** (`NotificationBell.jsx:9`). Mas a
watch party **já tem SSE** (`watchparty/WatchPartyContext.jsx` usa
`EventSource`). Reaproveitar esse mesmo canal para as notificações troca um
request por minuto por cliente por um eventopush, sem dependências novas.

O ProdSound faz o contrário (poll de 10 s, depois 30 s) e tem lá o comentário
certo sobre o problema disso: um endpoint que só lê tem de largar o lock da
sessão antes de ir para a base de dados, ou trava os outros pedidos da mesma
sessão.

### Reações com emoji nos comentários
A MEIDA não tem reações em lado nenhum. O ProdSound tem-nas nas mensagens
(`MensagensReacoes`) e a forma está bem escolhida: **uma por utilizador**, com
toggle — carregar no mesmo emoji desliga, carregar em outro troca
(`ON DUPLICATE KEY UPDATE Emoji = VALUES(Emoji)`). Não é o "contador de
reações" do Facebook, é o que a pessoa quer mesmo.

### Denúncias e registo de auditoria
A rota `admin.js` da MEIDA é **só** a migração de dados (`/api/admin/seed`). Não
há moderação nenhuma. E o servidor partilhado já tem utilizadores reais.

O que o ProdSound ensina, e que é a parte boa:

- **A denúncia é uma caixa de entrada, não um canal.** Resolver uma lá é um
  `UPDATE` de 14 linhas: não apaga nada, não bane ninguém, não notifica ninguém
  e não fica registado. É a maior fraqueza estrutural do sistema dele.
- **O registo de auditoria faz duplo papel.** A tabela `LogAdmin` é
  `(quem, acção, alvo, codAlvo, ip, quando)`, e a **justificação do banimento é
  guardada dentro do próprio log** em vez de criar colunas novas
  (`banuti.php:29-33`). Depois é lida de volta no login falhado para explicar ao
  utilizador *porque* está suspenso (`proclogin.php:66-73`).

Ou seja: uma tabela resolve auditoria **e** "porque é que estou suspenso". Uma
tabela e uma função.

Para a MEIDA basta o essencial: `reports` (com estado), um caminho para o admin
resolver **com uma acção real** (remover comentário, avisar, bloquear) e
`audit_log`. **Não precisa** de hierarquia de três níveis — o `podeModerar()` do
ProdSound (Master > Admin > Comum, em que um Admin não toca noutro Admin) só faz
sentido quando há mais do que um tipo de staff, e hoje não há.

### Eliminar a conta
A MEIDA **não tem** rota para isto. E tem uma vantagem que o ProdSound não tem:
o avatar é um `data:` URL ou `emoji:` guardado **na base de dados**
(`Avatar.jsx:12`), não um ficheiro em disco. Portanto não há ficheiros para
limpar depois do `commit()` — é tudo `ON DELETE CASCADE`, que a MEIDA já tem em
todo o lado.

Duas coisas do ProdSound que valem copiar mesmo assim:

- **Escrever `DELETE` para confirmar** (o campo tem de ser literalmente a
  palavra), com o botão desactivado até bater certo. Três linhas que evitam o
  clique acidental.
- **Apagar na base primeiro, ficheiros só depois** — nele é obrigatório (áudio e
  fotos), mas o hábito de separar as duas coisas é o que evita apagar ficheiros de
  alguém e depois a escrita falhar.

O que **não** copiar: ele faz *hard delete* e deixa umas dez tabelas com linhas
órfãs (favoritos, coleções, histórico, mensagens, denúncias, badges). A MEIDA, se
algum dia tiver contas reais no servidor partilhado, tem de decidir o que se
anonimiza em vez de apagar.

### Recuperar a senha — sem email, se não houver
A MEIDA **não tem campo de email nenhum** no utilizador. Não há verificação de
conta nem recuperação de senha.

O ProdSound tem as duas coisas (código de 6 dígitos, expira em 15 min, 5
tentativas), mas isso exige SMTP — e a regra da MEIDA é não usar nada pago.
O caminho grátis é o admin a repor a senha a quem perdeu o acesso, com o mesmo
registo de auditoria. A decisão fica para o utilizador; o que **não** se faz é
inventar um e-mail falso no registo só para ter o campo.

### Elenco e realizadores de anime — hoje está vazio
O `cast` do anime está **hardcoded a vazio** (`jikan.js:232` e `:765`) e a
AniList **nunca é perguntada por `staff`**. Os filmes tiram o elenco do TMDB
(`tmdb.js:337`, os primeiros 10 do `credits.cast`), mas um anime não tem.

A AniList devolve `staff` (com a ocupação principal de cada pessoa) e `studios` na
mesma consulta que já é feita. Passar de `cast: []` para a lista real é uma
alteração pequena, e o ganho é grande: o anime é metade do catálogo.

### "Partilha" / recomendar a quem segues
O ProdSound tem três acções separadas, e separá-las é a ideia:

| acção | quem vê | avisa? |
| --- | --- | --- |
| like | público | sim |
| favorito | **privado** | não |
| partilha / repost | **público**, entra no feed de quem segues | sim |

Para a MEIDA: *gostar* de um título (público) é distinto de o pôr na watchlist
(privado) e de o **recomendar aos meus seguidores** (público, e aparece no feed
deles). Hoje não existe nada disso — e também **não existe feed**, apesar de
existir `follows`. Ver a ideia do feed logo abaixo.

### Feed dos seguidos
Com `follows` já populado, falta a página: o que as pessoas que sigo viram,
avaliaram ou comentaram ultimamente. O ProdSound faz isto com um `UNION ALL`
entre o original de quem segues e as partilhas (`explorar.php:145-180`), o que é
o mesmo mecanismo.

**Atenção ao aspecto feio:** um feed destes é um convite a seguir bots. Vira-se
contra eles com o bloqueio e com o `remove_follower` acima.

### Ver o perfil como os outros veem
O ProdSound tem um link "ver perfil público" nas preferências
(`preferencias.php:43-44`). Na MEIDA o `is_public` já existe e já é respeitado;
falta só a pré-visualização. Duas linhas.

---

## O CSS e as estatísticas — o que o ProdSound faz melhor

O utilizador gostou do aspecto do projecto antigo. Analisei as duas coisas: o
`style.css` (749 linhas) e a forma como as estatísticas são mostradas no perfil e
no dashboard.

### O problema: o CSS da MEIDA não tem sistema

Medido, não estimado:

| | ProdSound | MEIDA |
| --- | --- | --- |
| `styles.css` / `style.css` | 749 linhas | **5609 linhas** |
| tokens com nome | ~30 | **15** |
| valores de cor crus | poucos | **158 `rgba(255,255,255,…)` + 74 hex** |

Os 158 valores de branco aparecem **18 vezes** com alfa `0.08`, 17 com `0.1`, 13
com `0.14` — e **nenhum passa por um token**. A MEIDA não tem `--line`,
`--surface-3`, `--radius-sm`, nem `--danger` / `--success` / `--warning`. São
valores repetidos à mão, o que significa que mudar a cor de uma borda é procurar
158 sítios.

### O que lá está bem pensado, e vale bring

**1. Um sistema com intenção escrita.** O `style.css` abre com uma frase que
decide tudo o que vem a seguir:

> *Dark-first, monochrome + one signal accent. Flat surfaces, hairline borders,
> no gradients, no glow, no scale/translate hovers. Minimal, deliberate motion.*

Isso é o que a MEIDA **não** tem: tokens sem uma regra que diga porque existem. E a
MEIDA hoje tem gradientes e glows (`--shadow-nav`, `--shadow-card-hover`) que o
outro projeto decide não ter.

**2. `--ps-fill`, um fundo que aguenta texto nos dois temas.** O comentário
explica: substituiu uns roxos que só se liam bem num dos temas, e o novo valor é
**igual em claro e em escuro** por isso o texto claro carrega sempre.

**3. Aliases velhos que apontam para os novos.** `--primary-color`,
`--shadow-light`, `--transition-smooth` são reapontados para os tokens do sistema.
Assim os estilos inline antigos herdam o aspecto novo **sem editar página por
página** — essencial durante uma remodelação.

**4. O gráfico do perfil é CSS puro, sem biblioteca.** Seis meses em colunas
flex: `flex: 1`, barra com `height: X%`, topo arredondado, número em cima, mês em
baixo. E o detalhe que faz funcionar: `min-height: 4px` — um mês a zero mostra
risca, não desaparece. (A MEIDA já pensa assim no `ProfileStats.jsx`, com o
comentário do "Series 12 que virava um risco de 1px". O raciocínio é o mesmo.)

**5. A faixa de números do perfil.** Cinco números grandes na cor de destaque, com
o rótulo em maiúsculas minúsculas de 11px por baixo, separados por **linhas
verticais de 1px**, e os dois interactivos (seguidores / a seguir) são links que
abrem modal. Simples e lê-se de relance.

**6. As métricas privadas só aparecem no perfil de quem é dono.** O gráfico está
dentro de `if ($idPerfil == $meuID)`. Separar "o que os outros veem" de "o que eu
vejo" na mesma página é o que impede a MEIDA de mostrar um número de biblioteca a
quem não deve.

### O que a MEIDA já faz e não há que trazer

- **`prefers-reduced-motion`** — a MEIDA já tem, em três sítios.
- **Barras em vez de gráficos circulares**, com o motivo escrito
  (`ProfileStats.jsx`): cinco a oito categorias com contagens muito diferentes
  comparam-se melhor em barra.
- **A barra cresce contra o maior do bloco, não contra o total** — já está feito e
  documentado.

Ou seja: o **raciocínio** já é o mesmo que o do outro projeto. O que falta é o
**sistema visual**.

### O trabalho, por ordem

- [ ] **Tokens de superfície e de traço**: `--line`, `--line-soft`, `--bg-surface3`,
      `--radius-sm`, e `--danger` / `--success` / `--warning`. Substituir os 158
      valores crus por referências. **Não muda o aspecto** — é o que torna o
      próximo passo possível.
- [ ] **Escrever a regra do aspecto** num sítio único (um comentário em cima do
      `:root`), para as decisões deixarem de ser implícitas.
- [ ] **Faixa de números no perfil** com os tokens acima — o número grande na cor
      de destaque, o rótulo em maiúsculas, a linha vertical de 1px entre eles, e
      seguidores / a seguir a abrir a lista em vez de só mostrarem um número.
      em **SVG puro** (`GraficoMensal.jsx`, sem dependências), alimentado por
      `serieMensal()` em `profileStats.js`. Mede **actividade** (última vez que
      mexeste num título), não visionamento, e a legenda diz-o. Três decisões que
      vieram do outro projecto: a escala cresce contra o **maior** mês (e não
      contra o total), um mês vazio fica a **3 px em vez de nada** — o zero é
      informação, e sumir fazia o eixo mentir —, e a cor vem do mesmo token que o
      resto da app. O eixo X leva o ano só quando muda. Só aparece com 3+ meses de
      dados. Testado em `scripts/testar-grafico-mensal.mjs` (55 verificações,
      incluindo que a barra mais alta usa pelo menos 80% da altura — defeito
      encontrado no perfil real, onde o eixo dava 0/500/1000 com a barra a 53%).
- [ ] **Separar o público do privado** nas estatísticas do perfil: números de
      biblioteca e seguidores são públicos; o gráfico de meses e a distribuição por
      estado de visionamento são só de quem é dono.

### Nota sobre os gráficos: sem biblioteca, e não por princípio

Cheguei a escrever que o Chart.js do dashboard de admin do ProdSound não valia a
pena por ser uma dependência nova. **Estava a responder ao ecrã errado** — um
ecrã de administração que ninguém vê. Nas estatísticas do perfil, que toda a
gente vê, um gráfico é o sítio certo, e era uma lacuna real.

Feito com SVG à mão na mesma, mas por uma razão prática e não por princípio: uma
coluna é um `<rect>`, e o gráfico do ProdSound no perfil **já é CSS puro**. O que a
biblioteca traria (pan, zoom, animações de entrada) não se usa num gráfico de 12
barras, e o ficheiro inteiro tem menos de 4 KB contra +70 a +200 KB.

O que muda se algum dia o gráfico passar a 3 ou 4 séries com cursor e *tooltip*
detalhado: aí a conta muda, e a biblioteca passa a compensar. Vale a pena ter
essa linha escrita.

---

## O que **não** há que ir buscar lá (anotado para não voltar)

Regra geral: **copiar a decisão, nunca o código.** O ProdSound é PHP com SQL
dentro do código, passwords em `md5` sem sal, e há código morto espalhado.

| Não portar | Porquê |
| --- | --- |
| **"Explorar" como recomendação** | Não existe lá para portar: é `ORDER BY DataP DESC`. E para uma biblioteca pessoal seria **errado** recomendar o que a pessoa já curou. A descoberta na MEIDA vem do catálogo (AniList/MAL), não dos dados próprios. |
| **"Tendências"** | O ranking dele filtra pela data de **publicação** e nunca pela data da **interacção** (`tendencias.php:13`), apesar de a coluna `DataLike` existir e não ser usada. Se algum dia fizermos "top semanal", tem de ser pela data da interacção — senão ganha sempre o título mais antigo. |
| **Streak / racha diária** | **A MEIDA está à frente** — no ProdSound não há racha nenhuma, nem níveis, nem XP, nem raridade. Não há nada para trazer. |
| **i18n** | 626 chaves × 2 idiomas, com cerca de 20% realmente traduzidas e o backoffice inteiro em português duro. Para uma app pt-PT o ganho é zero. |
| **Níveis / progresso dos badges** | Lá o badge é binário ("tens 50 seguidores, já cá está"). Falta mostrar "faltam 2" — que é o que dá vontade de continuar. |
| **Comentários aninhados** | Já cá está (`.comment-cita`). |
| **Notificações com `ENUM`** | Já cá está, em `kind` + `refId`. |
| **Upload de ficheiros** | Os validadores são bons (extensão **e** MIME, `random_bytes`), mas uma app defilms não tem porque guardar o filme. |
| **Tipos de publicação como interruptor de formulário** | Lá são 2 tipos com números mágicos escritos em 4 ficheiros. Na MEIDA `anime`/`filme`/`manga` é uma faceta de filtro, não uma regra de validade. |
| **`md5()` sem sal** | A MEIDA usa bcrypt. Nunca voltar atrás. |
| **Acções destrutivas em `?action=` de GET sem CSRF** | Um `<img src="perfil?action=bloquear">` num site terceiro bloqueia outra pessoa. Em React o CSRF está resolvido por defeito, mas o padrão de origem importa. |
| **Preferências que não fazem nada** | Ver a secção de cima. É o contra-exemplo mais útil de lá. |
| **Enumeração de emails** ("esse email não está registado") | A MEIDA tem servidor público. |
| **Hard delete sem anonimizar** | Se houver contas reais, é preciso decidir o que se guarda. |

---

## Feitas

Tudo o que já está feito, com a explicação de como e porquê. Saiu daqui
de cima quando se fez — a linha original dizia só o quê, não o como.

### Lingua / tradução

- **Interface inteira em português e inglês** — escolha nas Definições (Detalhe → Conteúdo), detetada do browser na primeira vez e memorizada. A tradução é só do lado do cliente: o servidor não sabe o idioma do pedido, e a chave é o próprio texto em português. Uma função pura partilhada (`web/src/i18n/traduzir.js`) é usada pelo contexto e pelo `api/client.js`, para as mensagens de erro do servidor também saírem traduzidas.
- **Auditor que garante que nada fica por traduzir** — `scripts/auditar-pt-por-traduzir.cjs`, ligado ao `npm test`. Apanha texto em português em JSX, em atributos de texto, em strings e em templates. **Já teve cinco buracos** (cada um com um ficheiro de teste e uma mutação): texto misturado com expressão, imports lidos como JSX, crases de fecho de template, o objecto de valores do `t()` lido como texto, e texto de **uma palavra** (que nenhuma das duas regras via, por ser indistinguível de um identificador). A lição: "não há nada por traduzir" nunca é resposta suficiente — mutar.

### Library / notas

- **Nota rápida no cartão**: mostra a tua nota (0-100) num badge no canto inferior-direito do cartão (SVG estrela) — usa o cache da library, sem pedidos extra.

### Multi-utilizador / social

- **Discord Rich Presence** — mostrar no perfil do Discord o que se está a ver (título, `S1E2`, `12:34 / 45:00` + cartaz), como no Stremio/Crunchyroll. 100% grátis e local: protocolo RPC do Discord implementado à mão em `electron/discord-presence.cjs` (zero dependências), sem servidor e sem API paga. Interruptor em Definições → Discord. Só na app de computador (Electron); nos providers com iframe só se sabe que a fonte foi escolhida.
- **Listas públicas/compartilháveis** (link para mostreres a tua biblioteca) — perfis em `/u/:username` com biblioteca e listas, privacidade à escolha (público/privado), seguir utilizadores e pesquisa de pessoas (`/users`).

### Player / visual

- **Suporte Real-Debrid**: cola o token em Definições; os torrents em cache no RD reproduzem logo (o que faz o Stremio parecer "instantâneo"). Torrents sem cache caem para o WebTorrent local. Badge "⚡ Debrid" + filtro só cache + os instant ficam no topo. Rotas: `/api/debrid/*`.
- **Multi-provider de torrents**: framework agregador no backend (`server/src/services/providers/`) que junta resultados de vários indexadores (Torrentio + YTS). Adicionar um provider = criar um ficheiro na pasta `providers/` e registá-lo no `index.js`. Mostra o badge da fonte (ex.: YTS) em cada torrent.
- **Redirecionamento/links para sites externos**: botão para abrir diretamente no RidoMovies (com slug exato por série/época/episódio ou filme) e pesquisa no Google quando os providers internos falham ou a pedido do utilizador.
- **Modo P2P (torrents sem Real-Debrid) que começa logo** — em vez de esperar pelo ficheiro inteiro (`ready`) antes de tocar, resolve nos `metadata` e vai chercher as peças de que precisa enquanto o resto vem atrás. Peças priorizadas com `torrent.critical` (que o WebTorrent já tinha e não era usado), com janela de 8 MB a partir da posição de leitura. Torrent sem seeds dá erro em vez de esperar para sempre. (`torrentEngine.js`, `stream.js`; testes em `scripts/testar-p2p.mjs` e `testar-p2p-metadados.mjs`).
- **Resolver as séries pelo catálogo do Anikoto** (`anikotoapi.site`) como fonte EXTRA de anime — apanha episódios que o MegaPlay não resolve na rota `/ani/`. **A ideia original previa isto como fallback de baixo ganho; mediu-se diferente e valeu a pena**: o `embed_url` do Anikoto é do próprio **MegaPlay pela rota `/stream/s-2/{id}`**, ou seja, é o mesmo site por um caminho que resolve títulos diferentes. Cada fonte extra aparece DEPOIS das providers normais e nunca as substitui, por isso nunca piora o caso em que o `/ani/` já funciona.

  A API mudou desde 2026-10-04 (ver AGENTS.md, secção de providers): os endpoints são agora `/recent-anime?page=N` e `/series/{id}`, e a chave é o `embed_url.sub/dub` de cada episódio, não `ani_id`. Os `mal_id`/`ani_id` vêm como **texto**, com `""` nos que não têm.

  O catálogo fica em cache no SQLite (tabela `anikoto_series`, migração 7) e o rasteio é incremental (2 páginas ao arrancar, mais 3 a cada título ainda desconhecido, com 1,4 s de pausa — bem dentro do limite de 60 pedidos/2 min da API). Separar "catálogo conhecido" de "embeds buscados" é o que permite guardar ~100 títulos por página com 1 pedido, em vez de pedir `/series/{id}` a todos. Testado em `scripts/testar-anikoto.mjs` (23 verificações, 3 mutações, com uma base temporária e a API real).
- **Reprodução nativa do MegaPlay, sem iframe** — o `getSources` dá as legendas em claro (`.vtt`) e o vídeo num campo `enc` cifrado; descifra-se e reproduz-se com o **nosso** player em vez de um `<iframe>`. Ganha três coisas que o iframe não dava: legendas escolhíveis, play/pausa que sincroniza no Watch Party (o `postMessage` não atravessa o cross-origin do player), e a posição a entrar no "Continua a ver".

  **A ideia original dizia "engenharia reversa do player: não fazer sem tempo".** Era cautious demais: a chave e o IV (`AES-CBC`, 32 e 16 bytes) estão em texto simples no próprio JavaScript do site, e a página não os sobrescreve. Medido a 2026-10-11 num episódio real: o m3u8 tem 339 segmentos (~24 min) e o `.vtt` 378 blocos, e os segmentos aceitam CORS.

  Aparece como **entrada separada** na lista de fontes ("MegaPlay (nativo)"), porque é o utilizador que escolhe: ao lado do iframe, não a substituí-lo. Se o servidor não conseguir desencriptar (cifra mudou, episódio sem embeds), devolve `native: false` e o `Player` cai no iframe da mesma fonte — a falha é invisível para quem só quer ver o episódio. Service: `megaplayNativo.js`; rota `/api/anime/megaplay`; testes em `scripts/testar-megaplay.mjs` (16 verificações, 3 mutações, a bater no site real).
- **Saltar a abertura e o fim no player nativo** — o `getSources` devolve `intro: {start, end}` e `outro`, e a 1.4.3 já os trazia até ao frontend… que os deitava fora. O "Autoskip" das Definições só funcionava nos iframes, e só porque o `Player` acrescentava `?autoSkipIntro=` ao URL (um parâmetro do *site*, não nosso).

  **A forma real, medida em 3 episódios:** `intro: {start: 140, end: 229}`, `outro: {start: 1376, end: 1447}` — e **`{start: 0, end: 0}` quando o episódio não tem fim**. Esse último é a armadilha: sem o filtro, o botão aparecia aos 0 segundos de qualquer episódio. Também vem `undefined` quando o `native` é `false`, porque a rota responde `{native: false}` sem os campos.

  A decisão (quando mostrar, para onde saltar, o que já foi saltado) está em **`pularIntro.js`**, toda pura e sem React, para se poder partir por mutação. Duas regras que vieram da medição: uma janela só vale se `Number.isFinite` nos dois lados e `end - start >= 1`, e o salto é limitado ao fim do vídeo quando a janela o passa (o site tem tempos ligeiramente errados). Com o Autoskip ligado salta sozinho uma vez e sem botão — as Definições prometem "tenta saltar a intro", não "pergunta".

  Testes em `scripts/testar-pular-intro.mjs` (57 verificações, 7 mutações). **Duas das mutações revelaram código morto**: o `typeof start !== "number"` era redundante com `Number.isFinite` (que não converte, logo já rejeita texto), e o `split` do harness cortava o `process.exit` — os sub-testes saíam com código 0 mesmo a falhar, e o harness reportava "mutação não apanhada" quando o teste a apanhara. As duas coisas foram corrigidas: o filtro ficou só no `isFinite` e o harness ganhou a cauda com o `process.exit`.

### UX / fluxos rápidos

- **Botão "Descarregar a app" no site** — no cabeçalho, só na versão web (`meida.onrender.com`). Na app de desktop e em `localhost` não aparece: quem já a tem não precisa de a descarregar, e em desenvolvimento o botão só ia atrapalhar. A regra está em `web/src/lib/web.js`, testada em `scripts/testar-web.mjs` (19 verificações, 2 mutações). Aponta para a página da release no GitHub, que é um URL estável (o do `.exe` leva a versão no nome e passaria a desatualizar).
- **Quick add à library** dos cartões do catalogo (home/search/category): ícone `+` no canto — adiciona à watchlist ou marca como visto sem abrir a ficha, com optimistic update. (`LibraryContext`, `MediaCard.jsx`). Também mostra as badges de visto/watchlist em todos os cartões.

### Importação / dados

- **Exportar a tua biblioteca/diário (CSV/JSON)** — botão nas Definições → "Os teus dados". JSON para backup, CSV para Excel/Sheets. Servidor entrega JSON em `GET /api/export`; o CSV é gerado no browser.
- **Importar o ficheiro exportado (JSON/CSV)** — secção "Importar dados" nas Definições. Merge conservador (`upsertLibrarySafe` + `importProgress`): não apaga notas/visto que o ficheiro não traga; parse CSV no backend (`parseCsv` com aspas/escapes).

### O CSS e as estatísticas — o que o ProdSound faz melhor

- **Gráfico de "ao longo do tempo" no perfil** — 12 meses de barras verticais
  em **SVG puro** (`GraficoMensal.jsx`, sem dependências), alimentado por
  `serieMensal()` em `profileStats.js`. Mede **actividade** (última vez que
  mexeste num título), não visionamento, e a legenda diz-o. Três decisões que
  vieram do outro projecto: a escala cresce contra o **maior** mês (e não
  contra o total), um mês vazio fica a **3 px em vez de nada** — o zero é
  informação, e sumir fazia o eixo mentir —, e a cor vem do mesmo token que o
  resto da app. O eixo X leva o ano só quando muda. Só aparece com 3+ meses de
  dados. Testado em `scripts/testar-grafico-mensal.mjs` (55 verificações,
  incluindo que a barra mais alta usa pelo menos 80% da altura — defeito
  encontrado no perfil real, onde o eixo dava 0/500/1000 com a barra a 53%).
- **Página `/stats`** com histograma de notas (`HistogramaNotas.jsx`, 10 faixas, SVG mão), tempo visto (`progress.seconds_watched`), género mais visto (`desempate alfabetico`), nota mais alta/baixa/média/mediana e década favorita (`Math.floor(year/10)*10`).

### Gamificação
- **Sistema de conquistas/badges** — página `/achievements` + link no menu. Badges calculados a partir da library/diário (Primeiro passo, Matiné, Cinéfilo, Maratonista, Otaku, Crítico, Biblioteca, Centenário, …) com ícones SVG (sem emojis).
- **Streak/racha diária** — dias consecutivos com atividade (baseado nas datas do diário/progresso e da library); racha atual + melhor racha.

## Ferramentas de verificação (para não voltar a cair nos mesmos buracos)
- **Auditor de tradução** (`scripts/auditar-pt-por-traduzir.cjs`, no `npm test`) e o seu teste (`scripts/testar-auditor-i18n.mjs`, 16 verificações, 5 mutações).
- **Testes com mutação por omissão** — cada ficheiro novo em `scripts/` parte o código de propósito e confirma que o teste o apanha. Um teste que passa porque o código está certo não prova nada; um teste que continua a passar quando o código está partido prova que não está a testar nada.
- **Um teste que arranca o servidor de verdade** (`testar-anikoto.mjs`). Nenhum dos outros arranca o `index.js`, e foi por isso que um `aquecerCatalogo()` sem `return` matou o servidor ao arrancar com "Cannot read properties of undefined (reading 'catch')" sem nenhum teste dar por isso. A lição: uma função pública chamada no arranque tem de ter um teste que arranque o servidor.
- **Testes que batem em APIs de terceiros** (o Anikoto, o MegaPlay) usam uma base de dados temporária e saltam com aviso quando a rede falha, em vez de falhar — um teste que rebenta porque o outro mudou o site não diz nada sobre o código.
- **`npm test` tem 24 passos** — confirmar que o que se mexeu entrou lá.

## Feitas sem detalhe (só o inventário)
Isto aqui não tem a explicação do *como* — a de cima é que a tem.

### Dados e base
- Base de dados em **SQLite** (`node:sqlite`, zero dependências) com migrações; **servidor remoto no desktop** (Electron 44, `node:sqlite` no Node 24).
- Notas 0-100 em vez de 5 estrelas.

### Perfis e social
- **Perfis** (`/u/:username`), seguir utilizadores, pesquisa de pessoas (`/users`), comparar com a comunidade.
- **Comentários por episódio** (respostas a respostas, gostos, minuto no vídeo).

### Biblioteca
- **Compara as tuas notas** (`/compare`) e **Comparar avaliação** (`CompareRating`).