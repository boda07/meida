# AGENTS.md — Memória do projeto MEIDA

Instruções e contexto duradouro para assistentes de IA que trabalhem neste repo.

## Stack

- `server/` — backend Express (Node ESM), porta **5175**, corre com `npm run dev` (`node --watch`). Dados em `server/data/` (JSON + cache).
- `web/` — frontend React + Vite, porta **5173** (dev). Build → `web/dist/`, servido pelo backend (`SERVE_WEB=1`).
- `electron/` — app desktop (Electron) que arranca o backend com o Node embutido.
- UI em português (pt-PT). `#c90303` é a cor de destaque.

## Numeração das versões (NUNCA saltar números)

A escala é **1–10**, não semver. O último número é um contador que vai de 0 a 9:

```
0.9.7 → 0.9.8 → 0.9.9 → 1.0.0 → 1.1.0 → 1.1.1 → ... → 1.1.9 → 1.2.0 → ... → 1.2.9 → 1.3.0
```

- **Cada release incrementa exatamente 1.** A próxima versão é quase sempre `MAIOR.MENOR + 1` (o patch).
- **Ao chegar a `.9`, o próximo é `.0` do minor seguinte** (`1.1.9` → `1.2.0`, `1.2.9` → `1.3.0`). É o que aconteceu em `0.9.9` → `1.0.0`.
- **Proibido saltar** (ex.: `1.1.3` → `1.2.0` saltou `1.1.4` a `1.1.9`). Mesmo para uma release grande: a partir de `1.1.3` a próxima era `1.1.4`, e só depois de `1.1.9` é que se sobe para `1.2.0`.
- Antes de bumpar, confirmar a última versão publicada: `gh api repos/boda07/meida/releases | ConvertFrom-Json | Select-Object -First 1 tag_name`, ou `node -p "require('./package.json').version"`.
- Excepção já consumida: a **1.2.0** foi publicada com este salto (6 versões em diante) e o utilizador mandou deixá-la assim. Não voltar a acontecer.

## Processo de release (importante)

> **A maquina de desenvolvimento e Windows sobre ARM** (`PROCESSOR_IDENTIFIER = ARMv8 ... Qualcomm`). Sem `--x64`, o `electron-builder` compila **arm64** e o instalador **nao instala em nenhum PC x86/x64 normal** — e falha em silencio: escreve o registo, cria o desinstalador e os atalhos, extrai zero ficheiros da app e sai com codigo 0. **Foi assim que 1.2.0, 1.2.1 e 1.2.2 ficaram partidas** (ver "Instaladores arm64" mais abaixo). Os scripts `app:pack`, `app:pack:zip` e `app:publish` ja leva `--x64`. **Nao os tirar.** Antes de publicar, confirmar em `release/builder-debug.yml` que a unica chave de topo e `x64:`.

1. Bump da versão em `package.json` (raiz) — **+1 segundo a regra de numeração acima** (ex.: `0.9.9`).
2. Atualizar o changelog da app: `web/src/changelog.js` (linguagem simples, sem termos técnicos, mais recente em cima).
3. Atualizar `CHANGELOG.md` (raiz) — changelog técnico, com secções e detalhes.
4. Commit + push.
5. **Publicar com binários**: `npm run app:publish` (usa `GH_TOKEN` — `gh auth token` resolve-o com scope `repo`; gera o instalador + `latest.yml` + `.blockmap` e faz upload para a release do GitHub; depois corre `scripts/prune-releases.mjs` que mantém só as 3 releases mais recentes).
6. O botão "Procurar atualização" da app depende dos **assets da release** (`latest.yml`). **NUNCA** criar a release só com `gh release create` sem binários — isso parte o auto-update (o electron-updater lê `https://github.com/boda07/meida/releases/latest/download/latest.yml`).

Se for preciso uma release apenas textual (notas), usar `gh release create` **depois** do `app:publish` com `--notes-file`.

## Regras de edição

- **NUNCA escrever caracteres chineses.** Nem nas mensagens ao utilizador, nem em ficheiros, nem em commits. O utilizador já reclamou várias vezes (2026-10-04). CJK = U+2E80–U+9FFF (mais U+3000–U+303F e U+FF00–U+FFEF). **Antes de mostrar texto, revê-lo.** Em ficheiros, verificar sempre com:
  ```
  node -e "const s=require('fs').readFileSync('FICHEIRO','utf8');const l=s.split(/\r?\n/);const m=l.map((x,i)=>[\u2E80-\u9FFF].some(c=>x.includes(c))?i+1:0).filter(Boolean);console.log(m.length?('CJK nas linhas '+m):'OK')"
  ```
  Ver também `\uFFFD` (carácter inválido) — sinal de UTF-8 partido.
