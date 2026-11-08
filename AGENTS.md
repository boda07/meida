# AGENTS.md — Memória do projeto MEIDA

Instruções e contexto duradouro para assistentes de IA que trabalhem neste repo.

## Stack

- `server/` — backend Express (Node ESM), porta **5175**, corre com `npm run dev` (`node --watch`). Dados em `server/data/`.
- `web/` — frontend React + Vite, porta **5173** (dev). Build → `web/dist/`, servido pelo backend (`SERVE_WEB=1`).
- `electron/` — app desktop (Electron) que arranca o backend com o Node embutido.
- UI em português (pt-PT). `#c90303` é a cor de destaque.

## Projeto antigo do utilizador (inspiração, só neste portátil)

- **Caminho:** `C:\Users\white\Documents\RAI PAP` — o **ProdSound** (PHP + MySQL, projeto da escola do utilizador). Ele autorizou explicitamente (2026-10-09) que se consulte quando faltar inspiração para uma funcionalidade.
- **Só existe neste portátil.** Não está no repo nem vai com o git. Noutra máquina, o caminho é só uma sugestão — não faças código que dependa de o encontrar.
- **Só ler.** Nunca escrever, limpar ou formatar: é trabalho dele e o diretório não é um repo (não há git para recuperar). O ficheiro mais útil é `ProdSoundDB.sql` (schema + dados); a lógica está em `PSI/FrontEnd/` (cada página com o seu `cmd=`).
- Decisões que já resolveu e valem a pena copiar (**a decisão, não o código**): comentários aninhados de profundidade livre com **citação do pai** (`vp-comment-quote`, copiada para `.comment-cita`); notificações por tipo com `CodUtilizadorOrigem`; seguir, gostos, listas, denúncias, moderação por hierarquia, badges e rate limit.
- O terminal mostra os acentos estragados (PHP sem encoding). **É a leitura, não o ficheiro.**

## Numeração das versões (NUNCA saltar números)

A escala é **1–10**, não semver. O último número é um contador de 0 a 9:

```
0.9.7 → 0.9.8 → 0.9.9 → 1.0.0 → 1.1.0 → ... → 1.1.9 → 1.2.0 → ... → 1.3.0
```

- **Cada release incrementa exatamente 1** (quase sempre o patch).
- **Ao chegar a `.9`, o próximo é `.0` do minor seguinte** (`1.1.9` → `1.2.0`).
- **Proibido saltar** (ex.: `1.1.3` → `1.2.0` saltou `1.1.4`–`1.1.9`). Mesmo numa release grande, só se sobe o minor depois de `.9`.
- Antes de bumpar, confirmar a última publicada: `gh release list --limit 1` ou `node -p "require('./package.json').version"`.

## Processo de release

### Onde se compila (duas máquinas)

| Máquina | CPU | Para que serve |
| --- | --- | --- |
| **PC de desenvolvimento** (onde o agent trabalha) | ARMv8 Qualcomm (Snapdragon X), Windows 11 | editar, `npm run dev`, testes |
| **Desktop do Boda** | AMD64 Ryzen 5 4500, Windows 10 | builds de validação, testes em x86 real |

- **Não usar `echo $env:PROCESSOR_ARCHITECTURE`** — num PC ARM o PowerShell corre emulado a x64 e responde `AMD64`. A que diz a verdade é a `PROCESSOR_IDENTIFIER` (`ARMv8` vs `AMD64 Family`). O `scripts/verificar-x86.ps1` faz isto pelo nome do CPU.
- **`node_modules` envelhece num pull.** O `electron-builder` usa o Electron que está em `node_modules`; se estiver velho, a build sai com ele e ninguém vê. O hook `beforePack` `scripts/verificar-electron.cjs` compara as versões e **falha a build**. Se der erro: `npm install` (e `node node_modules/electron/install.js` se faltar o `electron.exe`).
- **Binários nativos do `server/` têm de ser da arquitectura certa** (ver secção própria). O `@electron/rebuild` não toca no `server/`; o hook `afterPack` resolve.
- **`import` de módulo nativo tem de ser `await import()` com `try`/`catch`** (ver `torrentEngine.js`): um `.node` partido não pode matar a app a arrancar.

