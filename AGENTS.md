# AGENTS.md — Memória do projeto MEIDA

Instruções e contexto duradouro para assistentes de IA que trabalhem neste repo.

## Stack

- `server/` — backend Express (Node ESM), porta **5175**, corre com `npm run dev` (`node --watch`). Dados em `server/data/` (JSON + cache).
- `web/` — frontend React + Vite, porta **5173** (dev). Build → `web/dist/`, servido pelo backend (`SERVE_WEB=1`).
- `electron/` — app desktop (Electron) que arranca o backend com o Node embutido.
- UI em português (pt-PT). `#c90303` é a cor de destaque.

## Onde ir buscar inspiração: o projeto antigo do utilizador (só neste portátil)

> **O utilizador autorizou explicitamente (2026-10-09): sempre que precisares de
> inspiração para uma funcionalidade, vai ver o projeto antigo dele.**

**Caminho:** `C:\Users\white\Documents\RAI PAP`

**Só existe neste portátil.** Não está no repo, não vai com o git, e não está no
desktop do Boda. Se noutra máquina a pasta não estiver lá, o caminho é só uma
sugestão — não faças código que dependa de a encontrar.

### O que é

O **ProdSound** — o projeto da escola do utilizador. PHP + MySQL, não tem nada a
ver com a MEIDA em código. Está organizado assim:

| Onde | O quê |
| --- | --- |
| `PSI/Backend/` | PHP por área — `Tickets/`, `Denuncias/`, `Utilizadores/`, `Publicacoes/`, `Badges/`, `Logs/`, `Dashboard/` |
| `PSI/FrontEnd/` | As páginas, cada uma com o seu `cmd=` |
| `PSI/Comum/` |includes partilhados, `menu.php`, notificações, preferências |
| `ProdSoundDB.sql` | O schema **e** os dados — o ficheiro mais útil dos quatro |
| `*.docx` / `Em PDF/` | Caderno de análise, relatório e manual do utilizador |

**PHP com SQL dentro do código** (`$lig->query("SELECT ... WHERE id='$id'")`),
o `$_SESSION` para o login, e render no servidor. **Não copies o estilo** — o que
interessa é o que ele já resolveu.

### Porque é que vale a pena ir lá

**Porque já resolveu coisas que a MEIDA ainda não resolveu.** Foi exactamente
assim que se descobriu o bug dos comentários aninhados (ver "Bugs corrigidos"):
ele tem respostas a respostas a três níveis e a MEIDA não conseguia nem com duas.

Coisas que lá já estão feitas e que na MEIDA foram pensadas do zero:

- **Comentários aninhados de profundidade livre.** `CodCP_Pai` aponta para o
  próprio pai, sem achatar. Os dados no dump mostram os três níveis reais
  (o comentário 6 responde ao 5, e o 5 responde ao 3).
- **Como se lê um fio fundo:** `exibirComentarios($parent_id, …, $nivel = 0)`
  recursivo, e cada resposta mostra uma **citação do pai** — `vp-comment-quote`,
  com autor e até 120 caracteres, com link para `#com-<id>`. É o truque que
  sustenta o aninhamento quando a indentação já não ajuda. **Copiado para a
  MEIDA** como `.comment-cita`.
- **Notificações** com `ENUM` de tipo (`comentario`, `resposta`, `like_comentario`,
  `like_post`, `seguir`, `repost`, `ticket_aceite`, `ticket_recusado`), cada
  evento com a sua linha e o `CodUtilizadorOrigem`.
- **Seguir, gostos, listas/coleções, etiquetas, denúncias, moderação por
  hierarquia** (`podeModerar()` — um admin não apaga o comentário de um
  superadmin), **badges**, e o `rate limit` (1 comentário / 5 s por utilizador,
  guardado na sessão).

### Como usar

- **Só ler.** É trabalho da escola dele — nunca escrever, nunca "limpar", nunca
  formatar. Uma alteração acidental seria trabalho perdido dele sem forma de
  recuperar pelo git, porque **este directório também não é um repo**.
- Lê o `ProdSoundDB.sql` para o schema e o `FrontEnd/` para a lógica da página.
- E repara que, como é PHP e não tem encoding nenhum, os acentos aparecem
  estragados quando lês do terminal (`olá` sai `ol`). **Não tires conclusões
  disso** — é a leitura, não o ficheiro.
- O que trouxeres para a MEIDA traz a **decisão** (o truque da citação, o
  `refId` da notificação), não o código.

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

> **ONDE SE COMPILA IMPORTA. Sao DUAS maquinas (aviso escrito e corrigido em 2026-10-05):**
>
> | Maquina | CPU | Windows | Para que serve |
> | --- | --- | --- | --- |
> | **PC de desenvolvimento** (onde o agent trabalha) | `ARMv8 (64-bit) Family 8 Model 1 Revision 201, Qualcomm` - Snapdragon X | Windows 11 Home 10.0.26200 | editar, `npm run dev`, testes |
> | **Desktop do Boda** | `AMD64 Family 23 Model 96 Stepping 1, AuthenticAMD` - Ryzen 5 4500 | Windows 10 Pro | builds de validacao, testes em x86 real |
>
> Uma versao anterior deste aviso dizia "este PC de desenvolvimento e x86" - **estava errado**, a medicao tinha sido tirada no desktop, nao aqui. Duas consequencias praticas: (1) o `scripts/verificar-x86.ps1` so da um veredito **real** (x86 nativo, sem emulacao) **no desktop do Boda**; neste PC ARM ele corre mas emula x64; (2) **nao tires o `--x64 --arm64`** dos scripts `app:pack`, `app:pack:zip` e `app:publish`: sem `--x64`, uma build feita num PC ARM compila so arm64 e o instalador **nao instala em nenhum PC x86/x64 normal** - falha em silencio, escreve o registo, cria o desinstalador e os atalhos, extrai zero ficheiros e sai com codigo 0. **Foi assim que 1.2.0, 1.2.1 e 1.2.2 ficaram partidas** (ver "Instaladores arm64" mais abaixo). E a regra dos hooks existe precisamente para isso: **nao se confia em qual das maquinas fez a build**.
>
> ⚠️ **NÃO USAR `echo $env:PROCESSOR_ARCHITECTURE` — engana.** Num PC ARM o PowerShell corre **emulado a x64**, por isso essa variável responde `AMD64` mesmo estando em ARM (medido: `AMD64` aqui, num Snapdragon). A que diz a verdade é a `PROCESSOR_IDENTIFIER`:
>
> ```powershell
> $env:PROCESSOR_IDENTIFIER
> # ARMv8 (64-bit) ...  Qualcomm        = esta maquina e' ARM
> # AMD64 Family 23 ...  AuthenticAMD   = o desktop do Boda e' x86
> ```
>
> O `scripts/verificar-x86.ps1` faz isto pelo nome do CPU, que é o mais fiável.

> **`node_modules` ENVELHECE QUANDO FAZES PULL — e foi assim que a 1.2.4 saiu partida outra vez.** Depois do pull de 2026-10-05 o `package.json` pedia `electron 44.5.1` (exacto) mas o `node_modules` tinha **33.4.11**, porque o `npm install` nunca tinha corrido com o pin novo. Como o `electron-builder` **nao tem `electronVersion` fixo** e usa a versao que esta em `node_modules`, a build sai com o Electron velho e **ninguem ve o erro**: o log mostra `electron=33.4.11` como se estivesse tudo bem. Sem `node:sqlite` (que so existe no Node 22+, importado em `server/src/db/index.js`) o backend morre ao arrancar e a app mostra `Cannot GET /` — em qualquer PC. **Ja nao depende de disciplina humana:** o hook `beforePack` `scripts/verificar-electron.cjs` compara a versao de `node_modules/electron/package.json` com a do `package.json` e **falha a build** se forem diferentes. Se der erro, a solucao e `npm install` (e se faltar o `electron.exe`, `node node_modules/electron/install.js`, porque o `postinstall` pode ser ignorado).


> **BINARIOS NATIVOS DO `server/` TEM DE SER DA ARQUITECTURA CERTA (a 1.2.7 saiu partida assim — e foi o bug mais caro de sempre).** O `@electron/rebuild` **so reconstroi o modulo nativo do projecto principal**; o `server/` e' copiado tal e qual pelo `extraResources`, portanto qualquer `.node`/`.dll` la dentro vai sempre com a arquitectura da **maquina onde a build foi feita** (se for uma ARM, vai ARM64 para o pacote x64). `npmRebuild`, `buildDependenciesFromSource` e `nodeGypRebuild` **nao resolvem** — confirmei no `node_modules/app-builder-lib/scheme.json` que nenhum olha para o `server/`. Sintoma em PC x86: janela preta + "o servidor nao arrancou, codigo 1", porque o backend morre no `import` antes do primeiro log. **Resolvido na 1.2.8** com `scripts/empacotar-nativos.cjs` (hook `afterPack`, ver "Binarios nativos" mais abaixo). **Nao mexer no hook sem ler essa secao.**

> **LEMBRAR: `import` de modulos nativos tem de ser `await import()` com `try`/`catch`.** Foi o que salvou a app na 1.2.7 (ver `server/src/services/torrentEngine.js`). Se um dia um `.node` falhar outra vez, a app **nao pode morrer a arrancar** — e' a diferenca entre "os torrents nao funcionam nesse PC" e "ninguem consegue abrir a app".

1. Bump da versão em `package.json` (raiz) — **+1 segundo a regra de numeração acima** (ex.: `0.9.9`).
2. Atualizar o changelog da app: `web/src/changelog.js` (linguagem simples, sem termos técnicos, mais recente em cima).
3. Atualizar `CHANGELOG.md` (raiz) — changelog técnico, com secções e detalhes.
4. Commit + push.
5. **Publicar com binários**: `npm run app:publish` (usa `GH_TOKEN` — `gh auth token` resolve-o com scope `repo`; gera o instalador + `latest.yml` + `.blockmap` e faz upload para a release do GitHub; depois corre `scripts/prune-releases.mjs` que mantém só as 3 releases mais recentes).
6. O botão "Procurar atualização" da app depende dos **assets da release** (`latest.yml`). **NUNCA** criar a release só com `gh release create` sem binários — isso parte o auto-update (o electron-updater lê `https://github.com/boda07/meida/releases/latest/download/latest.yml`).

Se for preciso uma release apenas textual (notas), usar `gh release create` **depois** do `app:publish` com `--notes-file`.

### O aviso "There are data after the end of archive" NAO e' truncagem

O `7z t` num instalador NSIS diz sempre `Warnings: 1 / There are data after the
end of archive` — **mesmo num instalador bom**, porque o payload 7z esta'
embutido num stub PE e sobra o codigo do instalador a seguir. Verificado na
1.5.6: o 1.5.6 e o 1.5.5 (que se sabe que instala) dao o aviso **identico**.

O que separa truncagem (bug da 1.3.7) de aviso benigno:

| | truncado | bom |
| --- | --- | --- |
| `7z t` | `Everything is Ok` **faltando**, erros por ficheiro | `Everything is Ok` presente |
| `Errors:` | > 0 | 0 |
| contagem | menos ficheiros que o `win-unpacked` | igual |

Confirma sempre pelas **duas** coisas: o `Everything is Ok` e a contagem de
ficheiros do `7z l` contra a do pacote. E o `7za` da cache do electron-builder
e' o **arm64** nesta maquina (`%LOCALAPPDATA%\electron-builder\Cache\7zip@1.0.0\7zip-win-arm64-*\bin\7za.exe`)
— corre **nativo**, ao contrario do resto do build.

### O `app:publish` falha em ~metade das vezes: arruma com `scripts/fix-latest.cjs`

Já falhou **quatro vezes** (1.2.0, 1.2.1, 1.2.2 e 1.3.2), todas com `422 Validation Failed` ao `POST /releases`. O electron-builder **não sabe repetir**: com a release já criada ele continua a tentar *create* e volta a falhar. Por isso o passo 5 acima acaba com `Exited with code 1` **e mesmo assim a release existe, publicada e pela metade**.

