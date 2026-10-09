# IDEIAS — MEIDA

Lista viva de ideias para a app. Marca com `[x]` as que forem feitas e move-as
para a secção "Feitas".

## Estatísticas / perfil
- [ ] Página de **estatísticas** (`/stats`): distribuição das notas (histograma), nº de títulos visto/assistidos, tempo total gasto, género mais visto, "nota mais dada", década favorita.
- [ ] **Resumo anual/personalizado** ("o teu ano em revisão"): totais por mês, gráficos, top do ano — estilo Spotify Wrapped.

## Library / notas
- [x] **Nota rápida no cartão**: mostra a tua nota (0-100) num badge no canto inferior-direito do cartão (SVG estrela) — usa o cache da library, sem pedidos extra.
- [ ] **Barra de nota visual** nos cartões (gradiente colorido por nota).
- [ ] **Marcar como visto ao dar nota** (uma ação única).
- [ ] **Vista timeline**: ordenar por data em que viste, com linhas cronológicas.

## Recomendações / descoberta
- [ ] **Notifica quando sai próximo episódio** dos teus em seguimento.
- [ ] **Top semanal**: ranking da tua lista por trending ou nota.
- [ ] **"Podias gostar"**: recomendações baseadas nas notas altas (similaridade de géneros/tags).

## Multi-utilizador / social
- [x] **Discord Rich Presence** — mostrar no perfil do Discord o que se está a ver (título, `S1E2`, `12:34 / 45:00` + cartaz), como no Stremio/Crunchyroll. 100% grátis e local: protocolo RPC do Discord implementado à mão em `electron/discord-presence.cjs` (zero dependências), sem servidor e sem API paga. Interruptor em Definições → Discord. Só na app de computador (Electron); nos providers com iframe só se sabe que a fonte foi escolhida.
- [ ] **Estadísticas comparadas com a média dos utilizadores** (rating global por título).
- [x] **Listas públicas/compartilháveis** (link para mostreres a tua biblioteca) — perfis em `/u/:username` com biblioteca e listas, privacidade à escolha (público/privado), seguir utilizadores e pesquisa de pessoas (`/users`). Ver "Melhorias já feitas".

## Player / visual
- [x] **Suporte Real-Debrid**: cola o token em Definições; os torrents em cache no RD reproduzem logo (o que faz o Stremio parecer "instantâneo"). Torrents sem cache caem para o WebTorrent local. Badge "⚡ Debrid" + filtro só cache + os instant ficam no topo. Rotas: `/api/debrid/*`.
- [x] **Multi-provider de torrents**: framework agregador no backend (`server/src/services/providers/`) que junta resultados de vários indexadores (Torrentio + YTS). Adicionar um provider = criar um ficheiro na pasta `providers/` e registá-lo no `index.js`. Mostra o badge da fonte (ex.: YTS) em cada torrent.
- [x] **Redirecionamento/links para sites externos**: botão para abrir diretamente no RidoMovies (com slug exato por série/época/episódio ou filme) e pesquisa no Google quando os providers internos falham ou a pedido do utilizador.
- [ ] **Modo cinema**: player em fullscreen com UI limpa e auto-hide dos controlos. **(Decidido: o fullscreen/auto-hide nativo do `<video>` chega — não fazer.)**
- [ ] **Dark mode unificado** + tema custom por utilizador (a app já é maioritariamente escura; falta terminar).
- [ ] **Bookmarks/timestamps por episódio** (notas de episódio, não só da série).

## UX / fluxos rápidos
- [x] **Quick add à library** dos cartões do catalogo (home/search/category): ícone `+` no canto — adiciona à watchlist ou marca como visto sem abrir a ficha, com optimistic update. (`LibraryContext`, `MediaCard.jsx`). Também mostra as badges de visto/watchlist em todos os cartões.
- [ ] **Keyboard shortcut "o"** para marcar visto/nota na Library (como no /compare).