### Passos

1. Bump da versão em `package.json` (raiz), +1 pela regra acima.
2. Atualizar a changelog da app: `web/src/changelog.js` (linguagem simples, mais recente em cima).
3. Atualizar `CHANGELOG.md` (raiz), técnico.
4. Commit + push (só com autorização).
5. `npm run app:publish` — usa `GH_TOKEN` (`gh auth token`), gera instalador + `latest.yml` + `.blockmap`, publica, corre o prune (mantém as 3 releases mais recentes) e verifica.
6. **Nunca criar a release só com `gh release create` sem binários** — o auto-update lê `https://github.com/boda07/meida/releases/latest/download/latest.yml` e parte.

Uma release só de notas, se for mesmo preciso, faz-se **depois** do `app:publish` com `--notes-file`.

### O 422 e o `fix-latest`

O `electron-builder` falha muitas vezes ao criar a release (`422 Validation Failed`) e deixa-a publicada pela metade (1 asset de 3). O `npm run app:publish` já corre o `scripts/publicar.cjs`, que tenta o electron-builder; se falhar, corre `node scripts/fix-latest.cjs <versao>` (idempotente: só envia o que falta ou mudou); depois corre o prune e o `verificar-release.mjs` (3 assets + `latest.yml` público com o `sha512` certo).

Regras que continuam a valer:

- **O `latest.yml` tem de ser gerado do `.exe` já assinado** — a assinatura acrescenta bytes e um hash anterior não bate.
- **O nome é com traços** (`MEIDA-Setup-x.y.z.exe`), não o nome em disco (`MEIDA Setup x.y.z.exe`).
- **O publish pode sair com código 1 e a release existir pela metade.** Confirmar sempre os 3 assets e o `latest.yml` público antes de dizer que está boa.

### Notas de PowerShell

