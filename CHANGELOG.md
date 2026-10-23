# Changelog

## 1.6.0

O perfil e a biblioteca de outro utilizador davam *"utilizador não encontrado"* porque o pedido ia para o servidor local em vez do servidor partilhado (FadeHost).

### `/api/users` saiu da lista de rotas locais

O `web/src/api/client.js` tem uma lista `LOCAL_API_PREFIXES` de rotas que não vão para o servidor remoto (ex.: catálogo, search, details). `"/api/users"` estava nessa lista, o que fazia com que `/api/users/:username`, `/api/users/:username/library`, `/api/users/:id/avatar`, seguir/seguir em seguida e a pesquisa de utilizadores (`/api/users?q=...`) fossem sempre para o servidor local ou para a origem do navegador. Como o servidor local não tem o utilizador "Boda" (ele vive no FadeHost), o perfil dava 404.

O `"/api/users"` foi removido da lista. Agora:

- `/api/users/:username` — perfil de outro utilizador — vai para o servidor remoto
- `/api/users/:username/library` — biblioteca pública — vai para o servidor remoto
- `/api/users/:username/lists` — listas públicas — vai para o servidor remoto
- `/api/users/:id/avatar` — avatar de outro utilizador — vai para o servidor remoto
- `/api/users?q=...` — pesquisa de utilizadores — vai para o servidor remoto
- Seguir / deixar de seguir — vão para o servidor remoto

Medido em produção: `GET https://meida.fadehost.app/api/users/Boda` devolve 200 com o perfil correcto.

O `npm test` passou (37 testes, 0 falhas). `npm run build` passou. CJK limpo. Lint sem erros novos.

## 1.5.9

Um anime sem fontes dizia *"falta o parametro tmdb"* — que manda quem investiga
para o lado errado. E a causa immediate era uma paragem global da AniList.

### A API da AniList está globalmente desligada

Medido hoje: `POST https://graphql.anilist.co` devolve **HTTP 403** com

> *"The AniList API has been temporarily disabled due to severe stability issues."*

Não é do MEIDA nem do utilizador — é uma paragem da AniList, e afecta toda a
gente. **Consequência no MEIDA:** `buildAnimeEmbedSources` só inclui um provider
**se tiver o id de que esse provider precisa**, e os três de anime (MegaPlay
nativo, MegaPlay, VidNest) precisam do **id do AniList**. Com a AniList em baixo,
`malToAnilist` falha, o `anilistId` fica `null` e o anime fica com **zero
fontes** — o `mal` sozinho não chega.

### A mensagem errada era do MEIDA

O ramo anime do frontend (`web/src/pages/Details.jsx`) mandava
`.sources({ mal, anilist, episode, audio })` — **sem `type`**. O servidor só
sabia que era anime pelo `type`, portanto um anime sem fontes caía na resposta
de filme.

**Medido, contra o servidor real:**

| pedido | resposta |
| --- | --- |
| `/api/sources?mal=21` | 400 `falta o parametro tmdb` ← o que a app mandava |
| `/api/sources?type=anime&mal=21` | 400 *"Não consegui obter as fontes deste anime agora…"* |

**A mensagem certa existia e era inalcançável.** O servidor tem a mensagem de
anime desde 2026-10-08 (o caso do Dragon Ball, quando a AniList também não
respondeu) — mas como o `type` nunca chegava, nunca era mostrada.

- O frontend passa a mandar `type: "anime"`.
- O servidor deriva o tipo (`!tipoCru && (mal || anilist)` → anime), para nenhum
  outro chamador cair no mesmo buraco.
- Um filme ou uma série **sem** tmdb continuam a dar *"falta o parametro tmdb"* —
  a correcção não trocou uma mensagem pela outra.

### O id do AniList só vivia em memória

`anilistMetaCache` e `anilistCache` eram `Map` em memória: perdiam-se a cada
reinício do servidor. E o id do AniList de um anime **não muda**, portanto cabe
num cache em disco sem prazo.

- `anilistid:<mal>` — o id, sem prazo.
- `anilistmeta:<mal>` — o id + o banner, com 30 dias (o banner pode mudar).

Com isto, um servidor que já viu o anime continua a servir as fontes mesmo com a
AniList em baixo.

### Detalhe que vale a pena saber

O `!tmdb` do `/api/sources` é, na prática, *"o parâmetro não veio"*: `tmdb` vem
de `req.query`, e portanto é uma **string** — `tmdb=0` e `tmdb=abc` são truthy e
passam. E o `get()` do cliente **omite** o parâmetro quando o valor é
`undefined`/`null`/`""`, pelo que um id que chegue vazio do servidor desaparece
em silêncio.

`scripts/testar-fontes-anime.mjs` (13 verificações, entra no `npm test`).

## 1.5.8

A versão web (a que se abre no navegador) não entrava em linha desde um deploy,
e a página do GitHub Pages não era publicada. Nenhum dos dois é do código que o
utilizador vê — são o **arranque** e a **publicação**.

### O Render não deployava: o start command reconstruía o site

O deploy falhava com `==> No open ports detected, continuing to scan...` e
depois `==> Port scan timeout reached, no open ports detected`. **Cada deploy
novo falhava do mesmo modo** — o sítio ficava em baixo, e a instância antiga
continuava a servir a versão anterior.

**O servidor não tinha a culpa.** Medido com `PORT=10000` e `SERVE_WEB=1`: liga a
`0.0.0.0:10000` e responde em **390 ms**. O `bind` está certo
(`config.host` = `process.env.HOST || "0.0.0.0"`, `config.port` =
`process.env.PORT || 5175`).