- **Usar sempre a ferramenta `edit`** para alterar ficheiros. `Set-Content -replace` corrompe UTF-8 (partiu acentos/cedilhas no passado).
- **Nunca fazer `git push` sem o utilizador pedir primeiro.** Sempre que o utilizador autorizar push, é **obrigatório** atualizar a versão (`package.json` → `web/src/changelog.js` → `CHANGELOG.md`) **e** publicar a release do Git (tag + `gh release` com binários via `npm run app:publish`).**
- **A CHANGELOG DA APP (`web/src/changelog.js`) É OBRIGATÓRIA EM TODA A RELEASE.** Nunca fazer bump de versão / commit / release sem acrescentar a entrada dessa versão em `web/src/changelog.js` (linguagem simples, mais recente em cima) — é o que o utilizador vê no "o que mudou" dentro da app. Verificar SEMPRE que fica lá antes de qualquer push.

## Servidor partilhado (nuvem)

- Endereço: **`https://meida.fadehost.app`** (grátis, sem cartão, `/data` persistente, hiberna quando parado). Só dados — **vídeo é sempre local**.
- Está embutido no build em `electron/default-server.txt` (só o URL, uma linha). Precedência no `electron/main.cjs`: env `MEIDA_DEFAULT_SERVER` > ficheiro > "".
- Guardar: `JWT_SECRET`, `ADMIN_TOKEN` (rota `/api/admin/seed`), `TMDB_*`, `MAL_*`. Ver `deploy/SERVIDOR-PARTILHADO.md`.
- **`MAL_REDIRECT_URI` tem de ser `https://meida.fadehost.app/api/mal/callback`** no FadeHost **e** em myanimelist.net/apiconfig. Sem isto o OAuth do MAL volta para `localhost:5175` e falha.
- Migração de dados: `npm --prefix server run export:json -- saida.json` e depois `POST /api/admin/seed` com `x-admin-token`. O export **inclui** `user_tokens` (MAL/AniList/Letterboxd) mas **não** sessões JWT — é o certo, o remoto tem outro `JWT_SECRET`, por isso o utilizador entra uma vez com a senha normal.
- **O servidor partilhado NÃO serve a interface web** — é só API. `deploy/SERVIDOR-PARTILHADO.md` diz para **não** lá definir `SERVE_WEB` nem `HOST`. Portanto `https://meida.fadehost.app/` não abre a app no browser. Quem quer a versão web usa **`https://meida.onrender.com`** (ver abaixo) — são coisas diferentes: o Render serve a app, o FadeHost guarda os dados.

## Modo web / browser

- **A versão web já está publicada e viva em `https://meida.onrender.com`.** Verificado em 2026-10-04: `/api/health` → `{"ok":true,"tmdbConfigured":true}`; a raiz devolve `<title>MEIDA` com `div id="root"` e `/assets/`; o SPA fallback funciona em rotas internas (`/compare` → 200). É esta a resposta a dar a quem tem a instalação de desktop partida no Windows — **não instalar nada**, abrir o endereço. O Render free **hiberna**: o primeiro pedido depois de um tempo parado demora ~50 s a acordar. Não é erro.
- O serviço no Render chama-se `meida` (URL `meida.onrender.com`), **não** o `meida-pwa` que está no `render.yaml` — o blueprint é para instâncias novas, o que está em produção foi criado à mão.
- `npm run start:pwa` (na raiz) = `npm run build` + backend com `SERVE_WEB=1`. Compila e sobe em `http://localhost:5175`. **Não é preciso correr `npm run build` à parte.** Verificado em 2026-10-04: HTTP 200, `index.html` com `div id="root"` e referências a `/assets/`.
- Gera também um **service worker** (workbox, `dist/sw.js`, ~25 entradas em precache) — ou seja a versão web é uma PWA instalável pelo browser.
- O frontend já está preparado para não-Electron: `web/src/discord.js` devolve `window.electronAPI` e as funções tornam-se no-op silencioso quando não existe. É o mesmo código da app desktop, não uma versão separada.
- **Aviso esperado e inofensivo ao arrancar:** `WebTorrent: uTP not supported Error: Cannot find module 'utp-native'`. É só o transporte uTP (UDP) que não está compilado; o WebTorrent continua a funcionar por TCP/WebRTC. No browser o uTP nem se usa (lá é WebRTC), por isso não afecta a versão web.