- **`curl` está aliased** a `Invoke-WebRequest` (não aceita `-sIL`). E `execFileSync("curl")` dá `ENOENT` porque o `System32` não está no PATH do Node. **Usa `fetch` do Node**, nunca `curl`, em scripts.
- **`gh api` não aceita `--repo`** — passar o endpoint completo (`repos/boda07/meida/...`). O `gh` está em `C:\Program Files\GitHub CLI\`.
- O `gh` despeja o manual no stderr quando rejeita um flag; captura só a primeira linha.

### O aviso "There are data after the end of archive"

O `7z t` num instalador NSIS diz sempre isso — **mesmo num instalador bom**, porque o payload 7z está embutido num stub PE. Para distinguir truncagem: `Everything is Ok` presente, `Errors: 0`, e a contagem de ficheiros do `7z l` igual à do pacote.

## Regras de edição

- **NUNCA escrever caracteres chineses** (CJK = U+2E80–U+9FFF, U+3000–U+303F, U+FF00–U+FFEF). Verificar sempre antes de mostrar/commitar:
  ```
  node scripts/verificar-cjk.mjs <ficheiros>
  ```
  Ver também `\uFFFD` (UTF-8 partido).
- **Usar sempre a ferramenta `edit`** para alterar ficheiros. `Set-Content -replace` corrompe UTF-8. Para reescrever um ficheiro de propósito, **fazer backup primeiro** (ver "Processo e ferramentas").
- **Nunca `git push` sem o utilizador pedir.** Push autorizado ⇒ **obrigatório** bump de versão + changelog da app + `CHANGELOG.md` + release no GitHub com binários (`npm run app:publish`).
- **A changelog da app (`web/src/changelog.js`) é obrigatória em toda a release** — é o "o que mudou" dentro da app. Confirmar antes de qualquer push.

## Qualidade de código (SOLID)

Cada ficheiro/gancho deve ter **uma só responsabilidade** e ser testável isoladamente.

- **SRP:** um componente faz uma coisa; se mistura dados, persistência, negócio e UI, parte em ganchos (`use*.js`).
- **OCP:** comportamento novo → gancho novo, não alterar o existente.
- **LSP:** ganchos com a mesma assinatura são substituíveis.
- **ISP:** cada gancho expõe só o que o componente precisa.
- **DIP:** o componente depende de abstrações (ganchos), não de `fetch`/`localStorage`/`addEventListener` directos.

Ao refatorar: identificar responsabilidades → extrair ganchos → o componente compõe e renderiza → `npm test` + `npm run build` → verificar CJK.

## Servidor partilhado e modo web

- **Dados:** `https://meida.fadehost.app` (grátis, `/data` persistente, hiberna). Só dados — **vídeo é sempre local**. Embutido em `electron/default-server.txt`; precedência: `MEIDA_DEFAULT_SERVER` > ficheiro > `""`.
- Guardar `JWT_SECRET`, `ADMIN_TOKEN`, `TMDB_*`, `MAL_*`. **`MAL_REDIRECT_URI` = `https://meida.fadehost.app/api/mal/callback`** no FadeHost e em myanimelist.net/apiconfig.
- Migração: `npm --prefix server run export:json -- saida.json` → `POST /api/admin/seed` com `x-admin-token`. O export inclui `user_tokens` mas não sessões JWT.
- **O FadeHost não serve a interface web** (só API): não definir lá `SERVE_WEB` nem `HOST`.
- **A versão web vive em `https://meida.onrender.com`** (serviço `meida`, criado à mão; o `render.yaml` é só blueprint). O free **hiberna**: o primeiro pedido demora ~50 s.
- **No Render, o Start Command tem de ser `npm run serve:pwa`** (só arranca; o build é feito no passo de build). O `start:pwa` local constrói se a fonte for mais nova; `MEIDA_FORCE_BUILD=1` força. Quando `PORT` vem do ambiente, o servidor usa **uma** porta (sem saltar para port+1).
- Gera PWA (`dist/sw.js`). Aviso inofensivo: `WebTorrent: uTP not supported ... utp-native` — o uTP não está compilado; TCP/WebRTC funcionam.

## Bugs corrigidos e regras que nasceram deles

### Fontes e player

- **Anime sem fontes dizia "falta o parâmetro tmdb".** O ramo anime do `Details.jsx` não mandava `type`; o servidor só sabia que era anime pelo `type` e caía na resposta de filme. Corrigido nas duas pontas: o frontend manda `type: "anime"` e o servidor deriva o tipo quando recebe `mal`/`anilist`. A mensagem de anime já existia mas era inalcançável — **um teste por texto não apanha isto; só a chamada real**.
- **O id do AniList tem de ir para o disco** (`anilistid:<mal>`), não só para memória: cada provider de anime só entra se tiver o id de que precisa, e a AniList pode estar em baixo. O id não muda; o banner fica 30 dias.
- **`/api/sources`: `!tmdb` significa "o parâmetro não veio".** `req.query` é string: `tmdb=0` e `tmdb=abc` são truthy. E o `get()` do cliente omite `undefined`/`null`/`""` — um id vazio desaparece em silêncio.
- **Health-check: uma página de erro pode vir com HTTP 200.** O VidAPI (2026-11-07) devolvia `404 — Page Not Found` para todos os títulos, incluindo os exemplos da homepage. O marcador exacto (com travessão) está em `DEAD_HINTS`; `page not found` solto daria falsos positivos. A detecção é a função pura `motivoDePaginaMorta(text)`. O nativo é sondado pelo `getSources` e tem estado próprio (as duas entradas do MegaPlay têm o mesmo URL). Ao mudar as regras, **mudar a `CACHE_KEY`** (`provider-health-2`) para não esperar 6 h.
- **Ordem dos providers = preferência.** O 1.º vivo é a fonte default. O VidAPI ficou no fim (pode voltar, como o MegaPlay); o MoviesAPI é o 1.º. Um provider removido pode voltar — testar antes de o dar como morto. Comparar bytes antes de acrescentar outro: o "MegaVid 1 e 2" eram a mesma página.
- **MegaPlay** (`megaplay.buzz/stream/ani/{anilist}/{ep}/{audio}`): legendas completas; o `enc` é AES-CBC com chave/IV em texto simples no `newclient.min.js` (implementado em `megaplayNativo.js`); o `data-id` está na página, não no URL; exige `Referer`; `/ani/` e `/mal/` resolvem títulos diferentes — só `/ani/` entra, para não duplicar.
- **AniKoto** (`anikotoapi.site`): `/recent-anime` + `/series/{id}`; o `embed_url` é o próprio MegaPlay pela rota `/s-2/`; catálogo em SQLite (migração 7), separando "catálogo conhecido" de "embeds buscados".
- **Providers de anime grátis não são limpos.** O adblock local (`electron/adblock.cjs`) bloqueia pedidos na sessão do Electron; não prometer "sem anúncios". O VidNest só aceita id do AniList. Não procurar providers por adivinhação de domínios — medir com probe HTTP e browser (`<video>`, `<track>`, network). O aniwatchtv.ro não serve: scraping em 3 passos que parte quando mudarem o tema.
- **Anime "Temporada 1 (0 eps)":** o Tenrai não devolve `episode` nem `mal_id`; usar a **posição na lista**. E pode devolver 200 com `data: []` — tem de cair para o backup. `groupEpisodesBySeason([])` devolve uma temporada vazia, não `[]`: o teste certo é `seasons.some(s => s.episodes.length)`.

