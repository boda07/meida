# MEIDA

App pessoal tipo Stremio: catálogo TMDB + anime (Jikan/Tenrai) + manga, streams via
providers embebidos e torrents, legendas, MyAnimeList e Letterboxd integrados.
Existe como **app desktop (Electron)** e como **backend self-hosted** que serve o
mesmo frontend no browser.

## Arquitetura

| Pasta | O que é |
| --- | --- |
| `server/` | Backend Express (Node ESM): catálogo, library, auth, MAL, manga, torrents (WebTorrent), streams, legendas, Letterboxd. Dados em `server/data/` (JSON + cache). |
| `web/` | Frontend React + Vite. Em produção o Vite compila para `web/dist/`, que o backend serve. |
| `electron/` | App desktop: janela Electron que arranca o backend com o Node embutido e carrega a UI. |
| `build/` | Ícones e scripts de build (`make-icon.cjs`). |
| `scripts/` | Scripts auxiliares (ex.: `prune-releases.mjs`). |

Fluxo de pedidos: UI → `server` (porta **5175**) → APIs externas (TMDB, Jikan/Tenrai,
MAL, OpenSubtitles, providers de stream, TVMaze como fallback de séries).

## Requisitos

- Node.js **18+** (testado com 24) e npm
- Chave do TMDB (obrigatória): https://www.themoviedb.org/settings/api

## Desenvolvimento

```bash
npm run install:all          # instala raiz + server + web
npm run dev                  # backend :5175 + frontend (Vite) :5173 com proxy para /api
npm run app:dev              # igual + janela Electron (dev)
npm run lint                 # ESLint (0 erros esperado)
npm test                     # testes do backend (node:test, sem dependências)
```

- Em dev o frontend corre em `http://localhost:5173` e o backend em `http://localhost:5175`.
- O backend recarrega sozinho em mudanças (`node --watch`); o Vite faz hot-reload.

## Self-hosting

Só o backend + frontend estático — sem Electron. A app inteira fica num processo
Node e abre em qualquer browser.

```bash
# 1. Instalar e compilar o frontend
npm run install:all
npm run build

# 2. Configurar (ver secao abaixo)
cp server/.env.example server/.env   # preenche TMDB_API_KEY (e JWT_SECRET)

# 3. Correr
SERVE_WEB=1 npm --prefix server run start
```

Abre `http://localhost:5175` — o backend serve o `web/dist/` compilado e o
fallback SPA (`/api/*` fica no backend). Para correr noutra porta, muda
`PORT` no `.env`.

Para um processo persistente, usa algo como `pm2`:

```bash
npm i -g pm2
SERVE_WEB=1 pm2 start server/src/index.js --name meida
```