## Bugs corrigidos (não repetir erros)

- **Quase perdi o AGENTS.md inteiro (2026-10-04)**: usei a ferramenta `write` para acrescentar uma secção e ela **sobrescreveu o ficheiro todo** (18586 bytes → 2070). Salvei com `git checkout -- AGENTS.md`. **Porquê não voltou a acontecer:** para acrescentar texto a um ficheiro existente usa **sempre `edit`**, nunca `write`. O `write` só para criar ficheiros novos. Isto viola a regra "usar sempre a ferramenta `edit`" acima — obeyecê-la evita isto e mais.

- **Release publicada sem `latest.yml` (auto-update partido)**: ao correr `npm run app:publish`, o GitHub devolveu `422 "Published releases must have a valid tag"` ao criar a release `v1.2.0`. Ficou a release publicada **só com o instalador** (1 asset em vez de 3) — sem `latest.yml` o botão "Procurar atualização" não funciona (o mesmo sintoma das v0.9.6–0.9.9). **Corrigido** correndo `npm run app:publish` outra vez: com a release já existente o electron-builder faz *update* em vez de *create* e envia os 3 assets. **Regra:** depois de publicar, confirmar `gh api repos/boda07/meida/releases` → a release nova tem de ter **3 assets** (`latest.yml`, `MEIDA-Setup-x.y.z.exe`, `MEIDA-Setup-x.y.z.exe.blockmap`), e `curl -sL https://github.com/boda07/meida/releases/latest/download/latest.yml` tem de devolver `version: <a que publicaste>`.
- **O bug voltou na 1.2.2, e desta vez o asset que faltou foi o `.exe`** (não o `latest.yml`): o `npm run app:publish` terminou com `422 "Published releases must have a valid tag"` ao criar a release, e a release `v1.2.2` ficou publicada só com `latest.yml` + `.blockmap` — **sem o `MEIDA-Setup-1.2.2.exe`**, ou seja um `latest.yml` que aponta para um ficheiro inexistente. O instalador tinha sido construído localmente sem problemas (`release\MEIDA Setup 1.2.2.exe`, 102,3 MB) — falhou só o upload. **Como cada vez falta um asset diferente, contar os assets continua a ser a única verificação fiável**; nunca assumir que o `latest.yml` é o que falta. Repetir o `npm run app:publish` uploadou os 3 (`overwrite published file ... reason=already exists on GitHub`).
- **O mesmo bug voltou na 1.2.1, com outro erro**: `422 "Validation Failed" / code: already_exists / field: tag_name` — a release `v1.2.1` foi criada e **publicada** (já não era draft) com 1 asset, e só depois é que uma segunda tentativa de `POST /releases` falhou com `already_exists`. Ou seja: **não estejas a olhar para o erro do fim do log para concluir que a publicação correu bem** — o `publish` pode ter gravado a release incompleta *antes* de uma chamada duplicada rebentar. O `npm run app:publish` termina com `Exited with code 1` **e mesmo assim a release pode existir e estar pela metade**. **Sempre** confirmar os 3 assets + o `latest.yml` público (comando acima) antes de dizer ao utilizador que a release está boa; se faltar o `latest.yml`, repetir `npm run app:publish` (na segunda corrida o log mostra `overwrite published file ... reason=already exists on GitHub` e o `latest.yml` aparece).
- **`gh` (GitHub CLI) não estava instalado** nesta máquina (`C:\Program Files\GitHub CLI`), logo `gh auth token` falhava e o `electron-builder --publish` não tinha `GH_TOKEN`. Instalado com `winget install --id GitHub.cli -e`; o login do utilizador é preciso **uma vez** (`gh auth login --web --git-protocol https`) e pode ser feito noutro terminal — o token fica no keyring do Windows.
- **"Continua a ver" abria no episódio 1**: causa = `<React.StrictMode>` (dev) consome `takeResumeEpisode()` 2x. Corrigido com `loadedSeasonRef` em `web/src/pages/Details.jsx` — a retoma só é aplicada na 1ª carga efetiva da temporada.
- **"Procurar atualização" não funcionava**: as releases v0.9.6–0.9.9 foram criadas só com notas (`gh release create` sem binários), sem `latest.yml`/instalador → o `electron-updater` falha a comparar versões. Corrigido publicando a v0.9.9 via `npm run app:publish` (que gera `MEIDA-Setup-x.x.x.exe`, `.blockmap` e `latest.yml` e os anexa à release). **Regra:** uma release destino de upgrade **precisa** de assets — nunca usar `gh release create` puro para uma versão que deve ser atualizável.