### Segurança

- **`trust proxy`:** `TRUST_PROXY` é o número de saltos, **0 por omissão**; só aceita números (`true`/listas ignorados). `app.set("trust proxy", 1)` fixo deixava qualquer cliente forjar `X-Forwarded-For`.
- **Login:** o limite conta **falhas**, não sucessos: 100 pedidos/15 min e bloqueio por `(ip, utilizador)` após 10 falhas/15 min. Comparar sempre com bcrypt, mesmo quando o utilizador não existe (`HASH_FALSO` válido de custo 10) — senão o tempo denuncia o username. O `register` devolve 409 "já existe" por desenho (o frontend usa isso).
- **Watch Party:** medir o tamanho com `Buffer.byteLength(JSON.stringify(data ?? ""))` (não `String(data)`, que dava `"[object Object]"`); o membro guarda `userId` e `/wp/send` exige `membro.userId === req.user.id`; rate limit 60/10 s; validar o `path` no servidor **e** no cliente com `^\/(?![/\\])[^\s\\]{0,300}$` antes do `navigate` (barra invertida e `//host` são o perigo).
- **Contador de salas por IP:** o registo é do **criador** da sala; o `cleanup` tem de descontar com `room.ip`, não com o IP da ligação que sai. Sem isso o contador fica preso até reiniciar.
- **SSRF:** IPv6 vem entre parênteses (`[::1]`) e `isIP` dá 0 — resolver com `dns.lookup(host, { all: true })` (usar `node:dns/promises`) e julgar **todos** os endereços; usar `net.BlockList` para CGNAT (`100.64.0.0/10`); **nunca** meter `::ffff:0:0/96` no BlockList (bloqueia todos os IPv4). O `/api/anime/megaplay` só aceita `origin === https://megaplay.buzz` e pathname `/stream/…`. `algumEnderecoBloqueado` é função pura testada com lista sintética (não há nome público com IP público e privado).
- **Redirects do proxy:** seguir **um salto de cada vez**, validando cada destino com `alvoSeguro`; limite 5; o URL final é a base da `rewritePlaylist` e também decide `isPlaylist`/`isLegendas`. O `redirect: "manual"` sem `Location` era um beco sem saída; `follow` reintroduzia o SSRF.
- **Assinatura do proxy:** válida **12 h** (uma sessão de vídeo, não um pedido), `ts` no futuro tolerado 5 min. O segredo deriva de `MEIDA_PROXY_SECRET` ou do `config.jwtSecret` com HMAC e contexto (`meida/proxy/hls/v1`) — nunca usar o segredo JWT tal e qual.
- **`timingSafeEqual` só depois de validar a FORMA:** `/^[0-9a-f]{64}$/i` garante 32 bytes. Comparar **bytes**, nunca caracteres (`admin.js` tinha o mesmo bug). Um `sig` inválido sem autenticação matava o servidor (DoS). A rede é `asyncRotas.js`, que leva rejeições de handlers `async` ao middleware de erro (Express 4 ignora a promessa) e respeita `res.headersSent`.
- **react-router:** `npm audit fix` não resolve (precisa de 7.18+; é major que toca 29 ficheiros). A mitigação é validar o `path` antes do `navigate`, nos dois lados.
- **Ganchos que desligam segurança** (`__ativarModoTeste`, `__permitirHostsNoTeste`) exigem `NODE_ENV=test` e **atiram** fora de testes. O `localhost` está bloqueado; o teste do redirect usa nomes exactos via `__permitirHostsNoTeste`.