**A causa era o comando de arranque.** O `start:pwa` era
`npm run build && cross-env SERVE_WEB=1 node server/src/index.js` — reconstruía
a página inteira (**47 s**, medido no Render: *"built in 47.11s"*) **antes de o
servidor arrancar**. O Render já tinha construído no passo de build; o start
command repetia o trabalho. O scanner de portas do Render espera por um listener
TCP e dá-se por vencido entretanto — e a documentação dele diz exactamente isso
(*"Keep the start command to one long-running server"*; *"the server only starts
after the migration, so a slow migration holds the port closed"*). O scanner
corre **num namespace de rede separado** do processo, por isso só vê o porto
depois de o abrir.

- `scripts/start-pwa.cjs` (novo) decide se há de construir: compara o mtime do
  `web/dist/index.html` com o da fonte mais recente em `web/` (ignorando `dist`
  e `node_modules`). `serve:pwa` é o `--sem-build`: **só arranca**.
- `start:pwa` continua a construir quando a fonte é mais nova (o caso local), e
  `MEIDA_FORCE_BUILD=1` força.
- O `SERVE_WEB=1` passou a ser posto pelo script, e não por `cross-env`: assim o
  caminho crítico não depende de uma devDependency estar instalada no servidor.
- **Perigo antigo, agora fechado:** o servidor saltava de porta se a occupied
  (`PORTAS = [port, port+1, port+2, port+3]`). Isso é útil no PC (a 5175 às
  vezes está ocupada), mas **no Render é o pior**: a plataforma deu a porta e o
  scanner espera **essa**. As Docs dizem *"Render is usually able to detect and
  use it"* — "usually" não é "sempre", e o resultado é o mesmo erro. Agora,
  quando o `PORT` vem do ambiente, a lista tem **uma** porta e o `EADDRINUSE`
  sai com uma mensagem que diz porque.
- `render.yaml` passou a `startCommand: npm run serve:pwa`.
- **Falta ao utilizador:** o serviço Render em produção (`meida`, criado à mão —
  o `render.yaml` é só um blueprint) tem o **Start Command** no painel. Tem de
  passar a `npm run serve:pwa`. O `start:pwa` também fica bom (constrói só se
  for preciso), por isso a mudança do painel é uma melhoria e não uma
  urgência — mas sem ela o `serve:pwa` nunca é usado.
- `scripts/testar-start-pwa.mjs` (14 verificações, entra no `npm test`).

### O Pages do GitHub não estava activo

`actions/configure-pages@v5` dava *"Get Pages site failed... verify that the
repository has Pages enabled"*. A API do GitHub devolve 404 em
`GET /repos/{owner}/{repo}/pages` quando não há sítio.

- **Activa-se pela API, sem tocar no painel:**
  `gh api --method POST repos/boda07/meida/pages -f "build_type=workflow"` —
  devolve `html_url: https://boda07.github.io/meida/` e `build_type: workflow`.
- As actions estavam em `v3`/`v4`, que correm em **Node 20, já depreciado** (o
  GitHub avisava em cada run). Subidas para `checkout@v7`, `setup-node@v7`,
  `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` (versões
  verificadas pela API).

## 1.5.7

Dez defeitos medidos contra o servidor real antes de serem corrigidos, cada um
com teste validado por mutação. Seis são de segurança, e três deles eram
negação de serviço ou exfiltração a partir de um pedido anónimo.

### `sig` não-hexadecimal derrubava o servidor inteiro

`GET /api/proxy?...&sig=zzz…` — 64 caracteres, sem autenticação — matava o
processo com código 1. **Duas falhas encadeadas:** `assinaturaValida` comparava o
*comprimento da string* com o do digest, mas `Buffer.from(sig, "hex")` descodifica
a par e pára no primeiro par inválido, produzindo um buffer de 0 bytes — e o
`timingSafeEqual` atirava `RangeError`. Como `handleProxy` é `async` e não estava
ligado a nada, no Express 4 a rejeição ficava sem dono e o Node matava o
processo por `unhandledRejection`.

- A assinatura passa a validar a **forma** (`/^[0-9a-f]{64}$/i`) antes de
  comparar, e `routes/admin.js` passou a comparar **bytes** e não caracteres
  (um emoji são 2 caracteres e 4 bytes — o `timingSafeEqual` exige bytes iguais).
- **Rede:** `server/src/services/asyncRotas.js` (novo) envolve
  `Layer.prototype.handle_request`, o ponto onde o Express chama o handler e já
  apanha o `throw` síncrono mas **ignora a promessa devolvida**. A rejeição
  passa agora para o middleware de erro que já existia. Envolver os routers no
  `index.js` não serviria: eles já estão preenchidos quando são importados.
- `scripts/testar-rota-async.mjs` (50 verificações), **5 mutações confirmadas**.

### A assinatura do proxy durava 10 minutos e partia vídeos

Medido: um segmento dava 200 aos 10 minutos e **403 aos 11**. `rewritePlaylist`
assina os segmentos uma única vez, no momento em que a playlist é lida — e um
leitor de VOD não volta a lê-la. Com 10 minutos, um filme de 3 horas partia a
meio e uma pausa de 10 minutos estragava o mesmo.

- Validade de **10 minutos → 12 horas**, com `ts` no futuro limitado a 5 min de
  tolerância (desvio de relógio).
- O segredo vinha de `randomBytes(32)` em cada arranque — e `MEIDA_PROXY_SECRET`
  não estava definido em lado nenhum, pelo que **um reinício invalidava todas as
  URLs assinadas**. Agora deriva de `MEIDA_PROXY_SECRET` ou do `config.jwtSecret`,
  com `update("meida/proxy/hls/v1")` para que um HMAC do proxy nunca sirva para
  forjar um token de login.
- `scripts/testar-validade-assinatura.mjs` (26 verificações), **4 mutações**.

### O proxy devolvia 302 sem `Location`

Com `redirect: "manual"` (posto na 1.5.5 para fechar o SSRF) a cópia de
cabeçalhos só trazia `content-type`, `content-length`, `content-range` e
`accept-ranges` — **a resposta nunca tinha `Location`**. Um 302 sem `Location` é
um beco sem saída.

- `seguirRedirectos()` salta **um de cada vez**, e **cada destino passa por
  `alvoSeguro` antes de ser buscado** — é isso que fecha o SSRF sem fechar o
  vídeo. Limite de 5 saltos (a seguir, 502).
- O URL final passa a ser a base de `rewritePlaylist`: os segmentos de uma
  playlist são quase sempre relativos, e resolvidos contra o URL do pedido davam
  o caminho errado.
- `scripts/testar-proxy-redirect.mjs` (26 verificações), **5 mutações**.

### O filtro de destinos tinha 15 buracos em 30 casos

`localtest.me` e `127.0.0.1.nip.io` devolviam `{"ok":true}` — **um bypass
completo**, porque os hostnames nunca eram resolvidos.

- Os IPv6 literais passavam todos: `url.hostname` traz os parênteses (`[::1]`) e
  `isIP("[::1]")` dá 0, pelo que `if (ip === 4 || ip === 6)` nunca era verdade.
- O CGNAT estava errado nos dois sentidos: `100.(64–79|8\d|9\d|1[0-1]\d|2[0-5]\d)`
  saltava de `119` para `200` — bloqueava `100.200.x.x` (público) e deixava
  passar `100.120.x.x`..`100.127.x.x` (que é CGNAT). Substituído por
  `net.BlockList` com `100.64.0.0/10`.
- Agora há `dns.lookup(host, { all: true })` e **todos** os endereços são
  julgados, com cache de 60 s.
- `/api/anime/megaplay` era um **SSRF cego**: a rota é pública e fazia `fetch` ao
  `url` que o cliente mandasse. Agora `embedUrlValido()` só aceita
  `origin === https://megaplay.buzz` e pathname `/stream/…`, e o resto é 400.
- `scripts/testar-filtro-alvos.mjs` (96 verificações), **7 mutações**.

### `trust proxy` fixo em 1, e o limite de login a contar sucessos

**Medido:** 12 logins **corretos** seguidos davam `10x 200, 2x 429` — partia uma
casa, uma escola, ou quem troca de conta. E 12 tentativas com senha errada, cada
uma com um `X-Forwarded-For` diferente, davam **zero 429** — sem proxy à frente,
`app.set("trust proxy", 1)` faz o `req.ip` ser o que o cliente quiser.

- `TRUST_PROXY` no ambiente, **número de saltos, 0 por omissão**. Só se aceitam
  números: `true`, `false` e listas de sub-redes são ignorados de propósito
  (`true` faz o Express confiar em TUDO).
- O limite do login passou a **contar falhas** (`registarFalhaLogin` /
  `estaBloqueadoLogin`, por ip+utilizador, 10 falhas → 15 min) e subiu para 100
  em 15 min.
- Documentado em `deploy/SERVIDOR-PARTILHADO.md` e `server/.env.example`.
- `scripts/testar-trust-proxy.mjs` (31 verificações), **4 mutações**.

### O ETag do avatar era o comprimento

Dois emojis diferentes têm o mesmo `length` (medido: `emoji:😀` e `emoji:😁` dão
ambos **8**), pelo que o ETag não mudava. O `res.json` do Express trata o
`If-None-Match` sozinho, pelo que o cliente revalidava, levava **304** e ficava
com o avatar antigo indefinidamente.

- O ETag passou a ser o **SHA-1 do valor**, e o `Cache-Control` a
  `public, max-age=300, must-revalidate` (sem `immutable`, que num URL que muda
  adiava a mudança para o dia seguinte). O SHA-1 de um avatar de 4 MB custa ~6 ms
  (medido), por isso há um memo por utilizador.
- `scripts/testar-avatar-etag.mjs` (22 verificações), **4 mutações**.

### O tempo de resposta do login denunciava que contas existiam

**Medido:** com `!row || (await bcrypt.compare(...))`, o `||` faz curto-circuito —
um nome inexistente não tinha nada para comparar e não gastava o bcrypt.
**Mediana de 8: 0,0 ms contra 74,2 ms.** Uma diferença de 74 ms que qualquer
script de enumeração de usernames aproveita sem dificuldade.

- Passa a comparar-se sempre, contra um `HASH_FALSO` quando o utilizador não
  existe: **hash bcrypt válido de custo 10, escrito no código** (gerar um no
  arranque pagaria os ~74 ms de cada `compare`). **Depois: 1,3 ms de diferença.**
- Os ganchos de teste (`__ativarModoTeste`, `__permitirHostsNoTeste`) passaram a
  exigir `NODE_ENV=test` e **atiram** a quem os chama de fora — antes nada
  impedia um import acusinho de os deixar activos num servidor público.
- `scripts/testar-timing-login.mjs` (15 verificações), **5 mutações**.

### Watch Party: limite de tamanho inútil, sem verificação de membro, e navegação para fora da app

Quatro defeitos, medidos contra o servidor real:

- **O limite de 2 KB media `"[object Object]".** O cliente envia sempre objectos
  (`{path}`) e o servidor media `String(data)` — 15 bytes, sem dependência do
  tamanho real. **Medido: `data: {x: "a".repeat(5000)}` devolvia 200.** Agora
  mede-se `Buffer.byteLength(JSON.stringify(data ?? ""))`.
- **Não havia verificação de membro.** `member = { nick, res, ip }` — sem conta
  nenhuma ligada à ligação. **Medido: um utilizador que nunca entrou na sala
  publicou eventos e os outros membros receberam.** O membro passa a guardar
  `userId`, e `/wp/send` exige `membro.userId === req.user.id` (403 caso
  contrário).
- **`/wp/send` não tinha rate limit.** Cada pedido é ecoado por todos os outros
  membros. Agora `rateLimiter(60, 10_000)`.
- **`navigate(payload.data.path)` sem validar nada.** **Medido: `\\evil.com`,
  `//evil.com` e `https://evil.com` passavam todos com 200.** A regra
  `^\/(?![/\\])[^\s\\]{0,300}$` aplica-se **no servidor e no cliente**, antes do
  `navigate`. O `\` é o que importa (CVE-2025-68470): um caminho com barra
  invertida é lido pelo browser como barra normal, e `//host` como
  protocolo-relativo.
- `scripts/testar-watchparty-seguranca.mjs` (39 verificações), **6 mutações**.

### O contador de salas por IP ficava preso até reiniciar o servidor

A sala é registada em `roomsPerIp` com o IP de **quem a cria**, mas o `cleanup`
fazia `decRoomIp(ip, code)` com o IP de **quem saísse por último**. Se não fosse
o criador, o registo do criador nunca saía do mapa — e `roomsPerIp` **não tem
varrimento nenhum** que o reconcilie com `rooms` (o único `setInterval` do
ficheiro é o ping de 20 s do SSE). **Medido: A cria 10 salas e da 11.ª leva 429,
para sempre.**

- Corrigido para `decRoomIp(room.ip, code)`.
- `scripts/testar-wp-ip.mjs` (13 verificações), **3 mutações**.

### O mapa de calor e a racha contavam dias em UTC

`dayOf` vivia **duplicada** (`server/src/stats.js` e
`server/src/routes/achievements.js`), nas duas a fazer
`toISOString().slice(0, 10)` — **UTC**. O heatmap desenha dias **locais**
(`chaveDia` usa `getFullYear/getDate`), e `semanasDoMapa` marca `fora: true` para
`cursor > chave`. Em UTC-3, o que se vê depois das 21:00 cai no dia de **amanhã**
e **desaparece do mapa**.

- O fuso vem do cliente (`?tz=Intl.DateTimeFormat().resolvedOptions().timeZone`),
  e entra em **`/api/stats` E `/api/achievements`** — a racha é a outra ponta da
  mesma coisa. Sem fuso, o servidor fica em UTC, que é o comportamento antigo.
- `dayOf` passou a `server/src/services/dias.js` (novo), uma **fonte de verdade**
  para as duas rotas.
- **`en-CA` foi verificado, não assumido:** é o locale cujo formato curto já é
  `YYYY-MM-DD`. Se um runtime devolvesse `17/10/2026`, as chaves deixavam de
  bater com a `chaveDia` e o mapa desenhava vazio **sem erro nenhum** — por isso
  há uma verificação ao arrancar que cai para `formatToParts`.
- **Medido:** `toLocaleDateString("en-CA", { timeZone })` dentro do `dayOf` custa
  **45,96 µs por chamada** contra 0,98 µs do `toISOString()` — e o `dayOf` corre
  **por linha** (até 15 000 num pedido): 689 ms. Com o formatador **em cache**
  (`format()` em vez de `toLocaleDateString()`): **1,19 µs**, 18 ms.
- `scripts/testar-dias-fuso.mjs` (75 verificações), **10 mutações**.

### A workflow de Pages não arrancava

`.github/workflows/pages.yml` tinha `environment:` sem `name`. O GitHub lê essa
chave como uma **environment do repositório** e um objecto `environment` exige
`name` — sem ele rejeita o ficheiro inteiro, antes de a workflow sequer partir.
Corrigido para `name: github-pages` + `url:`, igual ao workflow oficial.

O gatilho era `push: branches: [gh-pages]`, e **essa branch não existe no
repo** (medido na API: só há `main`) — o caminho automático nunca corria. Pior: a
workflow nunca usava o conteúdo da `gh-pages`, porque o `checkout` traz o código
e o deploy é do artefacto que ela própria compila. Agora dispara em `push` para
`main` filtrado por `paths: ["web/**", ".github/workflows/pages.yml"]`.

## 1.5.6

O ecrã inteiro (que a 1.5.5 partiu), o idioma dos títulos, e um auditor de
traduções que estava a dizer "nada por traduzir" com metade do `web/src` por
auditar.

### O `setPermissionRequestHandler` devolvia valores em vez de chamar o `callback`

Diagnóstico do utilizador, confirmado no código: no Electron o handler de
pedidos de permissão recebe `(webContents, permission, callback, details)` e a
decisão dá-se com `callback(true)`/`callback(false)`. **O valor de retorno é
ignorado.** O código fazia `return true`/`return false` e nunca chamava o
`callback`, pelo que **todos os pedidos de permissão ficavam pendentes para
sempre** — sem erro, sem aviso, e com `requestFullscreen()` sem resolver nem
rejeitar.

- Afectava o botão `.app-fs-btn` (`AppFullscreen.jsx`), o `FullscreenButton`, o
  `PlayerControls`, o atalho `F` do `usePlayerShortcuts`, o fullscreen dos
  iframes dos players e o `navigator.clipboard.writeText()` da Watch Party.
- Corrigido com `PERMISSOES_OK = new Set(["fullscreen", "clipboard-sanitized-write"])`
  + `callback(ok)`. O `setPermissionCheckHandler` (a pergunta síncrona) mantém o
  `return ok` e permite `automatic-fullscreen` só à origem da app — é o `check`
  que o Chromium faz e o `request` que é o `fullscreen`.
- `web/src/components/ecraInteiro.js` (novo) devolve `{ok, erro}` e escreve o
  motivo na consola quando o pedido é recusado, com `MEIDA_FS_DEBUG=1` a dizer
  cada pedido e cada consulta.
- `scripts/testar-ecra-inteiro.mjs` (38 verificações). Não entra no `npm test`:
  precisa de um ecrã.

### O idioma dos títulos não seguia o idioma da interface

`DEFAULT_SETTINGS.titleLang` era `"en"`. A interface e o título são **duas
definições** e só a segunda mandava no catálogo — quem punha a interface em
português via os títulos em inglês e não tinha onde descobrir que havia outra
definição.

- O omissão passou a `"auto"`, resolvido **no cliente** (`titleLangEfetivo`): o
  servidor não sabe o idioma da interface de ninguém, e `"auto"` caía no
  fallback dele, que é `en-US`.
- O título gravado é o título no momento em que o título foi visto: `library`,
  `progress` e `list_items` guardam essa string e mudar o idioma não a reescreve.
  `GET /api/library` já localizava — e é isso que fazia a biblioteca parecer
  funcionar. Agora `localizarTitulos`/`preencherTitulosLocalizados`
  (`services/tmdb.js`) são usados pelas **cinco** rotas que devolvem itens
  guardados: `/library`, `/lists/:id`, `/progress`, `/users/:username/library`,
  `/users/:username/lists/:id`.
- `t.idioma` foi acrescentado às dependências do `useEffect` que carrega o
  catálogo em `Home`, `Search`, `Category` (×2) e `Details`. Sem isso, mudar o
  idioma não recarrega nada — e o teste tem de apanhar **as cinco**, porque o
  defeito do "só a biblioteca localiza" é precisamente o que faz as outras
  parecerem ter outra causa.
- `pMap` (concorrência limitada) foi de `routes/library.js` para `services/net.js`:
  o `tmdb.js` precisa dele e **as rotas não se importam entre si**.
- Migração `aplicarMigracoes()` com a marca `streamapp_migrou_titlang`: `"en"`
  guardado passa a `"auto"` uma vez só. Sem a marca, quem escolhesse inglês a
  propósito via-se a "auto" a cada arranque.
- `scripts/testar-idioma-titulos.mjs` (68 verificações, 5 mutações confirmadas).

### O auditor de traduções estava cego para metade do `web/src`

O `auditar-pt-por-traduzir.cjs` respondia "nenhum texto por traduzir" — **estava
a mentir, e sem dar erro nenhum**. Duas falhas encadeadas no mesmo sítio:

- `semComentarios` não sabia o que era uma string. O `//` de
  `href="https://real-debrid.com/apitoken"` é o início de um URL, não um
  comentário: o `//` apagava o resto da linha **com a aspa de fecho da string**,
  a string ficava aberta e `fimDaChamada` corria até ao fim do ficheiro — em
  silêncio. Em `Settings.jsx` começava na linha 438 e deixava **as 1207 linhas
  seguintes (73% do ficheiro) por auditar**; em todo o `web/src`, 477 linhas.
- O mesmo com uma **regex**: `return /[",\n\r]/.test(s)` tem uma aspa dentro, e
  sem reconhecer regex essa aspa abre uma string fantasma que copia texto em vez
  de o apagar — o que faz um `//` de comentário deixar de ser apagado.
- `fimDaChamada`: o guarda `if (chaves === 0)` ignorava o `)` de chamadas feitas
  *dentro* do objecto de valores mas contava o `(` correspondente, inflando o
  `nivel` para sempre. Agora o `nivel` desce sempre e o guarda só decide se
  aquele `)` fecha a chamada.
- Saiu de lá: `Esconder`/`Mostrar`, `Português`/`Inglês` (×4 cada), `Desligadas`,
  `momento`, `Comentar`, `Romaji`, `Letterboxd`. E três regras novas: unidade CSS
  (`184px`) não é texto, nomes próprios via `t()` com identidade, e o marcador
  `// i18n` passa a valer na linha de cima (entre atributos de JSX é onde pode
  estar, porque `className={...}` não aceita um `//` no fim da linha).
- `scripts/testar-auditor-i18n.mjs`: 9 mutações, 27 verificações. As fixtures
  têm texto por traduzir **depois** do URL e um comentário **depois** da regex —
  uma fixture única passaria como se tivesse apanhado a mutação.

## 1.5.5

Sete buracos de segurança fechados no servidor, a lista de episódios de anime
arrumada (eram dois bugs encadeados, nenhum deles com erro no log), e a
publicação da app passou a verificar-se sozinha.

### R1 — O proxy de vídeo era um proxy aberto

`/api/proxy?url=...` encaminhava qualquer endereço que lhe dessem. Não exigia
nada, não tinha limite, e seguia redireções. Na prática dava para usar a máquina
de quem corre a app para chegar a `127.0.0.1`, à rede local e aos endereços
internos da cloud onde a app está a correr.

- `buildProxyUrl` assina o alvo com **HMAC-SHA256** e junta `ts`; a assinatura
  expira a 10 minutos. `handleProxy` recusa (403) o que não vier assinado.
- `alvoSeguro()` bloqueia loopback, privados e link-local, em v4 e v6 — incluindo
  a forma mapeada `::ffff:`.
- `redirect: "manual"`: o alvo final é verificado, não o que veio no pedido.

`scripts/testar-proxy-seguranca.mjs` (13 verificações).

### R2 — `/api/subtitles/vtt` aberto

O mesmo problema nas legendas: qualquer pessoa podia pedir o `.vtt` de qualquer
endereço. Passou a usar `buildSubtitleVttUrl`/`assinaturaValida` (exportados de
`proxy.js`), os dois sítios de `play.js` (hianime e stream) passaram a assinar, e
a rota valida assinatura + `alvoSeguro` + limite de 2 MB (413).
`scripts/testar-subtitles-seguranca.mjs` (5).

### R3 — O portal de torrents era público

Qualquer pessoa podia mandar um magnet à vontade e ver o que os outros estavam a
ver. `addTorrent` passou a recusar (`TORRENT_DESCONHECIDO` / `INFOHASH_INVALIDO`)
o que não esteja em `magnetConhecido`, com cache de 2000 entradas em FIFO;
`GET /torrents`, `GET /stream/active` e `DELETE /stream/:infoHash` levam
`requireAuth`. `GET /stream/:infoHash` fica sem login de propósito: é o `<video
src>`, que não leva cabeçalho — parar aí partia a reprodução.
`VideoPlayer.jsx` usa `api.stopTorrent()` (que manda `Authorization`) e só chama
`onRemoved()` no `.then()`. `scripts/testar-stream-portao.mjs` (41).

### R4 — A autenticação não tinha nada que a travasse

`FALHAS_MAX` de 5 para **10** em 15 minutos, `rateLimiter(10, 15min)` no login e
`rateLimiter(10, 1h)` no registo, rotas de auth assíncronas, bcrypt awaited,
palavra-passe 8–72 e username `^[A-Za-z0-9_]{3,20}$`, `trust proxy` ligado,
`express.json({limit:"100kb"})` geral e 4 MB nas duas rotas que o precisam
(`/auth/profile` e `/export/import`), e comparação do token de admin com
`timingSafeEqual`. `testar-auth-seguranca.mjs` (6) e `testar-rate-limit.mjs`
reescrito (36 — antes esperava 15 min e 1 h por caso).

### R5 — As Photographs de perfil vinham repetidas

Cada pessoa numa lista mandava a sua fotografia dentro do JSON. `normalizeAvatar`
rejeita data URLs acima de 300 000 caracteres (~200 KB), deixou de haver `avatar`
inline em `toUserCard`/`toApiComment`/`toApiNotification`, e passou a existir
`GET /api/users/:id/avatar` (com `ETag` e cache de 1 dia). O `Avatar.jsx` aceita
`userId` e busca por lá. `testar-avatar-listas.mjs` (12 — 20 comentários agora
dão menos de 100 KB).

### R6 — Qualquer pessoa criava salas de watch party

`ROOM_CODE_RE = /^[A-Z0-9]{6,12}$/`, 500 salas no máximo, 10 por IP, 20 pessoas
por sala, 2 KB por mensagem, e só os tipos de evento que fazem sentido.
`/wp/send` exige `Bearer`; `/wp/stream` exige `?token=`. No cliente,
`makeCode()` passou a usar `crypto.getRandomValues` (8 caracteres).
`testar-watchparty-seguranca.mjs` (10).

### R7 — O Electron não estava endurecido

`sandbox: true`, `nodeIntegration: false`, `webSecurity: true` e
`contextIsolation: true`; `will-navigate` e `will-redirect` bloqueiam o que não for
origem da app e abrem no browser de fora; `setPermissionRequestHandler` só aceita
`fullscreen`; e os handlers de IPC passaram a validar `isTrustedSender`
(`open-external`, `app-version`, `check-update`, `get-server-config`).

### Animes sem episódios — "Temporada 1 (0 eps)"

Sintoma: o *Zan Sayonara Zetsubou Sensei* (2009) e outros apareciam com uma
temporada e zero episódios, sem erro no log nenhum. Eram **dois** bugs:

1. **O espelho Tenrai não devolve o número do episódio.** O Tenrai passou a ser o
   primário a 1-out-2026 e responde a `/anime/{id}/episodes` só com `title` e
   `aired` — sem `episode` e sem `mal_id`. O filtro era
   `(e.episode ?? e.mal_id) != null`: com os dois a `undefined`, o `??` dava
   `undefined` e o `!= null` era falso para **todas** as linhas, em qualquer anime.
   `normalizarEpisodios()` usa agora a posição na lista quando não há número (a
   API devolve por ordem, portanto a posição é o número).
2. **A lista vazia não caía para o outro site.** Para alguns títulos o Tenrai
   devolve **HTTP 200 com `data: []`** (base incompleta) e, como não houve erro de
   rede nem de HTTP, o `jikanFetch` não tentava o Jikan oficial. Passa a tentar.

E, quando mesmo assim a lista não vem, o número sabe-se na mesma: o `/anime/{id}`
devolve `episodes: 13` para o 6377 e o espelho preenche esse campo sempre. Os
números são sintetizados com `episodiosPorNumero` — só o número interessa, porque
os providers resolvem o episódio pelo número e não pelo título.

**O contra, que é o que torna isto difícil de apanhar:**
`groupEpisodesBySeason([])` devolve **uma** temporada vazia, nunca `[]`. O
`Details.jsx` caía no seu fallback com `if (!seasons.length)`, que nunca era
verdade — o fallback existia e estava certo, mas estava morto. Passa a ser
`seasons.some(s => s.episodes.length)`.

Medido contra a API, depois: 2605 → 12 eps, **6377 → 13 eps**, 3228 → 13,
Cowboy Bebop → 26, One Piece → 1180, Hunter x Hunter → 148 (todos a bater certo
com o declarado, sem truncamento). `scripts/testar-episodios-anime.mjs` (32
verificações, 4 mutações confirmadas a falhar com linha de resumo).

### Fonte lembrada por tipo

`lastSource` guarda a fonte escolhida **por tipo de título** (anime/filme/série),
não por episódio — guardar por episódio era tautológico, porque o episódio já
está a ser visto. O `playerIndex` tem de andar com o `active`, senão o botão
fica marcado na fonte certa e o vídeo arranca noutra. `testar-fonte-lembrada.mjs`
(41).

### Health-check do nativo separado do iframe

`probeNativo` é uma função à parte, com os seus próprios nomes: o nativo e o
iframe do mesmo provider deixam de aparecer como duas fontes iguais.
`testar-health-nativo.mjs` (31).

### `app:publish` que se cura sozinho

Já falhou quatro vezes (1.2.0, 1.2.1, 1.2.2 e 1.3.2), sempre com `422` ao criar a
release — e a release ficava **publicada e pela metade**, sem dar erro útil.
`scripts/publicar.cjs` faz a cadeia inteira: `electron-builder` → se falhar,
`fix-latest.cjs` (que é idempotente) → `prune-releases` → `verificar-release`,
que confirma os 3 assets e que o `latest.yml` público devolve a versão certa com
o `sha512` a bater com o do instalador assinado. O `fix-latest.cjs` usa `fetch`
e não `curl`: o `System32` não está no PATH que o processo Node vê, e o
`execFileSync("curl")` dava `ENOENT` depois de já ter publicado os assets.

### Também

- `scripts/verificar-cjk.mjs` — verificador de caracteres chineses, reutilizável.
- Teste de contraste do `--accent-text`.
- `testar-rate-limit.mjs` reescrito para não esperar 15 minutos por caso.

## 1.5.4

A app deixa de esconder-se atrás de um ecrã de espera, e traz os primeiros 60
segundos depois de criar a conta.

### O ecrã de arranque foi embora

**Sintoma.** A app de desktop abria sempre com "o servidor de dados está a acordar",
~40 s de cada vez, com o servidor acordado. Quem ia ver que estava vivo e não
percebia porque é que a app insistia.

**O que media, antes de mexer.** Com a app real a correr (Electron com
`--remote-debugging-port`, a perguntar ao renderer):

| Onde | Tempo | Ecrã |
| --- | --- | --- |
| fadehost acordado, renderer real | 175 ms | não aparece |
| pedido a frio, processos novos | 150–340 ms | — |
| `/api/health` do servidor local | 19 ms | — |

Ou seja: com o servidor acordado nunca aparecia. Ficam excluídos, com evidência: o
adblock (a função `adHostFor` real, 55 entradas, `fadehost` passa), o CORS (`*`
nas duas origens), o Private Network Access (preflight 204, e o renderer em
`127.0.0.1` fez-o em 175 ms) e o URL inválido que prendeu a app na 1.5.0
(corrigido na 1.5.1).

**Duas causas.**

1. **O `fetch` do health não tinha tempo limite.** Um pedido pendurado — a ligação
   é aceite mas a resposta não vem: IPv6 sem rota, VPN, portal cativo — **não entra
   no `.then()` nem no `.catch()`**. Como a repetição só estava no `.catch()`, um
   pedido pendurado significava *zero* novas tentativas: o ecrã ficava preso para
   sempre a dizer que o servidor dormia, e o servidor não tinha nada a ver. Os 40 s
   que a pessoa media são a assinatura disso: o primeiro pedido não falhou logo,
   ficou pendurado, e a repetição seguinte resolveu.

2. **A tapava a aplicação inteira.** A interface já estava carregada — o servidor
   local tinha servido a página. O que não estava era *um pedido de dados*, e isso
   tem o seu próprio estado de carregamento e o seu próprio erro, com a mensagem
   verdadeira.

**A correcção é estrutural, não uma margem maior.** O `<App/>` passou a ser montado
directamente em `main.jsx`: não há nada a esperar por um pedido de dados. Isto mata
o sintoma independentemente da causa, o que é o que interessa quando a causa não
está verificada.

Foi com o código morto à mistura: `healthDados`, `fetchComTempo`, `TEMPO_HEALTH` e
os 7 textos do ecrã nas traduções deixaram de ter consumidor e foram embora.

**Fica o ecrã estático do `index.html`.** Diz "a app está a arrancar" e sai quando o
JS monta (~1 s) — é verdade, e é o que evita o ecrã preto. O outro esperava por um
pedido de dados, que é outra coisa.

**Medido depois**, com o servidor de dados apontado para um endereço inalcançável
(`192.0.2.1`, TEST-NET-1): interface em **630 ms**, com conteúdo. Com o fadehost
real: **504 ms**, 600 cartazes, sem erros na consola. Não há ecrã preto a substituir.

### Os primeiros 60 segundos (`web/src/components/onboarding.js`)

Folha de 4 passos para quem cria a conta: importar, géneros, cor, pronto.

**Mostra-se a quem está vazio, não a quem se registou há pouco** (`count === 0`, com
`null` = ainda a carregar). `null === 0` é falso, e é isso que evita importar por
cima de quem já tem 300 títulos.

**Uma porta de importação só é oferecida se for capaz de importar.** O único CSV
aceite é o exportado pela MEIDA — o `toLibraryEntry()` lê `o.tmdbId`; a Letterboxd
dá `Date, Name, Year`. MAL e AniList exigem as *duas* metades: servidor configurado
*e* conta ligada.

**A porta em primeiro é a mais barata** (Letterboxd: escreve-se um username), não a
mais popular.

**Géneros guardam-se como `{ id, name }`** e o `Home` extrai o `id` — o `/api/discover`
exige IDs (`?genres=Terror` devolve 0 itens; `?genres=27` devolve 20). Nomes passam
sem erro e devolvem lista vazia: o pior tipo de bug.

É uma **folha de lado, não um modal** (`aria-modal="false"`), montada **fora** do
`ErrorBoundary` — quem cria a conta tem de poder ver um erro de rede. A cor
aplica-se ao clicar, não no fim.

### Barra de navegação em baixo no telefone (`web/src/components/navBaixo.js`)

5 separadores + folha "mais".

Os dois limites (esconder os botões fixos / mostrar a barra) são **o mesmo número**,
720, e de propósito: limites diferentes deixavam uma faixa de 20 px com a barra em
baixo *e* os botões por cima.

Medido num iframe de 375 px (o mais comum é 365): a pílula de cima tem 395 px, o
"Início" ficava a x = −8 (cortado) e os quatro botões fixos (`z-index: 70`) estavam
em cima dela (`z-index: 60`) — tocar no sino respondia o botão de ecrã inteiro.

### `scripts/verificar-release.mjs`

Prova a release a sério em vez de acreditar no código de saída: os 3 assets, o
`latest.yml` público com o `sha512` a bater com o do instalador assinado, e o
cabeçalho PE do `.exe`.

## 1.5.3

Quatro funcionalidades novas e três correcções. Cada uma com teste, e os
testes verificados por mutação.

### A data em que viste (migração 9)

O pedido era uma vista por data de visionamento, e **não havia histórico
nenhum**. A `library` só tinha `updated_at`, que é a última vez que tocaste na
linha: dar nota, mudar o estado ou reordenar a lista escreve nela. E o
`progress` tem **uma linha por título, não por episódio** — `patchProgress`
reescreve, e ao avançar um episódio `finishedAt` passa a ser a data de agora.
Ou seja, "quando viste o último episódio", não uma história.

A migração 9 acrescenta `library.watched_at`, gravada quando `watched` passa
a 1.

**Não se preenche com `updated_at`.** Seria dar a data do último toque a tudo o
que já estava visto, e a timeline apareceria com meses e anos errados sem
ninguém ter como saber. `NULL` significa "não se sabe", e a interface diz isso.

A regra de escrita tem três casos, e o do meio é o que a torna útil:

```sql
watched_at = CASE
  WHEN excluded.watched = 0 THEN NULL                -- reverteu: apaga
  WHEN library.watched = 0 THEN excluded.updated_at  -- marcou agora
  ELSE library.watched_at                           -- ja estava visto: fica
END
```

O terceiro caso é o erro fácil: um `COALESCE` simples trataria "marcar como
visto" e "dar nota a um filme visto" do mesmo jeito, e a segunda escreveria
`NULL` por cima, apagando a data.

`upsertLibrarySafe` (o caminho do import) tem regras **diferentes**, e é por
isso que são funções separadas: um import não é "marcar como visto agora", é
restaurar o que o ficheiro gravou. Aplicar-lhe a regra da transição punha
`watched_at` na data do import para tudo o que o ficheiro trouxesse sem data —
ou seja, fabricava meses e anos.

A timeline (`web/src/components/timeline.js`, `Timeline.jsx`) **nunca usa o
`updatedAt` como data de visionamento**. Quem não tem `watchedAt` vai para um
grupo "sem data" no fim, separado e sem ponto na linha — dar-lhe um ponto
faria a pessoa contar como se fosse um mês.

Testes: `testar-timeline.mjs` (75 verificações, 10 mutações) e
`testar-timeline-fim.mjs` (19), que arranca o servidor a sério — os três casos
da regra de escrita só existem quando o SQL corre.

### Metas e desafios em `/achievements`

Uma meta com anel de progresso, com o alvo escolhido pela pessoa
(10/25/50/100/200/365) guardado na coluna `users.meta` (migração 8). E um
desafio de ver um filme de cada década desde 1930.

**A meta conta o que MARCASTE COMO VISTO neste ano, não o que viste**, e todos
os textos dizem "marcaste" — a mesma limitação da `watched_at`. Filmes que
puseste na watchlist não contam (`watched = 0`), e é isso que impede o número
de ser generoso. A limitação está escrita em `server/src/metas.js`.

**O ano é do cliente.** O servidor manda três anos de contagem em UTC e o
cliente escolhe o dele com o relógio de casa, porque o Render e o FadeHost
estão em UTC e as 00:30 de 1 de Janeiro a meta reiniciava na hora errada.

Grava-se com **PATCH**, não PUT — é o verbo que o `patch_` de `api/client.js`
manda, e o `updateProfile` já fazia o mesmo. Com PUT o servidor respondia 404,
o `handle()` do cliente rebentava e a secção das metas desaparecia sem dizer
nada. Há teste a comparar o verbo HTTP entre os dois ficheiros.

O `/api/stats` devolve `filmesPorAno` e `topDoAno` para o cartão de partilha.
`statsFor` lê a biblioteca com `SELECT *`, logo as linhas são cruas
(`media_type`, `updated_at`); as funções de `metas.js` esperam a forma de
`listLibrary` (`type`, `updatedAt`). **Sem o `toApi` a contar dava zero, sem
erro nenhum** — foi o bug mais discreto da sessão, e nenhum teste puro o
apanhava porque nenhum executa SQL.

Testes: `testar-metas.mjs` (86 verificações, 14 mutações) e `testar-cartao-fim.mjs`.

### Cartão de partilha em imagem

Um cartão do teu ano no fim de `/stats`, desenhado num `<canvas>` e guardado
como `meida-<ano>.png`.

A ideia original em `IDEIAS.md` trazia três ressalvas que a medição desmentiu:

- **"Ver o que a secção do CSS diz dos gráficos"** — essa secção não existe.
- **"Sai com a fonte do sistema"** — a app usa web fonts (Manrope e Archivo,
  do Google Fonts). O perigo existe mas é outro: havia pesos `unloaded` no
  `document.fonts`, e o canvas **cai para a fonte do sistema em silêncio** se
  se desenhar antes de o peso estar carregado. `carregaFontes()` pede cada peso
  pelo nome, em vez de se fiar em `fonts.ready`.
- **"Sem retina"** — falso: este ecrã tem `devicePixelRatio` 1,25 e um canvas de
  1080 sairia a 81%. São duas linhas, e o dpr é limitado a 3 por causa da memória.
- **"Gerar fora do browser"** — falso, e era o caminho errado: a app é Electron
  **e** site, e o canvas corre igual nos dois.

O que a ideia não mencionava e rebenta tudo: um `drawImage` de host sem CORS
deixa o canvas "tainted" e o `toBlob()` lança `SecurityError`. O CDN do TMDB e
o do MAL mandam `access-control-allow-origin: *`, mas só se pedir a imagem com
`crossOrigin="anonymous"` **antes** do `src`.

Os números do cartão são todos deste ano e os cartazes são só filmes, para
baterem certo com o número de cima. Mostrar um cartaz de série ao lado de uma
contagem que não inclui séries é contar uma coisa e mostrar outra.

Testes: `testar-cartao.mjs` (86 verificações, 15 mutações) e
`testar-cartao-fim.mjs` (18, com o servidor a arrancar).

### A barra de pesquisa volta ao normal

Depois de escrever, a barra fecha e o menu mostra os botões. **O texto fica**:
tocar outra vez na pesquisa abre com o que se escreveu, para corrigir.

O `onBlur` antigo só fechava com o campo vazio, e a decisão passou para
`headerPesquisa.js` — pura e testada. O `relatedTarget` é o que separa "a
pessoa foi-se embora" de "tocou no botão da própria pesquisa"; sem ele, tocar
no ícone com o campo em foco dispara `blur` (fecha) e logo `click` (abre), e a
barra oscila no mesmo toque.

Faltava também largar o foco ao fechar: o input encolhe para 0 px mas continua
no DOM, e no telefone o teclado ficava aberto a escrever para um campo
invisível.

Testes: `testar-pesquisa.mjs` (43 verificações, 8 mutações).

### Dois gráficos novos e os rótulos do eixo

Em `/stats`: **de que décadas** são os teus filmes (a API já devolvia `decadas`
desde sempre e nada o desenhava) e **a que horas** mexes. A hora vem do
`updated_at` em UTC, com o cliente a rodar o histograma para o fuso de quem
vê — rodar um histograma é exacto e custa 24 números em vez de milhares de
datas.

Corrigido de passagem um bug antigo nos rótulos do eixo: a regra era
`i === 0 || i % 2 === 1`, que dá os índices 0, 1, 3, 5 — dois rótulos colados no
início ("Jan Fev Abr Jun") e um salto. Passou a `i % 2 === 0`, e a regra saiu do
JSX para `indicesRotulados()`, em `serieStats.js`, porque escrita dentro do
`.map()` não era alcançável por teste nenhum.

---

## 1.5.2

### O fundo escolhido nas Definições não aparecia

Regressão introduzida na **1.4.9**, com o bloco `<style>` do ecrã de arranque em
`web/index.html`:

```css
html, body { margin: 0; padding: 0; background: #070708; color: #fff; }
```

O fundo da app (imagem, glow, aurora, mesh, pontos, grelha) vive num
pseudo-elemento:

```css
body::before { position: fixed; inset: 0; z-index: -1; }
```

Um pseudo-elemento com `z-index: -1` pinta-se **por trás** das caixas do
documento. Com `background: #070708` opaco no `body`, essa cor tapava o
pseudo-elemento inteiro — e **todas** as opções de fundo deixavam de se ver,
não só a imagem. O `html` continua opaco (é o que evita o flash branco antes de
o `styles.css` carregar); o `body` passa a `transparent`.

Confirmado no browser com `getComputedStyle(body).backgroundColor`: antes
`rgb(7, 7, 8)`, depois `rgba(0, 0, 0, 0)`, com a camada `::before` com conteúdo
nos cinco estilos.

`scripts/testar-fundo.mjs` (16 verificações, ligado ao `npm test`) apanha o
regresso, e foi verificado por mutação: reposta a regra errada dá
`15 ok, 1 falha(s)` (exit 1); restaurada dá `16 ok, 0 falha(s)` (exit 0).

## 1.5.1

### Corrigido: o ecra de arranque ficava no ecra e a app nao abria
- **Isto era um bug meu** (tinha entrado na 1.4.9 e na 1.5.0, e ja vinha da 1.4.8
  do laptop). Pior do que o ecra preto que ia resolver: a app ficava presa no
  ecra de arranque.
- **Causa**: `api.healthDados()` construia um URL **absoluto**
  (`https://.../api/health`) e passava-o a `get()`. Mas `get()` faz
  `baseFor(path) + path`, e o `baseFor` so' desvia para o servidor remoto
  quando o path comeca por `/api/`. Com um URL absoluto nao desvia, e o
  resultado era:
  ```
  http://127.0.0.1:5197https://meida.fadehost.app/api/health   -> Invalid URL
  ```
  O pedido falhava sempre, o gate repetia de 4 em 4 segundos, e o ecra nunca
  saia. Confirmado: `new URL()` do URL antigo da `Invalid URL`; o novo da
  `https://meida.fadehost.app/api/health` e' valido e responde 200.
- **Correccao**: `healthDados()` deixa de passar por `get()` e faz `fetch()`
  direto ao URL absoluto. Sem a base para prepor, nao ha como dar a volta.
- **Rede de seguranca (esta e' a parte que importa)**: o `BootScreen` tem um
  **periodo de graca de 3,5 s**. Quem tem o servidor local (ou o
  partilhado acordado) **nao ve o ecra nenhum** — a app aparece logo. So' quem
  esta mesmo a espera e' que o ve, que e' a raza de ser dele. Antes, qualquer
  falha no `healthDados()` deixava a app presa; agora ela aparece na mesma ao
  fim de uns segundos e sao os pedidos de dados que mostram o erro.
- Isto afecta a **app de desktop tambem** (que usa o mesmo `BootScreen`), e nao
  so' a versao web.

### investigated: a imagem de fundo
- Testado a serio, dentro do Electron, com a imagem nas DEFINICOES (nao
  aplicada a mao, porque o `SettingsContext` re-aplica as suas e apaga o que o
  teste acabara de meter — foi esse o erro de dois testes meus seguidos).
- A camada e' `body::before` com `position: fixed; inset: 0` e mede o ecra todo
  (1280x800 numa janela de 1280x800), e **nada a tapa**. O screenshot do
  utilizador, com a imagem aparece so numa faixa e e' cortada, nao se reproduz
  com a app a serio.
- **Fica registado como tao**: nao foi possivel reproduzir aqui, e a app no PC
  de desenvolvimento mostra o fundo por inteiro. A proxima passagem e pela conta
  de quem viu: as Definicoes mostram a pre-visualizao (a imagem esta guardada), e
  o `body::before` esta a ser medido certo. Falta o passo do meio — se o que
  tapa e' `html`/`body` com `background` opaco, e' um elemento especifico.

## 1.5.0

### Corrigido: as novidades da 1.4.9 estavam so' em portugues
- A release **1.4.9 ja foi publicada**; esta e' a mesma mais a versao em ingles
  do changelog (e nada mais mudou).
- O `ChangelogModal.jsx:27` escolhe com
  `t.idioma === "pt" ? entry.items : entry.items_en`. A entrada da 1.4.9 foi
  escrita so' com `items`, portanto **quem tem a app em ingles via o texto em
  portugues** nessa versao.
- Acrescentado o `items_en`. E acrescentada a verificacao que faltava em
  `scripts/testar-i18n.mjs`: as **3 entradas mais recentes** tem de ter as duas
  linguas, e o **numero de itens tem de ser igual** nos dois (um item em portugues
  que fique de fora em ingles aparece a meio da lista, que e' pior do que nao
  aparecer).
- **A regra nao e' "todas as entradas"**: a i18n so' chegou na 1.4.x, e as 72
  entradas antigas (desde a 0.4.0) nao tem `items_en` — o modal cai de volta no
  portugues de proposito (`|| entry?.items`). Traduzir 70 notas antigas nao vale
  o esforço; o que nao pode voltar a acontecer e' uma release nova sair so' em
  portugues.
- Testado por mutacao: removendo o `items_en` da 1.4.9 o teste falha com
  `-> 1.4.9`, e volta a passar com ele la.

### O ecra de arranque: a versao web nao fica mais preta a espera do servidor
- **Sintoma**: ao abrir `meida.onrender.com` com o servidor adormecido, o ecra
  ficava **preto, sem nada**, durante 30-50 s. Era lido como "a app esta
  partida".
- **Causa raiz** (`web/src/main.jsx`): o React so era montado **depois** de
  `loadRuntimeConfig()`, e essa funcao faz `fetch("/runtime-config.json")`. No
  Render esse e' o primeiro pedido e e' o que acorda o servico. Nesse intervalo
  o `#root` esta vazio e so se ve `html { background-color: var(--bg-dark) }`
  = `#070708`, ou seja preto. E o mesmo acontecia a seguir, a espera do
  servidor de **dados** (FadeHost), que hiberna tambem.
- **Esta correccao ja estava na 1.4.8 publicada e nunca chegou ao repositorio.**
  A tag `v1.4.8` aponta para a commit da 1.4.7 e tanto o `package.json` como as
  duas changelogs em `main` paravam na 1.4.7: a release foi feita de um bump
  local que nao foi committado. Como o Render faz deploy do repositorio, o ecra
  nunca chegou a ser publicado. Foi daqui que se tirou o codigo — do bundle
  minificado da release, ja que o fonte nao existe em lado nenhum.
- **O que foi recriado**:
  1. `web/index.html` — ecra **estatico** (`#boot`) que aparece no instante em
     que o HTML chega, sem esperar por um byte de JavaScript. O CSS vai em
     linha de proposito: uma folha de estilos externa seria mais um pedido a
     esperar, que e' precisamente o que se quer tapar. A imagem tambem nao
     entra (um `logo.png` por carregar seria mais um pedido a falhar).
  2. `web/src/components/BootScreen.jsx` — o gate do React: insiste no
     `/api/health` do servidor de dados e vai mudando a mensagem conforme passa
     o tempo (0 s, 6 s, 25 s, 55 s), com contador. Limite de 90 s, para nunca
     ser um ecra preto eterno.
  3. `main.jsx` — remove o `#boot` estatico e envolve a `<App/>` no gate.
  4. `web/src/api/client.js` — `healthDados()`, que pede o health ao servidor
     de dados (e nao ao local, que e' o `health` que ja existia).
  5. `styles.css` e `traducoes.js` (pt/en).
- **Provado com fotografias**, nao com palavras: um servidor local que atrasa 9 s
  em `/runtime-config.json` e `/api/health`, dentro do Electron. Antes dava
  preto; agora o estatico entra logo e depois o gate com mensagem e contador.
- **Um ajuste ao codigo original**: a `.boot-msg` tinha
  `animation: boot-entra .35s ease both`. O `fill-mode: both` deixa o elemento no
  estado inicial (`opacity: 0`) enquanto a animacao nao corre, e um teste com a
  janela escondida provou exatamente isso — mensagem invisivel. Como essa
  mensagem e' o unico feedback que o utilizador tem, ficou sem `both`: sem
  animacao, mostra-se na mesma.
- **Os dois ecras sao diferentes de proposito**: o estatico diz "a app esta a
  arrancar", o do React diz "o servidor de dados esta a acordar" (que demora
  muito mais e precisa de contador). O `main.jsx` tira o primeiro antes de
  montar o segundo, senao ficavam os dois no ecra (e o estatico, com
  `z-index: 9999`, tapava o outro).

### Corrigido: as Definições perdiam-se em silencio
- `settingsStore.get()` fazia `catch { return padroes }`: uma preferencia
  corrompida repunha **tudo** — imagem de fundo, accent, legendas — sem um
  aviso nenhum. O sintoma do utilizador era um ecra preto (sem imagem fica so a
  cor escura) e nenhuma pista de porque. Pior: o `update()` seguinte gravava os
  valores por omissao por cima, selando a perda.
- `settingsStore.set()` nao tinha `try`/`catch` e era chamado **dentro** do
  actualizador do `setSettings`. Se o `localStorage` recusasse (limite de ~5 MB,
  facil de bater com uma imagem grande), a exceccao subia como erro de render
  em vez de "nao guardei" — o utilizador via a mudanca no ecra e achava que
  estava guardada.
- Agora: guarda uma copia em `streamapp_settings_aviso` e escreve na consola; o
  `set()` devolve `false` e as Definicoes mostram o aviso; e quando o estilo de
  fundo e' "Imagem" mas nao ha imagem, aparece a explicacao.

### `npm test` passou a correr inteiro (estava a falhar antes de nada disto)
- **Tres testes com o caminho absoluto do laptop** (`file:///C:/Users/white/
  Documents/Meida/...`) em `testar-estados`, `testar-notificacoes` e
  `testar-tempo`: rebentavam com `ERR_MODULE_NOT_FOUND` **antes de correr uma
  verificacao**. Agora o caminho e' calculado a partir do ficheiro.
- **Tres testes que renderizavam em ingles**: o i18n escolhe pelo
  `navigator.language`, e o do Node e' `en-US`. `testar-comentarios-render` e
  `testar-grafico-mensal` procuravam os textos em portugues e falhavam; o
  `testar-tempo` esperava "59 seg atras" e recebia "59 seg ago". Fixam o
  idioma em `localStorage`.
- **Tres testes de mutacao que acusavam "o codigo mudou" sem o codigo ter
  mudado** (`testar-megaplay`, `testar-pular-intro`, `testar-legendas`): os
  blocos de texto das mutacoes estao escritos com `\n` e os ficheiros estao em
  **CRLF**, por isso `includes` nunca encontrava. Normaliza-se antes de
  procurar. E' um bug de portabilidade que so aparece no Windows — e um teste
  que nunca chega a mutar parece estar a proteger o codigo quando nao protege.

### Notas
- A release 1.4.8 esta publicada mas o seu codigo nunca foi committado (ver
  acima). Por isso a proxima versao e' **1.4.9** e nao 1.4.8: confirmar sempre
  a release mais recente no GitHub antes de bumpar, porque o `package.json`
  mente.

## 1.4.7

A barra de controlos do player passa a ser nossa, a qualidade entra nela, e o
proxy deixa de mentir sobre os 404.

### Barra de controlos própria (`PlayerControls.jsx`)

O `<video>` ficou **sem `controls`** nos dois players próprios (`HlsPlayer` e
`VideoPlayer`). A barra que o browser desenha não é DOM: não tem posição que se
possa ler, e não há CSS nem biblioteca que meta um botão dentro dela — que era
exatamente o problema do botão de legendas, que ficava a chocar com o volume
porque os dois tentavam ocupar o mesmo sítio.

O que a barra nova traz: play/pausa, barra de progresso (arrastar só pinta, o
seek acontece ao largar), tempo, volume com mudo, legendas, qualidade e ecrã
inteiro. Esconde-se quando o vídeo dá e o rato está parado; em pausa fica
sempre visível, senão não havia como carregar no play.

Duas decisões que valem registo:

- **O preenchimento da barra é escrito por um `ref`, não por estado.** O
  `timeupdate` dispara ~4×/s e um render por quarto de segundo redesenharia o
  componente inteiro, popup incluído. O texto do tempo só muda quando muda o
  segundo.
- **O seek dispara o `seeked`** de propósito. Um seek nosso que não passa pelo
  evento deixaria o Watch Party dessincronizado.

Os atalhos de teclado (`usePlayerShortcuts`) não foram afectados: operam sobre o
elemento `<video>`, não dependiam dos controlos.

### A qualidade dentro da barra

Medido antes de mexer, porque a resposta à pergunta "não conseguimos trocar a
qualidade?" precisava de ser medida e não de suposta:

```
25 episódios de 10 séries
  19  → 1 variante só (1080p) — não há o que escolher
   6  → 3 variantes (1080 / 720 / 480) — todos Attack on Titan
   5  → native=false / falhou
```

Confirmado que a troca é real, medindo a resolução **do que é desenhado** e não
o texto do `.m3u8`:

```
pedi 1080p -> 1404x1089
pedi  720p ->  936x726
pedi  480p ->  624x484
```

O botão mostra a resolução que está a dar em vez de um ícone, e o menu só existe
com duas ou mais variantes. O seletor deixou de ser um `<select>` a flutuar por
baixo do vídeo (que se via a dar mal assim que a barra ficou nossa).

As classes do popup passaram de `.sub-cc-*` para `.pc-pop*`: o popup da qualidade
e o das legendas são o mesmo menu, e tê-los com nomes diferentes era pior.

### `proxy.js`: um 404 dizia 200

O ramo das playlists reescrevia o texto mas **não copiava o `upstream.status`**.
Um 404 (ou 403) do fornecedor voltava como **200**, com a página de erro do
MegaPlay — HTML — reescrita "aos bocados" como se fosse uma playlist. O
`hls.js` aceitava aquilo em silêncio e o erro só aparecia muito mais tarde, sem
dizer nada.

Os outros dois ramos (legendas e segmentos) já faziam `res.status(...)`; este era
o único que não. Corrigido, e agora um erro também **não é reescrito**: não há
uma única linha de playlist para reescrever num HTML de erro, só texto a estragar.

`scripts/testar-proxy.mjs` (14 verificações, 3 mutações, todas apanhadas) chama o
`handleProxy` com `req`/`res` falsos mas com um servidor HTTP a sério ao lado —
é o status real que interessa. Ligado ao `npm test`.

### `VideoPlayer` (torrents) com a mesma barra

O `controls` e o `FullscreenButton` de topo saíram; o ecrã inteiro passou para a
barra. O `FullscreenButton` continua em uso no `Player.jsx`, que é o player de
iframe.

---

## 1.4.6

Duas correcões que vieram de um utilizador, e uma promessa que eu tinha feito sem medir.

### Legendas visíveis no MegaPlay nativo

O `HlsPlayer` era montado **dentro** do `<div className="player">` do `Player.jsx`, e esse `.player` tem:

```css
.player { position: relative; aspect-ratio: 16 / 9; overflow: hidden; }
```

É o que faz o iframe ficar na caixa preta. Mas o `HlsPlayer` traz o **seu** `.player` **e os menus por baixo** (legendas, qualidade) — que ficavam **cortados** pelo `overflow: hidden`. Via-se o vídeo e não se via os menus, exatamente o que foi reportado.

O `Player` passou a embrulhar em `.player` **só quando é iframe**; com o nativo pronto, embrulha num `div` simples. Verificado no browser: o pai do `.vplayer` passou de `overflow: hidden` para `visible`, e o menu de legendas aparece com as suas opções (`Desligadas`, `English`, …).

### `{b}` em português hardcoded

`Details.jsx`, no texto de fim de episódio:

```js
b: '"Continua a ver"',   // <- português fixo
```

Com a interface em inglês, o texto de fora traduzia e o de dentro não: *"moves "Continua a ver" to the next episode"*. A chave `"Continua a ver"` **já estava traduzida** no dicionário — faltava passar por `t()`.

### A promessa da qualidade era especulação minha

Eu tinha escrito (na `IDEIAS.md` e no changelog) que o `master.m3u8` trazia variantes 1080p/720p. **Não é verdade, e eu não tinha medido** — foi suposição a partir do formato comum de HLS.

Medido em 5 episódios reais (2026-10-12):

```
#EXT-X-STREAM-INF:BANDWIDTH=1201097,RESOLUTION=1440x1080   <- a variante jogável
#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=40570,RESOLUTION=480x360  <- NÃO é outra qualidade
```

A segunda entrada é uma faixa de **I-frame**, que o HLS usa para saltar no vídeo rapidamente — não é uma segunda qualidade. O `hls.js` reporta `levels.length === 1`, e o menu esconde-se, o que está certo.

O menu ficou feito (`MANIFEST_PARSED` → `levels` → `<select>`) e **aparece sozinho** se a fonte passar a dar mais variantes. Mas não é trabalho do lado da MEIDA — é a fonte. O changelog e a `IDEIAS.md` foram corrigidos para dizer isto.

## 1.4.5

### Fonte lembrada entre episodios + qualidade do video

- **Fonte escolhida lembra-se**: antes, a `fonteManual` vivia so' na sessao do `Details.jsx` — mudavas de episodio e voltavas ao primeiro provider. Agora guarda-se no `localStorage` (`meida:last-source:<tipo>:<temporada>:<episodio>`), e o `SourceSelector` usa-a como ponto de partida se ainda existir e nao estiver morta pelo health-check.
- **Qualidade (menu pronto, mas invisivel)**: o `HlsPlayer` le as variantes no `MANIFEST_PARSED` e mostra um menu quando ha' mais de uma. **Medido em 5 episodios a 2026-10-12: o `master.m3u8` do MegaPlay traz UMA variante jogavel (1080p) mais um `#EXT-X-I-FRAME-STREAM-INF` (360p, para saltar no video, nao outra qualidade).** O `hls.js` reporta `levels.length === 1` e o menu esconde-se — o que esta certo. A ideia original (em `IDEIAS.md`) dizia "1080p/720p" e era **especulacao, nao medicao**. Para o menu ser util a fonte tem de dar mais variantes; nao e' trabalho do lado da MEIDA. Se um dia der, o menu aparece sozinho.
- **Legendas no MegaPlay nativo — o que estava partido de verdade**: o `HlsPlayer` era montado DENTRO do `<div className="player">` do `Player.jsx`, e esse `.player` tem `aspect-ratio: 16/9` + `overflow: hidden` (e' o que faz o iframe ficar na caixa preta). O `HlsPlayer` traz o seu `.player` E os menus por baixo, que ficavam **cortados**: via-se o video e nao se via os menus. Por isso o `Player` ja so embrulha em `.player` quando e' iframe; com o nativo pronto, embrulha num `div` simples. Verificado no browser: o pai do `.vplayer` passou de `overflow: hidden` para `visible`, e o menu de legendas aparece com as suas opcoes.
- **`{b}` com portugues hardcoded**: em `Details.jsx`, o texto "Guarda no diário e avança o {b} para o próximo episódio" passava `b: '"Continua a ver"'` em portugues fixo. Com a interface em ingles o texto de fora traduzia e o de dentro nao: *"moves "Continua a ver" to the next episode"*. A chave "Continua a ver" **ja estava** traduzida no dicionario — faltava passar por `t()`.
- **O `ErrorBoundary` estava partido desde que o i18n entrou**: usava `this.context.t()` quando o contexto do `I18nContext` e' a propria `t` (nao `{t}`). O `tSeguro()` e' uma funcao que nunca lanca, mesmo sem provider. E o `Header`/`BackButton` saem do boundary (antes, uma queda levava-os com ela — o teu amigo nao tinha botao para voltar atras).
- **`Compare.jsx`**: `const t = displayTitle(...)` tapava o tradutor; `t("A tua nota...")` chamava uma string.
- **`Hero.jsx`**: `const t = e.touches[0]` tapava o tradutor.
- **`testar-i18n.mjs`**: passa a verificar que `t` nao e' tapado por uma declaracao local, com uma regra que nao apanha timers inofensivos (`setTimeout`), mas apanha valores de dados (um titulo, um toque). E o harness das mutacoes passa a incluir o `process.exit` na cauda — antes os sub-testes saiam com 0 mesmo a falhar.
- **`pularIntro.js`**: `intro`/`outro` do MegaPlay (`{start:0,end:0}` quando nao ha' fim) e' filtrado; `Number.isFinite` rejeita texto, `NaN`, `Infinity` e `undefined` numa so' regra; `formatarTempo` e `rotuloNivel` sao puras e testadas.

## 1.4.4

### Saltar a abertura e o fim nos episódios de anime

O `getSources` do MegaPlay devolve `intro: {start, end}` e `outro`, e a 1.4.3
já os trazia até ao frontend — que os deitava fora. O "Autoskip" das Definições
prometia *"funciona nos nossos players"* e, nos episódios de anime, era mentira:
funcionava **só** nos iframes, e porque o `Player` acrescentava
`?autoSkipIntro=` ao URL, que é um parâmetro do *site*, não nosso.

**A forma real, medida em três episódios:**

```
intro: {start: 140, end: 229}      outro: {start: 1376, end: 1447}
intro: {start: 31, end: 111}       outro: {start: 0, end: 0}      <- sem fim
```

`{start: 0, end: 0}` é a armadilha: é o que o site manda quando o episódio **não
tem fim**, e sem o filtro o botão aparecia aos 0 segundos de qualquer episódio.
Quando `native: false` os campos nem vêm — a rota responde `{native: false}` sem
eles.

`web/src/components/pularIntro.js` — a decisão (quando mostrar, para onde saltar,
o que já foi saltado) está toda aqui, **pura e sem React**, para se poder partir
por mutação. Duas regras vieram da medição: uma janela só vale se
`Number.isFinite` nos dois lados e `end - start >= 1`, e o salto é limitado ao fim
do vídeo quando a janela o passa. Com o Autoskip ligado salta sozinho uma vez e
sem botão — as Definições prometem "tenta saltar a intro", não "pergunta".

### O harness de mutações estava a mentir

Duas coisas encontradas ao escrever `scripts/testar-pular-intro.mjs`, e as duas
valem para todos os testes de mutação do projecto:

1. **Código morto, descoberto porque a mutação não era apanhada.** O
   `typeof start !== "number"` era redundante: `Number.isFinite` não converte,
   logo já rejeitava `"140"`, `undefined`, `NaN` e `Infinity`. Tirar o `typeof`
   não mudava nada — por isso a mutação "não era apanhada". O filtro ficou só no
   `isFinite`, e agora a mutação é observável.

2. **O `split` cortava o `process.exit`.** O sub-teste corria, imprimia as
   falhas, e **saiu com código 0 na mesma** — o `apanhou` via `r.status !== 0` e
   era sempre falso. O harness reportava "mutação não apanhada" em casos em que
   o teste a apanhara. Pior: quase levou a "consertar" testes que estavam
   certos. O harness ganhou a cauda com o `process.exit` e imprime a saída do
   sub-teste quando não apanha, para se saber se a mutação não aplicou ou se o
   teste não a viu.

57 verificações, 7 mutações, todas apanhadas. Entrou no `npm test` (24 passos).

## 1.4.3

### MegaPlay nativo: o mesmo site, reproduzido dentro da app

O `getSources` do MegaPlay já devolvia as legendas em claro (`.vtt`) desde
2026-10-04, e o vídeo num campo `enc` cifrado. Este ficheiro dizia que o `enc`
"não dá para reproduzir nativamente sem fazer engenharia reversa". **Era
exagero.**

O `enc` é `AES-CBC` e a chave e o IV estão em **texto simples** no próprio
`megaplay.buzz/lib/newclient.min.js` (`__MegaPlayCfg`, com valores por defeito
que a página não sobrescreve). O texto claro é `{"file":"https://.../master.m3u8"}`.

Medido num episódio real: **339 segmentos** (~24 min) e `.vtt` com **378 blocos**.
Os segmentos aceitam CORS (`*`), por isso o browser pode buscá-los
directamente. Não é contornar DRM — os segmentos aceitam o mesmo `Referer` que o
player usaria.

**O que isto resolve, e o que o `<iframe>` não resolvia:**

| | iframe | nativo |
| --- | --- | --- |
| Legendas | as do site, ligadas à mão | em claro, escolhíveis |
| Watch Party | não sincroniza (cross-origin) | sincroniza |
| "Continua a ver" | não guarda posição | guarda |

**É uma fonte separada, não uma substituição.** Na lista aparece "MegaPlay
(nativo)" ao lado de "MegaPlay (anime)" — quem quer o iframe continua a tê-lo.
Se a chave mudar um dia, o servidor devolve `native: false` e o `Player` cai no
iframe da mesma fonte: a falha é invisível para quem só quer ver o episódio.

`server/src/services/megaplayNativo.js` + `GET /api/anime/megaplay`.
Testes em `scripts/testar-megaplay.mjs` (16 verificações, 3 mutações, **a bater
no site real** — a cifra não dá para testar com um `enc` de mentira).

### Catálogo do Anikoto como fonte extra

`services/anikoto.js`, tabela `anikoto_series` (migração 7). O `embed_url` do
Anikoto é o **próprio MegaPlay pela rota `/stream/s-2/`** — o mesmo site por um
caminho que resolve títulos que a `/ani/` não resolve. Aparece **depois** das
providers normais e nunca os substitui.

O que mudou face ao que a ideia previa: a **API mudou** (`/recent-anime?page=N` e
`/series/{id}`, e a chave passou a ser o `embed_url` de cada episódio), e o
`mal_id`/`ani_id` vêm como **texto** com `""` nos que não têm. Guardar `""` num
INTEGER dá **0**, que é um id válido de outra série — o `idValido()` trata
disso, e há uma mutação a prová-lo.

Rasteio incremental (2 páginas ao arrancar, mais 3 por título desconhecido,
1,4 s entre pedidos; o limite é 60/120 s). **Separar "catálogo conhecido" de
"embeds buscados"** dá ~100 títulos por página com 1 pedido, em vez de pedir
`/series/{id}` a todos.

### Um bug que matava a app ao arrancar

`index.js` fazia `aquecerCatalogo().catch(() => {})` e a função **não devolvia
nada** (faltava o `return`). O servidor morria no `listening` e a app mostrava
"o servidor não arrancou".

**Nenhum dos 23 testes dava por isto, porque nenhum arrancava o servidor.**
É a segunda vez que um teste passa porque o código está certo sem estar a
provar o arranque (a primeira foi o `t` sem import, apanhado pelo `eslint`).

Corrigido, e `scripts/testar-anikoto.mjs` passou a **arrancar o `index.js` de
verdade** (porta livre, base temporária, falha se o processo morrer logo a
seguir). **Verificado por mutação**: reintroduzir o bug é apanhado.

### Traduções (continuação da 1.4.2)

O `Login.jsx` estava praticamente todo por traduzir (`Criar conta`, `Entrar`,
`Utilizador`, `Password`, `Já tens conta?`) e o `Diary.jsx` tinha as seis
etiquetas do formulário. `TextoComMencoes.jsx` usa `t` como variável local para
`setTimeout` (duas vezes), por isso importa o tradutor como `tt`.

`"em baixo": "below"` passou a `"down"`: *below* é posição vertical, *down* é
estado. `x264`, `x265`, `Trailer` e `min` ficam declarados como iguais nos dois
idiomas, com `// i18n:` no código a dizer porquê.

O `IDEIAS.md` foi reorganizado: a secção "Feitas" deixou de ser uma promessa e
passou a existir a sério, com os 17 itens `[x]` movidos de cima e o texto do
*como* e do *porquê* preservado.

## 1.4.2

### O modo P2P (torrents sem Real-Debrid) deixou de esperar pelo ficheiro inteiro

O problema: `addTorrent` esperava pelo evento `ready`, que só dispara com o
ficheiro **completo** em disco. Retomar um episódio, ou vê-lo pela segunda vez,
ficava bloqueado até acabar o download — ou seja, não havia buffering nenhum.
Era o que tornava o modo grátis inutilizável fora de um torrent já em cache.

**Agora resolve nos `metadata`** (`torrentEngine.js`), que chegam em segundos.
O `createReadStream` continua a ir buscar as peças de que precisa enquanto o
resto vai atrás, que e' o buffering que sempre esteve lá — nunca chegou a ser
usado.

`c.add()` também deixa de poder pendurar o pedido para sempre: sem `error`, sem
`metadata`, o que resta era uma barra de progresso parada sem fim. Agora dá `504`
com uma mensagem, e **destrói o torrent** — senão ele fica em `client.torrents`
a tentar e cada reprodução nova espera os mesmos 30 s.

### Priorização das peças (`torrent.critical`)

`webtorrent@2.8.5` expõe `torrent.critical(start, end)`, e `_request(wire, piece,
critical)` usa essa marca para pedir primeiro. **Não estava a ser usado.**

O `hotswap` do WebTorrent, que já lá está, **não** faz isto: ele reatribui uma
peça de um wire lento para um rápido (L1865), não prioriza por posição de
leitura. Por isso a otimização era mesmo nova, e não redundante.

`pecasDaJanela()` é uma **função pura** (`offset`, `tamanho`, `pieceLength`,
`inicio`, `fim` → `[primeiraPeca, ultimaPeca]`), e é isso que a torna testável
sem WebTorrent, sem disco e sem rede.

Três decisões dentro dela:

- **O `offset` conta.** As peças são do *torrent*, não do ficheiro. Num
  pack/batch de anime o episódio não é a primeira coisa; sem o `offset` marcava
  as peças do **episódio errado**.
- **A janela tem de ser limitada a 8 MB.** O browser pede `bytes=0-` (fim
  aberto) para começar, e o `end` nesse caso é o fim do ficheiro. Sem o limite,
  `critical` marcaria o ficheiro inteiro — o mesmo que não marcar nada, porque
  a prioridade é uniforme.
- **`Janela a partir de ONDE, não do início.** Um seek a 3000 MB marca as peças
  à volta dos 3000, não do início.

A rota chama `priorizarPecas(torrent, file, start, end)` nos dois ramos (com e
sem `Range`), e o `getStatus` devolve agora `temMetadados` — é o que distingue
"ninguém tem isto" de "está a descarregar devagar", que se espera de maneiras
completamente diferentes.

### Um buraco de auditoria, e o que ele estava a esconder

Procurando o texto "Debrid indisponível, a tocar via torrent local" — que
estava por traduzir — encontrei a **5.ª vez** que o auditor de textos por
traduzir dizia "limpo" sem estar.

Desta vez eram **texto de uma palavra**. `pareceTexto` descarta o que é uma
palavra só (é indistinguível de um identificador) e `pareceFrase` exige duas.
Ou seja: entre `>` e `<` — onde não há código nenhum, só interface —
**"Apagar", "Entrar", "Utilizador", "Conquistas", "Acabou" nunca foram vistos.**

Somando ao buraco anterior (texto misturado com expressão, 26 textos), são
**~50 botões e etiquetas** que estavam em português com o auditor a passar.

**A regra nova (`pareceTextoDeTag`)** não pode usar o filtro de identificadores
nem exigir duas palavras. O filtro que sobra é de caracteres de JavaScript
(`(){}?&=;|!+*` e `.` seguido de letra), porque o scanner também passa pelo
fecho de uma expressão e lê `) : other ? (` como se fosse texto.

### `scripts/testar-auditor-i18n.mjs`

Passou de 11 verificações / 4 mutações para **16 / 5**. A quinta mutação apaga
`pareceTextoDeTag` do ramo do JSX e o teste tem de apanhar.

Corre o auditor contra ficheiros de teste num `web/src` de mentira, montado na
pasta temporária do sistema — `web/src` nunca é tocado. (Uma corrida anterior
deixou `_mut-*.mjs` em `web/src` e o `eslint` do `build` apanhou-os.)

### Traduções

O `Login.jsx` estava praticamente todo por traduzir (`Criar conta`, `Entrar`,
`Utilizador`, `Password`, `Já tens conta?`), e o `Diary.jsx` tinha as seis
etiquetas do formulário.

`TextoComMencoes.jsx` usa `t` como variável local para `setTimeout` (duas
vezes), por isso importa o tradutor como `tt` — como já se fazia em
`lib/tempo.js`.

`"em baixo": "below"` passou a `"down"`: *below* é posição vertical, *down* é
estado. `x264`, `x265`, `Trailer` e `min` ficam declarados no dicionário como
iguais nos dois idiomas, com `// i18n:` no código a dizer porquê.

### `scripts/testar-grafico-mensal.mjs` partido pela tradução

`GraficoMensal` passou a usar `useT()`, e o teste monta o componente fora do
`main.jsx` — o contexto era `undefined` e o `useT()` rebentava. Envolve agora a
árvore no `I18nProvider`.

### Testes novos no `npm test`

`testar-p2p.mjs` (26 verificações, 4 mutações) e `testar-p2p-metadados.mjs`
(22 verificações, 3 mutações, com um WebTorrent de mentira injectado).

O de metadados encurta `META_TIMEOUT_MS` para 400 ms **só no ensaio** — não é
mutação, é o harness. Em produção o prazo é 30 s.

## 1.4.1

### Novo: botão para descarregar a app, no site

Quem chega pela página web vê agora um botão no cabeçalho que leva à release
do GitHub. **Na app de desktop não aparece** — não faz sentido oferecer a
descarregar a app a quem já a tem instalada.

**A regra está em `web/src/lib/web.js`** (`ehVersaoWeb`), e tem três condições
porque cada uma cobre um caso diferente:

| Onde | Electron? | Host | Vê o botão? |
| --- | --- | --- | --- |
| App de desktop, dados locais | sim | — | não |
| App de desktop, servidor partilhado | sim | — | não |
| `meida.onrender.com` | não | domínio | **sim** |
| `npm run dev` | não | `localhost` | não |

**Por que detetar pelo `hostname` e não pelo `runtime-config.json`:** esse
ficheiro está também em `web/public/`, portanto o `npm run dev` lê-o igual e
passaria a mostrar o botão em desenvolvimento. Detetar pelo hostname não depende
do servidor e dá o mesmo resultado.

Pior: no Electron em modo "remoto", `MEIDA_REMOTE_DATA_BASE` **está**
preenchido (é o processo principal que o mete). Um teste que olhasse para essa
variável mostraria o botão *dentro da app*. É por isso que o teste da
app-em-modo-remoto existe.

**O link é para a página da release**, não para o `.exe`: o nome do ficheiro
leva a versão (`MEIDA-Setup-1.4.0.exe`), por isso um link direto passaria a
apontar para uma versão antiga. A página mostra o instalador *e* as notas.

**O `npm test` ganhou `scripts/testar-web.mjs`** — 19 verificações mais duas
mutações (sem o teste do Electron, e sem o teste do localhost). A regra é uma
função pura que recebe `{ electronAPI, hostname }` em vez de ir buscar o
`window`, que é o que a torna testável sem browser.

### Um erro que os testes não apanharam

O botão apareceu **sempre**, também em `localhost`. A causa:

```js
import { noBrowser as ehWeb } from "../lib/web.js";
// ...
{ehWeb && (...)}      // <-- funcao, sempre verdadeira
```

`ehWeb` é a *função*, não o resultado de a chamar — e uma função é sempre
truthy. O teste passava na mesma, porque testava `noBrowser()` e não o `{ehWeb && }`
do JSX. Só apareceu quando se abriu a página no browser.

É o mesmo bug só visto de outra maneira: **um teste da função não prova nada
sobre o sítio onde a função é chamada.** Por isso o ficheiro agora chama
`ehVersaoWeb()` explicitamente e o comentário ao lado avisa.

## 1.4.0

### Novo: a interface esta' toda em ingles tambem

Antes a app era so' em portugues. Agora ha **dois idiomas**, e muda-se sozinho
conforme o que o navegador pede (`navigator.languages`), com selector nas
**Definicoes > Conteudo** para trocar a mao.

**A traducao e' no cliente, nao no servidor.** O servidor nao sabe o idioma do
pedido, e nao precisa: cada texto vem com a sua propria traducao indexada pela
**frase em portugues**. E' o mesmo principio do resto do interface — a chave e' o
proprio texto em portugues, nao um identificador tipo `nav.home`. Por isso as
**46 mensagens de erro que o servidor devolve** traduzem sem tocar no servidor
e **sem redeploy** do `meida.fadehost.app`.

Tres ficheiros, e porque:

- **`web/src/i18n/traducoes.js`** — o dicionario. **548 chaves** em portugues e
  548 em ingles. A chave e' sempre o texto em portugues.
- **`web/src/i18n/I18nContext.jsx`** — o `t()` dos componentes. `useT()` chama
  o hook normal do React, por isso os componentes re-renderizam quando o
  idioma muda. `<html lang>` tambem muda (leitores de ecra).
- **`web/src/i18n/traduzir.js`** — a funcao **pura**, fora do React. Importada
  pelo `I18nContext` **e** pelo `api/client.js`, para que a mensagem de erro do
  servidor e a do interface traduzam **pelo mesmo codigo**. Ter duas copias
  seria a forma mais facil de elas divergirem em silencio.

**O `t()` aceita elementos React.** Uma frase que ja' tem markup a volta de uma
palavra (`Usa o filtro <b>x</b> na lista`) traduz-se inteira, com o elemento
dentro:

```jsx
{t("Usa o filtro {filtro} na lista de torrents e escolhe um {formato}.", {
  filtro: <b>✓ Reproduz no browser</b>,
  formato: <b>.mp4 / x264</b>,
})}
```

Quando algum valor e' um elemento, `traduzir()` devolve um **array** em vez de
uma string — `String(<b>x</b>)` daria `[object Object]` no ecra.

### Corrigido: `useT()` dentro de um `.map()` (rebentava com varias notificacoes)

O `frase()` do `NotificationBell.jsx` fazia `const t = useT()` e era chamada
dentro de `items.map((n) => ...)`. Isso executa o hook **uma vez por
notificacao**: assim que chegasse uma nova (ou saisse uma), o React contava
mais hooks do que no render anterior e rebentava com *"Rendered more hooks than
during the previous render"*.

O mesmo padrao apareceu em `Comments.jsx` (`whenTitle`) e `Manga.jsx`
(`MultiChips`). Agora o `t` entra como **parametro** — quem tem o hook e' o
componente, e passa-o. Em `Manga.jsx` o `t()` traduz no momento de mostrar
(`{t(o.label)}`), porque o array e' de nivel de modulo e la nao ha hook.

### Corrigido: dois nomes `t` a colidir no mesmo ficheiro

O nome bonito para a traducao e' `t`. O nome bonito para o **titulo** de um
filme tambem era `t`. Em `Library.jsx` e `CompareRating.jsx` o `const t =
displayTitle(...)` dentro do `.map` sombreava o `t = useT()`, e o
`{t("Remover da lista")}` traduzia o proprio titulo: o botao aparecia com o nome
do filme em vez do texto.

O titulo passou a chamar-se `titulo`. O mesmo vale para `lib/tempo.js`, onde o
`t` local e' o timestamp — por isso o `t()` puro e' importado ali como `tt`.

### Corrigido: os generos e as datas apareciam sempre em portugues

- **Generos**: `ROTULO_GENERO` dava o rotulo em portugues e o interface mostrava
  "Acao", "Ficcao Cientifica" com a app em ingles. Agora `rotuloGenero()` passa o
  rotulo pelo dicionario.
- **Datas relativas**: `lib/tempo.js` escrevia "ha 20 min" e usava
  `toLocaleDateString("pt-PT")` fixo. Agora segue o idioma, e a data absoluta sai
  em ingles quando o interface esta' em ingles.
- **Unidades** (`Torrents.jsx`): `"h"`, `"min"`, `"seg"`, `"dia"` — iguais nos
  dois idiomas, por isso ficam como estao (marcado com `// i18n`).

### Corrigido: os labels dos separadores ficavam em portugues

`TABS`, `SORTS`, `sets` e companhia sao **arrays de nivel de modulo**, onde nao
ha `useT()`. Traduzir na definicao dava `t is not defined`; traduzir com o
`t()` puro resolveria o erro mas nao a mudanca de idioma, porque o valor era
calculado uma vez no carregamento do modulo.

A convencao adoptada: o `label` guarda a **chave em portugues** e traduz-se no
momento de mostrar, em `{t(x.label)}`. O auditor sabe que e' uma chave e nao um
texto por traduzir.

### Novo: `scripts/auditar-pt-por-traduzir.cjs` (esta no `npm test`)

Nao ha forma de provar por leitura que **nao** ha texto esquecido — e este
projecto provou isso duas vezes. A primeira auditoria disse "nenhum texto por
traduzir" com **45 textos** por traduzir.

Por isso o auditor varre o `web/src` inteiro e corre em `npm test`. **Falha com
6 mutacoes** que apanham cada tipo de esquecimento: palavra isolada, texto de
JSX partido por varias linhas, atributo `title`, template literal com
expressao, ternario com expressao, e `label` de modulo usado sem `t()`.

Tres coisas que o auditor aprendeu a fazer, cada uma porque falhou:

1. **O limiar de uma palavra, e nao duas.** Com duas, "Novidade", "Nota" e
   "Apagar" passavam — e sao os textos mais faceis de esquecer.
2. **Reconhecer frases sem depender do dicionario.** "Usar URL" e "Criar sala"
   nao tem nenhuma palavra da lista de portugues. No texto de JSX e nos
   atributos de texto, **duas palavras e' interface quase certo**.
3. **Nao se perder no codigo.** Um `import { useEffect } from "react"` fazia o
   scanner ler a aspa de fecho como inicio de uma string que nunca mais fechava
   — e o ficheiro ficava **inteiro** por auditar. `Hero.jsx` tinha "Reproduzir"
   e "Mais info" no ecra em portugues com o auditor a dizer "limpo".

As exclusoes ficam **no codigo**, com `// i18n:` — nao numa lista do script, para
ninguem as "arranjar" sem ver que a traducao ja la esta.

### Corrigido: texto que o proprio extractor nao via

O `extrair-textos.cjs` so' olhava para 4 pastas e so' para texto na mesma linha.
Ficou de fora, e so' apareceu quando se abriu a app no browser: template
literals, ternarios com expressao, texto de JSX partido por varias linhas,
atributos, e ficheiros inteiros na raiz (`App.jsx`) e em pastas que nao eram
abertas (`lib/`, `watchparty/`, `auth/`, `api/`).

O `App.jsx` e' o exemplo mais barato: tres linhas de uma pagina inteira
(`A carregar`, `Filmes`, `Series`).

### Ferramentas de traducao

O trabalho foi feito com scripts, nao a mao, porque eran 330 textos:

- `extrair-textos.cjs`, `extrair-erros-servidor.cjs` — puxam os textos.
- `traduzir-*.cjs`, `gerar-dicionario.cjs` — escrevem o dicionario.
- `acrescentar-uset.cjs`, `corrigir-lint-i18n.cjs` — tratam de imports e de
  falsos positivos do lint.
- `verificar-t-em-codigo.cjs` — confirma que um `t()` nao ficou com a chave
  errada.

**Os testes apanham mais do que se pensava.** O `eslint` (`no-undef`) apanhou
seis `t` usados sem import — que **compilavam sem erro nenhum**, porque o build
nao verifica identificadores. E o `testar-i18n.mjs` apanhou chaves iguais em
portugues e ingles onde deviam ser differentes (`Watch Party`, `DUB`,
`Debrid`).

### Notas

- **O servidor nao mudou.** Zero alteracoes em `server/`: as mensagens
  continuam a vir em portugues e traduzem-se no cliente.
- **A web funciona igual.** O mesmo codigo corre em `meida.onrender.com`; so' a
  deteccao de idioma e' a nova.
- **Os titulos e as sinopses seguem o idioma do catalogo** (TMDB), que ja era a
  configuracao antes — nao se mexeu nisso.

## Por publicar

### Corrigido: dava para nao responder a uma resposta
O botao **"Responder" aparecia nas respostas e nao acontecia nada ao clicar.**
Nao dava erro, nao aparecia formulario nenhum — clicas e nada.

Tinha **duas metades**, uma em cada lado:

- **O store achata o aninhamento.** `addComment` gravava
  `parentId = p.parent_id ?? p.id`: responder a uma resposta pendurava o
  comentario **na raiz**. Era deliberado ("aninhamento a um nivel") e estava
  escrito no codigo.
- **O formulario so' sabia desenhar ao nivel de topo.** Vivia no `comments.map`,
  ao lado do comentario de topo. Mas o `CommentItem` desenha as respostas
  **recursivamente** — por isso o botao aparecia em todos os niveis e nao tinha
  onde abrir. Era esta metade que via a pessoa; a outra era silenciosa.

Agora o aninhamento e' real, sem limite, como o `CodCP_Pai` do projeto antigo
(RAI PAP / ProdSound) — que ja' o fazia a tres niveis e nunca teve o problema.

**Como se lee um fio fundo.** A indentacao para depois do terceiro nivel: cada
nivel comia 14px de margem e um fio de dez respostas deixava o texto numa tira
estreita, pior no telefone. A partir dai, todas as respostas ficam no mesmo recuo
e **cada uma cita quem se esta' a responder** — autor e um pedaco do texto, com
ligacao para o comentario. E' o mesmo truque do `vp-comment-quote` do projeto
antigo.

**Alem disso, a notificacao passou a ir para a pessoa certa.** O aviso de
"respondeu-te" apontava para o comentario de topo, porque era esse o `parent_id`
guardado — ou seja, notificava alguem que nao estava a ser respondido. Agora
aponta para a resposta.

Verificacoes: 50 testes do servidor (2 novos, um deles de um fio de 6 niveis com
os pais conferidos um a um), 16 verificacoes de ligacao da UI e 18 de
renderizacao — estas ultimas renderizam o componente de verdade com
`react-dom/server` e leem o HTML, sem jsdom. Todas as tres foram verificadas com
mutacao: reintroduzir o achatamento, tirar o formulario do `CommentItem`, ou
parar de passar o `parent` na recursao faz cada uma falhar com a mensagem certa.

O limite de seguranca (NIVEL_MAXIMO = 30) tambem foi verificado com um ciclo de
`parent_id` a apontar para si mesmo. **A primeira versao nao o impedia** — a
frase de aviso aparecia mas a recursao continuava, e rebentava com "Maximum call
stack size exceeded". O `!cortado` na guarda do `map` e' o que corta.

### Seguranca: cinco dependencias transitivas actualizadas
No log do deploy do servidor partilhado aparece `npm audit` a dizer **9
vulnerabilidades, uma crítica**. Auditoria feita a 2026-10-09.

**Nao se correu `npm audit fix`, de proposito.** Alem de exigir `--force` para o
`ip`, instalava tambem `utp-native`, `bufferutil` e `utf-8-validate` — modulos
**nativos** (`.node`). Cada `.node` novo no `server/` e' mais um ficheiro que o
empacotamento tem de trocar por arquitectura correcta antes de entrar no pacote, e
foi exactamente assim que os instaladores ARM sairam partidos (ver AGENTS.md). O
`utp-native` ainda nem e' preciso: o aviso dele e' inofensivo e o WebTorrent
funciona por TCP.

Em vez disso, `overrides` em `server/package.json` para as actualizacoes uteis:

| pacote | de | para | aviso |
| --- | --- | --- | --- |
| `proxy-addr` | 2.0.7 | **2.0.8** | **critico** — IP spoofing |
| `express` | 4.22.2 | 4.22.3 | patch (directa) |
| `body-parser` | 1.20.5 | 1.20.8 | DoS com `limit` invalido |
| `qs` | 6.15.2 | 6.16.0 | bypass do limite de arrays |
| `ip-address` | 10.2.0 | 10.7.3 | 7 avisos de SSRF/trust-boundary |

Todas sao JavaScript puro, sem quebras e **sem modulos nativos**. `npm install`
mudou 5 pacotes e **nao adicionou nenhum**.

Duas notas sobre o alcance real, para nao exagerar o que isto resolve:

- **A crítica nao e' exploravel hoje.** O `proxy-addr` so' entra no caminho de IP
  spoofing com `trust proxy` activo, e o servidor **nunca o activa**. Actualizar
  nao e' urgente; e' o patch que a pagina de seguranca pede.
- **O `body-parser` tambem nao e' alcançavel**: o aviso e' sobre um `limit`
  invalido desligar a verificacao de tamanho, e aqui o `limit` e' `'4mb'`
  (fixo no `src/index.js`).

**Fica por resolver** o `ip` (high, SSRF em `isPublic`). A correcao obriga a
`webtorrent@0.7.3`, quando estamos na **2.8.5** — um downgrade com quebras. Nao foi
feito. O `npm audit` continuara a dizer "4 high" por causa disso, e isso e'
esperado.

### Corrigido: a cache do AniList deixava um anime partido para sempre
Reportado a 2026-10-09 em `/details/anime/223`. **Isto e' do servidor, por isso
precisa de push para o servidor partilhado, nao de release** — o 1.3.8 ja foi
publicado. Detalhes no commit `9011f32`.

## 1.3.9

### Novo: pagina de Estatisticas (`/stats`)
Seis figuras (titulos, vistos, para ver, nota mais alta, genero, decada) +
histograma das notas + tempo visto + decada favorita. As ressalvas (o que o
numero nao diz) estao escritas na pagina — e' o mais importante desta release.
Ver detalhes na secao dentro desta versao.

### Novo: o ano dos titulos passa a ser guardado
`setLibraryYear()` (PATCH `/library/year`), com `COALESCE` e `IS NOT`. Os
imports do MAL (`start_season.year`) e Letterboxd (`filmYear`) trazem-no.

### Corrigido: tempo visto nao contava saltos; ano nao se perdia ao marcar visto
`avancoVisto()` com `delta > 120` (TETO_AVANCO). A rota `POST /library` aceita
`year`. Os testes falham com o codigo partido (5 mutacoes confirmadas).

### Melhorado: decada favorita conta a cobertura (`comAno`)
A pagina `/stats` diz quantos titulos entraram (`comAno` vs `titulos`).

### Corrigido: comentarios aninhados respondem ao pai certo (`CodCP_Pai`)
Notificacao para a pessoa certa, citacao `.comment-cita`, limite 30.

### Notas
`statsFor()` numa passagem pela biblioteca + diario. `HistogramaNotas.jsx` e'
SVG a mao, sem biblioteca. `runtime-config.json` nao alterado. Nao publicada
com binarios (fica para depois).

### Testes
70 no servidor (+5 mutacoes: faixa do histograma, salto, `IS NOT`, decada por
dezena, desempate alfabetico). `testar-histograma.mjs` (render do componente).

## 1.3.8

### Novo: "@mencoes" nos comentarios
Como no TikTok e no Instagram: escreve-se `@`, aparece uma lista, escolhe-se com
as setas e o Enter, e o nome fica escrito no texto. Quem e' mencionado leva
notificacao no sino.

**Frontend** (`web/src/lib/mencoes.js`, sem React, testado):
- `mencaoEmCurso(texto, cursor)` — o que a pessoa esta a escrever depois do `@`, e
  onde. E' a regra mais sensible: devolve `null` em quase todos os casos, porque um
  falso positivo mostra a lista no sitio errado. Regras: o `@` tem de estar no
  inicio ou depois de espaco/pontuacao (assim `a@b.com` e `ola@ana` nao contam), so'
  pode haver caracteres de username entre o `@` e o cursor, e um username a
  comecar por ponto nao vale. O `@` sozinho **tem** de abrir a lista — com `+` em
  vez de `*` no teste de caracteres, nao abria, e a pessoa via que estava partido.
- `insereMencao` — escreve `@fulano ` e deixa o cursor depois do espaco.
- `pedacosComMencoes` — divide o corpo em texto e mencoes, para desenhar.
- `porPrioridade` — quem tem ligacao connosco sobe. Normaliza os ids para `Number`
  dos dois lados: com um `Set` de textos e ids numericos, `set.has(2)` e' falso e
  nao subia ninguem — **em silencio, sem erro nenhum**.

`web/src/components/TextoComMencoes.jsx`: a caixa com a lista. Dois cuidados que
custaram:
- o `onBlur` do textarea chega **antes** do `click` da opcao e fechava o menu; por
  isso o clique usa `mousedown` com `preventDefault`, e o `onBlur` tem um
  `setTimeout` de 120 ms.
- o cursor so pode ser posto depois do React escrever o novo valor; antes disso o
  textarea ainda tem o texto antigo e a selecao cai no sitio errado. Fica num
  `requestAnimationFrame`.

`web/src/components/Comments.jsx` usa o componente nos dois sitios (comentario e
resposta) e desenha o corpo com `<CorpoDoComentario>`, que devolve **elementos e
nao HTML** — o texto do utilizador vai tal e qual para a base de dados, por isso
nao ha nada ali que possa injectar marcacao.

**Servidor**:
- `GET /api/users/suggest?q=` devolve a lista de sugestoes ja ordenada (quem tem
  ligacao connosco primeiro) e o campo `linked`, com os ids marcados. Query vazia
  e' valida de proposito: e' o que se pede logo apos o `@`, e `searchUsers("")`
  devolve vazio. A ordenacao e' feita aqui e nao no frontend, porque "quem comeca
  por 'an'" e' assunto deste. Os ids vao em blocos de 400 — o SQLite tem limite de
  parametros e uma lista maior rebentava a query.
- `addComment` extrai os usernames mencionados e notifica cada um, com
  `kind: "mention"`. **Nao houve migracao**: a coluna `kind` e' `TEXT` sem `CHECK`.
  As duas regras da `criarNotificacao` resolvem o resto sem codigo novo — nunca
  notificar-se a si proprio, e nao duplicar (o indice unico e' por
  destinatario+kind+ref, por isso `@fulano @fulano` no mesmo comentario avisa uma
  vez so).
- `NotificationBell` sabe escrever a frase: "fulano chamou-te num comentario".
  Distinta do "respondeu" de proposito, porque a mencao pode ser num comentario
  que nao responde a nada da pessoa.

### Duas implementacoes das mesmas regras, de proposito
`mencaoEmCurso` (web) trabalha sobre o cursor; `usernamesMencionados` (servidor)
sobre o texto todo. Nao se podiam fundir: o `server/` e' um pacote separado e no
pacote instalado **nao existe `resources/web/src`**, portanto o `store.js` nao
conseguia importar do `web/` — o import rebentava a app instalada.

Tendo de ser duas, a divergencia e' o perigo: se o servidor tratasse `a@b.com` como
mencao e o frontend nao, aparecia uma notificacao a partir de um `@` que a
interface nunca mostrou. A seccao 7 do `testar-mencoes.mjs` compara as duas nas
frases que costumam dar problemas e fixa tambem a **diferenca conhecida** do ponto
final (o servidor corta, o frontend filtra por "ana." e a lista fica vazia — nao e'
bug, mas fica escrito para se saber porque).

### Testes
- `scripts/testar-mencoes.mjs`, 61 verificacoes, ligado ao `npm test` (130 -> 191).
- `scripts/testar-mencoes-fumo.mjs`, 19 verificacoes, precisa de servidor a correr
  (`npm run test:mencoes:fumo`). Prova que a rota responde, que quem se segue sobe,
  e as tres regras: notifica, nao notifica a si proprio, nao duplica.
- O verificador de mutacao (`/tmp`) confirma que o teste falha com o codigo
  partido: `@` sozinho a nao abrir, ponto final a ser parte do nome, email a contar
  como mencao, ligacoes a nao subir. **Primeiro corrigiu-se o verificador** para
  abortar quando o teste ja falha em codigo bom — a primeira versao dava "o teste
  apanha o bug" sobre um teste que ja estava roto.

### Verificado no browser
Escrever `@` abre a lista (8 sugestoes); `@an` filtra so os Ana; seta + Enter
insere `@ana30phat ` com o cursor no sitio certo; o comentario publicado mostra a
mencao como link para `/u/ana2zrbz1`; `a@b.com` **nao** vira link; o sino mostra
"bentoumo4g8 chamou-te num comentario" com **uma** notificacao apesar de duas
mencoes.

### Nos dois servidores, ja verificado
`/api/comments`, `/api/auth` e `/api/users` **nao** estao em `LOCAL_API_PREFIXES`,
por isso vao para o servidor partilhado — que e' o caminho que interessa.

Este texto estava escrito antes do push, com a ideia de que a funcionalidade ia dar
404 ate o servidor fazer deploy. **Nao foi preciso**: o deploy foi automatico e
rapido, e antes de publicar a 1.3.8 ja se confirmou contra o servidor a correr.

`testar-mencoes-producao.mjs` (15 verificacoes, so' contra o servidor partilhado)
prova o ciclo completo em producao: registar duas contas, `/api/users/suggest`
responde e filtra, quem se segue sobe com a marca `linked`, um `@fulano` gera uma
notificacao e aponta para o comentario certo, tres `@fulano` num comentario dao
uma so, e `a@b.com` nao gera nada.

As contas que o teste cria ficam no servidor (`tan...` e `tbento...`, com sufixo
aleatorio). Nao ha rota de apagar conta, por isso ficam la.

## 1.3.7

### Corrigido: a app nao abria nenhum titulo depois da 1.3.6
Reportado a 2026-10-08 por um utilizador no ARM. **Foi um erro meu na 1.3.6, e
affectou toda a gente que a instalou** — nao era especifico do ARM.

Sintoma: a app abre, o login funciona, a pagina inicial carrega — e ao tocar num
anime, serie ou filme aparece

```
Algo correu mal
Ocorreu um erro ao mostrar esta pagina. Recarrega para tentar de novo.
```

que e' o `web/src/components/ErrorBoundary.jsx`. Pior: como o reinicio limpava,
dava a impressao de que era preciso reiniciar depois de atualizar.

Causa, no console do browser:

```
ReferenceError: Cannot access 'active' before initialization
    at Details (.../pages/Details.jsx:108:55)
```

O bloco do Discord introduzido na 1.3.6 ficou **antes** da seccao "Fontes / player"
do `Details.jsx`, onde vive o `const [active, setActive] = useState(null)`, e metia
`active` no array de dependencias de dois `useEffect`. O React avalia esse array **no
sitio da chamada**, ainda dentro do corpo do componente, e da' em cima da declaracao.

**E' o mesmo bug da v1.1.1** (que partiu os `embeds`), pela mesma confusao. Nem o
lint nem o `npm run build` o apanham: o Vite compila isto sem dizer nada. So se
descobre abrindo a app — que e' o que devia ter feito antes de publicar.

A regra que faltava na cabeca: um **array de dependencias** so' pode citar `const` ja
declaradas acima. O **corpo** do efeito pode usar o que quiser, porque so' corre
depois do render (por isso o `reportPos`, que usa refs no corpo, pode estar em
qualquer sitio).

- `web/src/pages/Details.jsx`: o bloco do Discord e o `reportPos` foram para depois
  das declaracoes das fontes.
- `scripts/testar-ganchos-deps.mjs` (novo, ligado ao `npm test`): procura
  dependencias citadas antes de serem declaradas, em todos os `.jsx`, **respeitando
  as fronteiras entre componentes**. Confirma-se que falha com o codigo partido
  (apanha os dois pontos) e passa com o corrigido.
  - Sem o cuidado das fronteiras o teste dava 7 falsos positivos (`Manga.jsx` e
    `UserProfile.jsx` declaram nomes em componentes diferentes). Um teste com falsos
    positivos e' pior do que nenhum: ninguem confia nele e deixa de ser corrido.

### Corrigido: o atalho do menu Iniciar apontava para a pasta de compilacao
No mesmo PC, o `MEIDA.lnk` do menu Iniciar apontava para
`Documents/Meida/release/win-arm64-unpacked/MEIDA.exe` — a pasta que o
`electron-builder` apaga e refaz a cada compilacao. O atalho ficava a apontar para
nada e o WindowsEDIA que o shortcut estava corrompido, a oferecer "Reparar" (que,
com `NoRepair = 1` no registo, nao faz nada).

Consequencia pratica: quem o usava estava a correr a **build de desenvolvimento**,
nao a app instalada — o que e' tambem porque o crash da 1.3.6 aparecia mesmo depois
de "instalar". A 1.3.7 recria o atalho no sitio certo.

### Corrigido: a instalacao em Windows ARM deixava a app sem executavel
Reportado a 2026-10-08. Este bug **e' anterior a 1.3.6** — o instalador da 1.3.5
falha exactamente igual — e so' afecta o ARM. O x64 estava sempre bem.

Sintoma: o instalador acaba com **codigo 0**, escreve o registo, cria o
desinstalador e os atalhos — e o `MEIDA.exe` **nao existe**. A app nao arranca, e
quem installou fica sem atalho no ambiente de trabalho.

Comparando `release/win-arm64-unpacked` (2740 ficheiros) com o instalado (2733),
faltavam **7, todos no topo, todos `.exe`/`.dll`**: `MEIDA.exe`, `ffmpeg.dll`,
`vulkan-1.dll`, `d3dcompiler_47.dll`, `dxcompiler.dll`, `dxil.dll`,
`vk_swiftshader.dll`. Os `.pak`/`.dat`/`.bin` estavam todos la.

**A causa: o `app-arm64.7z` embutido no instalador esta truncado.** Com
`7z t` nos dois arquivos do mesmo instalador:

```
app-arm64.7z  ->  ERROR: Unsupported Method : vk_swiftshader.dll
                   Sub items Errors: 7
app-64.7z     ->  Everything is Ok   (2740 ficheiros, 620 pastas)
```

As entradas corrompidas sao as **ultimas** do arquivo, e o `MEIDA.exe` (227 MB) esta
nessa cauda. Isto explica porque `Nsis7z::Extract` **e** `nsisunz::Unzip` falham
(o problema e' o arquivo, nao o metodo de extracao) e porque `useZip: true` e'
**pior** — aborta com codigo 2 e nao instala nada.

Descartado: espaco em disco (694 GB livres), antivirus (zero deteccoes),
permissao de escrita (copiar o `MEIDA.exe` a mao para a mesma pasta funciona),
binarios de arquitectura errada (o `MEIDA.exe` do pacote e' ARM64 a serio).

**Correcao: `--x64` sem `--arm64`.** O Windows ARM corre x64 emulado, e o
`extractAppPackage.nsh` escolhe o pacote "64" em ARM quando `APP_ARM64` nao esta
definido. Troca-se ARM nativo (que nao funcionava) por x64 emulado (que
funciona). Para recuperar o ARM nativo, compilar num PC x86 — o `7za` do
electron-builder e' x86 24.09 e corre emulado aqui; o `app-64.7z` feito nesta
maquina sai perfeito, por isso o problema e' do caminho arm64 sob emulacao.

Verificado de ponta a ponta: codigo 0, 2741/2740 ficheiros (0 em falta, 0
tamanhos errados), `MEIDA.exe` = 0x8664, atalhos do menu Iniciar e do desktop a
apontar para a pasta de instalacao, e a app arrancada com `/` e `/api/health` a 200.

`app:pack`, `app:pack:zip` e `app:publish` ficaram so' com `--x64`.

### Corrigido: o log do instalador
`build.nsis.logging` esta agora `true`. Sem isso o instalador nao deixa rasto do
que fez, e um ficheiro que falha a extrair e' silencioso (ver "Instalador" abaixo).

## 1.3.6

### Corrigido: a presenca no Discord conta o tempo com o video parado
Reportado a 2026-10-08.

O sintoma: o Discord dizia que estavas "a ver" desde o momento em que escolhias
um servidor de video, antes sequer de carregares no play. E o contador nunca
parava — pausar continuava a contar. So' saires do episodio limpava.

Duas causas, no mesmo sítio.

**1. A presenca aparecia ao escolher a fonte.** O `Details.jsx` tinha um efeito
que chamava `showPresence` sem `position` assim que `active` (a fonte escolhida)
mudava. Ia ao Discord a dizer "a ver" sem nada estar a dar. O comentario no
codigo justificava ("nos providers com iframe nao da para saber se estao a
tocar"), mas isso so justifica mostrar o TITULO — nao mostrar como se estivesse
a ver. O efeito foi removido.

**2. O tempo nunca parava.** O `discord-presence.cjs` mandava
`timestamps: { start }` fixo ao escolher a fonte e nunca mais tocava. O Discord
conta "12 min a ver" desde esse instante porque era a unica informacao que
tinha. Sem `paused` nao ha como dizer-lhe que parou.

### Tres estados, em vez de "sempre a ver"
A primeira correcao (deste e do commit anterior) tratou "sem progresso" como
"em pausa", com `timestamps.paused`. Isso estragou o caso dos players em iframe:
nele o progresso **nunca** chega, nem com o video a dar, e portanto ficavam
todos marcados como "Pausado" para sempre — pior do que o defeito original, que
ao menos tinha o contador a verdade.

A distincao que faltava e' entre "parou" e "nunca soube":

| estado | quando | o que vai para o Discord |
| --- | --- | --- |
| `a-ver` | o progresso chega (players nossos) | `timestamps.start`, contador a correr |
| `pausa` | o progresso chegou e parou | `timestamps.start` + `timestamps.paused` (congela, escreve "Pausado") |
| `sem-dados` | nunca chegou progresso (iframes) | **sem `timestamps` nenhum** |

Em `sem-dados` o Discord mostra o titulo, nao conta tempo e nao diz "Pausado".
Nos tres casos o titulo aparece — o que muda e' so se o Discord pode afirmar
alguma coisa. Nos iframes nao sabemos se da', e afirmar seria mentira.

O que separa "parou" de "nunca soube" e' o `viuProgressoRef` do `Details.jsx`:
uma vez que houve progresso, soubemos que aquele player da' sinal, e uma
ausencia a seguir e' uma pausa. Sem isso, um player nosso que arranca devagar
era acusado de pausa logo a partida.

- `electron/discord-presence.cjs`: `activityPayload()` passou a `buildActivity()`,
  funcao pura e **exportada** — e' a logica que decide os `timestamps` e ja esteve
  errada duas vezes, sem ponto testavel nao dava para apanha-la. `setPresence()`
  passou a receber `estado` (valores invalidos caem em `a-ver`, nunca em
  `pausa` — acusar alguem de ter pausado sem provas seria pior).
- Uma mudanca de estado sai **na hora**, sem esperar o `MIN_UPDATE_MS` de 15 s.
  Sem isso o Discord ainda mostrava o estado anterior durante mais 15 s.
- `electron/main.cjs`: acrescentado `estado` a lista de campos do
  `ipcMain.handle("set-presence")`. **Este handler lista os campos um a um**, nao
  passa o objeto — e o `estado` tinha ficado de fora, o que faria o Discord
  receber sempre a omissão e o defeito voltar **sem erro nenhum em lado nenhum**.
- `web/src/pages/Details.jsx`: `presencaPausada` (booleano) substituido por
  `presencaEstado` ("a-ver" | "pausa" | "sem-dados"). `PRESENCA_PAUSADA_MS` = 10 s,
  entre o intervalo com que o player reporta (uns 5 s) e o minimo do Discord
  (15 s), para a pausa aparecer sem demorar. O efeito que envia o estado nao leva
  `position` — quem a manda e' o `reportPos`, porque o `subLine` so escreve o
  tempo se a posicao existir.
- `web/src/discord.js`: `showPresence` passa `estado` em vez de `paused`.

### Testes
`scripts/testar-presenca-discord.mjs`, 24 verificacoes, ligado ao `npm test`
(104 -> 128). Cobre os tres estados e o que cada um manda, o default de um
estado invalido, o encaminhamento do `estado` pelo IPC, e as guardas do
`Details.jsx`.

**O teste foi verificado com o codigo partido** (mutacao + teste), senao nao
prova nada: tirando o `estado` do IPC, mandando `timestamps` sempre, tirando o
`paused` da pausa, e tirando a guarda do `viuProgressoRef`. As quatro dao falha.
(A primeira tentativa de verificar isto **nao aplicou as mutacoes** — o regex nao
batia com o codigo — e o teste passou verde sobre codigo intacto. Passou a
imprimir `mudou? true/false` antes de cada corrida.)

### Nao verificado
O efeito real no Discord so' se ve na app Electron; no browser a presenca e'
no-op (`window.electronAPI` nao existe). Falta testar na app.

## 1.3.5

### Corrigido: a fonte de video escolhida a mao mudava sozinha
Reportado a 2026-10-08, com South Park.

O sintoma: clicavas no VidLove e, uns segundos depois, aparecia o VidLink sem
teres pedido nada.

Causa: o auto-fallback de 15 s do `Player.jsx` dispara sempre que o `load` do
iframe nao chega a tempo. O VidLink e' o provider logo a seguir ao VidLove na
lista de `server/src/services/providers.js` (ordem: vidapi, moviesapi, vidlove,
vidlink), por isso era esse que ficava com o video. Num player de serie pesada
isto acontece com regularidade.

O selector de fonte punha o VidLove (`setPlayerIndex`), mas nao dizia ao player
que a escolha era da pessoa — o timeout continuava a contar.

- `Details.jsx`: novo estado `fonteManual`, posto a `true` nos dois `onSelect`
  (filme e serie) e passado ao `Player` como `manual`.
- `Player.jsx`: com `manual`, o timeout espera `TIMEOUT_MANUAL_MS` (45 s) em vez
  de 15 s e, em vez de trocar de fonte, so chama `setLoaded(true)` — deixa de
  mostrar "a carregar" e a fonte fica.
- O health-check (`deadIds`) continua a trocar de fonte: uma fonte marcada como
  morta esta mesmo partida, e ai mudar e' o que ajuda. O que deixou de acontecer
  e' a troca por lentidao.
- Titulo novo volta ao automatico (`setFonteManual(false)` no efeito que carrega
  os detalhes). Dentro do mesmo titulo, a escolha mantem-se de episodio a
  episodio.

`scripts/testar-player-fonte.mjs`, 7 verificacoes da decisao do timeout.

### A barra da pesquisa: cinco tentativas, e a que resulta
O problema original (1.3.4): a pilula da barra e' **centrada**
(`left: 50%` + `translateX(-50%)`) com `backdrop-filter: blur(20px)`. Quando o
input crescia de 0 para 180 px a barra recentrava e deslizava 90 px para a
esquerda, e o fundo ia com ela.

Cada tentativa de corrigir criou um defeito diferente, todos medidos:

| tentativa | defeito |
| --- | --- |
| `position: absolute` no input | a barra parava de mexer, mas o input crescia por cima dos links de navegacao |
| `min-width: 400px` no `.search` | barra de 744 px com os links a ocupar 222 px — 484 px de vao morto |
| `background` opaco no input | rectangulo de cor ligeiramente diferente do fundo da pilula |
| `outline` para o foco | desenha-se por FORA da caixa e nao e' recortado pelo `border-radius` da pilula — a linha vermelha saia da barra |

A solucao: **os links e o input trocam de lugar com a mesma largura**. Ao abrir,
o `nav-left` encolhe para `width: 0` (com `overflow: hidden`) e o input cresce
para a esquerda pelos mesmos 222 px — a largura real dos links, medida, nao um
valor inventado. A pilula fica com a mesma largura nos dois estados.

- input transparente e sem borda: e' uma janela dentro da pilula, nao uma caixa
- `caret-color: var(--accent)`: o cursor na cor da app e' o sinal de "podes
  escrever aqui", sem precisar de moldura
- foco desenhado pela propria pilula com `box-shadow: inset 0 0 0 1px` — o
  `inset` fica sempre dentro e nunca transborda

Medido: barra 382 px igual fechada e aberta, nav-left 222 -> 0, input 0 -> 222,
sem sobreposicao.

### Testes
`npm test` de 97 para **104** verificacoes (48 servidor + 14 adblock + 14
autoplay + 22 estados + 17 notificacoes + 44 tempo + 7 fonte de video).

## 1.3.4

### Corrigido: aviso "a carregar" permanente e troca de fonte com o video a dar
Reportado a 2026-10-07, so na app de desktop (nao no browser).

O sintoma eran dois na mesma causa: o aviso `megaplay (anime) a carregar...`
ficava no ecra com o video a reproduzir, e a fonte mudava uns segundos depois de
o episodio arrancar.

Causa: `deadIds` estava nas dependencias do efeito que reinicia o player
(`web/src/components/Player.jsx`). O health-check chega **depois** do video
comecar — no backend local gasta ~2 s a sondar os 10 providers e o
`useProviderHealth` volta a perguntar de 3 em 3 s — e ao passar de `null` para
`Set` disparava:

1. `setReloadKey(k + 1)`: o React deitava fora o iframe e criava outro **com a
   mesma URL**, que vinha do cache. Da' a "fonte a mudar uns segundos depois".
2. `setLoaded(false)`: o aviso "a carregar" reaparecia com o video a dar.
3. O `load` do iframe recriado disparava em milissegundos, as vezes antes de um
   efeito ter tempo de lixar o listener `addEventListener`. Perdia-se o evento,
   `loaded` ficava a `false` para sempre, e aos 15 s o timeout de fallback trocava
   de fonte com o video a reproduzir bem.

Tres mudancas:

- `deadIds` saiu das dependencias do reinicio. Houve agora um efeito separado que
  so sai da fonte actual **se ela estiver mesmo nos mortos** (e nao quando o
  health-check chega).
- O `load` passou para o `onLoad` do React, para o listener estar ligado quando
  o elemento e' criado em vez de depois.
- O timeout passou a guardar o estado em refs e a respeitar `arrancado` (com o
  autoplay desligado nao ha iframe, e contar 15 s trocava a fonte sem a pessoa
  ter carregado em nada).

Verificado no browser durante 40 s, com o health-check a resolver dentro da
janela: zero recreacoes de iframe, zero avisos. A troca de titulo continua a
reiniciar o player.

### Corrigido: "vistos" e "para ver" em branco nas Estatisticas do perfil
Desde a 1.3.2. `ProfileStats.jsx` renderiza `s.vistos` e `s.aVer`, mas
`detalheStats()` nunca os devolvia — so' `statsFrom()` os calcula, e a aba nao o
chama. Passavam a ser `undefined`, que o React renderiza como vazio. O cabecalho
do perfil nao se notava porque usa `statsFrom()`.

Passaram a ser calculados no mesmo ciclo, com o mesmo `estadoDe()`, e por isso
tambem respondem a qualquer filtro.

### Corrigido: filtro da biblioteca nao voltava a pagina 1
`Library.jsx` chamava `setFilter`/`setSort`/`setTypeFilter` sem mexer em `page`.
Estar na pagina 9 e carregar em "Em pausa" saltava para a pagina 9 de uma lista
com 2 — ou seja, para o fim dela. O `safePage` escondia o defeito: limitava a
pagina mas limitava para a ultima.

### Corrigido: a barra da pesquisa mexia o fundo desfocado
`.nav-bar` e' uma pilula **centrada** (`left: 50%` + `translateX(-50%)`) com
`backdrop-filter: blur(20px)`. Quando o input crescia de 0 para 180 px a barra
recentrava e deslizava 90 px para a esquerda, e o fundo ia com ela (medido:
fechada `left=184`, aberta `left=94`, centro fixo em 395).

O input passou a `position: absolute`, a crescer para a **esquerda** por cima dos
links de navegacao. Fora do fluxo, nao contribui para a largura do pai, portanto a
pilula mantem-se constante. Depois: `mexeu: false`, barra e menu de perfil
identicos nos dois estados.

### Novo: paginacao na biblioteca do perfil
`PosterGrid` (que serve a biblioteca e as listas) passou a paginar a 60 por
pagina — o mesmo que a pagina de biblioteca, para o dedo saber onde esta o
"Seguinte". Mudar de perfil ou de lista volta a pagina 1; a pagina nunca passa do
fim. A biblioteca principal ja paginava (60 por pagina); o scroll gigante era o
do perfil.

### Novo: sino de notificacoes
Migracao 5 (`server/src/db/schema.js`), rotas em
`server/src/routes/notifications.js`, store em `server/src/store.js`, sino em
`web/src/components/NotificationBell.jsx`.

Tres eventos: resposta a um comentario, gosto num comentario, e "comecou a
seguir-te". Duas regras que o store garante: nunca notificar a pessoa de si
propria, e nunca duplicar (indice unico em `(user_id, kind, ref_id, actor_id)`).
O `like` so notifica se o like foi mesmo novo (`guard.changes > 0`).

Detalhe importante de montagem: o `requireAuth` esta **em cada rota**, nao com
`router.use(...)`. Um `router.use(requireAuth)` corre para todos os pedidos que
entram no router e, sem token, responde 401 em vez de seguir — e como este router
e' montado em `/api`, isso partia o registo e o login de toda a gente. Apanhado
pelo teste de fumo ponta a ponta.

### Novo: rosto do comentario e datas relativas
- A contagem do like passou a aparecer **sempre**, mesmo a zero. Antes so
  aparecia com `likes > 0`, e com zero ficava um coracao solto sem contexto —
  dai a conclusao de que nao havia likes. O `.on` ganhou contorno alem da cor
  (para se ler sem depender so da cor) e `aria-pressed`.
- `when()` (data absoluta "07 out") deu lugar a `haQuanto()`: "agora mesmo",
  "ha 10 seg", "ha 3 min", "ha 5 h", "ha 2 dias", e data completa depois de uma
  semana. Datas no futuro nao dao negativos (desvio de relogio entre maquinas).
- O campo do momento deixou de ser `<input type="number">` (pedia `125` para
  dizer 2:05) e passou a texto em `m:ss`, aceitando as duas escritas, com
  mensagem de erro e a bloquear o botao. Ganhou um "neste momento" quando o
  player sabe a posicao (nos providers em iframe nao ha, e ai o botao nao
  aparece em vez de aparecer morto).

Novo modulo `web/src/lib/tempo.js` com **44 verificacoes** em
`scripts/testar-tempo.mjs`.

### Melhorado: generos das Estatisticas em portugues
A BD guarda os generos em ingles (vem da TMDB/AniList). `ROTULO_GENERO` traduz
para mostrar e o que nao tiver traducao usavel aparece tal e qual ("Isekai",
"Shounen"). A chave continua a ser o nome original: `"Music"` e `"Música"`
existem os dois na BD e traduzem para a mesma palavra, e chaves repetidas fazem o
React trocar linhas.

### Testes
`npm test` passou de 84 para **97** verificacoes (48 servidor + 14 adblock +
14 autoplay + 22 estados + 17 notificacoes + 44 tempo).

## 1.3.3

### Corrigido: o autoplay desligado nao impedia o MegaPlay de arrancar
Reportado a 2026-10-07, no MegaPlay (o provider de anime principal).

A app ja fazia as duas coisas obvias (ver `Player.jsx`): tirar `autoplay` do
atributo `allow` do iframe, e acrescentar `?autoplay=false&autoPlay=false` ao
URL. Nao chegava, por dois motivos medidos:

**O MegaPlay nao aceita o parametro.** O HTML do player
(`megaplay.buzz/stream/ani/<id>/<ep>/<audio>`) tem:

```js
window.settings = { time: 0, autoPlay: "1", ... }   // fixo, sempre "1"
// o unico parametro lido da query string e' ?time= e ?unix=
```

Ou seja, nao existe parametro que faca o player nao arrancar.

**O `allow` so pode dar permissao, nunca tirar.** E mesmo sem delegacao, o
Chromium autoriza o autoplay quando a origem tem Media Engagement Index — ou
seja, depois de algumas semanas a ver anime com som no mesmo sitio. E' por isso
que o defeito so aparecia no MegaPlay.

Primeira tentativa (mantida): injectar `Permissions-Policy: autoplay=()` nas
respostas de documento, em `electron/autoplay.cjs`. O log de diagnostico
confirmou que o cabecalho **sai mesmo** (`subFrame BLOQUEIA autoplay ->
autoplay=()`) e mesmo assim o video arrancou. Ficou como segunda barreira,
porque e' correcta e vale para outros providers.

A correcao que resolve e' no `Player.jsx`: **com o autoplay desligado, o iframe
so nasce depois de um clique.** Enquanto ele nao existir nao ha video para
arrancar — nao depende do browser, do provider, nem de politica nenhuma.

Cuidados que dao jeito:

- So o **primeiro** carregamento precisa de clique. Depois o auto-fallback de
  15 s volta a trocar de fonte sozinho, como sempre.
- Volta a aparecer em **fonte nova** (episodio seguinte, trocar de audio).
- Se ligares o autoplay, desaparece e o player abre logo como antes.
- O botao e' um `<button>` de verdade (Tab/Enter/Space), com `focus-visible`.

`MEIDA_AUTOPLAY_DEBUG=1` liga o log de diagnostico, como o do adblock.

### Novo: "em pausa" e "abandonado" na biblioteca
Os estados que o MyAnimeList e o AniList tem e que aqui faltavam. Sem eles, os
estatisticos do perfil contavam tudo o que estava na watchlist como "para ver".

**Migracao 4** (`server/src/db/schema.js`): uma coluna `status TEXT`. Uma coluna
em vez de mais duas flags porque os estados sao **mutuamente exclusivos** — com
flags e' possivel ficar "visto E abandonado" ao mesmo tempo, e cada consumidor
tinha de inventar a sua regra para desempatar. `NULL` = usa as flags de sempre,
portanto os titulos existentes nao mudam de estado.

**`estadoDe()`** em `server/src/store.js` e' a unica funcao que decide o estado
final, para nao haver duas regras. A mesma regra esta replicada em
`web/src/components/profileStats.js` — o frontend **nao pode** importar o store
do servidor, porque essa cadeia traz o SQLite e abriria uma base de dados
dentro do browser.

`scripts/testar-estados.mjs` (22 verificacoes, ligado ao `npm test`) passa por
cima das **duas** versoes e compara os 12 casos possiveis de
`status` x `watched` x `watchlist`. Se uma mudar sem a outra, falha. Foi a
divergencia entre as duas que causou o bug original.

UI: dois botoes na ficha (`LibraryControls.jsx`) ao lado do "Watchlist" e do
"Marcar como visto". O abandonado fica **riscado**, como no MyAnimeList. Dois
filtros novos na biblioteca.

Ao atribuir `paused`/`dropped`, a rota **limpa** `watched`/`watchlist` — se nao, o
titulo contava duas vezes (como "em pausa" e como "para ver"), que e' exactamente
o bug do 389. Tirar o `status` nao repoe a watchlist: quem despausa decide de
novo o que quer com o titulo, em vez do app adivinhar.

### Corrigido: o perfil dizia "a ver" quando queria dizer "para ver"
Duas coisas diferentes com o mesmo nome em portugues:

- No **diario**, "A ver" e' o `status: watching`, que so existe depois de
  arrancar um titulo. E' mesmo o presente.
- No **perfil**, `aVer` contava `watchlist && !watched` — a intencao.

Resultado: o perfil dizia 389 "a ver" quando a pessoa via 2. Agora sao dois
numeros separados. "A ver agora" vem do diario e so aparece **no teu proprio
perfil** — o diario de outra pessoa nao e' publico, e mostrar 0 ai seria
mentira.

### Corrigido: o grafico das notas nao dizia nada
As barras de 20 em 20 davam `1 / 3 / 30 / 167 / 104`. Numa escala 0-100 quase
toda a gente nota entre 60 e 100, por isso tres quartos da biblioteca cabia em
duas barras: tres quartos do grafico para dizer que duas barras eram maiores que
as outras.

Substituido por um **espectro** — uma linha 0-100 com as marcas da nota mais
baixa, da mediana e da mais alta. E' a mesma linguagem visual do "Comparar com a
comunidade" que ja existia na ficha (`.lib-rating-track`), por isso nao parece um
grafico colado de fora.

### Corrigido: "Mais vistos" nao mostrava os mais vistos
Ordenava por **nota**, nao por reproducoes — e nao ha contagem de reproducoes em
lado nenhum, por isso o nome era mentira. Passou a "Melhores notas", e so mostra
titulos que tem nota (antes dos cinco podiam ser os cinco primeiros com 100, por
ordem da base de dados).

## 1.3.2

### Corrigido: acabando um episodio de anime, o titulo saia do "continua a ver"
Bug no servidor, em `finishProgress` (`server/src/store.js`):

```js
// antes
const hasNext = e.nextSeason != null && e.nextEpisode != null;
```

Exigia **temporada E episodio**. Mas no anime os episodios sao globais (1..N) e
**nao ha temporada** — o cliente (`nextEpisodePos` em `web/src/pages/Details.jsx`)
manda `nextSeason: null`. Logo `hasNext` era SEMPRE falso para anime: marcava
acabado ao fim de cada episodio e a entrada saia do "continua a ver" em vez de
avancar para o seguinte.

Series e filmes funcionavam sempre (a temporada vem preenchida), que e' porque
isto passou meses sem dar sinal — e porque o teste que existia em
`server/test/store.test.js` so cobria `type: "tv"` com temporada, passando com o
bug. Agora a decisao e' so pelo episodio:

```js
const hasNext = e.nextEpisode != null;
season: hasNext ? e.nextSeason ?? cur.season ?? null : e.season,
```

O `?? cur.season` preserva a temporada quando o proximo episodio vem sem ela (anime).

### Corrigido: as legendas desapareciam em alguns episodios
Consequencia do bug seguinte. Com o `load` do iframe nunca a chegar, o
auto-fallback de 15 s disparava mesmo com o video a reproduzir e trocava de
fonte — e a fonte nova vinha sem legendas. Corrigir o `load` resolveu os dois.

### Corrigido: "a carregar" ficava no ecra com o video a dar
`web/src/components/Player.jsx`. O efeito que regista o listener de `load` tinha
`[active, lista, deadIds, index]` nas dependencias, e nao `reloadKey`. Mas outro
efeito faz `setReloadKey(k + 1)` ao abrir, e o `key` do `<iframe>` obriga o React
a **deitar fora o elemento e criar outro**. O listener ficava ligado ao iframe
que ja tinha ido para o caixote, e `load` nunca chegava.

Consequencias, ambasmeasured em 2026-10-06 no VidCore:
- o aviso "MegaPlay · a carregar..." ficava 15 s no ecra com o video a dar;
- ao fim dos 15 s, o auto-fallback trocava de fonte a meio da reproducao.

Acrescentado `reloadKey` as dependencias. Aproveitei para tirar um `ref` que
estava nos dois elementos ao mesmo tempo (o `div` e o `iframe`): o iframe
ganhava por ordem da anexacao das refs, o que e' fragil.

### Corrigido: o 111Movies deixou de funcionar
`111movies.com` deixou de resolver: o DNS do proprio dominio passou a falhar
(`EAI_AGAIN`, e o PowerShell responde "falha do servidor DNS"). Isto e' pior do
que uma pagina de erro — da erro de **rede**, por isso o health-check via timeout
em vez de dizer "esta morto", e nenhuma url funcionava.

O servidor de video do proprio 111Movies continua de pe em `player.vidlove.cc` e
tem o **mesmo formato de url**. Medido a 2026-10-06 (Fight Club, Inception,
Breaking Bad S1E1):

| url | resposta |
| --- | --- |
| `/embed/movie/{tmdb}` | 200, 69-122 ms |
| `/embed/tv/{tmdb}/{s}/{e}` | 200 |

Comprovado com `readyState: 4` e duracao 2:19:08 no Fight Club (2h19 reais), e
legendas + Chromecast + picture-in-picture. **162 ms** no health-check — terceiro
mais rapido dos 10 providers. O id passou de `111movies` para `vidlove`.

Duas coisas ficaram escritas em `providers.js`: nao arranca sozinho (o `<video>`
so existe depois de carregar no play), e **o stream passa por um dominio de
anuncios** (`a2.<palavra>.cfd/api?d=...`, com a palavra a mudar de sessao), pelo
que `.cfd` nunca pode ser bloqueado por TLD.

### Corrigido: o audio (legendado/dobrado) nao se guardava
`localAudio` em `web/src/pages/Details.jsx` era `useState(null)`: so vivia
enquanto a pagina estivesse aberta. Voltar ao Inicio e clicar outra vez em
"continua a ver" trazia o `sub` das Definicoes, e a barra de audio voltava ao
estado inicial. Como ha animes que so existem dobrados, mudar a definicao global
nao resolvia (e nao devia: o dub e' so desse).

Agora e' guardado **por titulo**, em `localStorage` (`audioTituloStore` em
`web/src/api/client.js`, chave `"<tipo>:<id>"`). Sem entrada = segue as Definicoes.

Os **dois** sitios que escolhem passam pela mesma funcao, `escolherAudio`:
- a barra "Audio deste titulo" — e' a que manda `audio` na URL dos providers, por
  isso o dub nos providers tambem fica guardado;
- os chips Legendado/Dobrado/Todos da lista de torrents, que passou a ter
  `onAudioChange`.

O "Todos" dos torrents e' deliberadamente ignorado por `escolherAudio`: nao
corresponde a nenhum valor de URL de provider, e nao deve desfazer o dub guardado
so porque a pessoa foi ver a lista toda.

Nota: fica em `localStorage`, como as Definicoes, portanto **nao acompanha entre
PCs**. Passar para o servidor e' uma coluna nova na tabela do utilizador.

### Corrigido: anuncios no VidCore
Medido a 2026-10-06 em `vidcore.org/embed/movie/27205`: 171 pedidos, dos quais a
pagina traz **dois scripts no `<head>` sem relacao com video**:
`wwr.giriudog.com` (135 KB de motor de anuncios, com `popunder`, `window.open`,
`beforeunload`) e `clarity.ms` (Microsoft Clarity, que **grava a sessao** — cliques
e scroll — e envia para a Microsoft).

Mais as camadas que se desenham por cima do video (`cdn.holdbitter.com`, que e' o
"play" falso do `/in-page-push/`), e pixels de tracking e de leilao (RTB).
Bloqueados 16 dominios, em `electron/adblock.cjs`.

**A parte delicada:** `downloadhub4u.xyz`, `vidzen.fun`, `vidrack.created.app` e
`vdrk.site` parecem anuncios (`downloadhub`, `vidzen`) e **nao sao** — sao a cadeia
que resolve o stream e as legendas. Bloquea-los dava um player preto sem erro.
Estao em `NEVER_BLOCK` com o motivo escrito, e em `verificar`-land no teste.

### Novo: teste do bloqueador de anuncios
`scripts/testar-adblock.cjs`, ligado ao `npm test`. Confirma os dois sentidos
(18 anuncios bloqueados, 14 urls de video/legendas livres) e falha a build se
alguem mexer na lista. Foi verificado que falha mesmo: com o bloqueio total
forcado, apanha 15 problemas.

`eslint.config.mjs` passou a cobrir `scripts/**/*.cjs` — ate agora os scripts em
CommonJS nao tinham os globais de Node declarados.

### Novo: aba de Estatisticas no perfil
`web/src/components/ProfileStats.jsx` + `detalheStats()` em
`web/src/components/profileStats.js`. Tudo calculado no cliente a partir da
biblioteca que a API ja devolveu — sem pedidos extra.

Conteudo: media e mediana (juntas dizem coisas que uma barra sozinha nao diz),
distribuicao das notas em 5 faixas, generos mais marcados, split por tipo, e os
titulos com nota mais alta.

O que **nao** se mostra, e porquê: ano de estreia, temporada, estudio, duracao e
numero de episodios. Nada disso esta' na tabela `library` (`toApi()` em
`server/src/store.js` so' tem tipo, generos e nota), por isso esses graficos
dariam sempre zero.

A barra cresce contra o **maior** do bloco, nao contra o total: senao a barra
mais alta ocupava a largura toda e as outras sumiam.

### Redesenho do perfil
A capa (o poster esticado) saiu. Deu problema de tres maneiras seguidas: ficava
presa aos 1200px do content num ecra largo, o degradue tapava o nome (o fade
tinha `z-index: 2` e o bloco da identidade nao tinha nenhum), e o avatar a pousar
sobre a capa obrigava a margens negativas.

O que ficou e' fluxo normal, sem posicao absoluta, sem margem negativa, sem
sobreposicao — nao ha largura de ecra onde se desfaca. O `max-width: 1200px` foi
tirado para o cabecalho alinhar com a grelha de cartazes, e o nome passou a 34 px
(maior que os numeros) para o perfil ter hierarquia.

## 1.3.1

### Corrigido: o video comecava sozinho com o autoplay desligado
- `web/src/components/Player.jsx` punha **sempre** `allow="autoplay"` no iframe.
  Isso da ao player do provider permissao para arrancar sozinho, independently
  da definicao nas Definicoes. Agora essa permissao so entra quando o autoplay
  esta ligado.
- O `applyPlaybackPrefs` ja acrescentava `autoplay=false` ao URL, mas poucos
  providers respeitam o parametro quando o iframe tem a permissao — o parametro
  sozinho nao chega.

### Corrigido: o player saltava sozinho de servidor a cada 15 s
Bug com tres partes, todas em `web/src/components/Player.jsx`:

1. **`nextAlive(i)` devolvia a propria fonte que estava a falhar.** O loop
   comecava em `j = i`, logo a fonte partida era logo devolvida como "a
   seguinte". Como o timeout de 15 s usava essa funcao, o auto-fallback nunca
   saia da fonte que falhava e reiniciava a mesma. Passa a comecar em `i + 1` e
   devolve `i` quando nao ha mais nenhuma.
2. **Um provider devolvia um `data:` URL.** O caso reportado foi
   `data:application/pdf;base64,aG1t` — um PDF disfarçado de pagina. O Chromium
   aborta o carregamento, o iframe **nunca dispara `load`**, e por isso o timeout
   de 15 s expirava sempre. Agora a lista e filtrada antes de ser usada
   (`ePlayerValido`): so entram URLs `http(s)`. Um `data:` URL tambem nao pode
   receber `?autoplay=` — isso juntaria lixo a um base64.
3. **O timeout mexia mesmo nao havendo alternativa.** Agora, se a fonte que
   falhou era a ultima, para em vez de ficar a recarregar a mesma.

Acrescentado: quando a fonte muda sozinha, aparece um aviso discreto
("<fonte> nao carregou · a usar <fonte>") em vez da marca mudar sem explicacao.

### Corrigido: o aviso de "a janela ficou em branco" disparava sem ser preciso
O `did-fail-load` do Electron dispara **tanto para a janela principal como para
cada iframe**, e o handler so lia os quatro primeiros argumentos. Portanto um
iframe de provider a falhar era tratado como se a janela inteira tivesse
caido — com a app perfeitamente saudavel (que era o sintoma reportado: o aviso
 aparecia sempre que o video comecava ou se mudava de servidor, e o video
funcionava na mesma apos fechar).

- O quinto argumento (`isMainFrame`, confirmado no `electron.d.ts`) passa a ser
  lido: um iframe que falha so fica registado.
- **`-102` (ERR_CONNECTION_REFUSED) durante o arranque.** O `loadWithRetry` tenta
  ate 80 vezes, e cada tentativa falhada disparava um "a janela ficou em branco"
  a cada 500 ms. Agora o handler sabe quando ainda ha tentativas pendentes
  (`tentativasRestantes`) e so avisa se ja nao ha mais — ou seja, se o servidor
  cair mesmo a serio depois da app ter aberto. O contador e' reposto no
  `did-finish-load`, para que uma queda posterior volte a avisar.
- **O URL saiu da caixa de dialogo.** Um `data:` URL em base64 nao cabe, e o
  utilizador via so um bocado do codigo (foi o "ts" que apareceu no ecrã do
  utilizador). O URL completo fica no registo, com o caminho indicado.

### Verificado

- Regra do `did-fail-load`, com a logica reproduzida: iframe falhado sem dialogo;
  `-102` com tentativas pendentes sem dialogo; `-102` e `-105` sem tentativas
  pendentes com dialogo. Um dialogo, so no ultimo caso.
- `ePlayerValido`: aceita `http(s)`, rejeita `data:`, `javascript:`, vazio e
  `null` — incluindo o `data:application/pdf` do caso reportado.
- `nextAlive`: salta para a seguinte, roda para a anterior quando e' a ultima, e
  devolve o proprio indice quando nao ha nenhuma alternativa.
- `allow` muda conforme a definicao: com autoplay ligado leva `autoplay; ` a
  frente, desligado nao leva.
- ESLint e `npm run build` do frontend limpos.
- O `lint` do repositorio continua nos mesmos 16 erros que ja estavam.

### Notas

- O instalador e' **unico e serve as duas arquitecturas**: `builder-debug.yml`
  tem `x64:`, `arm64:` e `nsis:`, e o `latest.yml` aponta para um so ficheiro
  (`MEIDA-Setup-1.3.1.exe`). O `electron-builder` mete os dois apps no mesmo
  instalador e deixa-o extrair o certo conforme o PC. Por isso o botao
  "Procurar atualizacao" funciona igual em ARM e x86.
- A script de reparacao continua a repor os ficheiros a partir da zip porque o
  instalador do electron-builder ja demonstrou sair com codigo 0 sem extrair
  ficheiros (o bug dos arm64). Para uma atualizacao de rotina o botao chega; a
  linha e' para quando a instalacao esta estragada.

## 1.3.0

### A versao web passa a ver os mesmos dados que a app de desktop

Era a resposta a "os comentarios estao a ser partilhados em todos os
computadores". A arquitectura **ja existia**: `web/src/api/client.js` manda as
rotas de dados para um servidor remoto e so mantem local o video e o catalogo.
O que faltava era dizer ao browser qual e' esse servidor — so a app de Electron
o sabia, por `electron/default-server.txt`.

- **`web/public/runtime-config.json`** ganha
  `VITE_REMOTE_DATA_BASE: "https://meida.fadehost.app"`. O `main.jsx` ja lia
  este valor do ficheiro quando nao ha Electron, por isso e' o sitio certo.
  Antes so havia `VITE_API_BASE`, e a versao web usava a base de dados dela
  propria — contas e comentarios diferentes dos da app de desktop.
- **`server/src/index.js`**: `/runtime-config.json` passa a ser gerado. O
  servidor le o ficheiro de `web/public/` e substitui o `VITE_REMOTE_DATA_BASE`
  pelo valor de `MEIDA_REMOTE_DATA_BASE`, se existir. Assim trocar o servidor de
  dados deixa de obrigar a recompilar o frontend e a redeployar, e a config
  errada nao fica presa na cache do navegador (`Cache-Control: no-store`). A
  variavel sobrescreve **so** o `VITE_REMOTE_DATA_BASE`, nunca o resto, para nao
  se perder o `VITE_API_BASE`.
- **`web/src/main.jsx` (correccao obrigatoria)**: ao meter um
  `VITE_REMOTE_DATA_BASE` no ficheiro, a app de desktop em modo "local" passava a
  mandar contas e comentarios para a nuvem sem ninguem ter pedido — o codigo so
  sobrescrevia o valor quando o modo era "remote", e em "local" o runtime-config
  era aceite. Agora, se o Electron responder e o modo nao for "remote",
  `MEIDA_REMOTE_DATA_BASE` e' posto a `""`.

### O que passa a ser partilhado

Tudo o que `LOCAL_API_PREFIXES` (`web/src/api/client.js`) nao lista:

| Vai para o servidor partilhado | Fica local |
| --- | --- |
| contas e sessao (`/api/auth/login`) | video e legendas (`/api/stream`, `/api/play`, `/api/subtitles`, `/api/proxy`) |
| biblioteca, listas, diario (`/api/library`, `/api/export/json`) | catalogo (`/api/catalog`, `/api/search`, `/api/details`) |
| perfis e ligacoes (`/api/profile/me`, `/api/mal/link`) | torrents (`/api/torrents`, `/api/debrid`) |
| **comentarios** (`/api/comments`) | health |
| MAL / AniList / Letterboxd (`/api/letterboxd/diary`) | watch party (`/api/wp`, para ficar na mesma maquina) |
| watch party state, conquistas | |

### CORS verificado (a peca que estava em duvida)

O `cors()` so e' desligado quando `SERVE_WEB === "1"`, e o FadeHost nao serve a
interface — logo o CORS fica aberto. Medido em `https://meida.fadehost.app`:

```
GET /api/health  (Origin: https://meida.onrender.com)
  -> HTTP 200, Access-Control-Allow-Origin: *
OPTIONS /api/auth/login
  (pre-flight com POST e content-type,authorization)
  -> HTTP 204, Allow-Origin: *, Allow-Headers: content-type,authorization,
     Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
```

Ou seja: o browser consegue autenticar-se no servidor partilhado a partir da
versao web. Sem isto, a mudanca nao funcionaria.

### Testado

- compilacao: o `runtime-config` novo foi para o `web/dist`.
- servidor sem a variavel: `{"VITE_API_BASE":"","VITE_REMOTE_DATA_BASE":"https://meida.fadehost.app"}`.
- servidor com a variavel: `{"VITE_API_BASE":"","VITE_REMOTE_DATA_BASE":"https://outro-servidor.exemplo"}` (a barra final e' removida).
- `Cache-Control: no-store, no-cache, must-revalidate`.
- `/api/health` e `/` continuam a responder, `/` traz `div#root`.
- destino de cada rota reproduzindo a logica do `baseFor()` (ver tabela acima).
- lint: 16 erros antes e 16 depois — os 16 ja la estavam.

### Notas

- **Falta um redesploy no Render** para isto valer na versao web. O Render so
  redesplega depois de um push.
- Quem tinha conta **na versao web** perde o acesso a essa conta: os dados do
  Render deixam de ser lidos. E' preciso criar a conta outra vez (ou migrar com
  `POST /api/admin/seed` no FadeHost, se `ADMIN_TOKEN` estiver definido).
- A base do Render passa a guardar so catalogo e video — mais leve e mais
  previsivel. Em troca, o FadeHost hiberna quando para, e o primeiro pedido
  depois de um tempo parado demora uns segundos a acordar (ja acontecia com a
  app de desktop).
- O `node_modules` deixa de se poder envelhecer: `install:all` passou a usar
  `npm ci`. Ver a seccao da 1.2.9 e o commit `bfd3267`.

## 1.2.9

### Corrigido: o Electron desatualizado no node_modules (build sem dar erro)
- **Sintoma**: nenhuma mudanca no codigo, mas qualquer build feita nesta maquina
  sairia com o Electron errado e a app nao abria (janela preta, `Cannot GET /`).
- **Causa**: depois do pull, o `package.json` passou a pedir `electron 44.5.1`
  (exacto, sem `^`) mas o `node_modules` continuou com **33.4.11**, porque o
  `npm install` nunca tinha corrido com o pin novo. O `electron-builder` nao tem
  `electronVersion` fixo: tira a versao de `node_modules/electron`, por isso
  empacotou 33.4.11 **sem dar qualquer erro** — o log ate escreve
  `electron=33.4.11` como se estivesse tudo bem. Sem `node:sqlite` (que so
  existe no Node 22+, importado em `server/src/db/index.js`) o backend morre no
  `import` e a app mostra `Cannot GET /` em qualquer PC. E' o mesmo modo de
  falha da 1.2.4, por outra via: ali o `package.json` dizia `^44.5.1`; aqui o
  pin estava certo mas o `node_modules` e' que estava velho.
- **Correcao**:
  1. `npm install` na raiz (aumentou o electron para 44.5.1) e
     `node node_modules/electron/install.js` — o `postinstall` tinha sido
     ignorado e `node_modules/electron/dist/` nao existia. Sem isso o modo de
     desenvolvimento (`npm run app:electron`) nem arranca; o empacotamento
     nao é afectado porque o `electron-builder` descarrega o Electron do GitHub.
  2. **`scripts/verificar-electron.cjs`** — novo hook `beforePack`
     (`"beforePack"` no `build` do `package.json`) que compara a versao de
     `node_modules/electron/package.json` com a de `package.json` e **falha a
     build** se forem diferentes. Testado nos dois sentidos: passa com a versao
     certa e, a pedir `33.4.11`, a build morre antes do `packaging`
     (`failedTask=build`). E' a diferenca entre "ninguem ve o erro" e "a build
     para logo".
- **Porque nao basta o `^`:** `electron-updater` e' que instala versoes novas
  para o utilizador; o `^`/`~` nao influencia o empacotamento. O queinfluencia e'
  o que esta instalado em `node_modules` no momento da build — e esse e' agora o
  que o hook verifica.

### Corrigido: o script de verificacao perdia as mensagens que diziam a causa
- `scripts/verificar-x86.ps1` tem 9 chamadas com concatenacao **fora de
  parenteses**, em `OK "texto " + $variavel` e
  `Write-Host "porta " + $Porta + "..."`. Em PowerShell isto **nao concatena**:
  passam-se 3 argumentos ("texto ", "+", valor) e a funcao, que so via o
  primeiro, imprime a frase sem o valor.
- O que se perdia era precisamente o que interessa quando algo falha:
  - `release mais recente no GitHub: ` (sem a versao)
  - `porta  + 5175 + ` (em vez de `porta 5175`)
  - **todas as mensagens de erro**: `nao consegui abrir a zip: `,
    `o pedido de torrents falhou: `, `o catalogo nao respondeu: `,
    `nao consegui ler as releases do GitHub: ` — e `o programa principal e' ` /
    `o programa nativo e' ` sem o tipo, que e' a informacao central do script.
- **Correcao**: parenteses nas 9 chamadas, e as funcoes `OK`/`Mal`/`Duv` passam a
  juntar todas as palavras que lhes sao passadas (`JuntarMensagem`). Se sobrar
  mais de um argumento, avisa — foi o que apanhar a 9.ª ocorrencia, que a
  primeira busca por `Select-String` nao tinha mostrado.

### Corrigido: a verificacao dava falsos erros nos pacotes arm64
- O script comparava o tipo de tudo com `"x64"` fixo. Numa maquina ARM o
  instalador poe a variante ARM64 (e AI que esta certo), e a zip arm64 dava
  "[FALHA] o programa nativo e' ARM64" — a dizer que estava partido algo que
  estava bem.
- Agora ha `$EsteTipo` (o da maquina, para a app instalada) e `$Esperado` (para
  cada pacote: o nome da zip diz `-arm64-win` = ARM64, `-win` = x64), e o
  esperado e' escrito no ecra antes de comparar.
- Tambem deixou de estar a versao "1.2.8" escrita a mao na lista de zips a
  procurar: agora vem do GitHub e, se isso falhar, aceita qualquer
  `MEIDA-*-win.zip` da pasta `release/`.

### Corrigido: o AGENTS.md dizia que a maquina de build era Windows sobre ARM
- **O AGENTS.md estava certo** — falava do **laptop**, que e' Windows sobre ARM
  (`PROCESSOR_ARCHITECTURE = ARM64`, Snapdragon). E' de la que sairam as builds
  1.2.0-1.2.2 so arm64 e o Electron 33.4.11.
- **Este PC de desenvolvimento e x86**, medido em 2026-10-05:
  `PROCESSOR_ARCHITECTURE = AMD64`,
  `PROCESSOR_IDENTIFIER = AMD64 Family 23 Model 96 Stepping 1, AuthenticAMD`,
  "AMD Ryzen 5 4500", Windows 10 Pro. Sao duas maquinas de proposito, e por isso
  e' que se mantem o `--x64 --arm64` em todos os scripts de build: no dia em que
  a build for feita no laptop, sem `--x64` o `electron-builder` compila so
  arm64 e o instalador deixa de instalar em PC x86/x64. Para saber em que
  maquina se esta: `echo $env:PROCESSOR_ARCHITECTURE` (`AMD64` = este PC;
  `ARM64` = o laptop).

### Verificacao da release 1.2.8 (instalador publicado, abertos de facto)
- Descarregado o `MEIDA-Setup-1.2.8.exe` (238 714 457 bytes, igual ao asset) e
  aberto com o 7-Zip. Contem `app-64.7z` **e** `app-arm64.7z`.
- No payload x64: `MEIDA.exe` com cabecalho PE `x64`, versao 1.2.8.0, e
  `node_datachannel.node` com PE `x64` e **sha256 igual ao prebuild oficial**
  (`9C994ED1262F12313694D34F...`, de `scripts/native/`).
- Executado o payload publicado: **Electron 44.5.1, Node 24.21.0, Chrome 152**,
  e `node:sqlite` carrega (`DatabaseSync`, `StatementSync`, `Session`).
  Arranca o servidor, `/api/health` responde, o catalogo responde, e o
  `Cache-Control: no-cache, no-store, must-revalidate` da 1.2.4 esta presente.
- Build local da 1.2.8 (as duas arquitecturas): o hook trocou o nativo no
  arm64 — `node-datachannel/build/Release/node_datachannel.node: x64 -> arm64` —
  que e' o bug original a ser travado a tempo.

### Notas
- O `prune-releases.mjs` devia manter 3 releases mas ficou com 6 (1.2.3 a
  1.2.8): o script saltou provavelmente por o `gh` nao estar autenticado no
  laptop. As releases 1.2.3 e 1.2.4 estao partidas e continuavam para download
  manual.
- `scripts/verificar-x86.ps1` continua **100% ASCII e sem BOM** (verificado byte
  a byte) — o PowerShell le mal um script com BOM.

## 1.2.8

### Os binarios nativos do servidor passam a ser especificos de cada arquitectura

A 1.2.7 impediu que a app morresse quando o binario nativo nao carregava
(`torrentEngine.js` passou a fazer `await import()` com `try`/`catch`). Isso
resolveu a app a nao arrancar, mas deixou os torrents (streaming) a nao
funcionar em PCs x86. Agora o binario correcto e' colocado em cada pacote.

- **Causa de fundo**: o `@electron/rebuild` so reconstroi o modulo nativo do
  projecto principal. O `server/` e' copiado tal e qual pelo `extraResources`,
  por isso o `node_datachannel.node` que veio do `npm install` (compilado na
  maquina de desenvolvimento, um PC **ARM**) foi parar ao pacote x64 sem ser
  tocado. `npmRebuild`, `buildDependenciesFromSource` e `nodeGypRebuild` do
  `electron-builder` nao ajudam: nenhum deles olha para o `server/`.
- **Como foi resolvido** — `scripts/empacotar-nativos.cjs`, registado como
  `afterPack` no `build` do `package.json`:
  - Corre depois de cada pacote estar montado (`release\win-unpacked` e
    `release\win-arm64-unpacked` sao pastas separadas), por isso cada uma recebe
    o binario certo.
  - Copia o binario de `scripts/native/` para dentro de
    `resources/server/node_modules/node-datachannel/build/Release/`.
  - No fim **varre todos os `.node` e `.dll` do `server/node_modules`** e falha a
    build se algum ficar com a arquitectura errada. Os que vivem em
    `prebuilds/<plataforma>-<arquitectura>/` sao ignorados, porque o
    `require-addon` escolhe o certo em runtime (`fs-native-extensions` e' assim
    e' que se resolvia sozinho).
  - Se o binario certo nao estiver em `scripts/native/`, a build falha com a
    mensagem a dizer qual falta.
- **De onde vem os binarios** (`scripts/native/`): prebuilds oficiais do
  `murat-dogan/node-datachannel`, release `v0.32.3`, variante `napi-v8`
  (`node-datachannel-v0.32.3-napi-v8-win32-x64.tar.gz` e
  `...-win32-arm64.tar.gz`). Sao N-API, portanto servem para o Node e para o
  Electron em qualquer versao, e sao os mesmos ficheiros que o
  `prebuild-install` descompacta ao instalar o pacote. Ficam no repositorio
  para a build nao depender da rede. `scripts/native/README.md` explica.
- **Confirmado**: o binario ARM64 do `node_modules` local e' **byte a byte igual**
  ao prebuild oficial `win32-arm64` — ou seja, o caminho certo e' mesmo este.
  Nao ha binarios para `linux`/`darwin` no repositorio porque so publicamos
  Windows.

### Testado a arquitectura x64 (o PC do utilizador que estava avariado)

O problema: a maquina de desenvolvimento e' ARM64, por isso **nao conseguia
carregar** um `.node` x64 para o testar. Resolvido com um Node x64
(`node-v24.21.0-win-x64`), que o Windows sobre ARM corre emulando.

| | com o binario errado (ARM64) | com o binario certo (x64) |
|---|---|---|
| `require('node-datachannel')` | `nao e' uma aplicacao Win32 valida` | carrega, `PeerConnection: function` |
| `import('webtorrent')` + `new WebTorrent()` | falha | carrega, peer id gerado |
| `/api/health` | servidor morre | `{"ok":true,...}` |
| `/api/torrents` | — | HTTP 200, 26 944 bytes |
| `fs-native-extensions` | escolhe `prebuilds/win32-x64` em runtime | idem |

O pacote ARM64 continua a carregar com o Node local (ARM64), como antes.

## 1.2.7

### Corrigido: a app nao arrancava em PCs x86 (todas as versoes desde 1.2.0)
- **Sintoma**: janela preta, e a janela de erro dizia "a app nao conseguiu iniciar
  o servidor interno, codigo 1". Sem log antigo: o backend morria antes do
  primeiro `log.info`.
- **Causa** (encontrada no `logs/arranque-*.log`):
  ```
  Error: node_datachannel.node is not a valid Win32 application
    code: 'ERR_DLOPEN_FAILED'
    at .../webrtc-polyfill/dist/esm/lib/node-datachannel.mjs:9
  ```
  O `webtorrent` -> `webrtc-polyfill` -> `node-datachannel` tem um binario
  **nativo** (`.node`) especifico da arquitectura. Verificado no pacote:
  `release/win-unpacked/.../node_datachannel.node` e
  `release/win-arm64-unpacked/.../node_datachannel.node` estavam **ambos ARM64**
  (`0xAA64`) — no pacote x64 tambem. Num PC x86 normal o `dlopen` falha e o
  backend morre no arranque.
- **Porquê que o `@electron/rebuild` nao resolveu**: ele so reconstroi o modulo
  nativo do **projecto principal**. `server/` e' copiado tal e qual pelo
  `extraResources`, por isso o `.node` que veio do `npm install` (compilado para
  a maquina de desenvolvimento, um PC ARM) foi parar ao pacote x64 sem ser
  tocado.
- **Este bug explica o diagnostico anterior ficar pela metade**: sem log, so se
  sabia que o backend morria, nao porquê. A partir da 1.2.6 ha
  `logs/arranque-*.log`, e foi ai que a causa apareceu.
- **Correcao** (`server/src/services/torrentEngine.js`):
  - O `import WebTorrent from "webtorrent"` passa a `await import(...)` **lazy**,
    dentro de `carregar()`, com `try`/`catch`.
  - Se o binario nao carregar, fica registado o motivo e o servidor **arranca
    na mesma**. So as funcionalidades que dependem do WebTorrent (streaming de
    torrents) ficam indisponiveis nesse PC.
  - `findTorrent`, `listActive`, `removeTorrent` e `getStatus` passam a devolver
    valores vazios quando o cliente nao existe, em vez de rebentar.
  - Listar torrents (`/api/torrents`) continua a funcionar: so o provider e'
    preciso, nao o binario nativo.
- **Testado** com o `.node` substituido por ficheiro invalido (que e' o que o
  Windows ve quando a arquitectura nao bate certo):
  - servidor arranca: `Backend a correr em http://127.0.0.1:5175`
  - `/api/health` -> `{"ok":true,"tmdbConfigured":true}`
  - `/` -> HTTP 200 com `div#root`
  - `/api/catalog` -> HTTP 200, 39 879 bytes
  - `/api/torrents` -> HTTP 200 com a lista (o servidor sobrevive)

### Corrigido: a porta da sessao anterior
- `electron/main.cjs` passa a apagar `%APPDATA%/streamapp/porta.txt` antes de
  arrancar o servidor. Sem isso, se uma sessao anterior ficou noutra porta, a
  app ia procurar o servidor onde ele ja nao estava e falhava ao abrir com um
  erro interno. O script de reparacao tambem o apaga.

## 1.2.6

### Corrigido: a janela ficava preta (a app nao abria)
- **Sintoma**: a app instalava e abria, mas a janela ficava preta. Sem erro, sem
  aviso, sem nada no log. O script de reparacao dizia "instalada e completa" -
  e estava certo, a instalacao estava boa.
- **Causa**: `server/src/index.js` ouve sempre na porta **5175**
  (`config.port`). Se essa porta estiver ocupada, o `app.listen` emitia
  `EADDRINUSE` e o **backend morria no arranque**. Pior: o backend e lancado
  como processo separado com `stdio: "inherit"`, ou seja, a saida dele ia para
  a consola do Electron - **que numa app instalada nao existe**. O erro
  desaparecia no vazio.
- **Porquê "instalada e completa" e mesmo assim preta**: a installacao estava
  correcta; o que falhava era o servidor ao arrancar, e isso acontecia depois.
- **Agravante**: fechar e reabrir depressa. A instancia anterior nao libertava a
  porta a tempo, a nova batia em cima e morria. Sem log novo, porque o backend
  morre **antes** do primeiro `log.info`.
- **Correcao**:
  - `server/src/index.js` tenta `config.port`, e se estiver ocupada passa a
    seguinte ( ate `port + 3`), em vez de morrer. Escreve a porta escolhida em
    `%APPDATA%/streamapp/porta.txt`.
  - `electron/main.cjs` le esse ficheiro (`prodUrl()`) e abre a interface na
    porta certa, esperando por `/api/health` antes de carregar.
  - O backend passa a escrever num ficheiro em vez de `stdio: "inherit"`:
    `%APPDATA%/streamapp/logs/arranque-AAAA-MM-DD.log`.
  - Se o backend morrer, aparece uma janela com o codigo de saida e a pasta do
    log. Antes: preto e calado.
  - `did-fail-load` e `console-message` passam a mostrar/registar o erro da
    pagina. Antes: preto e calado.
  - A app limpa `Cache` + `serviceworkers`/`cachestorage` ao arrancar (nunca
    `localstorage`, `indexdb` nem `cookies`, onde estao os dados do utilizador).
- **Testado**: duas instancias em simultaneo. A segunda escolhe a 5176 e ambas
  respondem a `/api/health` e a `/` com `div#root`.

### Diagnostico que vale a pena reter
Um processo filho com `stdio: "inherit"` **nao tem onde escrever** quando e
lancado por uma app empacotada (nao ha consola). Qualquer erro dele - e
invisivel. Antes de culpar o sistema operativo, perguntar sempre: *onde vai a
saida deste processo?* E, ao mesmo tempo, dar-lhe um ficheiro de log e um
dialogo de erro, para a proxima vez ser obvious.

## 1.2.5

### Corrigido: a app nao abria de todo (1.2.4)
- **Sintoma**: a app arrancava e mostrava `Cannot GET /`. O backend morria de
  imediato ao arrancar, sem log no sitio obvio:
  ```
  Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
  Node.js v20.18.3
  ```
- **Causa**: `server/src/index.js` e `server/src/store.js` usam
  `import { DatabaseSync } from "node:sqlite"`, que so existe a partir do
  **Node 22**. A release **1.2.4** foi empacotada com **Electron 33.4.11**
  (Node 20.18.3) em vez do **Electron 44.5.1** que o `package.json` declara.
  Sem `node:sqlite` o backend nao arranca, e a janela fica sem nada para
  mostrar.
- **Como escorregou**: o `package.json` pedia `^44.5.1` e o `node_modules` tinha
  44.5.1 instalado, por isso nada indicava problema — mas o binario que foi
  para a release era de uma build anterior. **Faltou a verificacao que agora e
  obrigatoria: ler a versao do Electron de dentro do binario empacotado** (ver
  "Como verificar uma build" abaixo).
- **Correcao**: `electron` passou a `"44.5.1"` exacto (`npm i -D --save-exact
  electron@44.5.1`), sem o `^`, para nunca mais saltar de versao sozinho.
  Rebuild com `electron=44.5.1` confirmado no log do empacotamento.
- **Afeta toda a gente que instale a 1.2.4** — em qualquer PC e qualquer
  arquitectura, a app nao servia nada. Quem actualizou para a 1.2.4 deve
  actualizar para esta.

### Corrigido: actualizar a app deixa de exigir conta
- O "Procurar atualizacao" so existia no menu da conta, e esse menu nao aparece
  sem sessao iniciada — quem nao tinha conta ficava sem forma de actualizar a
  app. Passou a estar tambem em **Definis > Avancado > Atualizacoes**, que nao
  pede login. `web/src/pages/Settings.jsx` ganhou a `checkUpdate` (com estado
  de espera e mensagem de resultado); o "Desinstalar" passou a um bloco proprio
  dentro da mesma seccao.

### Login: feedback enquanto espera
- `web/src/pages/Login.jsx`: o botao mostrava `"..."`, o que nao diz nada.
  Passa a mostrar o anel de `LoadingStatus` (o componente que a app ja usava
  noutros sitios) com "A entrar", e o cursor passa a `wait`. O estado `busy`
  ja existia; so faltava mostrar.

### Script de reparacao da instalacao
- `scripts/reparar-instalacao.ps1`:
  - A versao deixa de estar fixa: le a mais recente do `latest.yml`.
  - Detecta o processador por `PROCESSOR_IDENTIFIER`, **nao** por
    `PROCESSOR_ARCHITECTURE` — este diz `AMD64` mesmo num PC ARM, e era
    exactamente esse o engano que escondia o problema das 1.2.0 a 1.2.2.
  - Le o cabecalho PE do `MEIDA.exe` instalado e avisa se for do tipo errado
    para o PC (`Get-TipoExe`).
  - Espaco minimo de 500 para 1000 MB (o instalador tem ~210 MB e precisa de
    espaco tambem para descompactar).
  - Retirado o comentario que atribuia a falha a pasta do ambiente de trabalho:
    **nao era a causa** (a pasta existia). Criar a pasta ficou, e e inofensiva.

### Como verificar uma build (obrigatorio antes de publicar)
Um build pode parecer correcto e levar o Electron errado dentro. Verificar
sempre, nesta ordem:

1. `release/builder-debug.yml` — a unica chave de topo tem de ser `x64:` e
   `arm64:` (nunca so uma).
2. O log do `electron-builder` tem de dizer `electron=<versao de
   package.json>` em todas as linhas `packaging`.
3. `node -e "...readUInt16LE(pe+4)..."` sobre `release/win-unpacked/MEIDA.exe` e
   `release/win-arm64-unpacked/MEIDA.exe` — `0x8664` (x64) e `0xaa64` (ARM64).
4. O `.exe` instalado tem de responder a `-e "console.log(process.versions)"` com
   `ELECTRON_RUN_AS_NODE=1`, e `require('node:sqlite')` tem de funcionar.
5. O `latest.yml` publico tem de bater certo com o `sha512` e o `size` reais do
   instalador — **conferir sempre depois de publicar**, porque o
   `electron-builder` pode gerar o `.yml` antes da assinatura final e deixar o
   hash trocado (aconteceu na 1.2.3).

## 1.2.4

### Corrigido: app abria com o bundle web antigo em cache (changelog velha e "fail to fetch")
- **Sintoma** (PC x64 com instalação limpa da 1.2.3): a janela mostrava a
  changelog só até 1.0.0 e dava "fail to fetch", apesar de o instalador e o
  Windows registarem a 1.2.3.
- **Causa**: a app abre em `loadURL("http://localhost:5175")` e o servidor
  servia o `index.html` sem `Cache-Control`. A **cache HTTP do Chromium**
  (`%APPDATA%\streamapp\Cache`, que **sobrevive à desinstalação NSIS** — a
  desinstalação não apaga `AppData`) devolvia o `index.html` antigo, que
  apontava para o bundle JS antigo (changelog até 1.0.0); quando esse JS antigo
  já não estava na cache, o fetch da app falhava. Não é erro do instalador nem
  da release: **verificado** extraindo `MEIDA-Setup-1.2.3.exe` (7-Zip): contém
  `app-64.7z` e `app-arm64.7z`, e o `web/dist` traz `index-BBTnWU4E.js`
  (changelog até 1.2.3, "Voltar atrás", Discord) — a release está íntegra.
- **Correção** em `server/src/index.js`: o `index.html` passa a ser servido com
  `Cache-Control: no-cache, no-store, must-revalidate` (tanto no `express.static`
  como no fallback SPA). O Chromium revalida sempre, pelo que cada arranque
  obtém o `index.html` atual que referencia o bundle novo. Os assets com hash no
  nome (`index-<hash>.js`/`.css`) continuam cacheáveis — é o comportamento certo.
- **Para quem já está afetado**: fechar a app e apagar `%APPDATA%\streamapp\Cache`
  e `%APPDATA%\streamapp\Code Cache` (ou, mais simples, `Ctrl+Shift+R` dentro da
  app para recarregar ignorando a cache).
- **Nota**: o Service Worker só se regista fora do Electron
  (`web/src/main.jsx`, guard `!window.electronAPI`), portanto na app desktop não
  há interferência de SW — é cache HTTP clássica.
- Testado localmente: `SERVE_WEB=1` devolve `Cache-Control: no-cache, no-store,
  must-revalidate` em `/` e o HTML referencia o bundle novo.

## 1.2.3

### Corrigido: o instalador não instalava em nenhum PC x86/x64 (1.2.0 a 1.2.2)
- **Causa raiz**: a máquina de desenvolvimento é **Windows sobre ARM**
  (Snapdragon; `PROCESSOR_IDENTIFIER = ARMv8 (64-bit) ... Qualcomm`). O
  `electron-builder` foi corrido **sem `--x64`**, portanto empacotou **arm64** —
  confirmado em `release/builder-debug.yml`, cuja única chave de topo era
  `arm64:`. As releases **1.2.0, 1.2.1 e 1.2.2** ficaram com um instalador
  que não instala num PC normal.
- **Como falha, em silêncio** (`extractAppPackage.nsh` do electron-builder):
  `identify_package` só define `$packageArch` se `${RunningX64}` ou
  `${IsNativeARM64}`; num PC x64, `${IsNativeARM64}` é falso e `APP_64`/`APP_32`
  não estão definidos porque só foi empacotado arm64. Logo `$packageArch` fica
  vazio e `compute_files_for_current_arch` **não extrai um único ficheiro**. O
  instalador prossegue: escreve a entrada no registo, deixa o
  `Uninstall MEIDA.exe`, cria os atalhos a apontar para um `MEIDA.exe`
  inexistente (o Windows mostra *"o Windows está a procurar MEIDA.exe"*) e sai
  com **código 0**. Sem evento no CodeIntegrity, sem deteção do Defender.
- **Correção**: `--x64` em `app:pack`, `app:pack:zip` e `app:publish`.
  Verificado por três vias: `builder-debug.yml` com `x64:`, cabeçalho PE do
  `MEIDA.exe` a `0x8664` (AMD64), e tamanho do instalador diferente do
  anterior (113 395 232 bytes, contra 107 284 764 do arm64).
- **Afeta toda a gente em x64**, não só o PC onde foi reportado. Como o
  `prune-releases` mantém 3 releases, as 3 visíveis estavam partidas.
- **Corrige também o diagnóstico anterior**: a hipótese da "corrida entre o
  backend e o instalador" na 1.2.2 era errada. Não havia corrida; o que
  partiu a instalação foi o payload arm64 quando o `electron-updater` actualizou
  de 1.1.x para 1.2.0. A espera pelo backend em 1.2.2 fica (é inofensiva e
  correcta por si), mas não era a causa.

### Diagnóstico: como um instalador "bem-sucedido" não instala nada
- Sintoma: o instalador acaba com código 0, deixa o desinstalador e a entrada no
  Painel de Control, mas a pasta fica com 0,5 MB e sem `MEIDA.exe`.
- O **registo de Aplicações nunca regista ficheiros bloqueados** — quem regista
  é o `Microsoft-Windows-CodeIntegrity/Operational` e o histórico do Defender.
- A primeira coisa a verificar quando o payload não aparece é a
  **arquitectura** (`release/builder-debug.yml`, `PROCESSOR_IDENTIFIER`), antes
  do Defender, do espaço em disco ou da versão do Windows.

### Scripts de diagnóstico (gists, só de leitura, não alteram o PC)
- `scripts/diag-instalacao.ps1` — estado do Windows, build, Controlo de
  Aplicações Inteligentes, AppLocker/WDAC, MOTW.
- `scripts/verificar-instalacao.ps1` — procura a MEIDA nas 9 pastas possíveis
  (incluindo `C:\Program Files\streamapp`, que faltava), lê o Painel de
  Control, o histórico do Defender, os logs do Defender/CodeIntegrity/AppLocker
  filtrados para a MEIDA, e diz o que o Windows fez ao instalador.
- `scripts/reparar-instalacao.ps1` — limpa a instalação partida (pasta, atalhos
  **e a entrada do Painel de Control**, que deixava o instalador novo a tentar
  correr um desinstalador inexistente), descarrega o instalador com verificação
  de tamanho e sha512, e guarda o **código de saída** — que é o número que
  distingue "o instalador fez o que devia" de "desistiu a meio".

### Web
- A versão web está publicada e a funcionar em **`https://meida.onrender.com`**
  (`/api/health` → `{"ok":true,"tmdbConfigured":true}`). É a via para quem tem
  a instalação de desktop bloqueada pelo Windows.
- Retirada a via do VPS/Oracle Cloud (não disponível): apagados
  `deploy/ORACLE-CHECKLIST.md`, `deploy/README.md`, `bootstrap.sh`,
  `deploy.sh`, `meida.service`, `Caddyfile` e `duckdns-update.sh`. Fica o
  `render.yaml` como blueprint para instâncias próprias.

## 1.2.2

### Corrigido: a atualização da app ficava a meio (atalho do Menu Iniciar partido)
- **Causa**: `electron/main.cjs` lançava o backend com
  `spawn(process.execPath, [serverEntry], { env: { ELECTRON_RUN_AS_NODE: "1" } })`,
  ou seja o backend é **outro processo do próprio `MEIDA.exe`**. `stopServer()` só
  fazia `kill()` sem esperar, e `quitAndInstall()` arrancava de seguida — o
  instalador do NSIS tentava substituir `MEIDA.exe` e `resources/` com dois
  processos do mesmo ficheiro vivos. O `.exe` antigo desaparecia, o novo não
  ficava, e o atalho do Menu Iniciar passava a apontar para nada
  (*"este atalho foi alterado ou removido"*).
- **Correção**: `stopServer(waitForExit)` devolve uma Promise e, com
  `waitForExit`, espera pelo evento `exit` (com `SIGKILL` aos 5 s se Resistir).
  O handler de `update-downloaded` faz `await stopServer(true)` antes de
  `quitAndInstall(false, true)`.
- **Nota**: isto resolve a causa de ficheiros trancados. Se num PC específico o
  sintoma se repetir, a hipótese a seguir é o Windows Defender a pôr a app em
  quarentena (instaladores sem assinatura digital + WebTorrent). Para isso ficou
  `scripts/diag-instalacao.ps1`, que reporta onde a app está instalada, para onde
  apuntan os atalhos, deteções do Defender e o que ficou a meio no cache do
  updater.

### Provider de anime novo: MegaPlay (`megaplay.buzz`), agora o principal
- `server/src/services/providers.js`: `ANIME_PROVIDERS` passa a
  `megaplay-anime` → `vidnest-anime`.
  URL: `https://megaplay.buzz/stream/ani/{anilist}/{ep}/{audio}`.
- **Legendas completas e ligadas.** O `/stream/getSources?id={data-id}` devolve
  `tracks[].file` em claro (o `.vtt` do ep 1 do One Piece tem 285 blocos), ao
  contrário do MegaVid removido, cujas legendas só existiam para cópias em
  cache. O JW Player do MegaPlay traz a legenda ligada por omissão; o do VidNest
  nasce com `mode="disabled"`.
- **O mais limpo dos providers de anime medidos**: em 12 s de reprodução, e mesmo
  a clicar (que é o que dispara popunders), só pediu segmentos de vídeo. O único
  pedido de terceiros é `statlytic.net` (estatísticas).
- **Exige header `Referer`** (sem ele devolve "Error - MegaPlay"), mas não valida
  o valor — e um iframe envia sempre. A health-check passou a mandá-lo
  (`refererFor()` em `providerHealth.js`).
- **Só a rota `/ani/`** entra na app. A `/mal/` resolve quase sempre o mesmo
  episódio que a `/ani/` (embora cada uma falhe em títulos que a outra resolve —
  Dandadan só na `/mal/`, Solo Leveling só na `/ani/`), por isso listar as duas
  voltaria a mostrar o mesmo episódio duas vezes: o bug do "MegaVid 1 e 2".
- **Descartados na mesma procura**: `supaplay.fun` (passou a premium),
  `ani.megaplay.su` (página de erro), `ninjasheild.stream` (não responde),
  `myapi-psi-wheat.vercel.app` (AnimePahe, 503), `api.ani.zip` (404).

### Novo: bloqueador de anúncios local (`electron/adblock.cjs`)
- Cancela os pedidos de anúncios na sessão do Electron
  (`session.webRequest.onBeforeRequest`) **antes de saírem para a rede** — o vídeo
  continua a passar, os anúncios nunca chegam a existir. Vale para todos os
  providers, é grátis e não precisa de listas externas.
- 41 domínios: as redes de anúncios mais comuns, mais o que foi **medido** no
  megavid.buzz (Teniacites, Histats), no vidnest.fun (MintAds, bounceExchange,
  bdpcmd, click-catcher do popunder) e no megaplay.buzz (statlytic.net).
- `NEVER_BLOCK` como rede de segurança com os hosts que servem vídeo e legendas
  (CDNs do MegaPlay, `vidnest.fun`, proxy das legendas, `127.0.0.1`). Se o vídeo
  deixar de passar, é aí que se acrescenta o domínio que aparecer no log.
- `MEIDA_ADBLOCK_DEBUG=1` faz log de cada bloqueio; `MEIDA_BLOCK_ALL_ADS=1`
  bloqueia tudo (para testes). Não faz `require("electron")` — recebe a sessão
  como parâmetro, para ser carregável num script Node normal.

### Anime sem fontes quando só há o id do MyAnimeList
- `server/src/routes/sources.js`: a rota `/sources` passou a `async` e resolve o
  id do AniList via `malToAnilist()` quando o catálogo só traz o do MAL. Sem isto,
  um anime com `anilistId: null` ficava **sem fonte nenhuma** (e o novo MegaPlay,
  tal como o VidNest, só aceita id do AniList).

### Melhorado: Definições em abas
- `web/src/pages/Settings.jsx`: as 21 secções deixaram de ser um scroll só. Cada
  `<section>` declara `data-tab="..."` e o CSS esconde as das outras abas
  (`.settings-page[data-active-tab]` em `web/src/styles.css`) — não foi preciso
  mexer no envelope nem na ordem dos blocos. Aba guardada em `localStorage`
  (`meida:settings-tab`), com `aria-selected`/`role="tablist"`.

### Melhorado: marca de "visto" nos cartazes
- `web/src/components/icons.jsx`: novo `CheckIcon` (SVG preenchido, como os
  outros ícones). Substitui o carácter `✓`, que o Windows desenhava com o Segoe
  UI Symbol como um traço fino e torto, e o "olhinho" desenhado à mão no botão
  de acção rápida de `MediaCard.jsx` (agora um tick).

### Housekeeping
- `AGENTS.md` / `IDEIAS.md`: registo do que foi medido nos providers de anime
  (incluindo por que um provider removido em Julho voltou em Outubro, e o que
  ainda não compensa fazer).

## 1.2.1

### Novo: Discord Rich Presence (grátis, local)
- **`electron/discord-presence.cjs`** (novo): escreve directamente no servidor RPC
  local do Discord (`\\?\pipe\discord-ipc-0..9` no Windows, sockets Unix nos
  restantes) para mostrar o que está a ver, como o Stremio e o Crunchyroll.
  **Zero dependências** — implementa o protocolo RPC do Discord à mão (frames
  `[opcode LE32][len LE32][JSON]`, opcodes HANDSHAKE/FRAME/CLOSE/PING/PONG)
  em vez de usar o `discord-rpc` do npm, abandonado desde 2021, ou as
  alternativas recentes, que exigem Node >= 24.13.
  Faz handshake com o `client_id`, responde aos `PING` do Discord (sem isso
  corta a ligação), reenvia a atividade no `READY`, e ao fechar o socket
  (Discord restarted) volta a tentar de minuto a minuto **em silêncio**.
  `MIN_UPDATE_MS = 15000` porque o Discord penaliza updates a mais.
  `clear()` mantém o socket (como o Stremio) para não reconectar a cada episódio;
  só `shutdown()` fecha. `electron/main.cjs` chama-o em `before-quit` para a
  presença não ficar "A ver ..." para sempre.
- **Activity**: `type: 3` (Watching), `details` = título, `state` =
  `S1E2 · 12:34 / 45:00`, `large_image` = URL do cartaz (TMDB/Jikan/MAL),
  `timestamps.start` só reinicia quando muda de título.
- **`electron/main.cjs`**: handlers `set-presence` / `clear-presence`, ambos
  com `isTrustedSender` (o preload também fica exposto à página servida pelo
  servidor remoto, por isso a validação de origem é necessária).
- **`electron/preload.cjs`**: expõe `setPresence` / `clearPresence`.
- **`web/src/discord.js`** (novo): formata a linha `S1E2 · 12:34 / 45:00`,
  resolve o URL do cartaz, e é **no-op silencioso** sem Electron (PWA/web) ou
  com a definição desligada — a presença nunca pode partir a app.
- **`web/src/pages/Details.jsx`: presence quando escolhes uma fonte
  (`active`), progresso ligado ao `reportPos` que já existia (os players
  próprios reportam de 5 em 5 s; os providers com iframe não dizem se estão a
  tocar — o Stremio também não sabe), e `clearPresence()` ao sair da ficha.
- **`web/src/pages/Settings.jsx`**: secção "Discord" com o interruptor
  (definição local em `localStorage`, `discordPresence`, default ligado) e nota
  de que só funciona na app de computador.
- **Custo zero**: sem servidor, sem bot, sem API paga. A app escreve só no
  Named Pipe local do Discord; nada sai do computador. A única coisa que foi
  preciso registar foi a aplicação no Discord Developers (grátis), cujo
  `client_id` ficou em `electron/discord-presence.cjs` (overridable por
  `MEIDA_DISCORD_CLIENT_ID`).

### Corrigido
- **Botões das Definições sem estilo**: "Exportar JSON", "Exportar CSV",
  "Importar" e "Rever agora" usavam `className="btn"`, e **não existe nenhuma
  regra `.btn` no CSS** (a única está dentro de `.error-boundary`) — saíam com o
  aspecto por defeito do browser, contra o resto das Definições. Passam a
  `set-choice`, o mesmo estilo pill usado nas outras acções da página.
- **Cabeçalho dos comentários mostrava "T?E6"**: em `Comments.jsx` a etiqueta era
  `· T${season ?? "?"}E${episode ?? "?"}`, e nos animes (ou antes de a temporada
  estar definida) `season`/`episode` chegam `null` → `T?E6`. O cabeçalho passou
  a ser só "Comentários".
- **Changelog da 1.2.0 reescrito**: tinha texto de developer (SQLite, nota sobre
  o servidor local) em vez de novidades para quem usa a app.

## 1.2.0

Release grande: a app passa a suportar **dados partilhados na nuvem** (vídeo
continua local), sobre a base SQLite e as camadas sociais do commit `5cb3e7f`
(aquele ainda não tinha versão nem changelog — entra agora como 1.2.0).

### Modo "dados na nuvem" (híbrido)
- **Cliente com duas bases** (`web/src/api/client.js`): `LOCAL_API_PREFIXES`
  (catálogo, detalhes, fontes, stream/play, torrents, proxy, Real-Debrid,
  watch-party) fica sempre no servidor **local**; **todas** as outras `/api/*`
  (auth, biblioteca, progresso, listas, social, comentários, MAL/AniList,
  Letterboxd, export, conquistas) vão para o servidor **remoto**. Default
  seguro = remoto (o lado que tem os dados), para uma rota nova não falhar em
  silêncio. `fullUrl()` lê `window.MEIDA_REMOTE_DATA_BASE`/`MEIDA_API_BASE` **em
  tempo de chamada** (o `main.jsx` só os define depois do runtime-config/IPC — a
  leitura no import era um bug latente).
- **`web/src/main.jsx`**: `loadRuntimeConfig()` passou a definir também
  `MEIDA_REMOTE_DATA_BASE` (de `VITE_REMOTE_DATA_BASE` no `runtime-config.json`
  e, no Electron, com prioridade sobre o IPC `get-server-config`).
- **`server/src/config.js`**: novos `host` (`HOST`, default `0.0.0.0`) e
  `remoteDataUrl` (`MEIDA_REMOTE_DATA_URL`).
- **`server/src/index.js`**: o CORS só liga quando `SERVE_WEB !== "1"` (o
  servidor local do Electron fica same-origin e não expõe rotas); `listen` passa
  a usar `config.host`.
- **`server/src/store.js`**: `ensureUserStub(id)` cria a linha mínima em `users`
  (FK de `user_tokens`).
- **`server/src/services/auth.js`**: `localUserFromToken()` + fallback em
  `requireAuth` — o servidor local tem outro `JWT_SECRET`, por isso descodifica
  (sem verificar) o token emitido pelo remoto para as rotas locais
  (Real-Debrid) saberem quem é o utilizador. Só fica ativo com
  `MEIDA_REMOTE_DATA_URL` definido; superfície reduzida por o CORS desligado e o
  `HOST=127.0.0.1` do servidor local.
- **`electron/main.cjs`**: o servidor local **arranca sempre** (é ele que serve o
  UI e o vídeo); em modo nuvem só ganha `MEIDA_REMOTE_DATA_URL`. A janela carrega
  sempre o URL local. `DEFAULT_REMOTE_URL` passa a ler
  `electron/default-server.txt` (embutido no build), com `MEIDA_DEFAULT_SERVER`
  como override para dev — assim uma release nova aponta os amigos para a nuvem
  sem configurarem nada.
- **Limitação conhecida:** o watch-party entre PCs diferentes deixa de funcionar
  (é uma rota local por desenho; as fontes são locais a cada servidor).

### Migrar os dados para o servidor partilhado
- **`POST /api/admin/seed`** (`server/src/routes/admin.js`): semeia a base a
  partir de um `data.json`. Protegido por `ADMIN_TOKEN` (header `x-admin-token`);
  sem token definido **ou** token errado responde `404` (não revela a rota).
  `?force=1` para reimportar por cima (upsert = *merge*).
- **`server/src/db/seed.js`**: a lógica de importação saiu do CLI e passou a uma
  função reutilizável (`seedFromJson`). Passou a importar também
  `follows`/`comments`/`comment_likes` (que só existem em exports recentes), a
  subir os comentários por `id` para respeitar a FK pai→resposta.
- **`server/src/db/export-json.js`** + `npm --prefix server run export:json`:
  exporta a base atual para o formato do `data.json` (inclui tokens, seguir e
  comentários), para enviar ao servidor partilhado sem se registar de novo.
- **`server/src/db/import-json.js`**: ficou um wrapper fino do CLI em torno do
  `seed.js`.

### Deploy
- **`deploy/SERVIDOR-PARTILHADO.md`** (novo): guia do servidor de dados grátis e
  **sem cartão** (FadeHost: `/data` persistente, Node 24, hiberna e acorda).
  Inclui variáveis de ambiente, seed e como publicar com o endereço embutido.
- `deploy/README.md`: aviso de que o guia Oracle pede cartão só para
  verificação; Passo 9 actualizado para o `default-server.txt`.
- `package.json` (raiz e `server/`): `"engines": { "node": ">=24" }` — o
  servidor usa o `node:sqlite`, que precisa de Node 24.
- `server/.env.example`: secções para `HOST`, `ADMIN_TOKEN` e
  `MEIDA_REMOTE_DATA_URL`.

### SQLite + social (vinha do commit `5cb3e7f`, sem versão até agora)
- Base de dados SQLite com migrações numeradas (`server/src/db/schema.js`),
  store reescrito sobre `node:sqlite`, importação do `data.json` antigo.
- **Perfis** (`/u/:username`): avatar, bio, visibilidade, biblioteca/listas
  públicas; **seguir** e listar seguidores/seguindo; página de utilizadores.
- **Comentários** por título **e por episódio**: escrever, responder, apagar
  (thread sobrevive), gosto, e marcação do minuto do vídeo (`at_seconds`).
- **Definições → Servidor**: escolher entre "Este computador" e um servidor
  MEIDA remoto (grava em `userData/desktop-config.json`).

## 1.1.3

### Ecrã de erro mais útil
- **`web/src/components/ErrorBoundary.jsx`**: além do "Recarregar", o ecrã "Algo correu mal" ganhou **"‹ Voltar atrás"** — usa `window.history.back()` quando há histórico, senão `location.assign("/")`.
- **`web/src/styles.css`**: `.error-boundary-actions` (flex, wrap), botão "Voltar" com fundo subtil para se distinguir do "Recarregar" (accent).

### Nota (não é código novo)
- O crash "Algo correu mal" ao abrir títulos (incl. a nova temporada do Slime) era o `ReferenceError: Cannot access 'embeds' before initialization` da v1.1.1, já corrigido na v1.1.2. A 1.1.2 só precisa de reiniciar a app para aplicar.

## 1.1.2

### Corrigido: crash ao abrir a ficha de qualquer título
- **Causa:** `ReferenceError: Cannot access 'embeds' before initialization` ao montar o `Details`. Na v1.1.1, o `useEffect` que restaura o provider do "Continua a ver" ficou **antes** das declarações `const [embeds, ...]` e `wantedSourceRef` — como o corpo e a lista de deps do efeito referenciam essas variáveis, o primeiro render lançava "temporal dead zone" e o `ErrorBoundary` mostrava "Algo correu mal" em **todas** as fichas (série, filme e anime).
- **Fix** (`web/src/pages/Details.jsx`): o `useEffect` de `progressItem`/restauro do provider mudou para depois de `embeds`/`wantedSourceRef`/`activeProviderRef` estarem declarados. Comportamento inalterado (restaura a fonte na 1ª entrada do título, guardado por `restoreProviderDone`).
- **Verificação:** reproduzido em headless (ErrorBoundary atingido para anime 223, 813, 30694, movie 603, tv 1399) → após o fix, `h2: "Se gostaste disto"` (conteúdo real) com build OK.

## 1.1.1

### Anime: sub/dub por título
- **Seletor local "Legendado"/"Dobrado"** (`web/src/pages/Details.jsx`): na ficha de anime, por cima das fontes. Estado local (`localAudio`) que faz override do `settings.animeAudio` **só para esse título** — as Definições ficam intactas. Aplica-se às Fontes em iframe (`audio=dub` na API), ao Torrents (`defaultAudio`) e ao "Sem anúncios" (`AnimeExtract.jsx` agora aceita prop `audio`). O `useEffect` de fontes depende de `animeAudio` para recarregar ao trocar.

### "Continua a ver" restaura a fonte
- **O provider é guardado no progresso** (`server/src/store.js` + `server/src/routes/progress.js`): `startProgress` e `setProgressPosition` aceitam `provider`, exposto em `toApiProgress` como `provider` (entradas antigas devolvem `null` — retrocompatível).
- **Restauro na abertura** (`web/src/pages/Details.jsx`): ao entrar no título, `progressItem` devolve o provider guardado; `wantedSourceRef` + `setActive`/`setPlayerIndex` restauram a fonte (senão `pickDefault` caía no 1º provider vivo). Guardado só na 1ª entrada do título (`restoreProviderDone`) — não volta a impor ao mudar de episódio/áudio a meio da sessão.
- `reportPos`/`progressStart` enviam `activeProviderRef.current` (ref do último provider escolhido, sem reiniciar o timer dos 5 min).

### UI mobile
- **`web/src/styles.css`**: no `@media (max-width:700px)`, `.anime-audio-bar` faz `flex-wrap` e os `.mode-tabs` (áudio + Fontes/Sem anúncios/Torrents) quebram linha com botões esticados a `flex: 1 1 auto` — deixam de ficar todos juntos.

## 1.1.0

### Real-Debrid (streaming instantâneo de torrents)
- **Real-Debrid integrado**: o utilizador cola o token de `real-debrid.com/apitoken` nas Definições (`server/src/routes/debrid.js` + `server/src/services/debrid.js`). O servidor (nunca o browser) chama a API RD: `checkToken`, `instantAvailability` (torrents em cache → streaming imediato ✓), `addMagnet`/`selectFiles`/`torrentInfo`, `createDownload`/`streamingLink` (link m3u8 servido por proxy — o token não sai do server).
- **UI de torrents RD** (`web/src/components/Torrents.jsx`, `web/src/pages/Settings.jsx`): selo de hastag quando já está na cache RD, ligar/desligar a conta nas Definições, torrents instant RD ordenados ao topo da lista.
- **Multi-provider de torrents** (`server/src/services/providers/`, novo: `index.js` + `torrentio.js` + `yts.js`): torrentEngine agrega resultados de várias fontes (Torrentio, YTS, …) numa lista única.
- **Atalhos para sites externos** (`web/src/components/SourceSelector.jsx`): lista `EXTERNAL_SITES` configurável; abre o título no site original sem sair da app.

### Performance
- **Code-splitting** (`web/src/App.jsx`): páginas (Home, Details, Library, Diary, Achievements, Login, Settings, PickForMe, Compare, Search, Category) passam a `React.lazy` + `<Suspense>` — o entry caiu de ~430 kB para ~218 kB (gzip ~72 kB); o Details mantém-se num chunk gordo (HLS+WebTorrent), aceite.

### Segurança e robustez
- **Guarda JWT fail-fast** (`server/src/config.js`): em produção, arranque falha com instruções se `JWT_SECRET` estiver vazio ou for o default de dev (evita deploy sem chave). Gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- **Escrita atómica dos dados** (`server/src/store.js`): grava em `data.json.tmp` + `renameSync` → `data.json`, e depois copia para `data.json.bak` (backup sempre presente). O load tenta o ficheiro principal e, se estiver corrompido, recupera do `.bak`; o snapshot de boot só copia se o JSON validar.

### UI
- **Swipe no slideshow** (`web/src/components/Hero.jsx`): gesto táctil (touchstart/touchend, threshold 50px, mais horizontal do que vertical) avança/recua o banner. `styles.css`: `touch-action: pan-y` no `.hero`.
- **Responsividade** (`web/src/styles.css`): 3 breakpoints — `max-width:1024px` (nav só ícones, poster 240×360, hero menor), `max-width:700px` (fiche no topo em coluna, poster `min(240px,72vw)` com `aspect-ratio:2/3`, nav compacta) e `min-width:1600px` (conteúdo centrado com max-width em rows/catálogo/episódios/ficha).

### Watch Party sem Supabase
- O projeto Supabase foi **encerrado pela Supabase** — o Watch Party passa a correr **no próprio servidor Express** (`server/src/routes/watchparty.js`), sem dependências novas:
  - Salas em memória num `Map`; `GET /api/wp/stream` (SSE) — a própria ligação é a presença (fechar = sair) e o heartbeat de 20s mantém a ligação viva (sobrevive a proxies).
  - `POST /api/wp/send` faz broadcast de eventos (`{type:"event", kind, data, from}`) aos outros membros da sala.
  - **Público** (como era no Supabase) — montado no `index.js` **antes** dos routers com `use(requireAuth)` global (library/debrid/progress/export/achievements/letterboxd), que bloqueavam `/api/wp/*` com 401.
  - `web/src/watchparty/WatchPartyContext.jsx` reescrito: `EventSource` + `POST /api/wp/send`; `enabled: true` sempre (sem `VITE_SUPABASE_*`); reconnect automático do EventSource.
  - Removidos `web/src/watchparty/supabase.js` e a dependência `@supabase/supabase-js` (também fora do `package-lock.json`).

## 1.0.0

### Exportar / Importar dados
- **Exportar a tua biblioteca e diário** (Definições → "Os teus dados"): novo botão "Exportar JSON" e "Exportar CSV". `GET /api/export` devolve tudo como JSON (client-side gera o CSV, sem dependências). CSV combina biblioteca + diário num ficheiro (`# biblioteca` / `# diario`). Útil para backup, análise no Excel/Sheets ou sair da app.
- **Importar dados exportados** (Definições → "Importar dados"): carrega o ficheiro JSON ou CSV e faz merge conservador na tua conta (`POST /api/export/import` + `parseCsv` no backend). Não apaga notas/visto que o ficheiro não traga (`upsertLibrarySafe`/`importProgress`).

### Gamificação
- **Conquistas/badges + racha**: nova página `/achievements` (link no menu do perfil). 14 badges calculados a partir da library/diário (Primeiro passo, Matiné, Cinéfilo, Maratonista, Otaku, Crítico, Curador, Biblioteca, Centenário, Implacável, Lenda…) e o racha diário (dias consecutivos com atividade) com racha atual + melhor racha. Ícones SVG (sem emojis).

### Quick-add + UI de cartões
- **Quick-add nos cartões** (home/search/category): botão `+` no canto do cartão adiciona à watchlist ou marca como visto sem abrir a ficha (optimistic update). Usa um novo `LibraryProvider` (cache leve, carregado uma vez) que também faz aparecer as badges de visto/watchlist em todos os cartões do catálogo.
- **Nota no cartão**: se já deste uma nota, ela aparece (0-100, com SVG de estrela) no canto inferior-direito do cartão.

### Comparar com a comunidade
- **Barra de comparação na ficha**: em `LibraryControls`, mostra a tua nota (0-100) vs a média da comunidade (Letterboxd/MAL/TMDB, escala 0-100 equivalente) como uma barra comparativa — vais vendo onde a tua nota fica em relação à média.

### Infra / deploy
- `render.yaml`: corrigir o `buildCommand` para instalar também `web/` (e `server/`), senão o `vite` não existe e a build falha com `vite: not found`. Usar `npm install && npm --prefix web install && npm --postfix server install && npm run build` (ou `npm run install:all && npm run build`), e `startCommand: npm run start:pwa`.

## 0.9.9

### Notas pessoais 1-10 → 0-100
- As notas pessoais passam de escala 1-10 para **0-100** (mais precisa). As importações MAL (`score*10`), AniList (0-100 nativo) e Letterboxd (`score*10`) convertem automaticamente, e a base de dados existente é migrada uma única vez na arrancada (guarda `meta.scoreScale=100`).

### Comparação de notas
- **Jogo "Compara as tuas notas"** (`/compare`, menu do perfil): mostra dois títulos que já viste lado a lado com as notas da comunidade e as tuas; no meio ajustas a tua nota de cada um (escrever na caixa ou ↑/↓ de 1 em 1) e avanças para o próximo par.
- **Botão "Comparar avaliação" nas fichas** (`CompareRating.jsx`): modal com o título atual de um lado e um título já visto (aleatório) do outro como referência — ↑/↓ ajustam a nota do título atual de 1 em 1 (guardada logo) e "Trocar referência ↻" muda o lado direito.

### Players / providers
- **Auto-fallback entre providers:** o leitor de iframe (providers externos) passa automaticamente para a próxima fonte quando a que está seleccionada não responde em 15s — acaba o "a carregar indefinidamente" quando um provider cai/bloqueia. Mostra o nome do provider activo a ser testado.
- **Reordenação de providers (filmes/séries):** ordem passa a refletir velocidade/fiabilidade medida por probe (vidapi 128ms, moviesapi 123ms, 111movies 171ms, vidlink 203ms, vidcore 145-420ms, 2embed 210ms, superembed 229ms, smashystream 290ms). **Removidos:** MegaEmbed (mgeb.top — ~2280ms no filme, ~10x mais lento, e serve áudio PT-BR via Superflix sempre) e VidFast (SPA que resolve o vídeo só no browser; a health-check passa mas o stream falha). O default passa a ser o VidAPI.
- **Novo provider VidCore** (`vidcore.org`): API de embed dedicada a developers — player HLS multi-servidor com failover e subtítulos, URLs por TMDB, sem Turnstile/XFO/COEP, ~145-420ms. Nota: o stream resolve-se via JS client-side (SPA), pelo que o health-check valida só a página; falhas de stream são cobertas pelo auto-fallback de 15s.
- **Providers lentos marcados como mortos:** health-check agora sinaliza também quem demora >2.5s a responder (`SLOW_MS`), além dos que falham — entram na lista de "em baixo" (riscados) e são saltados na escolha automática.
- **Torrents compatíveis com o browser:** cada torrent é etiquetado no servidor com o container/codec (`.mkv`/`x265`/`AV1`/`mp4`) — a lista mostra um selo "✓ browser" para os reproduzíveis nativamente (mp4/webm) e um aviso ⚠ para os `.mkv x265` que o Chrome/Safari não tocam. Novo filtro "✓ Reproduz no browser" e a mensagem de erro do player aponta para ele. (`torrentio.js` extrai `behaviorHints.filename`, `Torrents.jsx`+`styles.css`).
- **Gerir torrents:** botão "✕ Parar torrent" no player para de descarregar e remove o torrent (libera disco e ligações — `DELETE /api/stream/:infoHash`, nova rota `GET /api/stream/active`).
- **Filtros/ordenação de torrents:** filtros x264/x265 e opções novas de ordenação (Qualidade, Menor tamanho — útil para downloads mais rápidos).
- **Legendas mais robustas:** cache + retry nos downloads do OpenSubtitles reduzem os erros 500 quando o player pede várias legendas de seguida (rate-limit).
- **Health check de providers:** TTL de 24h→6h (reflete melhor o estado real ao longo do dia) e UA de browser real no probe (menos falsos positivos de "em baixo").
- **UI de carregamento de providers:** o selector mostra estado `checking`/stale e o `useProviderHealth` aguenta refresh em background (6×3s) antes de usar a cache.
- **Definições a ficarem em branco (fix):** crash de render quando `provHealth` ainda era `null` (acesso sem guarda) derrubava a app inteira por não haver error boundary. Corrigido com optional chaining + novo `ErrorBoundary` (`web/src/components/ErrorBoundary.jsx`) que mostra uma mensagem com "Recarregar" em vez de ecrã vazio.

## 0.9.8

### PWA / Deploy web
- **`start:pwa`**: script raiz que builda o web (`npm run build`) e corre o server MEIDA com `SERVE_WEB=1` (serve `web/dist` + `/api` no mesmo origin) — caminho oficial para a PWA/web+api.
- `render.yaml`: serviço Render pre-configurado para a PWA (build `npm install && npm run build`; start `npm run start:pwa`, env `SERVE_WEB=1`). Evita correr `node electron/main.cjs` por engano.
- `electron/main.cjs`: guarda de boot — se corrido fora do runtime Electron (ex.: hosting erroneamente a apontar para o processo Electron), falha com mensagem explicativa ("usa `npm run start:pwa`") em vez do stack-trace opaco do `electron-updater`.

## 0.9.7

### PWA (instalar no iPhone — 100% grátis)
- A app MEIDA passa a ser **instalável como webapp progressiva (PWA)** no iPhone e Android (menu Safari/Chrome → "Adicionar à Tela de Início").
  - `manifest.json` (ícones 192/512, modo `standalone`).
  - Service worker (`workbox`) com cache de assets + `/api` (NetworkFirst) e imagens (CacheFirst) — funciona **offline parcial** (listas, cartazes, notas já carregadas).
  - Registo do SW em `main.jsx` (só na web, não no Electron).
  - `public/runtime-config.json`: define `VITE_API_BASE` (vazio = same-origin; aponta para o teu backend se a PWA ficar noutro host).
- GitHub Actions workflow `.github/workflows/pages.yml`: build + deploy contínuo do `web/dist` para GitHub Pages.
- Novo script `npm run build:pwa` (alias a `vite build`, já com PWA embutida).
- **Como instalar no iPhone (grátis):** hospeda o `web/dist` juntamente com o backend (o server MEIDA com `SERVE_WEB=1` serve web+api no mesmo URL) num hosting free (Render/Railway/Fly/Cloudflare) → abre no Safari → Share → "Adicionar à Tela de Início". Ou usa GitHub Pages e edita `runtime-config.json` para apontar para o teu backend.

### Notas técnicas
- `web/src/api/client.js`: chamadas `/api` agora usam `window.MEIDA_API_BASE` (fallback a `window.location.origin`) — same-origin no Electron e nos hostings onde o server serve web+api.

## 0.9.6

### AniList (ligado ao MyAnimeList)
- **Sync bidireccional MAL ↔ AniList**. Liga a tua conta AniList em Definições e,
  quando ambas as contas estão ligadas, a app reconcilia o maior progresso de eps
  vistos entre as duas — nunca regride. Empurra o "máximo" para a conta atrasada.
  - OAuth2 Authorization Code (`ANILIST_CLIENT_ID` / `ANILIST_CLIENT_SECRET` /
    `ANILIST_REDIRECT_URI`).
  - Importar lista completa (estado visto/ver, watchlist, nota pessoal 0-100→0-10,
    progresso, diário) via `POST /api/anilist/import`.
  - Scrobble de episódios no Details (marca MAL **e** AniList).
  - `POST /api/anilist/sync` manual + sync automático na Library (máx. 6h,
    cooldown independente, retry na falha) quando MAL + AniList estão ambos ligados.
  - AniList também funciona como **fonte de verdade da lista** quando o MAL não
    está ligado (sync automático na Library, max. 6h).

### Outros destaques desde 0.9.5
- **MAL API v2 de verdade**: OAuth2 PKCE, ligação/desligamento, `importMalList`
  (estado preciso: visto/ver, nota pessoal, progresso, diário) e `getMeanScores`
  (nota da comunidade) via API oficial — não mais scraping do Jikan. Sync
  automático na Library (max. 6h, retry na falha). AniList/Jikan ficam como
  reserva para quem não liga o MAL.
- **Fallback resiliente TMDB → TVMaze**: cache em disco (30 dias) + requests
  paginados do TVMaze para detalhes/episódios de series quando o TMDB falha.
- **Modo offline Library**: deteção de rede (`netFetch`, 3 falhas → offline 60s),
  rota `/library` serve a lista do cache sem rede e mostra banner no frontend.
- **Acessibilidade**: `aria-label`s em botões de ícone, `aria-hidden` em SVGs
  decorativos, foco visível (`:focus-visible`) global e contraste das setas do hero.
- **Temporadas de anime**: `getAnimeEpisodes` agrupa episódios reais por
  temporada (1 cour / 2 cours / split-cour) com picker no Details.
- **Recomendações**: secção "Se gostaste disto" entre o player e o fim do
  Details (TMDB similar + MAL recommendations).
- **Logs estruturados**: JSONL em `<dataDir>/logs` + console colorido; página de
  Estado dos providers em Definições.
- **Jikan → Tenrai (invertido, 1-out-2026)**: Tenrai passa a ser primário
  (`PRIMARY_URL`), Jikan backup; cooldown do primário. Escrow do MAL não é
  afetado (scrobble/sync usam a API oficial do MAL, não o `jikanFetch`).
- ESLint v10 (flat config), 0 erros.

## 0.9.5
- Modo offline da Library: deteção de rede, cache em disco (30 dias),
  rota `/library` offline + banner no frontend.
- IDEIAS: modo offline marcado como feito.

## 0.9.4
- Acessibilidade: `aria-label`s, `aria-hidden` em SVGs, `:focus-visible`,
  contraste de setas do hero.

## 0.9.3
- Cache em disco (Letterboxd/TMDB) + backfill em background na `/library`.
- Corrige tela preta ao abrir detalhes (TDZ nos states de série).