- **Providers de anime: "MegaVid 1 e 2" eram o mesmo player** (2026-10-04). `megavid.buzz/mal/...` e `megavid.buzz/ani/...` passaram a devolver a **mesma página byte a byte** (31253 bytes, `<title>KissKH Player</title>`) — o mesmo player em duplicado, por isso o utilizador via duas entradas iguais. Esse player é servido pelo **CDN do Teniacites**, faz tracking com o **Histats**, e o próprio código dele diz que as legendas só existem para cópias em cache (*"subtitle tracks ... only for OUR cached copies"*) → episódios novos ficavam sem legendas. **As duas entradas foram removidas**.
  - **Nenhum provider de anime grátis é limpo.** O VidNest carrega popunder + tracking de fundo (`view-mintads.site`, `image.eu.bmndx.com` = bounceExchange, `eu.xml.bdpcmd.com`, e um CSS de `thatdisform.cyou` que injeta o click-catcher). O `shorl.hartlysiegeractos.cyou` devolve `{"s":"1536x960","b":"1000x700"}` = config de popunder. **Não prometer "sem anúncios" a ninguém.**
  - **O health-check só via HTML inicial não chega** para apanhar isto: os ads do VidNest são carregados por JS em runtime, por isso o HTML não tem nenhum marcador. O `AD_MARKERS` em `providerHealth.js` só apanha a classe "o player É um site de anúncios" (Teniacites/Histats) — é útil, mas não é um bloqueador.
  - **O bloqueador de verdade é local e grátis**: `electron/adblock.cjs` cancela os pedidos de anúncios na sessão do Electron (`session.webRequest.onBeforeRequest`), antes de saírem para a net, e vale para **todos** os providers. Instalado em `main.cjs` dentro de `createWindow()`. Lista à mão (41 domínios) + `NEVER_BLOCK` de segurança. `MEIDA_ADBLOCK_DEBUG=1` faz log de cada bloqueio. O `setWindowOpenHandler(() => deny)` que já existia só impedia a janela de abrir, não o script de carregar.
  - **O VidNest só aceita `/anime/` com id do AniList** (`/mal/` e `/ani/` dão 404). Por isso `server/src/routes/sources.js` agora resolve o AniList via `malToAnilist()` quando o catálogo só traz o id do MAL — sem isso, um anime com `anilistId: null` ficava **sem fonte nenhuma**.
  - **O aniwatchtv.ro** (site indicado pelo utilizador) serve de exemplo mas **não dá para pôr como provider**: é WordPress + tema HiAnime, e o player resolve-se por REST (`wp-json/v1/otakuthemes/`, endpoints `episode/list/{id}` e `episode/servers`) em 3 passos, com slugs próprios do site. A app só tem ids MAL/AniList, e esse scraping parte assim que mudarem o tema.
  - **Não procurar providers por adivinhação de domínios.** O que resultou bem foi: (1) probe HTTP com Node para comparar bytes/tamanho entre variantes do mesmo site, (2) abrir no browser para ver `<video>`/`<track>` (o que o JS carrega), (3) `browser.network.list` para ver o que é que o player pede. O `vidstream.pro` respondia 200 mas não renderizava nada de útil — o health-check dizer "ok" não quer dizer que o player funcione.