### Dados e UI

- **Dias locais:** `dayOf` é partilhado e recebe `?tz` em `/api/stats` **e** `/api/achievements`; o heatmap desenha dias locais. Usar um `Intl.DateTimeFormat` em cache (1,19 µs contra 45,96 µs por chamada; o `dayOf` corre por linha). `computeStreak` é exportada e recebe `agora`.
- **ETag do avatar:** era o `length` (dois emojis diferentes davam 8). Agora é o SHA-1 do valor, com memo por utilizador, e `Cache-Control: public, max-age=300, must-revalidate` (sem `immutable`).
- **Idioma dos títulos:** `titleLang` por omissão é `"auto"`, resolvido **no cliente** para o idioma da interface. As **cinco** rotas que devolvem itens guardados localizam o título (`/library`, `/lists/:id`, `/progress`, `/users/:username/library`, `/users/:username/lists/:id`). Os `useEffect` do catálogo precisam de `t.idioma` nas dependências. A migração de `"en"` → `"auto"` corre uma vez (marca no `localStorage`).
- **"Continua a ver" abria no episódio 1** porque o `StrictMode` consumia `takeResumeEpisode()` 2x; `loadedSeasonRef` aplica a retoma só na 1.ª carga da temporada.
- **Auditor de i18n:** o scanner tem de reconhecer strings e regex (um `//` dentro de um URL ou regex cegava-o). Testar com fixtures que tenham texto **depois** do URL/regex. Unidade CSS (`184px`) não é texto; nomes próprios via `t()` com identidade; `// i18n` vale na linha de cima.
- **Permissões do Electron:** `setPermissionRequestHandler` decide com `callback(true/false)`; o valor de retorno é ignorado. Sem isso, fullscreen e clipboard ficam pendentes para sempre.

### Testes (lições que valem para qualquer teste novo)

