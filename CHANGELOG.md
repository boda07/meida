# Changelog

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