- **Provider de anime principal: MegaPlay (`megaplay.buzz`)** (2026-10-04). Foi procurado a sério depois de instalar o adblock, e é a resposta à queixa original (sem legendas + anúncios). URL: `https://megaplay.buzz/stream/ani/{anilist}/{ep}/{audio}` (também aceita `/stream/mal/{mal}/...` e `/stream/s-2/{episode_id}/...`).
  - **Legendas completas, em claro.** O endpoint `/stream/getSources?id={data-id}` (que se lê do atributo `data-id` da página do player) devolve `{tracks:[{file:".../subtitles/eng-2.vtt", kind:"captions"}], t, server, intro, outro, enc}`. O `.vtt` do ep 1 do One Piece tem 285 blocos de texto — o oposto do MegaVid. O vídeo em si vem **encriptado** no campo `enc` (é o JS do player que o descripta), por isso **não dá para reproduzir nativamente sem fazer engenharia reversa** — ficamos pelo iframe, como os restantes.
  - **É o mais limpo de todos**: em 12 s de reprodução e mesmo a clicar (que é o que dispara popunders) só pediu segmentos de vídeo. O único pedido de terceiros é `statlytic.net` (estatísticas), que já está no adblock.
  - **Exige header `Referer`**, senão devolve a página "Error - MegaPlay". Não valida o *valor*, só exige que exista — e um iframe envia sempre, por isso na app funciona. A health-check manda a raiz do próprio site (`refererFor()` em `providerHealth.js`).
  - **A rota `/ani/` e a `/mal/` NÃO são iguais** — cada uma falha em títulos que a outra resolve (Solo Leveling só na `/ani/`, Dandadan só na `/mal/`). Só entram `/ani/` na app, para não voltar a mostrar o mesmo episódio duas vezes (o erro do "MegaVid 1 e 2").
  - **As legendas vêm ligadas** (JW Player, `getCurrentCaptions() === 1`), ao contrário do VidNest onde a track nasce com `mode="disabled"` e o utilizador tem de a ligar à mão.
  - **Cuidado: um provider removido pode voltar.** O MegaPlay foi removido a 2026-07-31 por devolver erro 410 e voltou a 2026-10-04. Antes de dar um provider como morto, voltar a testar.
  - **Descartados nesta procura** (2026-10-04): `supaplay.fun` (passou a "PREMIUM ACCESS", e o `aniwixi` cobra $50/mês — nada pago), `ani.megaplay.su` (devolve uma página de erro; a API JSON exige origem na lista branca), `ninjasheild.stream` (não responde), `myapi-psi-wheat.vercel.app` (API do AnimePahe, `/search` dá 503), `api.ani.zip` (404 na raiz).
  - **A `anikotoapi.site` dá exatamente os URLs do MegaPlay** (rota `s-2`), com 9044 títulos e `mal_id`/`ani_id` — mas **não tem pesquisa**, só paginação por data (91 páginas) e 60 requests/2 min por IP. Cobrir um título antigo exigiria rastear o catálogo todo; para já não compensa (ver `IDEIAS.md`).


## Instaladores arm64: 1.2.0 ate 1.2.2 nao instalam em PC x64 (2026-10-04)

**CAUSA RAIZ, confirmada.** Esta maquina de desenvolvimento e **Windows sobre
ARM** (Snapdragon; `PROCESSOR_IDENTIFIER = ARMv8 (64-bit) ... Qualcomm`). O
`electron-builder` sem `--x64` compila **arm64**. Confirmado em
`release/builder-debug.yml`, cuja unica chave de topo era `arm64:`.

**Como falha, em silencio.** `extractAppPackage.nsh` do electron-builder:

```nsis
!macro identify_package
  !ifdef APP_64
    ${if} ${RunningX64} ${orIf} ${IsNativeARM64}     ; so define $packageArch se for ARM64
      StrCpy $packageArch "64"
  !endif
  !ifdef APP_ARM64
    ${if} ${IsNativeARM64}                          ; idem para ARM64
      StrCpy $packageArch "ARM64"
```