- **Uma mutação que não aplica não testa nada.** Ancorar numa linha só (o repo é CRLF) e confirmar que o código mudou. Se o sub-teste morrer por `ERR_MODULE_NOT_FOUND`/`JSON.parse`, o harness lê "sem resumo" como "não apanhada" — guardar os parses e mostrar `ATIROU: ...`.
- **Um teste que pode pendurar pendura a CI.** Todo o `fetch` leva `AbortSignal.timeout(...)`; o servidor de mentira tem tecto (ex.: 20 redirects).
- **Não engolir `uncaughtException`/`unhandledRejection` no teste** — o módulo aborta e o Node sai com 0, que parece sucesso. A única prova de que chegou ao fim é `resumoImpresso` antes do fim.
- **`process.exit()` no fim de um teste com servidor aborta o Windows ao acaso** (`UV_HANDLE_CLOSING`). Usar `process.exitCode`, `filho.unref()` e `filho.stdout.destroy()`; matar → esperar pelo `exit` → `rmSync` (senão fica `EPERM` e pastas `meida-test-*`).
- **Testes por texto provam pouco:** passam quando o texto lá está e não dizem o que o browser faz. Preferir comportamento; quando o texto for inevitável, não o afrouxar só porque o código ficou melhor.
- **O controlo positivo é o que dói:** se "aceita a assinatura certa" falhar, suspeitar primeiro do teste (crypto duplicada), não do código. Importar a função real (`assinar`) em vez de reimplementar.
- **Datas/limites:** ancorar fronteiras no valor que o código produziu (`Number(ts)`), com margens de minutos — nunca num `Date.now()` tirado à parte.
- **Para testar 304 é HTTP cru:** o `fetch` do Node manda `cache-control: no-cache` e o `fresh` do Express devolve stale por desenho.
- **Escrever a asserção ao contrário:** antes de escrever "NÃO", perguntar o que se quer que aconteça.
- Um `res` falso com `return this` numa arrow rebenta (`this` é `undefined`); usar `function resFalso() { return res; }` e lembrar que `res.json({error})` guarda um objeto (`String` dá `"[object Object]"`).
- **Funções públicas chamadas no arranque têm de devolver a promessa** (`aquecerCatalogo` não devolvia e matou o servidor com `.catch` de `undefined`). Se mexer no arranque, o teste tem de **arrancar o servidor a sério**.
- **Ao acrescentar um campo ao IPC da presença do Discord**, acrescentá-lo à lista do `ipcMain.handle`, ao `buildActivity()` e ao teste.

### Processo e ferramentas

- **O Render não deployava** porque o start command reconstruía o site (47 s) e o scanner de portas desistia. `serve:pwa` só arranca; com `PORT` do ambiente, uma única porta.
- **GitHub Pages:** activar pela API (`gh api --method POST repos/boda07/meida/pages -f "build_type=workflow"`); actions em `checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`.
- **Um ramo novo tem de ser medido no caminho completo**, não só na lógica que decide (o `--sem-build` imprimia "a usar o build" e não arrancava).
- **Quase perdi o AGENTS.md** por usar `write` para acrescentar (sobrescreveu tudo). Para acrescentar, `edit`. Para reescrever de propósito, **backup primeiro**. **`git checkout --` só para ficheiros já commitados** — destruiu ~50 linhas por commitar. Qualquer comando que possa apagar trabalho por commitar exige commit (ou cópia) antes.

## Binários nativos do `server/`

**O problema:** o `electron-builder` copia `server/node_modules` tal e qual pelo `extraResources`, **sem recompilar**. Um `.node` compilado numa máquina ARM vai ARM64 para o pacote x64 e falha no `dlopen` em x86 (`ERR_DLOPEN_FAILED`). Se o módulo for importado estaticamente, o backend morre antes do primeiro log: janela preta + "o servidor não arrancou, código 1".

- **`node-datachannel`** (`build/Release/node_datachannel.node`, via `webrtc-polyfill`/`webtorrent`) é o caso tratado: os prebuilds oficiais estão em `scripts/native/` (`win32-x64` e `win32-arm64`, N-API) e o hook `afterPack` `scripts/empacotar-nativos.cjs` troca-os.
- **`fs-native-extensions`** tem `prebuilds/<plataforma>-<arquitetura>/` e **não é problema** (o runtime escolhe a pasta certa); o hook ignora-o (`RUNTIME`).
- **Novo `.node`:** não tentar `@electron/rebuild`/`npmRebuild`/`buildDependenciesFromSource` (nenhum olha para o `server/`). Meter o prebuild em `scripts/native/<pacote>.win32-<arch>.node`, acrescentar a `TROCAR` e não mexer no `package.json` do `server/` (o próximo `npm install` desfaz).
- **A defesa:** no fim o hook varre todos os `.node`/`.dll` do pacote e **falha a build** se a arquitectura estiver errada. Não mexer no hook sem ler isto.
- **Testar um `.node` x64 numa máquina ARM** exige o Node x64 (o Node local é ARM): descarregar `node-v24.x-win-x64.zip` e correr esse `node.exe`. Num PC x86, o Node local chega.