### Configuração (`server/.env`)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `TMDB_API_KEY` ou `TMDB_ACCESS_TOKEN` | Sim | Chave v3 ou token v4 do TMDB (o token tem prioridade). |
| `PORT` | Não | Porta do backend (default `5175`). |
| `JWT_SECRET` | Sim (produção) | Segredo para assinar tokens de login. Gera um aleatório. |
| `OPENSUBTITLES_API_KEY` | Não | Legendas do OpenSubtitles (grátis em https://www.opensubtitles.com/consumers). |
| `EXTRACTOR_API_BASE` | Não | Extractor Consumet para streams sem anúncios (ver docker-compose abaixo). |
| `ANIME_EXTRACTOR_BASE` | Não | Extrator de anime self-hosted (aniwatch-api) — player próprio com sub/dub. |
| `MAL_CLIENT_ID` / `MAL_CLIENT_SECRET` | Não | MyAnimeList (app em https://myanimelist.net/apiconfig/create). |
| `MAL_REDIRECT_URI` | Não | Redirect do OAuth do MAL (default `http://localhost:5175/api/mal/callback` — muda se alojares noutro host). |
| `LETTERBOXD_API_KEY` / `LETTERBOXD_API_SECRET` | Não | API do Letterboxd (fechada, requer aprovação em https://letterboxd.com/api-beta/). A leitura do diário funciona sem chaves. |

### Watch Party (opcional)

O Watch Party usa Supabase Realtime (só broadcast/presence, sem base de dados).
Para o ativar, cria um projeto Supabase e define em `web/.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Depois recompila o frontend (`npm run build`).

### Extractor de streams (Consumet, opcional)

```bash
docker compose up -d consumet
# depois no server/.env:
EXTRACTOR_API_BASE=http://localhost:3000
```

### Onde ficam os dados

- `server/data/` — `data.json` (utilizadores, library, listas, progresso, definições),
  `cache/` (respostas de APIs em disco para resilência offline).
- No app desktop, a pasta de dados é a do utilizador (definida pelo Electron).
- `DB_DIR` permite apontar a pasta de dados para outro sítio.

## App desktop (Electron)

```bash
npm run app:pack      # build + instalador NSIS em release/
npm run app:publish   # build + release no GitHub (GH_TOKEN) + limpeza de releases antigas
```

Em produção o Electron arranca o backend com o Node embutido (`SERVER_WEB=1`,
`WEB_DIST`), serve o frontend na porta 5175 e abre a janela. A atualização
automática (electron-updater) está ligada às releases do GitHub.

## Notas

- Sem chave TMDB, o backend arranca na mesma mas o catálogo devolve erros —
  cria `server/.env` a partir de `server/.env.example`.
- O anime usa o Jikan como fonte primária com mirror Tenrai; séries/filmes usam
  TMDB com fallback para TVMaze quando o TMDB falha.
- ESLint: `npm run lint` (config em `eslint.config.mjs`).

### Windows: aviso do "Windows protegeu o teu PC"

O instalador **não tem assinatura digital** (falta certificado), por isso o
Windows 11 pode mostrar o aviso azul do SmartScreen. É esperado: clica em
**Mais informações → Executar mesmo assim**.

Há um caso mais chato: o **Smart App Control** (Windows 11) chega a bloquear
executáveis sem assinatura sem sequer mostrar o aviso, e a instalação fica a
meio — aparece a pasta
`%LOCALAPPDATA%\Programs\streamapp` quase vazia e o atalho do Menu Iniciar
aponta para um `MEIDA.exe` que não existe. Se isso acontecer:

- **Definições → Privacidade e segurança → Segurança do Windows → Controlo de
  aplicações e browser → Controlo de Aplicações Inteligente → Desligar.** É a
  única forma de instalar sem certificado. Repor a definição é possível nas
  atualizações recentes do Windows (sem reinstalar), **mas a app deixa de
  abrir** assim que o voltar a ligar, porque continua sem assinatura e não há
  forma de dar um aval só a uma aplicação.
- Ou correr `scripts/reparar-instalacao.ps1`, que apaga a instalação partida,
  volta a descarregar o instalador **confirmando o sha512**, e instala.

Ou seja: enquanto a MEIDA não for assinada, no Windows 11 com Smart App Control
ligado ela não instala. Num PC com o Controlo de Aplicações Inteligente desligado
instala e funciona — mas o PC fica menos protegido.

### Se não conseguires instalar: usa no browser

A MEIDA também corre como aplicação web, sem instalador nenhum, e **já está
publicada**:

## <https://meida.onrender.com>

Abre no Chrome, Edge ou Brave, entra com a tua conta e está feito. Não há
instalador, não há assinatura, não se mexe no PC — é a via mais segura se o
Windows te estiver a bloquear a app de desktop.

> O Render free hiberna quando ninguém usa. O primeiro pedido depois de um
> tempo parado pode demorar **uns 50 segundos** a acordar. Depois disso responde
> normal. Não é erro, é só o servidor a acordar.

O que a versão web **não** tem: Discord Presence (precisa do Electron) e
players externos. O WebTorrent depende de WebRTC — Chrome, Edge e Brave
suportam. Os dados ficam no servidor, não no PC.

### Correr a versão web tu mesmo

É o mesmo código da app desktop — o backend compila e serve o frontend na
mesma porta (`SERVE_WEB=1`). Com Node e o repo clonado:

```bash
npm run install:all
npm run start:pwa        # compila o frontend e serve em http://localhost:5175
```

`start:pwa` é `npm run build` seguido do backend com `SERVE_WEB=1`.

Para pôr uma instância tua no ar, o `render.yaml` é o_blueprint_ pronto
(`SERVE_WEB=1` e `npm run start:pwa` já lá estão). O servidor partilhado de
dados é outra coisa e **não** serve a interface — ver
[`deploy/SERVIDOR-PARTILHADO.md`](deploy/SERVIDOR-PARTILHADO.md).

## Testar num PC x86 (o que falta confirmar)

A app é construída num PC **Windows sobre ARM**, o que criou uma classe de bugs
que só aparecem noutros computadores: programas nativos (`.node`/`.dll`) que vão
com a arquitectura errada. Isso chegou a partir **todos os PC x86** (Intel/AMD).

A correcção foi feita e verificada emulado, mas **falta confirmar num PC x86 a
sério**. Se tens um, corre o script abaixo.

### O que o script faz

Não instala nada, não altera o PC, não manda nada para a net além de ler a
release do GitHub. Ele olha para os ficheiros e diz o que está certo e o que
está errado.

Para o correr **sem clonar o repositório** (recomendado — assim testas
exactamente o que o teu amigo vai instalar):

```powershell
iwr -useb https://gist.githubusercontent.com/boda07/7e23010eb543763de239ab1e7af0ffc0/raw -OutFile "$env:TEMP\verificar-x86.ps1"; powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\verificar-x86.ps1"
```

Com o repositório clonado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verificar-x86.ps1
```

### O que esperar

Cinco blocos. No fim, um veredicto: **TUDO CERTO**, **FUNCIONA, COM AVISOS**, ou
**HÁ PROBLEMAS**.

Os blocos são:

1. **Este PC** — confirma que é x86 (num PC ARM avisa, e o teste do nativo não se aplica).
2. **Os ficheiros na release** — qual é a versão mais recente no GitHub.
3. **O programa dentro do pacote** — a parte importante. Lê o cabeçalho de
   `MEIDA.exe` e do `node_datachannel.node` e diz se são do tipo certo, e
   varre `server/node_modules` à procura de mais algum com o tipo errado.
4. **O servidor interno** — arranca o servidor (sem abrir a janela), pergunta
   `/api/health`, e carrega o programa nativo e o WebTorrent a sério.
5. **O registo de arranque** — as últimas linhas de
   `%APPDATA%\streamapp\logs\arranque-*.log`, se existirem.

### Se der problemas

Copia-me a saída. Os casos possíveis:

| O que aparece | O que significa |
| --- | --- |
| `o programa nativo e' ARM64` | o pacote é do tipo errado — instala a release mais recente |
| `o programa nativo NAO carrega` mas o bloco 3 está certo | outra coisa; a resposta do Node vem logo abaixo |
| `o webtorrent nao arrancou` mas o nativo carregou | os torrents podem não funcionar, o resto da app sim |
| `o servidor NAO arrancou` | é o bug do arranque; o bloco 5 mostra o erro |

### Teste manual (o que o script não apanha)

O script confirma que os ficheiros e o servidor estão bem. **Isto só se confirma
a abrir a app:**

1. Abre a MEIDA pelo ícone do Menu Iniciar. A janela tem de aparecer com o
   catálogo — não uma janela preta.
2. Entra na tua conta.
3. Procura um filme e abre os **torrents**. Tenta reproduzir um que tenha
   seeders. Se começar a carregar, os binários nativos estão certos.

Se alguma das três falhar, diz-me o que vês e o que o bloco 5 do script
mostrou.

> O aviso `WebTorrent: uTP not supported Error: Cannot find module 'utp-native'`
> no registo é **normal e inofensivo** — só falta o transporte uTP por UDP, e o
> WebTorrent continua a funcionar por TCP e WebRTC.

## Licença

[MIT](LICENSE) — Copyright (c) 2026 Boda.