Num PC x64 normal, `${IsNativeARM64}` e falso e `APP_64`/`APP_32` nao estao
definidos, porque so foi empacotado arm64. Logo `$packageArch` fica **vazio** e
`compute_files_for_current_arch` **nao extrai um unico ficheiro**. O instalador
continua: escreve o registo, deixa o `Uninstall MEIDA.exe`, cria os atalhos
(apontando para um `MEIDA.exe` inexistente, o que faz o Windows mostrar *"o
Windows esta a procurar MEIDA.exe"*), e sai com **codigo 0**. Sem registo no
CodeIntegrity, sem evento de 논 Defender, sem aviso nenhum.

**Afeta as tres ultimas releases** (1.2.0, 1.2.1, 1.2.2) e a toda a gente em
x64 — nao e so ao PC do utilizador. Como o `prune-releases` so mantem 3, todas
as releases visiveis estavam partidas.

**Isto e tambem a verdadeira causa da instalacao partida original**, e nao a
"corrida do auto-update": ao passar de 1.1.x para 1.2.0, o electron-updater
descarregou o payload arm64 e o instalador falhou exactamente assim. A espera
pelo backend em 1.2.2 (`await stopServer(true)` antes de `quitAndInstall`) foi
uma correcao para um problema que nao existia — inofensiva, mas nao a causa.

**Correccao:** `--x64` em `app:pack`, `app:pack:zip` e `app:publish`. Confirmar
sempre `release/builder-debug.yml` antes de publicar.

**Diagnostico que vale a pena reter:** um instalador que "acaba com sucesso",
escreve no registo e deixa o desinstalador, mas **nao extrai a app**, e a
primeira coisa a verificar e a **arquitectura** (`builder-debug.yml`,
`PROCESSOR_IDENTIFIER`), nao o Defender nem o espaco. O registo de Aplicacoes
nunca regista ficheiros bloqueados; o certo e o `CodeIntegrity/Operational`.

Ferramentas criadas durante esta investigacao (gists, so de leitura):
`scripts/diag-instalacao.ps1`, `scripts/reparar-instalacao.ps1` (agora guarda o
**codigo de saida** do instalador, que e o que dá a pista), e
`scripts/verificar-instalacao.ps1`.

## Funcionalidades recentes

- **Discord Rich Presence** (grátis, local): mostra no perfil do Discord o que se está a ver, como o Stremio. `electron/discord-presence.cjs` implementa o **protocolo RPC do Discord à mão** (frames `[opcode LE32][len LE32][JSON]`, HANDSHAKE/FRAME/CLOSE/PING/PONG) sobre o Named Pipe `\\?\pipe\discord-ipc-0..9` — **zero dependências** (o pacote npm `discord-rpc` está abandonado desde 2021; as alternativas modernas exigem Node >= 24.13). `client_id` = **1556179310077804564** (aplicação MEIDA no Discord Developers, grátis), sobreponível com `MEIDA_DISCORD_CLIENT_ID`. Frontend em `web/src/discord.js` (no-op silencioso sem Electron ou com a definição desligada), ligado em `Details.jsx` à escolha de fonte + ao `reportPos` do progresso. `MIN_UPDATE_MS = 15000` (limite do Discord); `clear()` mantém o socket, `shutdown()` é que fecha.

- **Notas pessoais 0-100** (antes 1-10): UI, servidor, importações MAL (`*10`), Letterboxd (`*10`), AniList (nativo 0-100), e migração dos dados antigos em `server/src/store.js` (guarda `meta.scoreScale = 100`, corre uma vez).
- **Jogo "Compara as tuas notas"** (`/compare`, link no `ProfileMenu.jsx`): pares de títulos vistos escolhidos ao acaso; ↑/↓ ajustam a nota de cada item (1 em 1); botão "Manter e próximo" no meio passa ao par seguinte.
- **"Comparar avaliação"** (`web/src/components/CompareRating.jsx`, botão na ficha): modal com o título atual de um lado e um título já visto (aleatório) do outro; ↑/↓ ajustam a nota do título atual.
- Estilos de comparação em `web/src/styles.css` (`.compare-*`, `.cmp-btn`). Atenção: a coluna central usa `align-self: stretch`; remover `order` dos itens do grid (o `order` reposiciona a coluna central para a direita).

## O que o utilizador pediu

- Redesenho de UI ("NOW/Sky") abandonado — `design_handoff_meida_home/` removido.
- Sempre que terminar uma funcionalidade, perguntar se quer commit/push/release (ele costuma querer).
- **NUNCA push sem autorização. Todo push ⇒ obrigatório bump de versão + tag + release no GitHub (com assets via `npm run app:publish`).**
- **LEMBRAR SEMPRE:** em cada release, atualizar PRIMEIRO a changelog da app em `web/src/changelog.js` (ver "Regras de edição" acima — é obrigatório, não é opcional).
- **Ideias e melhorias vivem em `IDEIAS.md`** (raiz). Quando o utilizador pedir ideias, consultar esse ficheiro primeiro e adicionar novas ideias lá. Marcar `[x]` as que forem feitas e mover para "Feitas".