## Instaladores: regras e diagnóstico

- **`app:pack`, `app:pack:zip` e `app:publish` usam `--x64`** (sem `--arm64`). Sem `--x64`, uma build feita em ARM compila arm64 e **não instala em x64 nenhum**: escreve o registo, cria atalhos, extrai zero ficheiros e sai com código 0. O Windows ARM corre x64 emulado.
- **Confirmar `release/builder-debug.yml`** antes de publicar: se a única chave de topo for `arm64:`, a build está errada.
- **Sintoma de instalador partido:** "acaba com sucesso", escreve no registo e deixa o desinstalador, mas **não extrai a app**. Primeiro verificar a arquitectura, não o Defender nem o espaço.
- **O arquivo ARM64 truncado (1.3.7)** era um bug separado: o `app-arm64.7z` saía truncado sob emulação (as últimas entradas, incluindo o `MEIDA.exe`, ficavam ilegíveis). `7z t` mostra `Unsupported Method` e falta o `Everything is Ok`. Resolveu-se com `--x64`; para ter ARM nativo, compilar num PC x86.
- **Diagnóstico:** contar ficheiros do `win-unpacked` contra os instalados; `7z t`/`7z l` no instalador (o `7z` abre NSIS). Antes de culpar o instalador, **ver para onde aponta o atalho** (pode apontar para a pasta da build, que é apagada).
- **`scripts/verificar-x86.ps1`** lê o cabeçalho PE dos `.node`, arranca o servidor e carrega node-datachannel/WebTorrent. **100% ASCII e sem BOM** (o PowerShell lê mal com BOM) — tem de continuar assim. Correr nas duas máquinas: veredito real no desktop x86, emulação no ARM. Gist: `https://gist.github.com/boda07/7e23010eb543763de239ab1e7af0ffc0`.
- **`npm ci` e `electron`:** o `node-datachannel` não traz binário no tarball (o script descarrega); o `electron` também precisa do script. Usar `install:all` (`npm ci && node node_modules/electron/install.js && ...`) antes de empacotar; `install:all:update` só ao mexer em dependências.
- **PowerShell:** `OK "texto " + $variavel` **não concatena** (passa 3 argumentos). Usar `OK ("texto " + $variavel)`.

## Funcionalidades recentes

- **Discord Rich Presence** (`electron/discord-presence.cjs`): protocolo RPC à mão sobre o Named Pipe, zero dependências; `client_id` 1556179310077804564 (`MEIDA_DISCORD_CLIENT_ID` sobrepõe). Três estados: `"a-ver"` (com `timestamps`), `"pausa"` (`timestamps.paused`) e `"sem-dados"` (**sem** `timestamps`, para não mentir nos iframes). O que separa "parou" de "nunca soube" é `viuProgressoRef` no `Details.jsx`. `buildActivity()` é pura e exportada; `MIN_UPDATE_MS = 15000`.
- **Notas 0-100** (antes 1-10): UI, servidor, importações MAL/Letterboxd (`*10`), AniList nativo, migração `meta.scoreScale = 100` uma vez.
- **Jogo "Compara as tuas notas"** (`/compare`) e **"Comparar avaliação"** (`web/src/components/CompareRating.jsx`); estilos `.compare-*`/`.cmp-btn`. No grid, a coluna central usa `align-self: stretch` e não se usa `order`.

## O que o utilizador pediu

- Redesenho de UI ("NOW/Sky") abandonado — `design_handoff_meida_home/` removido.
- Sempre que terminar uma funcionalidade, perguntar se quer commit/push/release (ele costuma querer).
- **NUNCA push sem autorização. Todo push ⇒ bump de versão + changelog + release no GitHub com assets.**
- **A changelog da app é obrigatória em cada release** (`web/src/changelog.js`, primeiro).
- **Ideias e melhorias vivem em `IDEIAS.md`** (raiz): consultar primeiro e acrescentar lá; marcar `[x]` e mover para "Feitas".