Quando isso acontecer, **não repitas o `app:publish`** (reconstroi 228 MB e volta a falhar). Corre:

```
node scripts/fix-latest.cjs <versao>
```

O script é **idempotente** — só envia o que falta ou o que mudou de tamanho, por isso repetir é barato. E no fim **verifica**: os 3 assets presentes, e o `latest.yml` público a devolver a versão certa *e* o `sha512` a bater com o do instalador assinado. Se algo estiver errado, sai com erro.

Duas coisas que o script faz e que são fáceis de fazer mal à mão:

- **Gera o `latest.yml` a partir do `.exe` já assinado.** A assinatura acrescenta bytes; um hash calculado antes não bate e o updater rejeita o download. Na 1.3.2 o `release\latest.yml` era ainda o da **1.3.1** (timestamp 01:17 contra 04:22 do `.exe`), porque a build morreu antes de o escrever — publicar aquilo mandava instalar a versão antiga.
- **Usa o nome com tracos** (`MEIDA-Setup-x.y.z.exe`), não o nome em disco (`MEIDA Setup x.y.z.exe`). É assim que o updater procura, e é o nome a que o `.blockmap` já publicado se chama.

Notas de PowerShell que custaram tempo:

- `curl` está aliased a `Invoke-WebRequest`, que não aceita `-sIL`. Usar `curl.exe` (ou `execFileSync("curl", …)` a partir de Node, que contorna o alias).
- **`execFileSync("curl")` dá `ENOENT` nesta máquina (2026-10-08, na 1.3.6).** Não é o alias — o `curl.exe` do Windows está em `C:\Windows\System32`, e **o `System32` não está no PATH que o processo Node vê**. Confirmado que `curl` **e** `curl.exe` dão ambos `ENOENT`, mesmo com `Test-Path` a dizer que o ficheiro existe. **É por isso que o `fix-latest.cjs` passou a usar `fetch`** (nativo do Node desde a v18, não depende do PATH), com o `C:\Windows\System32\curl.exe` de caminho completo só de reserva. O estrago: o script **publicava os 3 assets e só depois rebentava** na verificação final — ou seja, saía com erro sem dizer nada sobre o resultado, que é a pior forma de falhar. Se um script precisar de HTTP, **`fetch`**, nunca `curl`.
- `gh api` **não** aceita `--repo` (só `gh release upload` aceita). Passar o endpoint completo: `gh api repos/boda07/meida/releases/tags/v1.3.2`.
- `gh` despeja o manual inteiro no stderr quando rejeita um flag — capturar só a primeira linha, senão o output explode.
- O `gh` **não** está em `C:\Program Files\Git\cmd\`, está em `C:\Program Files\GitHub CLI\`. Se um script correr sem esse PATH dá `pid: 0, stderr: undefined`, que parece outra coisa toda.

## Regras de edição

- **NUNCA escrever caracteres chineses.** Nem nas mensagens ao utilizador, nem em ficheiros, nem em commits. O utilizador já reclamou várias vezes (2026-10-04). CJK = U+2E80–U+9FFF (mais U+3000–U+303F e U+FF00–U+FFEF). **Antes de mostrar texto, revê-lo.** Em ficheiros, verificar sempre com:
  ```
  node -e "const s=require('fs').readFileSync('FICHEIRO','utf8');const l=s.split(/\r?\n/);const m=l.map((x,i)=>[\u2E80-\u9FFF].some(c=>x.includes(c))?i+1:0).filter(Boolean);console.log(m.length?('CJK nas linhas '+m):'OK')"
  ```
  Ver também `\uFFFD` (carácter inválido) — sinal de UTF-8 partido.
- **Usar sempre a ferramenta `edit`** para alterar ficheiros. `Set-Content -replace` corrompe UTF-8 (partiu acentos/cedilhas no passado).
- **Nunca fazer `git push` sem o utilizador pedir primeiro.** Sempre que o utilizador autorizar push, é **obrigatório** atualizar a versão (`package.json` → `web/src/changelog.js` → `CHANGELOG.md`) **e** publicar a release do Git (tag + `gh release` com binários via `npm run app:publish`).**
- **A CHANGELOG DA APP (`web/src/changelog.js`) É OBRIGATÓRIA EM TODA A RELEASE.** Nunca fazer bump de versão / commit / release sem acrescentar a entrada dessa versão em `web/src/changelog.js` (linguagem simples, mais recente em cima) — é o que o utilizador vê no "o que mudou" dentro da app. Verificar SEMPRE que fica lá antes de qualquer push.

## Qualidade de código (SOLID)

Ao refatorar ou escrever componentes, seguir os princípios SOLID. O alvo é que cada ficheiro/gancho tenha **uma só responsabilidade** (SRP) e seja fácil de testar isoladamente.

- **SRP — Single Responsibility Principle:** um componente ou gancho faz apenas uma coisa. Se um ficheiro mistura busca de dados, persistência, lógica de negócio e renderização de UI, partilhe em ganchos com responsabilidade única.
  - Exemplo: `PlayerControls.jsx` (UI e ações) → `useVideoState.js` (estado do vídeo) + `useVolumeMemory.js` (persistência volume/mudo).
  - Exemplo: `Player.jsx` (iframe + fonte nativa + auto-fallback) → `usePlayerFallback.js` (troca de fonte) + `useNativeVideoSource.js` (fonte nativa MegaPlay).
- **OCP — Open/Closed Principle:** para adicionar comportamento novo, crie um gancho novo em vez de alterar um existente.
- **LSP — Liskov Substitution Principle:** qualquer gancho com a mesma assinatura é substituível; o componente depende apenas do contrato de retorno.
- **ISP — Interface Segregation Principle:** cada gancho expõe apenas o que o componente precisa (não obriga a depender de tudo).
- **DIP — Dependency Inversion Principle:** o componente depende de abstrações (ganchos), não de implementações concretas (`addEventListener`, `localStorage`, `fetch` direto).

**Quando refatorar:**
1. Identifique a responsabilidade única de cada bloco de código.
2. Extraia para um gancho (`use*.js`) com nome descritivo da responsabilidade.
3. O componente passa a compor ganchos e renderizar UI.
4. Corra `npm test` e `npm run build` para confirmar que não partiu nada.
5. Verifique CJK em todos os ficheiros alterados antes de commitar.

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

- **Um anime sem fontes dizia "falta o parametro tmdb" — a mensagem mandava para o lado errado (2026-10-21)**. Bug do utilizador (o do MEIDA de um amigo). Medido contra o servidor real.
  - **A causa immediate era externa:** a **API da AniList esta' globalmente desligada** — HTTP 403 com *"The AniList API has been temporarily disabled due to severe stability issues"*. Nao e' do MEIDA nem do utilizador; e' uma paragem da AniList.
  - **E a causa do MEIDA era a mensagem.** O ramo anime do frontend (`Details.jsx`, `.sources({mal, anilist, episode, audio})`) **nao mandava `type`**. O servidor so' sabia que era anime pelo `type`, portanto um anime sem fontes caia na resposta de filme. **Medido:** `?mal=21` dava `falta o parametro tmdb` e `?type=anime&mal=21` dava *"Nao consegui obter as fontes deste anime agora..."*.
  - **A mensagem certa EXISTIA e era INALCANCAVEL.** O servidor tinha a mensagem de anime desde 2026-10-08 (o caso do Dragon Ball, quando a AniList nao respondeu) — mas como o `type` nunca chegava, nunca era mostrada. **Um teste por texto nao apanha isto; so' a conta com o servidor a correr.**
  - **Corrigido nas duas pontas:** o frontend manda `type: "anime"`, e o servidor deriva o tipo (`!tipoCru && (mal || anilist)` -> anime) para nenhum outro chamador cair no mesmo buraco.
  - **`buildAnimeEmbedSources` so' inclui um provider SE TIVER o id de que ele precisa**, e os tres de anime (MegaPlay nativo, MegaPlay, VidNest) precisam do **id do AniList**. Com a AniList em baixo, `malToAnilist` falha -> `anilistId` fica null -> **zero fontes**. O `mal` sozinho nao chega.
  - **O id do AniList vivia SO' em memoria** (`anilistMetaCache` e `anilistCache`), e perdia-se a cada reinicio. Agora vai **para o disco** (`anilistid:<mal>`): o id de um anime **nao muda**, e o banner (que pode mudar) fica com 30 dias. Com isto, um servidor que ja viu o anime continua a servir as fontes mesmo com a AniList em baixo.
  - `scripts/testar-fontes-anime.mjs` (13 verificacoes, entra no `npm test`).

- **O `!tmdb` do `/api/sources` e' na verdade "o parametro NAO VEIO"** (2026-10-21). `tmdb` vem de `req.query`, e portanto e' uma **string**: `tmdb=0` e `tmdb=abc` sao **truthy** e passam; so' a **ausencia** do parametro e' falsy. Medido: `?type=movie&tmdb=0` -> 200, `?type=movie` -> 400. Vale a pena saber porque o `get()` do cliente **omite** o parametro quando o valor e' `undefined`/`null`/`""` — e um `id` que chega vazio do servidor desaparece em silencio, sem aviso nenhum.

- **Um teste de frontend tem de ser lido como o que e' (2026-10-21)**. A verificacao de que o ramo anime manda `type: "anime"` e' **por texto** (o pedido e' feito no browser). O que prova o comportamento de verdade e' a seccao 2 do mesmo teste, contra o servidor a correr. **Uma verificacao de texto passa quando o texto la esta — e nao diz nada sobre o que o browser faz com ele.**


- **O Render nao deployava a versao web: o start command reconstruia o site (2026-10-20)**. Bug do utilizador (log do Render). O sitio ficou em baixo **para sempre**, nao so um deploy: cada deploy novo falhava do mesmo modo.
  - **O sintoma:** `==> No open ports detected, continuing to scan...` e depois `==> Port scan timeout reached, no open ports detected`.
  - **A causa nao era o servidor.** Medido: com `PORT=10000` e `SERVE_WEB=1`, o servidor liga a `0.0.0.0:10000` e responde em **390 ms**. O `bind` esta' certo (`config.host` = `process.env.HOST || "0.0.0.0"`, `config.port` = `process.env.PORT || 5175`).
  - **A causa era o COMANDO DE ARRANQUE.** O `start:pwa` era `npm run build && cross-env SERVE_WEB=1 node server/src/index.js` — ou seja, **reconstruia a pagina inteira** (47 s, medido no Render: *"built in 47.11s"*) **antes de o servidor arrancar**. O Render ja tinha construido no passo de build; o start command repetia o trabalho. O scanner de portas do Render espera por um listener TCP e **da-se por vencido antes**.
  - **A documentacao do Render diz exactamente isto** (tutorials/boot-and-port-binding): *"Keep the start command to one long-running server"* e *"the server only starts after the migration, so a slow migration holds the port closed"*. E o scanner corre **num namespace de rede separado** do processo, por isso so' ve o porto depois de o abrir.
  - **Correccao:** `scripts/start-pwa.cjs` (novo) decide se ha de construir — compara o mtime do `web/dist/index.html` com o da fonte mais recente em `web/` (ignorando `dist` e `node_modules`). `serve:pwa` e' o `--sem-build`: **so' arranca**, que e' o que o Render usa. `start:pwa` continua a construir quando a fonte e' mais nova (o caso local), e `MEIDA_FORCE_BUILD=1` força.
  - **O `SERVE_WEB=1` passou a ser posto pelo script**, e nao por `cross-env`: assim o caminho critico nao depende de uma devDependency estar instalada no servidor.
  - **Perigo antigo, agora fechado:** o servidor saltava de porta se aoccupied (`PORTAS = [port, port+1, port+2, port+3]`). Isso e' util no PC (a 5175 as vezes esta' ocupada), mas **no Render e' o pior**: a plataforma deu a porta e o scanner espera **essa**. As Docs dizem *"Render is usually able to detect and use it"* — "usually" nao e' "sempre", e o resultado e' o mesmo erro. Agora, quando o `PORT` vem do ambiente, a lista tem **uma** porta e o EADDRINUSE sai com uma mensagem que diz porque.
  - **O Render ja tinha feito as contas:** `render.yaml` tem `buildCommand: ... && npm run build` e `startCommand: npm run start:pwa`. Corrigido o startCommand para `npm run serve:pwa`.
  - **O QUE FALTA AO UTILIZADOR:** o servico Render em producao (`meida`, criado a mao — o `render.yaml` e' so' um blueprint) tem o **Start Command** no painel. Tem de passar a `npm run serve:pwa`. Sem isso o deploy volta a falhar do mesmo modo. **O `start:pwa` tambem fica bom** (constroi so' se for preciso), por isso a mudanca do painel e' uma melhoria, nao uma urgencia — mas sem ela o `serve:pwa` nunca e' usado.
  - `scripts/testar-start-pwa.mjs` (14 verificacoes, entra no `npm test`).

- **O Pages do GitHub nao estava activo, e a workflow falhava por isso (2026-10-20)**. `actions/configure-pages@v5` dava *"Get Pages site failed... verify that the repository has Pages enabled"*. A API do GitHub devolve 404 em `GET /repos/{owner}/{repo}/pages` quando nao ha sitio.
  - **Activa-se pela API, sem tocar no painel:** `gh api --method POST repos/boda07/meida/pages -f "build_type=workflow"` — devolve `html_url: https://boda07.github.io/meida/` e `build_type: workflow`. Feito na 1.5.8.
  - As actions estavam em `v3`/`v4`, que correm em **Node 20, ja depreciado** (o GitHub avisava em cada run: *"actions/checkout@v4, actions/configure-pages@v5, actions/setup-node@v4 ... forced to run on Node.js 24"*). Subidas para `checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` (versoes verificadas pela API).