## Importação / dados
- [x] **Exportar a tua biblioteca/diário (CSV/JSON)** — botão nas Definições → "Os teus dados". JSON para backup, CSV para Excel/Sheets. Servidor entrega JSON em `GET /api/export`; o CSV é gerado no browser.
- [x] **Importar o ficheiro exportado (JSON/CSV)** — secção "Importar dados" nas Definições. Merge conservador (`upsertLibrarySafe` + `importProgress`): não apaga notas/visto que o ficheiro não traga; parse CSV no backend (`parseCsv` com aspas/escapes).
- [ ] **Filtrar Library por nota/estado/tipo** (mais filtros no `LibraryControls`).
- [ ] **Filtros e ordenação da library a viverem na URL** (`?ordem=nota&filtro=vistos&genero=Ação`). Hoje o `LibraryControls` não usa `useSearchParams`, por isso uma vista filtrada não se pode partilhar, marcar nos favoritos, nem sobreviver ao botão "voltar". O ProdSound faz isto com um helper de ~15 linhas que reescreve os parâmetros existentes em vez de os substituir (`exUrl()`), e é o que torna cada vista um link.

## Providers de anime
- [ ] **Resolver as séries pelo catálogo do Anikoto** (`anikotoapi.site`) para apanhar episódios que o MegaPlay não tem na rota `/ani/`. A API devolve 9044 títulos com `mal_id`/`ani_id`, e os `embed_url` são do próprio MegaPlay (rota `/stream/s-2/{id}`). **Só entra se for preciso**: a API não tem pesquisa, só paginação por data de estreia (91 páginas) e limita a 60 requests/2 min por IP. Ao testar (2026-10-04), varrendo 1 em cada 3 páginas não apareceu nenhum dos 3 títulos experimentais, e muitas entradas têm `ani_id` vazio — o ganho pode ser menor do que o esperado. Rastear o catálogo para o disco (mapeamento MAL/AniList → `series.id`) só compensa se o MegaPlay falhar com frequência. Serviria também para usar a rota `/mal/` sem mostrar o mesmo episódio duas vezes na lista.
- [ ] **Reprodução nativa do MegaPlay, sem iframe**: o `/stream/getSources?id=` devolve as legendas em claro (`tracks[].file`) e os tempos de intro/outro, mas o vídeo vem encriptado no campo `enc` (é o JS do player que o descripta). Só vale a pena se se conseguir o m3u8 — e aí as legendas passavam a ser as nossas, com escolha de idioma. Requer engenharia reversa do player: **não fazer** sem tempo para isso.

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
- [x] **Gráfico de "ao longo do tempo" no perfil** — 12 meses de barras verticais
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
- [ ] **Página `/stats`** com o resto do conteúdo (histograma de notas, tempo
      total, género mais visto). A dimensão temporal já está no perfil; falta
      juntar o resto num sítio próprio.
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

## Gamificação
- [x] **Sistema de conquistas/badges** — página `/achievements` + link no menu. Badges calculados a partir da library/diário (Primeiro passo, Matiné, Cinéfilo, Maratonista, Otaku, Crítico, Biblioteca, Centenário, …) com ícones SVG (sem emojis).
- [x] **Streak/racha diária** — dias consecutivos com atividade (baseado nas datas do diário/progresso e da library); racha atual + melhor racha.

---

## Melhorias já feitas (para referência)
- Compara as tuas notas (`/compare`), Comparar avaliação (`CompareRating`), Notas 0-100, export + import (JSON/CSV), gamificação (badges + streak), quick-add nos cartões, comparar com a comunidade.
- Base de dados em **SQLite** (`node:sqlite`, zero dependências) com migrações; **perfis** (`/u/:username`), seguir utilizadores, pesquisa de pessoas (`/users`), **comentários por episódio** (respostas, gostos, minuto no vídeo), e **servidor remoto no desktop** (Electron 44, `node:sqlite` no Node 24).