- **Um ramo novo que nao chama a funcao que devia (2026-10-20)**. O `--sem-build` do `start-pwa.cjs` imprimia "a usar o build que ja existe" e **nao arrancava o servidor** — o porto nunca abria. **Apanha-lo foi a medicao, nao a leitura do codigo**: o teste que fiz primeiro so' verificava a *decisao* de construir, e essa estava certa. So' quando se correu o comando de arranque a serio e se mediu o tempo ate ao porto abrir (que deu "NUNCA") se viu o buraco. **Regra: um ramo novo tem de ser medido no caminho completo, nao so na logica que ele decide.**


- **O mapa de calor e a racha contavam dias em UTC; o heatmap desenha dias LOCAIS (2026-10-19)**. Bug do utilizador; os dois casos que ele deu, medidos. `dayOf` vivia DUPLICADA (`server/src/stats.js` e `server/src/routes/achievements.js`), nas duas a fazer `toISOString().slice(0, 10)` — **UTC**. O heatmap (`web/src/components/heatmap.js`, `chaveDia`) usa `getFullYear/getDate`, que sao **locais**.
  - **O sintoma e' o heatmap esconder a atividade.** `semanasDoMapa` marca `fora: true` para `cursor > chave` ("depois de hoje nao existe"). Em UTC-3, o que se ve depois das 21:00 cai no dia de **amanha** e desaparece. **Medido:** as tres datas do teste devolvem `2026-10-19` em UTC, que e' amanha para quem esta' em Sao Paulo; com `?tz` devolvem `2026-10-18`.
  - **Um fuso nao se descobre no servidor.** O Render e o FadeHost estao em UTC e o servidor e' o mesmo para toda a gente. O fuso vai no pedido (`?tz`), e o cliente manda-o em **`/api/stats` E `/api/achievements`** — a racha e' a outra ponta da mesma coisa.
  - **`en-CA` foi verificado, nao assumido.** E' o locale cujo formato curto ja e' "YYYY-MM-DD". Se um runtime devolvesse "17/10/2026", as chaves deixavam de bater com a `chaveDia` e **o mapa desenhava vazio sem erro nenhum** — por isso ha uma verificacao ao arrancar que cai para `formatToParts`.
  - **`scripts/testar-dias-fuso.mjs` (75 verificacoes, entra no `npm test`), 10 mutacoes confirmadas.**
  - **A correccao tal como foi proposta custava 689 ms por pedido.** `toLocaleDateString("en-CA", { timeZone })` dentro do `dayOf` mede **45,96 us por chamada** contra 0,98 us do `toISOString()` — e o `dayOf` corre **por linha** (ate' 15 000 num pedido). Medido com formatador **em cache** (`format()` em vez de `toLocaleDateString()`): **1,19 us**. 689 ms -> 18 ms. `formatToParts` ficava em 2,34 us. **E' por isso que o teste conta CONSTRUCOES de `Intl.DateTimeFormat` e nao mede segundos** — os testes com relogio sao instaveis, e a contagem e' determinista (a mutacao que tira o cache da 2000 construcoes em vez de 0).
  - **Eu disse que a racha partia no Brasil. Medido, o NUMERO nao muda.** Num fuso de desvio fixo (Sao Paulo e' UTC-3 sem hora de verao desde 2019) o conjunto de dias desloca-se em 1 **e o "hoje" desloca-se com ele**, e o `computeStreak` conta a partir do "hoje" para tras: da 2 nos dois regimes. O que estava partido no Brasil sao as **chaves** — que e' o que manda a ultima hora para a celula escondida. **O numero parte em Lisboa**, na noite da mudanca de hora: as 22:30 e as 23:30 de UTC do dia 24 sao o dia 24 e o **dia 25** em Lisboa (racha 2); em UTC sao as duas o dia 24 (racha **1**). Verificado com o ICU do Node antes de escrever o teste.
  - **`computeStreak` passou a ser exportada e a receber `agora`.** A racha so' e' observavel por um pedido cujo resultado depende de "hoje", o que tornava o teste dependente da data em que corria — e meio dia nao distinguia os dois regimes. E' o mesmo caminho que se abriu para o `buildActivity()` do Discord. As quatro mutacoes do fuso na racha (`M5`-`M8`) so' eram apanhadas por **texto**; com a funcao pura passa a ser por comportamento.
  - **`LIMITE_FUSOS` (o cache nunca passa de 32) nao tem teste, e nao deve.** Baixa a memoria retida, nao o numero de formatadores construidos: com 200 fusos em rotacao o contador e' 200 com o limite e 200 sem ele. Um teste que "apanhasse" uma mutacao dele estaria a medir a coisa errada.
  - **`testar-heatmap.mjs` partiu com esta correccao** — tinha quatro verificacoes de texto a procurar `function dayOf` e `dayOf(x)` sem fuso. Actualizadas para o `import` partilhado e para o `, tz`. **E' a desvantagem dos testes por texto: partem quando o codigo fica melhor, e a tentacao e' so' afrouxar o texto em vez de reescrever o que se queria provar.**
  - **DUAS vezes neste teste um `.map` sem guarda matou o modulo em vez de reportar** (`s.dias.map` num corpo de 500), e o harness le "sem resumo" como "mutacao nao detectada". Agora `dia()` e `racha()` involvedores que transformam um atiro em `ATIROU: ...` — uma verificacao que FALHA, com linha de resumo. E' a **terceira vez** nesta sessao (a primeira foi o `JSON.parse` do `testar-rota-async.mjs`).


- **O contador de salas por IP do Watch Party ficava preso ate' reiniciar o servidor (2026-10-19)**. Bug do utilizador; medido contra o servidor real antes da correccao. A correccao e' de uma linha, e o que a torna subtil e' que o registo e' feito num sitio e desfeito noutro.
  - **O registo e' do CRIADOR, o desfeito e' do ULTIMO A SAIR.** `incRoomIp(ip, code)` corre quando a sala e' criada (com o IP de quem a cria, guardado em `room.ip`); o `cleanup` fazia `decRoomIp(ip, code)` com o `ip` **desta ligacao**. Se quem saisse por ultimo nao fosse o criador, `decRoomIp` mexia no `Set` de um IP que nunca teve aquele codigo (um `Set.delete` que nao apaga nada, e apaga logo a chave por estar vazia), e **o registo do criador nunca mais saia do mapa**.
  - **E nao ha nada que reconcilie.** O comentario na linha 54 diz "Limpeza lazy" e e' verdade: o unico `setInterval` do ficheiro e' o ping de 20 s do SSE. Nao existe varrimento de `roomsPerIp` contra `rooms`, portanto o registo fica la ate' o processo morrer. **Medido: A cria 10 salas (da 11.a leva 429) e continua a levar 429 para sempre.**
  - Para reproduzir sao preciso **dois IPs**, e isso so' e' possivel com `TRUST_PROXY=1` e `X-Forwarded-For` — a correccao do N5. Com o omissao a 0 (que e' o certo em producao) o `X-Forwarded-For` seria ignorado, os dois seriam o mesmo `127.0.0.1` e o bug **nao apareceria**.
  - `scripts/testar-wp-ip.mjs` (13 verificacoes, entra no `npm test`), **3 mutacoes confirmadas**.
  - **A ordem das seccoes do teste e' o que da' a forca ao sinal.** A primeira e' quem cria e sai **sozinho** — o unico caso que nao acumulava nem com o bug. Com a mutacao aplicada, essa seccao passa (0 barradas) e so' a segunda falha com 2 barradas. Pela ordem inversa, a seccao 1 vazava o contador e as seguintes falhavam **em cascata**, e a mutacao M2 (que nem chega a chamar o `decRoomIp`) dava 8 falhas em vez das 3 que lhe pertencem — o teste "apanhava" bugs que nao eram o dele.
  - **Um `test` que procure `decRoomIp(ip, code)` apanha a DECLARACAO da funcao**, que tem essa assinatura exacta, e falha sem haver chamada nenhuma errada. O teste percorre as ocorrencias e so conta as que **nao** tem `function ` atras — o que tambem exige que *todas* as chamadas levem `room.ip`, e nao so a primeira.


- **Watch Party: limite de tamanho inútil, sem verificação de membro, e navegação para fora da app (2026-10-19)**. Bug do utilizador; os quatro medidos contra o servidor real antes da correccao.
  - **O limite de 2 KB media "[object Object]".** O cliente envia sempre objectos (`{path}`) e o servidor media `String(data)` — 15 bytes, sem dependencia do tamanho real. **Medido: `data: {x: "a".repeat(5000)}` devolvia 200.** Agora mede-se `Buffer.byteLength(JSON.stringify(data ?? ""))`.
  - **Nao havia verificacao de membro.** `member = { nick, res, ip }` — sem conta nenhuma ligada a ligacao, e por isso `from` era so' um identificador que o cliente escolhia. **Medido: um utilizador que nunca entrou na sala.publicou eventos e os outros membros receberam.** Agora o membro guarda `userId`, e `/wp/send` exige `membro.userId === req.user.id` (403 caso contrario).
  - **`/wp/send` nao tinha rate limit.** Cada pedido e'ecoado por todos os outros membros da sala. Agora `rateLimiter(60, 10_000)`.
  - **`navigate(payload.data.path)` sem validar nada.** O `path` vem de outro membro. **Medido: `\\evil.com`, `//evil.com` e `https://evil.com` passavam todos com 200.** Agora a regra `^\/(?![/\\])[^\s\\]{0,300}$` aplica-se **no servidor e no cliente**, antes do `navigate`.
  - **O `\` e' o que importa** (CVE-2025-68470 / GHSA-wrjc-x8rr-h8h6): um caminho com barra invertida e' lido pelo browser como barra normal; `//host` e' lido como protocolo-relativo. A regra e' identica nos dois ficheiros e o teste verifica que as expressoes **coincidem** e que a validacao aparece **antes** do `navigate`.
  - `scripts/testar-watchparty-seguranca.mjs` (39 verificacoes, entra no `npm test`), **6 mutacoes confirmadas**.

- **O `npm audit fix` NAO resolve a vulnerabilidade do react-router (2026-10-19)**. `npm audit` marca **duas**, nao uma: GHSA-wrjc-x8rr-h8h6 (open redirect) e GHSA-337j-9hxr-rhxg (`deserializeErrors`, SSR). O intervalo afectado e' `react-router 6.0.0 - 7.17.0`. **Com `^6.28.0` declarado, o `npm audit fix` — e mesmo com `--force`, que so' propoe 6.30.4 -> 6.30.6 — deixa as duas a pee.** A correccao exige **7.18.0 ou superior** (o `latest` do `react-router-dom` e' 7.18.4), ou seja **uma subida de major** que toca **29 ficheiros** de `web/src`. Nao foi feita sem decisao do utilizador. A mitigacao no codigo (validar o caminho antes do `navigate`, nos dois lados) fecha o caminho de exploracao desta app independentemente da versao.

- **Um teste que so' passa um `from` INEXISTENTE nao distingue "ligacao desconhecida" de "ligacao de outro membro" (2026-10-19)**. A mutacao que trocava `!membro || membro.userId !== req.user.id` por so' `!membro` **passou com 37/37**. So' se apanha quando o Bruno entra mesmo na sala (client `c2`) e a Ana manda `from: "c2"`: a ligacao existe, e o `userId` e' a unica coisa que a distingue.


- **O tempo de resposta do login denunciava se o utilizador existia (2026-10-19)**. Bug do utilizador, medido antes de mexer em nada. Com `!row || (await bcrypt.compare(...))`, o `||` faz curto-circuito: um nome inexistente nao tinha nada para comparar e nao gastava o bcrypt. **Medido (mediana de 8): 0,0 ms contra 74,2 ms** — uma diferenca de 74 ms que qualquer script de enumeracao de usernames aproveita sem dificuldade.
  - Agora compara-se sempre, contra um `HASH_FALSO` quando o utilizador nao existe: **hash bcrypt VALIDO de custo 10, escrito no codigo** (gerar um no arranque pagaria os ~74 ms de cada `compare` feito contra ele). **Depois: 1,3 ms de diferenca.**
  - O teste **nao compara as duas medianas** (seria fragil com a carga da maquina): o teste robusto e' o **piso absoluto** — um nome inexistente nunca desce abaixo de ~40 ms — mais uma banda larga de razao (0,55x a 1,8x).
  - **O mesmo canal noutro sitio, mas por desenho e nao por tempo:** `register` devolve **409 com "Esse utilizador ja existe."** Qualquer pessoa enumera usernames so' a fazer pedidos de registo. Nao mexi porque o frontend usa esse 409 para dizer "esse nome esta' tomado" e mudar isso e' decisao de produto — ver a pergunta ao utilizador.

- **Os ganchos que desligam a seguranca do proxy agora exigem `NODE_ENV=test` (2026-10-19)**. `__ativarModoTeste()` tira a assinatura **e** o filtro de IPs do `/api/proxy`, e `__permitirHostsNoTeste()` (o do N4, do mesmo tipo) deixa passar nomes que o filtro bloquearia. Nao havia nada que impedisse um import acusinho de os deixar activos num servidor publico.
  - **Atira** em vez de falhar em silencio: quem chamar fora de um teste recebe logo o erro, e nao um proxy aberto sem dar conta.
  - Os dois unicos chamadores (`testar-proxy.mjs` e `testar-proxy-redirect.mjs`) metem `process.env.NODE_ENV = "test"` **antes** do `import`. O `testar-timing-login.mjs` verifica que os ganchos atiram, que a mensagem diz o porque, e que **o filtro continua fechado depois da tentativa**.
  - So' `NODE_ENV=production` muda comportamento no arranque (`config.js` e o aviso do `trust proxy`), por isso `NODE_ENV=test` nao afecta nenhum deles.

- **Uma mutacao que nao aplica nao testa nada (2026-10-19)**. A M1 tinha a ancora em duas linhas separadas por `\n`, e o ficheiro esta' em CRLF: `NAO APLICOU` e eu ia conta-la como deteccao. **Ancorar mutacoes numa linha so**, ou construir a ancora com o EOL do ficheiro. E no mesmo ficheiro, o `exigirModoTeste` que **reclama** em vez de atirar e' a mutacao M5 — a que mais vale a pena ter, porque e' a que produz a falha silenciosa.


- **O ETag do avatar era o COMPRIMENTO, e o `immutable` prometia um dia (2026-10-19)**. Bug do utilizador, confirmado reproduzindo. Dois emojis diferentes tem o mesmo `length` (medido: `emoji:😀` e `emoji:😁` dao ambos **8**), portanto o ETag nao mudava; o `res.json` do Express trata o `If-None-Match` sozinho, pelo que o cliente revalidava, levava **304** e ficava com o avatar antigo indefinidamente. Agora o ETag e' o **SHA-1 do valor** e o `Cache-Control` e' `public, max-age=300, must-revalidate` (sem `immutable`, que num URL que muda adiava a mudanca para o dia seguinte). O SHA-1 de um avatar de 4 MB custa ~6 ms (medido), por isso ha um memo por utilizador — o `===` de uma string em JS e' imediato, e as repeticoes ficam gratis.

- **O `fetch` do Node esconde a revalidacao condicional (2026-10-19)**. **O `undici` manda `cache-control: no-cache` por omissao**, e o pacote `fresh` do Express devolve `false` nesse caso *por desenho* ("always return stale when Cache-Control: no-cache, to support end-to-end reload requests"). Resultado: com `fetch`, **nenhuma** revalidacao chegava a dar 304 e o bug parecia nao existir — a primeira reproducao deste bug deu 200 e fez-me duvidar do relatorio do utilizador. **Para testar 304 tem de ser HTTP CRU** (`http.request` com cabecalhos explicitos), como um browser. E o mesmo cuidado para `require("dns").lookup`: essa e' a API **com callback** e atira `ERR_INVALID_ARG_TYPE` sem callback (ver N4).

- **Um `JSON.parse` sem guarda matou o teste em vez de reportar (2026-10-19)**. A mutacao que repõe o bug faz a rota devolver 304 **sem corpo**; o `JSON.parse("")` do teste atirava, o modulo abortava e nao havia linha de resumo — pelas regras, isso nao conta como deteccao. `lerAvatar(corpo)` devolve `null` em vez de partir.


- **O `trust proxy` fixo em 1, e um limite de login que contava sucessos (2026-10-19)**. Bug do utilizador, confirmado reproduzindo contra o servidor real.
  - **`app.set("trust proxy", 1)` fixo.** Sem proxy a frente (servidor local do Electron, exposicao directa), qualquer cliente manda `X-Forwarded-For: 1.2.3.4` e o `req.ip` passa a ser o que ele quizer. **Medido: 12 tentativas com senha errada, cada uma com um XFF diferente, e ZERO 429.** E o `req.ip` alimenta tres coisas (`routes/auth.js`, `routes/watchparty.js`, `services/rateLimit.js`) — todas de seguranca. Com dois proxies a frente acontecia o oposto: toda a gente partilhava um IP.
  - **O limite do login contava TODOS os pedidos.** `rateLimiter` faz `entrada.conta += 1` antes de saber se o login correu bem. **Medido: 12 logins CORRETOS seguidos davam `10x 200, 2x 429`** — o 11.o e o 12.o bloqueados. Partia uma casa, uma escola, ou quem troca de conta.
  - **Correccao:** `TRUST_PROXY` no ambiente, **numero de saltos, 0 por omissao**. So' se aceitam numeros — `true`, `false` e listas de sub-redes sao ignorados de proposito (`true` faz o Express confiar em TUDO). O `0` esta no `config.js` e o arranque avisa em `production` se ficar a `0`, porque com proxy a frente o limite conta para todos em conjunto.
  - **O limite do login subiu para 100 em 15 min** e o **controlo que aperta passou a ser o de falhas** (`registarFalhaLogin`/`estaBloqueadoLogin`, por (ip, utilizador), 10 falhas -> 15 min). E' melhor: o bloqueio por conta e' o que impede o brute force, e a mensagem do 429 passou a distinguir as duas coisas. O limite do `/auth/register` (10/hora) nao se mexeu.
  - Documentado em `deploy/SERVIDOR-PARTILHADO.md` e `server/.env.example`. **Para o Render o `0` e' o certo** (o Render termina o TLS ele proprio).
  - `scripts/testar-trust-proxy.mjs` (31 verificacoes, entra no `npm test`), **4 mutacoes confirmadas**. Uma delas e' a que aceita `true`: com ela, o Express confia em qualquer `X-Forwarded-For`.

- **Uma verificacao escrita ao contrario passou a falhar depois de estar certa (2026-10-19)**. Escrevi *"30 tentativas com 30 XFF diferentes NAO dao 429"* para provar que o limite apertava — o que e' exactamente o oposto do que se queria provar. Quando o codigo ficou correcto, a verificacao ficou vermelha e custou um ciclo a perceber porque. **Antes de escrever "NAO", perguntar: o que e' que quero que aconteca?**


- **O filtro de destinos tinha 15 buracos em 30 casos, e o MegaPlay fetchava o que lhe dessem (2026-10-19)**. Bug do utilizador, confirmado por medicao antes de mexer em nada.
  - **Os IPv6 literais passavam todos.** `url.hostname` traz os IPv6 **entre parenteses** (`[::1]`) e `isIP("[::1]")` da `0` — por isso `if (ip === 4 || ip === 6)` nunca era verdade e nao se checava nada: loopback, link-local, unique local e multicast entravam todos.
  - **O CGNAT estava errado nos dois sentidos:** `100\.(6[4-9]|7[0-9]|8[0-9]|9[0-9]|1[0-1][0-9]|2[0-5][0-5])\.` salta de `119` para `200` — bloqueava `100.200.x.x` (publico) e deixava passar `100.120.x.x`..`100.127.x.x` (que e' CGNAT). Substituido por `net.BlockList` com `100.64.0.0/10`.
  - **Os hostnames nunca eram resolvidos, e isso era um bypass completo** (medido, nao teorico): `localtest.me` e `127.0.0.1.nip.io` devolviam `{"ok":true}`. Agora ha `dns.lookup(host, { all: true })` e **todos** os enderecos sao julgados.
  - **`/api/anime/megaplay` era um SSRF cego:** a rota e' publica e fazia `fetch` ao `url` que o cliente mandasse. Agora `embedUrlValido()` so' aceita `origin === https://megaplay.buzz` e pathname `/stream/…`, e o resto da **400** (nao um `native: false` que parece "o site nao tem").
  - `alvoSeguro` passou a ser **async**; os quatro chamadores (`handleProxy`, `seguirRedirectos`, `fetchSubtitleAsVtt`, a rota `/subtitles/vtt`) ja eram `async`.
  - `scripts/testar-filtro-alvos.mjs` (96 verificacoes, entra no `npm test`), **7 mutacoes confirmadas**.

- **`::ffff:0:0/96` NAO se pode meter no `net.BlockList` (Node 24.19)**. Medido: acrescentar essa regra faz `BLOQUEADOS.check("8.8.8.8", "ipv4")` devolver **`true`** — o verificador IPv4 passa a casar com a sub-rede IPv6 e bloqueia **todos** os enderecos IPv4, ou seja, todos os provedores. Nao e' preciso: o `BlockList` aplica as regras IPv4 aos enderecos IPv4 mapeados quando verificados como ipv6 (`::ffff:7f00:1` e' bloqueado por `127.0.0.0/8`, `::ffff:8.8.8.8` continua a passar). A mutacao M5 fixa este comportamento.

- **O que fechou os IPv6 NAO foi tirar os parenteses, foi resolver o nome (2026-10-19)**. A mutacao "remove o `semParenteses` inteiro" passou com 96/96. Motivo: o `dns.lookup` do Node **aceita** IPv6 entre parenteses e devolve o endereco sem eles (medido: `dns.lookup("[::1]")` -> `::1`). `semParenteses` fica como optimizacao (evita uma consulta DNS por literal) e como rede se o `dns.lookup` deixar de aceitar. **E uma terceira vez que a mutacao, e nao o teste, estava errada** (ver `Promise.resolve(retorno).then` do N2).
  - Para o mesmo motivo, `alvoSeguro` **nao pode** ser medido com `require('dns').lookup(host, opts)`: essa e' a API **com callback** e atira `ERR_INVALID_ARG_TYPE` sem callback — o que parece "o DNS falha". Tem de ser `node:dns/promises`.

- **Testar "todos os enderecos de um nome" com DNS real nao da (2026-10-19)**. Nao existe nome publico que devolva um endereco publico **e** um privado — `localtest.me` devolve `::1, 127.0.0.1`, ambos internos, por isso a mutacao "so' julga o primeiro" passava. Da' `algumEnderecoBloqueado(enderecos)` ser uma **funcao pura exportada**, testada com a lista sintetica `[publico, loopback]` (a mesma ideia do `buildActivity()` do Discord).

- **`localhost` passou a estar bloqueado, e isso partiu um teste (2026-10-19)**. O `testar-proxy-redirect.mjs` tinha o upstream em `localhost`, que agora e' bloqueado (bem: resolve para 127.0.0.1). Nao ha nenhum endereco aceitavel nesta maquina (so' `192.168.1.85`, tambem privado), por isso veio o gancho `__permitirHostsNoTeste(["localhost"])` — **nomes exactos**, separado de `__ativarModoTeste` (que desliga a assinatura e nao servia). E' essa selectividade que mantem o teste do SSRF util: o `localhost` do upstream passa e o `127.0.0.1` para onde ele redirige NAO esta' na lista. Por omissao e' `null` (nada passa) e `testar-filtro-alvos.mjs` verifica isso num **sub-processo**, para nao poder herdar estado.


- **O proxy devolvia um 302 SEM `Location`: beco sem saida (2026-10-18)**. Bug do utilizador, confirmado simulando: `upstream 302 -> 200` dava ao cliente `302` com `Location` ausente.
  - A causa era o `redirect: "manual"` posto na 1.5.5 (R1/SSRF) combinado com a copia de cabecalhos, que so' traz `content-type`, `content-length`, `content-range` e `accept-ranges`. **A resposta nunca tinha `Location`.**
  - **Nem "seguir tudo" nem "nao seguir nada" servia.** `redirect: "follow"` reintroduzia o SSRF (um 302 para `169.254.169.254` seria buscado sem validacao). A solucao e' `seguirRedirectos`: salta **um de cada vez**, e **cada destino passa por `alvoSeguro` antes de ser buscado**. E' isso que fecha o SSRF sem fechar o video. Limite de 5 saltos (a seguir, 502).
  - **O URL final e' a base da `rewritePlaylist`.** Os segmentos de uma playlist sao quase sempre relativos (`seg1.ts`); resolvidos contra o URL do pedido davam o caminho errado. O teste usa um redirect `/antigo/play -> /novo/dir/final.m3u8` precisamente para isto: com a base antiga o segmento sai `/antigo/seg1.ts`, com a certa sai `/novo/dir/seg1.ts`.
  - `isPlaylist`/`isLegendas` passam a olhar para **o URL final tambem**: um redirect pode levar de `/play` (sem extensao) a `/master.m3u8`.
  - `scripts/testar-proxy-redirect.mjs` (26 verificacoes, entra no `npm test`), **5 mutacoes confirmadas**. Duas delas sao o SSRF: uma que remove a revalidacao, outra que revalida o **alvo inicial** em vez do **destino do salto** (que e' o erro natural a escrever — e o que faz o teste parecer redundante).
  - **Como o teste de SSRF e' REAL e nao desligado:** `alvoSeguro` so' verifica quando o host e' um IP literal, por isso `http://localhost:PORT` **passa** e um redirect para `http://127.0.0.1:PORT` e' bloqueado. O teste corre com a seguranca LIGADA e conta os pedidos que chegaram ao sitio interno para provar que o destino **nao foi buscado**.

- **Um `res` falso com `return this` numa arrow function rebenta (2026-10-18)**. `this` dentro de uma arrow, ao nivel do modulo ESM, e' `undefined`: `res.status(403).json(...)` da `TypeError: Cannot read properties of undefined`. O `testar-proxy.mjs` usa `return this` e safa-se porque o modo de teste nunca chega ao caminho do 403; o `testar-proxy-redirect.mjs` chega, por isso leva `function resFalso()` com `return res`. **E `res.json({error})` guarda um OBJETO:** `String(corpo)` dava `"[object Object]"` e tres verificacoes de mensagem falhavam sem o codigo ter nada de errado.

- **Um teste de lao pode pendurar em vez de falhar (2026-10-18)**. Com o limite de saltos partido, o proxy pedia de uma vez para sempre e o teste nao saia (a mutacao dava `SIGTERM`, sem linha de resultado — que, pelas regras, nao conta como detectada). A correccao esta do lado do **upstream de teste**: ele so' redireciona 20 vezes. Com o limite certo o proxy da 502 aos 5; com o limite partido acaba por receber um 200 e a verificacao falha na mesma. E' a **segunda vez** nesta sessao que um teste precisa de um tecto do lado do servidor de mentira: a primeira foi o `AbortSignal.timeout` do N2.


- **A assinatura tinha de durar um PEDIDO; tinha de durar uma SESSAO DE VIDEO (2026-10-18)**. Bug do utilizador, confirmado reproduzindo com o relogio simulado: um segmento dava 200 aos 10 min e **403 aos 11**.
  - `rewritePlaylist` assina os segmentos **uma unica vez, no momento em que a playlist e' lida**, e um leitor de VOD nao volta a le-la. Por isso `VALIDADE_ASSINATURA_MS` tem de ser maior do que a reproducao inteira, nao do que um pedido: com 10 minutos, um filme de 3 horas partia a meio e uma pausa de 10 minutos estragava o mesmo. Agora **12 horas** (com `ts` no futuro limitado a 5 min de tolerancia para desvio de relogio).
  - **O segredo era `MEIDA_PROXY_SECRET || randomBytes(32)` e `MEIDA_PROXY_SECRET` nao esta definida em LADO NENHUM** — nem `.env`, nem `config.js`, nem `deploy/`. Em producao era portanto aleatorio em cada arranque, e um reinicio (o Render hiberna) invalidava todas as URLs assinadas. Agora deriva de `MEIDA_PROXY_SECRET` ou do `config.jwtSecret` (que o `config.js` exige em producao). **O segredo do JWT nao e' usado tal e qual**: deriva-se `createHmac("sha256", segredo).update("meida/proxy/hls/v1")`, para um HMAC do proxy nunca servir para forjar um token de login.
  - **Estender a validade nao abriu o proxy**: a assinatura continua presa ao seu URL (HMAC de `alvo|ts`), e `testar-validade-assinatura.mjs` verifica isso explicitamente, alem de "sem assinatura continua a dar 403".
  - `assinar` passou a ser exportada de `proxy.js` para os testes assinarem um `ts` a escolher sem reimplementar o HMAC.

- **Crypto DUPLICADA num teste parte em silencio e com a mensagem errada (2026-10-18)**. Quatro ficheiros de teste reimplementavam `createHmac("sha256", SEGREDO).update(alvo + "|" + ts)`. Quando a chave passou a ser derivada, **os quatro partiram ao mesmo tempo** — e o pior:
  - **O controlo POSITIVO e' o que dói.** No `testar-rota-async.mjs`, "aceita a assinatura certa" passou a falhar: via-se como *"o portao esta' a rejeitar assinatura válida"* (catastrófico) e nao como *"o teste assina mal"**. Em caso de duvida, verificar primeiro se o **controlo positivo** e' que esta a falhar.
  - **Um teste que se copia para uma pasta nova precisa de TODOS os imports.** O harness de mutacoes do `testar-proxy.mjs` copia o `proxy.js` mutado para `server/src/services/.mutproxy-*`; o novo `import "../config.js"` resolvia para `services/config.js` (que nao existe) e o sub-teste morria com `ERR_MODULE_NOT_FOUND` **antes de imprimir uma verificacao sequer** — o que o harness lia, ao contrario, como "mutacao nao apanhada". A pasta passou para `server/src/.mutproxy-*`: um nivel acima, `../config.js` da' o verdadeiro e `./legendas.js` continua a ser a copia local. **Regra: quando um import novo entra num modulo que algum teste copia, o `Cannot find module` do sub-teste e' lido como "mutacao nao apanhada" e investigated.**
  - Os quatro ficheiros passam a importar `assinar` do servidor. Uma fonte de verdade.
  - E um teste que **afirmava o bug**: `testar-proxy-seguranca.mjs` SECAO 4 affirmava "ts de ha mais de 10 min -> 403". Passou a verificar 11 min e 3 h **ainda valem**, 13 h **expiram**, e `ts` no futuro **e' recusado**.

- **Testes instaveis: mede antes de aceitar (2026-10-18)**. O `testar-validade-assinatura.mjs` falhou em **3 de 8** execucoes na primeira versao, e o sintoma era enganador.
  - **Um limite de 1 ms e' menor do que o tempo de_arrancar um modulo.** As fronteiras mediam-se a partir de um `Date.now()` tirado a parte, e `buildProxyUrl` (chamado depois) estampava um `ts` alguns ms no futuro, portanto "12 h + 1 ms ja expirou" falhava ao acaso. **Ancorar sempre as fronteiras no valor que o codigo produziu** (`Number(ts)`), e usar margens de minutos.
  - **`process.exit()` no fim de um teste que arranca um servidor aborta o Windows ao acaso:** `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` do libuv, em ~1 de cada 6 execucoes, **mesmo com o teste todo a passar**. Nao e' a espera pelo `exit` do filho que resolve (nem destruir os pipes). O que resolve: `process.exitCode = falhou ? 1 : 0` e deixar o processo sair sozinho, depois de `filho.unref()` e `filho.stdout.destroy()`. Medido: 14/14 limpo. E `filho.kill()` -> **esperar pelo `exit`** -> `rmSync`, porque inverter a ordem da `EPERM` e deixa uma pasta `meida-test-*` em Documents por execucao.

- **Os testes `*-seguranca` também deixavam pastas `meida-test-*` em `Documents`** (129 de 7 testes anteriores ao de hoje). O mesmo padrao de limpeza. Nao foram apagados por serem de outros; se quiseres, corrijo-os todos com o mesmo padrao.


- **Um `sig` com 64 caracteres nao-hexadecimais derrubava o servidor inteiro (2026-10-18)**. Bug do utilizador, confirmado reproduzindo contra o servidor real: um `GET /api/proxy?...&sig=zzzz...` **sem autenticacao** matava o processo com codigo 1. O servidor e' publico, portanto era negacao de servico.
  - **Duas falhas encadeadas.** (1) `assinaturaValida` guardava com `sig.length !== esperado.length` — comprimento da **string**. Mas `Buffer.from(sig, "hex")` descodifica **par a par** e pára no primeiro par invalido: um `sig` de 64 caracteres com um `z` dava um buffer de **0 bytes** (e "32 hex + 32 `z`", bem mais plausivel, dava 16), e o `timingSafeEqual` atirava `RangeError: Input buffers must have the same byte length`. (2) `handleProxy` e' `async` e nao estava ligado a nada — no **Express 4 o handler de rota recebe o valor devolvido e ignora-o**, a rejeicao fica sem dono e o Node mata o processo a um `unhandledRejection`.
  - **O contra, que e' o que torna isto dificil de apanhar:** o `timingSafeEqual` documenta "os buffers tem de ter o mesmo tamanho" mas o compilador nao avisa, nao ha teste que falhe, e o sintoma e' "o servidor desapareceu" — que parece infra-estrutura, nao codigo. **Regra: `timingSafeEqual` (e `Buffer.from(x, "hex")` a partir de input) so' depois de validar a FORMA, nunca so' o comprimento.** `/^[0-9a-f]{64}$/i` garante 64 chars = 32 bytes = o tamanho do digest, por isso abaixo ja e' impossivel os buffers diferirem.
  - **A rede: `server/src/services/asyncRotas.js`** (novo), importado pelo `index.js` por efeito de borda. Envolve `Layer.prototype.handle_request` — o ponto onde o Express chama o handler e ja apanha o `throw` sincrono, mas **ignora a promessa devolvida** — para escutar tambem a rejeicao e a levar ao middleware de erro que ja existia (`index.js`). E' a abordagem do `express-async-errors`.
  - **Porque nao envolver os METODOS do router no `index.js`:** os routers **ja estao preenchidos no momento em que sao importados**, portanto envolver `router.get`/`router.post` depois chegaria tarde demais. Era esse o plano e so' se percebeu ao tentar escrever o codigo. Nao ha `router.route(...)` no codebase, por isso envolver o `Layer` cobre tudo.
  - **A guarda `res.headersSent`:** um handler que responde e *depois* lanca nao pode mandar o erro para o middleware de erro — esse ia chamar `res.status().json()` e rebentar com `ERR_HTTP_HEADERS_SENT`, que e' ruido que esconde o erro verdadeiro (e o pedido tinha sucesso). Logo-se.
  - **`routes/admin.js` tinha o mesmo bug de classe** (mesmo `timingSafeEqual`, mesmo `provided.length !== expected.length`): um token com tantos caracteres quanto o certo mas mais bytes passava o teste e rebentava — respondia 500 em vez de 404. Caracteres fora do plano BEM (emoji, etc.) é o caso: 2 unidades de codigo, 4 bytes. **Ao comparar para `timingSafeEqual`, medir BYTES, nunca caracteres.**
  - `scripts/testar-rota-async.mjs` (50 verificações, entra no `npm test`), **5 mutações confirmadas a falhar**. Ver as quatro lições de teste abaixo — sao as que custaram mais tempo aqui.

- **Um `uncaughtException` engolido transforma um teste partido num teste que passa (2026-10-18)**. Quatro armadilhas na mesma hora, todas no mesmo teste:
  - **Um `process.on("uncaughtException", (e) => registrar(e))` no FICHEIRO DE TESTE engole a excecao**: o modulo aborta, o Node sai com **0** e nao ha resumo. Parece um teste que passou. O mesmo com `unhandledRejection`.
  - **Ouncao que salva isto (`process.on("exit")`) tinha a mesma falha**: fiz `if (codigo === 0 && falhou === 0) return;` para ficar calado no caso bom — que e' **exactamente o aspecto de uma morte silenciosa**. A unica coisa que diz que o script chegou ao fim e' `resumoImpresso`, posto antes do `process.exit()` do fim. (Isto e' a **terceira vez** que um fallback assim morre: ver o `if (!seasons.length)` dos animes.)
  - **Nao dar `exit=1` a um crash como prova de que o teste funciona.** A mutacao do wrapper "apanhou" o teste, mas por `SIGTERM` de timeout e nao pela linha `N ok, M falha(s)` — nao conta.
  - **Detectar `ERR_HTTP_HEADERS_SENT` por `uncaughtException` e' uma verificacao MORTA**: o Express apanha essa excecao dentro do proprio dispatch e nunca a propaga. A mutacao que provou isso passou com 50/50. A forma que funciona e' registar no **proprio middleware de erro do teste** (`if (res.headersSent) marcar()`).
  - **Um teste que pode pendurar e' um teste que pendura a CI.** Com o wrapper desligado nenhum pedido produz resposta e o `fetch` espera para sempre. Todo o `fetch` do teste leva `signal: AbortSignal.timeout(...)`, e o resultado de timeout e' uma **verificacao que falha** (`TEMPO ESGOTADO`), nao um processo morto.
  - E a mutação em si pode estar mal feita e dar a ilusao de que o teste e' fraco: a primeira versao do M2 trocava `retorno.then(` por `void Promise.resolve(retorno).then(` — **que nao desliga nada**, porque `Promise.resolve(p)` devolve a propria `p`. Passou, e o culpado era a mutacao.


- **O `setPermissionRequestHandler` devolveu valores em vez de chamar o `callback` (1.5.5, 2026-10-18)**. O fullscreen (botão, player, atalho F) e o copiar da Watch Party nunca arrancavam: o pedido ficava pendente para sempre, sem erro na consola.
  - No Electron o handler recebe `(webContents, permission, callback, details)` e a decisão dá-se com `callback(true)`/`callback(false)`. O valor de retorno é **ignorado**.
  - O código da 1.5.5 fazia `return true` / `return false` sem nunca chamar `callback`. Todos os pedidos de permissão ficavam pendentes.
  - Afectava `setPermissionRequestHandler` (pedido). O `setPermissionCheckHandler` (pergunta síncrona) já estava certo porque devolve boolean.
  - Corrigido: `PERMISSOES_OK = new Set(["fullscreen", "clipboard-sanitized-write"])` + `callback(ok)` no request handler. O check handler mantém o `return ok` e permite `automatic-fullscreen` só à origem da app.
  - Teste: `scripts/testar-ecra-inteiro.mjs` (38 verificações) prova que o request handler chama `callback(ok)` e que ambos os handlers existem.
  - Sem isto, `document.documentElement.requestFullscreen()` fica pendente para sempre e `navigator.clipboard.writeText()` nunca resolve.


- **O idioma da interface nao mexia nos titulos — e o titulo guardado nao se mexia nunca (2026-10-18)**. Duas falhas independentes, nenhuma com erro, nenhuma com aviso: a app mostrava um titulo, so que o titulo errado.
  - **O omissao nao seguia a interface.** `DEFAULT_SETTINGS.titleLang` era `"en"`. A interface e o titulo sao **duas definicoes** e so a segunda mandava no catalogo — quem punha a interface em portugues via os titulos em ingles e nao tinha onde discoverir que havia outra definicao. Agora o omissao e' `"auto"`, resolvido **no cliente** (`titleLangEfetivo`) para o idioma da interface. Tem de ser no cliente: `resolveLang` no servidor nao sabe o idioma da interface de ninguem, e "auto" caia no fallback dele, que e' `en-US` — ia para ingles, que e' o defeito.
  - **O titulo gravado e' o titulo no momento em que o titulo foi visto.** `library`, `progress`, `list_items` guardam essa string, e mudar o idioma nao a reescreve. **`GET /api/library` ja localizava** — e e' isso que fazia a biblioteca parecer funcionar e as listas e o "Continua a ver" parecerem ter outra causa. Agora `localizarTitulos`/`preencherTitulosLocalizados` (`services/tmdb.js`) sao usados pelas **cinco** rotas que devolvem itens guardados: `/library`, `/lists/:id`, `/progress`, `/users/:username/library`, `/users/:username/lists/:id`.
  - **O que quase passou:** o `useEffect` que carrega o catalogo tinha `settings.titleLang` nas dependencias mas nao `t.idioma`. Com `"auto"` isso nao chega: o valor nao muda, so o valor de que ele se resolve. Sem `t.idioma` em `Home`, `Search`, `Category` (x2) e `Details`, mudar o idioma da interface nao recarrega nada.
  - **A migracao tem de ser uma vez so.** `"en"` guardado passa a `"auto"`, com uma marca no `localStorage`; sem a marca, quem escolhesse "Ingles" a proposito via-se a "auto" em cada arranque. O custo e' que tambem muda a escolha de quem tinha escolhido ingles a mao — o valor guardado e' o mesmo, nao ha como distinguir. Preferimos errar para o lado de a interface governar.
  - **A mudanca de omissao, sozinha, nao chegava ao utilizador**: quem ja tem `"en"` no `localStorage` continua com `"en"` ate mudar a mao. Da a migracao ser preciso, e nao um extra.
  - `pMap` (concorrencia limitada) foi de `routes/library.js` para `services/net.js`: o `tmdb.js` precisa dele para o preenchimento em segundo plano, e **as rotas nao se importam entre si**.
  - Teste: `scripts/testar-idioma-titulos.mjs` (68 verificacoes, 5 mutacoes confirmadas). Apanha as cinco rotas pelo texto do fonte — e tem de apanhar as cinco, porque o bug do "so a biblioteca localiza" e' precisamente o que faz as outras parecerem ter outra causa.

- **O auditor de traduções estava cego para metade do `web/src` (2026-10-18)**. O utilizador reportou "os botões não foram traduzidos" no `Esconder`/`Mostrar` do conteúdo adulto. O `auditar-pt-por-traduzir.cjs` respondia "nenhum texto por traduzir" — **estava a mentir, e sem dar erro nenhum**. Duas falhas encadeadas no mesmo lugar:
  - **`semComentarios` não sabia o que era uma string.** O `//` de `href="https://real-debrid.com/apitoken"` é o início de um URL, não um comentário: o `//` apagava o resto da linha **com a aspa de fecho da string**. A string ficava aberta, o scanner perdia o fio e o `fimDaChamada` corria até ao fim do ficheiro — em silêncio. Em `Settings.jsx` começava na linha 438 e deixava **as 1207 linhas seguintes (73% do ficheiro) por auditar**; em todo o `web/src`, **477 linhas**.
  - **E o mesmo com uma REGEX.** `return /[",\n\r]/.test(s) ? ...` tem uma aspa dentro. Sem reconhecer regex, essa aspa abre uma string fantasma — que não *destrói* texto, *copia-o*. O que estraga é um `//` de comentário ficar lá dentro e deixar de ser apagado; se o comentário tiver aspas, o scanner lê-as como string e aponta o comentário como interface.
  - **A mesma armadilha de `fimDaChamada`**: o guarda `if (chaves === 0)` ignorava o `)` de chamadas feitas *dentro* do objecto de valores (`{ ligacao: (<a/>), fim: t("x") }`) mas contava o `(` correspondente — o `nivel` ficava inflado para sempre. Agora o `nivel` desce sempre e o guarda só decide se aquele `)` fecha a chamada.
  - **Como isto se apanha:** não com `grep` — com uma fixture que tenha **texto por traduzir DEPOIS** do URL, e outra com **um comentário depois** da regex. Um mutation check que só olha para uma fixture passa como se tivesse apanhado a mutação: as minhas duas primeiras fixtures faziam exactamente isso (`MUTACAO NAO DETECTADA`). `testar-auditor-i18n.mjs` tem agora 9 mutações e 27 verificações.
  - **Saiu de lá:** `Esconder`/`Mostrar`, `Português`/`Inglês` (×4 cada), `Desligadas`, `momento`, `Comentar`. E três regras novas: unidade CSS (`184px`) não é texto, nomes próprios via `t()` com identidade, e o marcador `// i18n` passa a valer na linha de cima (entre atributos de JSX é onde pode estar, porque `className={...}` não aceita um `//` no fim da linha).

- **Anime aparecia sem episodios — "Temporada 1 (0 eps)" (2026-10-17)**. Eram **duas** falhas encadeadas, e nenhuma delas dava erro no log: o servidor respondia 200 e o frontend desenhava, era so a lista que vinha vazia. (1) O espelho **Tenrai** (primario desde 1-out-2026) responde a `/anime/{id}/episodes` **sem o campo `episode` e sem o `mal_id`**, e o filtro era `(e.episode ?? e.mal_id) != null` — com os dois a `undefined`, o `??` dava `undefined` e o `!= null` era falso para **todas** as linhas, em qualquer anime. Agora `normalizarEpisodios()` usa a **posicao na lista** (a API devolve por ordem, portanto a posicao e' o numero). (2) O Tenrai tem a base incompleta para alguns titulos e devolve **HTTP 200 com `data: []`** (o Zan Sayonara Zetsubou Sensei, ID 6377, e' um) — e nesse caso o `jikanFetch` **nao caia para o backup**, porque nao houve erro de rede nem HTTP. Corrigido nos dois sitios, mais um ultimo recurso: quando nada devolve a lista, os numeros sao sintetizados a partir do `episodes` do `/anime/{id}`, que o espelho preenche sempre (e so o numero interessa — os providers resolvem o episodio pelo numero, nao pelo titulo). **O contra, que e' o que torna isto dificil de apanhar:** `groupEpisodesBySeason([])` devolve **uma** temporada vazia, nunca `[]` — por isso o `if (!seasons.length)` do frontend era um fallback **morto**, e o fallback existia e estava certo. O teste certo e' `seasons.some(s => s.episodes.length)`. Coberto por `scripts/testar-episodios-anime.mjs` (32 verificacoes, 4 mutacoes confirmadas a falhar).
- **`TypeError: Cannot read properties of undefined (reading 'catch')` MATOU o servidor ao arrancar (2026-10-11, 1.4.3)**. `index.js` fazia `aquecerCatalogo().catch(() => {})` e o `aquecerCatalogo()` **não devolvia nada** (faltava o `return`). Morre no `listening`, o `electron/main.cjs` vê o processo morrer e a app mostra "o servidor não arrancou". **Nenhum dos 23 testes do `npm test` dava por isto, porque nenhum arranco o `index.js`.** Regra: (1) uma função pública chamada no arranque **tem de devolver a promessa** — quem chama faz `.catch()`; (2) se mexeu no arranque do servidor, o teste tem de **arrancar o servidor de verdade** (`scripts/testar-anikoto.mjs` faz: porta livre, base temporária, falha se o processo morrer — e foi verificado por mutação, reintroduzir o bug é apanhado).

- **Quase perdi o AGENTS.md inteiro (2026-10-04)**: usei a ferramenta `write` para acrescentar uma secção e ela **sobrescreveu o ficheiro todo** (18586 bytes → 2070). Salvei com `git checkout -- AGENTS.md`. **Porquê não voltou a acontecer:** para acrescentar texto a um ficheiro existente usa **sempre `edit`**, nunca `write`. O `write` só para criar ficheiros novos. Isto viola a regra "usar sempre a ferramenta `edit`" acima — obeyecê-la evita isto e mais.
- **`git checkout -- <ficheiro>` DESTRUI trabalho por fazer (2026-10-08, quase repeti o de cima)**. Estava a verificar que o teste novo falhava mesmo — que é a coisa certa a fazer — e para desfazer uma mutação de teste usei `git checkout -- web/src/pages/Details.jsx`. O ficheiro tinha ~50 linhas **por commitar** (a refactorização dos três estados do Discord): foram todas para o lixo. Repeti o trabalho à mão. **Regra:** para desfazer uma alteração de teste, **copia o ficheiro antes** (`Copy-Item x.cjs "$env:TEMP\x.bak"`) e **restaura com `Copy-Item`**, nunca com `git checkout --` — que só serve para ficheiros **já commitados**. Ou faz-se o commit *antes* de começar a mutar. Isto é o mesmo perigo do `write` acima, pelo caminho oposto: **qualquer comando que possa apagar escrita por commitar tem de ter o commit feito primeiro.**

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
  - **Legendas completas, em claro.** O endpoint `/stream/getSources?id={data-id}` (que se lê do atributo `data-id` da página do player) devolve `{tracks:[{file:".../subtitles/eng-2.vtt", kind:"captions"}], t, server, intro, outro, enc}`. O `.vtt` do ep 1 do One Piece tem 285 blocos de texto — o oposto do MegaVid.
  - **O `enc` DÁ-SE para desencriptar (2026-10-11) — e já está feito.** Isto estava escrito aqui como "não dá para reproduzir nativamente sem engenharia reversa", e era exagero: o `enc` é `AES-CBC` e a chave e o IV estão em **texto simples** no próprio `megaplay.buzz/lib/newclient.min.js` (chave `"i?LMTAx0Q6,:}50U"` → 32 bytes com zeros, IV `"W0;27ToaUpl_P%'c"` → 16 bytes). A página **não** os sobrescreve em `__MegaPlayCfg`, por isso são estáveis. O texto claro é `{"file":"https://.../master.m3u8"}`.
    - **Não é contornar DRM**: os segmentos aceitam o mesmo `Referer` que o player usaria, e o servidor não impõe nada. É a mesma técnica que o próprio site faz no browser.
    - Medido num episódio real: o m3u8 tem **339 segmentos** (~24 min) e o `.vtt` **378 blocos**; os segmentos aceitam CORS (`*`), por isso o browser pode buscá-los.
    - Implementado em `server/src/services/megaplayNativo.js` + rota `/api/anime/megaplay`. Aparece como fonte **separada** na lista ("MegaPlay (nativo)") ao lado do iframe — não o substitui. Se a chave mudar um dia, devolve `native: false` e o `Player` cai no iframe sem o utilizador notar. Testado em `scripts/testar-megaplay.mjs` (16 verificações, 3 mutações, a bater no site real).
    - **O `data-id` NÃO está no URL.** O `embedUrl` é `/stream/ani/{aniList}/{ep}/{audio}` e o `getSources` quer um atributo `data-id="7827"` da **página**. Por isso o áudio fica correcto sem trabalho extra: quem pede `/dub` traz a página do dub, cujo `data-id` é o do dub.
  - **É o mais limpo de todos**: em 12 s de reprodução e mesmo a clicar (que é o que dispara popunders) só pediu segmentos de vídeo. O único pedido de terceiros é `statlytic.net` (estatísticas), que já está no adblock.
  - **Exige header `Referer`**, senão devolve a página "Error - MegaPlay". Não valida o *valor*, só exige que exista — e um iframe envia sempre, por isso na app funciona. A health-check manda a raiz do próprio site (`refererFor()` em `providerHealth.js`).
  - **A rota `/ani/` e a `/mal/` NÃO são iguais** — cada uma falha em títulos que a outra resolve (Solo Leveling só na `/ani/`, Dandadan só na `/mal/`). Só entram `/ani/` na app, para não voltar a mostrar o mesmo episódio duas vezes (o erro do "MegaVid 1 e 2").
  - **As legendas vêm ligadas** (JW Player, `getCurrentCaptions() === 1`), ao contrário do VidNest onde a track nasce com `mode="disabled"` e o utilizador tem de a ligar à mão.
  - **Cuidado: um provider removido pode voltar.** O MegaPlay foi removido a 2026-07-31 por devolver erro 410 e voltou a 2026-10-04. Antes de dar um provider como morto, voltar a testar.
  - **Descartados nesta procura** (2026-10-04): `supaplay.fun` (passou a "PREMIUM ACCESS", e o `aniwixi` cobra $50/mês — nada pago), `ani.megaplay.su` (devolve uma página de erro; a API JSON exige origem na lista branca), `ninjasheild.stream` (não responde), `myapi-psi-wheat.vercel.app` (API do AnimePahe, `/search` dá 503), `api.ani.zip` (404 na raiz).
  - **A `anikotoapi.site` dá exatamente os URLs do MegaPlay** (rota `s-2`), e **já está integrada** (2026-10-11, `services/anikoto.js`). A nota antiga dizia "não compensa"; mudou por duas razões medidas:
    - **A API mudou.** Os endpoints já não são `/series?page=N` — são `/recent-anime?page=N&per_page=M` e `/series/{id}`. E a chave deixou de ser o `ani_id`: é o `embed_url.sub`/`.dub` de cada episódio. Os `mal_id`/`ani_id` continuam lá, mas **como texto**, com `""` nos títulos que não têm (e `""` numa coluna INTEGER dá **0**, que é um id válido de outra série — o `idValido()` trata disso).
    - **O ganho é maior do que "outro site".** O `embed_url` é o **próprio MegaPlay pela rota `/stream/s-2/`** — ou seja, é o mesmo site por um caminho que resolve títulos que a `/ani/` não resolve. Como provider EXTRA (aparece depois dos normais e nunca os substitui), só acrescenta.
    - O catálogo fica em cache no SQLite (tabela `anikoto_series`, migração 7) com rasteio incremental (2 páginas ao arrancar, mais 3 por título desconhecido, 1,4 s entre pedidos — o limite é 60/120 s). **Separar "catálogo conhecido" de "embeds buscados"** é o truque: o `/recent-anime` dá ~100 títulos por página com **1** pedido, e o `/series/{id}` só é pedido a quem se precisa.


## Binarios nativos do `server/`: como nao voltar a errar a arquitectura (2026-10-05)

**Este foi o bug mais caro de sempre: nenhuma versao publicada (1.2.0 ate 1.2.6) arrancava em nenhum PC x86.** Levou o dia inteiro a investigar em silencio ate aparecer um log (1.2.6).

**O que acontece.** `server/node_modules` traz modulos nativos. O `electron-builder` copia essa pasta tal e qual pelo `extraResources`, **sem recompilar nada**. Quando a build e' feita numa maquina ARM, o `.node` compilado no `npm install` local e' **ARM64** — e vai para o pacote x64 tal e qual. Em PC x86 o `dlopen` falha:

```
Error: node_datachannel.node is not a valid Win32 application
  code: 'ERR_DLOPEN_FAILED'
```

E como o `webtorrent` era importado de forma **estatica**, o backend morria **antes do primeiro `log.info`** — por isso nao havia rasto nenhum. Sintoma do lado do utilizador: janela preta e "a app nao conseguiu iniciar o servidor interno, codigo 1".

**Quem tem `.node` no `server/node_modules`:**

- `node-datachannel/build/Release/node_datachannel.node` — o problema. Vem do `webrtc-polyfill` (usado pelo `webtorrent`), **caminho fixo**, por isso o runtime escolhe sempre este.
- `fs-native-extensions/prebuilds/<plataforma>-<arquitetura>/` — **nao e' problema**. O `require-addon` monta `"prebuilds/" + process.platform + "-" + process.arch` em runtime, e a pasta tem `win32-x64` e `win32-arm64`. Ja estava certo desde sempre; o hook ignora estes de proposito (`RUNTIME` em `scripts/empacotar-nativos.cjs`).

**Como resolver um novo `.node` que apareca** (a lista nunca mais vai ter so este):

1. Nao vale a pena tentar o `@electron/rebuild`, nem `npmRebuild`/`buildDependenciesFromSource`/`nodeGypRebuild` — confirmei no schema do `electron-builder` que nenhum reconstroi nada no `server/`.
2. Meter o prebuild oficial em `scripts/native/` com o nome `<pacote>.win32-<arch>.node`.
3. Acrescentar a entrada em `TROCAR` dentro de `scripts/empacotar-nativos.cjs`.
4. **Nao mexer** no `package.json` do `server/` para "arrumar" isto a mao: volta a partir no proximo `npm install`.

**Onde estao os binarios:** `scripts/native/node_datachannel.win32-x64.node` e `...win32-arm64.node`, tirados dos prebuilds oficiais de `murat-dogan/node-datachannel` release `v0.32.3`, variante `napi-v8`. Sao **N-API**, portanto servem para o Node e para o Electron em qualquer versao. Ficam no repositorio para a build nao depender da rede; `scripts/native/README.md` tem o porque.

**Confirmacao de que o caminho esta certo:** o `.node` ARM64 que estava em `server/node_modules` (compilado localmente) e' **byte a byte igual** ao prebuild oficial `win32-arm64` (sha256 `c8ce3ad6...`). O `prebuild-install` e' que os tinha posto la.

**Como o hook esta ligado:** `"afterPack": "scripts/empacotar-nativos.cjs"` no `build` do `package.json`. Corre **depois** de cada pacote estar montado, e `release/win-unpacked` / `release/win-arm64-unpacked` sao pastas separadas — por isso cada uma recebe o binario certo, sem condicoes de corrida.

**A defesa importante:** no fim o hook varre **todos** os `.node`/`.dll` de `server/node_modules` no pacote e **falha a build** se algum ficar com a arquitectura errada. Testado: injetei um `.node` ARM64 num pacote desconhecido e a build parou com o erro certo. **Este e' o que impede a repeticao do bug** — antes nao havia nada que falhasse.

**Como testar um binario x64 (so e' preciso numa maquina ARM):** num PC ARM nao
da para carregar um `.node` x64 com o Node local (da o mesmo `nao e' uma
aplicacao Win32 valida`, ao contrario) — e' preciso o Windows emular. Descarga-se
o Node x64 e usa-se:

```
Invoke-WebRequest -useb https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip -OutFile $env:TEMP\node-x64.zip
Expand-Archive $env:TEMP\node-x64.zip -DestinationPath $env:TEMP\node-x64 -Force
$env:TEMP\node-x64\node-v24.21.0-win-x64\node.exe
```

**Num PC x86 nao e' preciso nada disto**: carrega-se o `.node` x64
directamente com o Node local, porque e' a arquitectura certa. E' por isso que o
`scripts/verificar-x86.ps1` da um veredito real no desktop do Boda, e so uma
emulacao num PC ARM.

Testado assim na 1.2.8: `require('node-datachannel')` carrega, `new WebTorrent()` gera peer id, `/api/health` e `/api/torrents` respondem.

## O arquivo ARM64 sai TRUNCADO quando a build e' feita nesta maquina ARM (2026-10-08, 1.3.7)

**Este e' um bug diferente do de cima, e o pior de todos pela razao de custar tempo: e' silencioso e so' afecta o ARM.** Enquanto o bug das 1.2.0-1.2.2 era x64, este e' o inverso — **o x64 funciona e o ARM nao**.

**Sintoma.** O instalador acaba com **codigo 0**, escreve o registo, cria o desinstalador, cria os atalhos — e o `MEIDA.exe` **nao existe**. A app nao arranca. Quem installou tem de ir ao "Reparar"/"Alterar" do Windows (que com `NoRepair=1` no registo nao faz nada) e fica sem atalho no desktop.

**Diagnostico — comparar o pacote com o instalado.** Nao e' adivinhar, e' contar ficheiros: `release/win-arm64-unpacked` tem 2740 ficheiros, o instalado tinha 2733. Falhavam **7, todos no topo, todos `.exe`/`.dll`**: `MEIDA.exe`, `ffmpeg.dll`, `vulkan-1.dll`, `d3dcompiler_47.dll`, `dxcompiler.dll`, `dxil.dll`, `vk_swiftshader.dll`. Os `.pak`, `.dat`, `.bin` estavam todos la, e `resources\elevate.exe` tambem — porque esse vem do script NSIS, nao do arquivo.

**O que fica de fora e' deitar fora.** Nao e' espaco em disco (694 GB livres). Nao e' antivirus (zero deteccoes, zero eventos de CodeIntegrity). Nao e' permissao (copiar o `MEIDA.exe` a mao para a mesma pasta funciona). Nao e' binarios de arquitectura errada (o `MEIDA.exe` do pacote e' mesmo ARM64). Nao e' empacotamento — o `.7z` dentro do instalador **tem** os 7 ficheiros, com o `MEIDA.exe` a 227 MB.

**A prova de que o arquivo esta corrompido** (esta e' a parte que custa horas se nao se pensar):

```
7z t app-arm64.7z   ->  ERROR: Unsupported Method : vk_swiftshader.dll
                        ERROR: Unsupported Method : vulkan-1.dll
                        Sub items Errors: 7
7z t app-64.7z      ->  Everything is Ok   (2740 ficheiros, 620 pastas)
```

O `app-arm64.7z` esta **truncado**: as ultimas entradas tem cabecalhos ilegiveis. E sao **as ultimas** — os 7 ficheiros em falta sao as ultimas entradas do arquivo, por ordem. `Blocks = 2728` em ambos, mas o x64 fecha com "Everything is Ok".

**Isto explica todos os sintomas que nao se explicavam:**
- `Nsis7z::Extract` **e** `nsisunz::Unzip` falham: o arquivo esta corrompido, nao o metodo. Por isso `useZip: true` e' **pior** — aborta com codigo 2 e nao instala nada (em vez de 2733 em 2740).
- O `CopyFiles` "parcialmente bem" tambem: e' o fallback do macro `extractUsing7za` a re-extrair a ignorar erros.
- O instalador da **1.3.5** falha **exactamente igual** — logo **nao e' regressao**, o ARM nunca esteve a funcionar.
- O `MEIDA.exe` e' o maior ficheiro (227 MB) e esta na cauda corrompida: a falta de espaco nao se explica pelo tamanho, mas o arquivo grande e' precisamente o que a truncagem leva.

**Porquê que acontece aqui e nao no desktop do Boda.** O `7za` do electron-builder na cache e' **x86, versao 24.09** (verificado pelo cabecalho PE) e corre emulado neste ARM. O `app-64.7z` feito **nesta mesma maquina** sai perfeito, por isso o problema e' do caminho **arm64** do empacotamento sob emulacao, nao do compressor.

**A correcao escolhida para a 1.3.7: `--x64` sem `--arm64`.** O Windows ARM corre x64 emulado, e o `extractAppPackage.nsh` escolhe o pacote "64" em ARM quando `APP_ARM64` nao esta definido:

```nsis
!ifdef APP_64
  ${if} ${RunningX64}
  ${OrIf} ${IsNativeARM64}
    StrCpy $packageArch "64"
```

Resultado: **instalador que funciona em toda a gente** (ARM emulado), contra um que nao funciona em ARM nenhum. O preco e' perder o ARM nativo. Para o ter de volta, compilar num PC x86 — que e' o que o aviso do inicio deste ficheiro ja diz para as builds de validacao, e agora ha uma razao concreta.

**Verificado de ponta a ponta na 1.3.7:** instalou com codigo 0, 2741/2740 ficheiros (0 em falta, 0 tamanhos errados), `MEIDA.exe` = 0x8664, atalhos do menu Iniciar **e** do desktop a apontar para `AppData\Local\Programs\streamapp\MEIDA.exe`, e a app arrancou com o backend a responder 200.

**`app:pack`, `app:pack:zip` e `app:publish` ficaram so' com `--x64`.** Voltar a meter `--arm64` sem compilar num PC x86 volta a publicar um instalador partido no ARM — e desta vez em silencio.

**Diagnostico que vale a pena reter:** um instalador que "acaba com sucesso", escreve o registo e cria os atalhos, mas **nao extrai os executaveis**, e' sempre **o arquivo, nao o destino**. Comparar contagens de ficheiros entre o pacote e o instalado leva-me ao ponto em minutos; `7z t` no arquivo aponta o culpado. E `7z` consegue abrir o instalador NSIS (`7z l`, `7z e`) — e' assim que se chega ao `.7z` embutido, que de outra forma nao existe em disco.

**Um quase-erro meu, para nao repetir:** comecou com "o atalho aponta para a pasta da build e o Windows diz que esta corrompido", que parece ser do instalador. Era o `.lnk` do menu Iniciar apontado para `release\win-arm64-unpacked\MEIDA.exe` — a pasta que o electron-builder apaga a cada build. Quem o usava estava a correr a **build de desenvolvimento**, nao a app instalada. **Antes de culpar o instalador, confirmar para onde aponta o atalho.**

## Instaladores arm64: 1.2.0 ate 1.2.2 nao instalam em PC x64 (2026-10-04)

**CAUSA RAIZ, confirmada.** A build foi feita **numa maquina Windows sobre ARM**
(`PROCESSOR_IDENTIFIER = ARMv8 (64-bit) ... Qualcomm`; ver o aviso no inicio
deste ficheiro). O `electron-builder` sem `--x64` compila **arm64**. Confirmado em
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
CodeIntegrity, sem evento de Defender, sem aviso nenhum.

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

**`scripts/verificar-x86.ps1` — o script que falta quando mexeres nos nativos.**
Existe porque **uma das duas maquinas e' ARM** (e foi de la que saiu a build que
deu problemas), e num PC ARM nao se consegue provar que o pacote x86 esta certo
(ver "Binarios nativos do `server/`" mais acima). Abre os ficheiros do pacote, le o
cabecalho PE de cada `.node` e diz se estao do tipo certo, arranca o servidor e
carrega o node-datachannel e o WebTorrent a serio. **100 por cento ASCII e sem
BOM** (o Powershell le mal um script com BOM) — **tem de continuar assim**.

Gist (para testar sem clonar o repo):
`https://gist.github.com/boda07/7e23010eb543763de239ab1e7af0ffc0`

```powershell
iwr -useb https://gist.githubusercontent.com/boda07/7e23010eb543763de239ab1e7af0ffc0/raw -OutFile "$env:TEMP\verificar-x86.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\verificar-x86.ps1"
```

Depois de mexer no hook `afterPack` ou nos nativos, **corre-o nas duas
maquinas**: no desktop do Boda (x86 nativo) dá um veredito real, e no PC ARM
emula x64 e tambem chega para apanhar um binario com o
tipo errado — que era exactamente o que falhava em silencio. Detalhes em
`README.md`, seccao "Testar num PC x86".

**`npm ci` e o `electron` sao coisas diferentes (2026-10-05).** O `node-datachannel`
**nao traz nenhum binario no tarball** do npm (verificado: 171 entradas, zero
binarios, 663 941 bytes) — o `.node` so existe porque o script de instalacao o
descarrega. O npm 11.17 avisa `allow-scripts` mas **nao bloqueia** (verificado:
apaguei `build/` e o `npm ci` repus o ficheiro). Ja o **electron** precisa mesmo
do script, porque o binario e' descarregado e nao vem no pacote: depois de um
`npm ci` puro, `node_modules/electron/dist/electron.exe` **nao existe**. Por isso
o `install:all` e' `npm ci && node node_modules/electron/install.js && ...`. O
passo do `install.js` e' repetivel (devolve 0 mesmo com o binario ja la) e
sobrevive a `npm ci` porque e' o Electron que escolhe a versao a descarregar.

Usar `install:all` (com `npm ci`) antes de empacotar, e `install:all:update`
(que usa `npm install`) so quando se mexe nas dependencias.

**Cuidado com o PowerShell ao escrever neste script:** `OK "texto " + $variavel`
**nao concatena** — passa 3 argumentos e a funcao so ve o primeiro, portanto a
variavel desaparece da mensagem (foi assim que o script passou anos a esconder
as causas das falhas). Sempre parenteses: `OK ("texto " + $variavel)`. As funcoes
`OK`/`Mal`/`Duv` ja avisam quando lhes chegam argumentos a mais.

## Funcionalidades recentes

- **Discord Rich Presence** (grátis, local): mostra no perfil do Discord o que se está a ver, como o Stremio. `electron/discord-presence.cjs` implementa o **protocolo RPC do Discord à mão** (frames `[opcode LE32][len LE32][JSON]`, HANDSHAKE/FRAME/CLOSE/PING/PONG) sobre o Named Pipe `\\?\pipe\discord-ipc-0..9` — **zero dependências** (o pacote npm `discord-rpc` está abandonado desde 2021; as alternativas modernas exigem Node >= 24.13). `client_id` = **1556179310077804564** (aplicação MEIDA no Discord Developers, grátis), sobreponível com `MEIDA_DISCORD_CLIENT_ID`. Frontend em `web/src/discord.js` (no-op silencioso sem Electron ou com a definição desligada), ligado em `Details.jsx` ao `reportPos` do progresso. `MIN_UPDATE_MS = 15000` (limite do Discord); `clear()` mantém o socket, `shutdown()` é que fecha.
  - **A presença tem TRÊS estados, e o que os distingue é o que *sabemos*, não o que achamos** (2026-10-08): `"a-ver"` (chega progresso — os nossos players, contador a correr), `"pausa"` (chegava e parou — o `timestamps.paused` congela e o Discord escreve "Pausado") e `"sem-dados"` (nunca chegou progresso — os players em iframe: MegaPlay, VidLove, ...). **Em `"sem-dados"` não se manda `timestamps` nenhum**, para o Discord mostrar o título sem contar tempo e sem dizer "Pausado": nos iframes não sabemos se está a dar, e afirmar seja o que for é mentira. O que separa "parou" de "nunca soube" é `viuProgressoRef` no `Details.jsx`.
  - **O `ipcMain.handle("set-presence")` do `electron/main.cjs` lista os campos UM A UM** — não passa o objeto inteiro. Um campo novo que não se acrescente à lista **chega com o valor por omissão, sem erro nenhum em lado nenhum** (já aconteceu: o `estado` ficou de fora e o defeito original voltaria em silêncio). Ao acrescentar um campo à presença, acrescentá-lo **também** à lista **e** ao teste — `scripts/testar-presenca-discord.mjs` (24 verificações) cobre isso.
  - **`buildActivity()` é função pura e exportada de propósito.** É a lógica que decide os `timestamps` e já esteve errada duas vezes; sem um ponto testável não há como apanhá-la. Ao mexer nela, **confirmar que o teste falha** com o código partido (mutação + teste) — foi assim que se apanhou o `timestamps` a ser enviado sempre.

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
