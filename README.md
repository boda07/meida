# StreamApp

App pessoal tipo Stremio: catalogo do TMDB + reproducao por *embed providers*
(VidSrc, 111movies, VidLink...). Torrents (WebTorrent) e conta de utilizador
ficam para fases seguintes — ver `.claude/plans/`.

## Stack
- **server/** — Node + Express. Proxy ao TMDB e montagem dos URLs de embed.
- **web/** — React + Vite. Catalogo, pesquisa, detalhe e player (iframe).

## Setup

1. Instala dependencias (raiz, server e web de uma vez):
   ```
   npm run install:all
   ```

2. Cria a chave do TMDB:
   - Regista em https://www.themoviedb.org/settings/api e copia a **API Key (v3)**.
   - Copia `server/.env.example` para `server/.env` e preenche `TMDB_API_KEY`.

3. Arranca tudo (server + web):
   ```
   npm run dev
   ```
   - Frontend: http://localhost:5173
   - Backend:  http://localhost:5175 (ex: http://localhost:5175/api/health)

## Streams sem anuncios (Consumet via Docker)

Os providers em iframe trazem anuncios. Para reproducao **sem anuncios** fiavel,
corre o extractor Consumet em Docker (ja incluido `docker-compose.yml`):

```
docker compose up -d consumet      # arranca em http://localhost:3000
```

Depois descomenta no `server/.env`:

```
EXTRACTOR_API_BASE=http://localhost:3000
```

e reinicia o `npm run dev`. O separador **Sem anuncios** na pagina de detalhe
passa a usar o Consumet (mais fiavel que os extractores best-effort). Para parar:
`docker compose down`.

## Definicoes (idioma, legendas, avatar)

No menu de perfil → **Definicoes** (`/settings`) podes escolher:
- **Titulos** em ingles ou portugues (independente das sinopses).
- **Sinopses** em portugues ou ingles.
- **Legendas** preferidas (PT/EN/desligadas) — ativadas automaticamente nos
  players proprios.
- **Separador inicial** (Providers / Sem anuncios / Torrents).
- **Avatar** (emoji predefinido ou URL de imagem) — requer login.

## App desktop (Electron)

A mesma UI corre numa janela desktop (estilo Stremio), sem mudar o site.

```
npm install            # instala tambem o electron (raiz)
npm run app:dev        # abre a app desktop em modo dev (server + web + janela)
```

- `app:dev` arranca o backend (5175) + Vite (5173) e abre a janela a apontar para
  o Vite (hot-reload incluido). Os popups dos providers ficam bloqueados na janela.
- Versao "produzida" (sem Vite): `npm run app` — compila o `web/` e o backend
  passa a servir o `web/dist`, com a janela a carregar tudo de `localhost:5175`.
- Empacotar num instalador `.exe`: `npm run app:pack` (usa electron-builder).

O processo principal esta em `electron/main.cjs`.

### Enviar a um amigo (sem programacao)

O instalador inclui **tudo** (frontend + backend + chaves do `.env`), por isso o
amigo nao precisa de instalar Node nem configurar nada — so instalar e abrir.

1. Gera o instalador:
   ```
   npm run app:pack
   ```
   Resultado: `release/StreamApp Setup <versao>.exe` (~90 MB).
2. Envia esse ficheiro `.exe` (WeTransfer, Google Drive, etc.).
3. O amigo faz duplo-clique, instala e abre o **StreamApp** como qualquer programa.
   - Cada pessoa tem a sua propria base de dados (watchlist/login), guardada em
     `%APPDATA%/StreamApp` — nao e partilhada.
   - O backend corre embutido na app; nao e preciso terminal nem alojamento.

> Nota Windows: se o `app:pack` falhar a extrair o `winCodeSign` ("Cannot create
> symbolic link"), ativa o **Modo de Programador** do Windows (Definicoes →
> Privacidade e seguranca → Para programadores) ou corre o terminal como
> Administrador, e tenta de novo.
>
> Aviso do SmartScreen: como o `.exe` nao esta assinado, o Windows pode mostrar
> "Windows protegeu o seu PC" — o amigo carrega em "Mais informacoes" → "Executar
> mesmo assim". (Assinar precisa de um certificado pago.)

### Atualizacoes automaticas (estilo Spotify)

Com `electron-updater` + GitHub Releases, o amigo instala **uma vez** e depois a
app **deteta, descarrega e instala** novas versoes sozinha — tu nao envias nada.

Ja esta configurado: repo **github.com/boda07/meida** (publico, so releases) e
`build.publish` no `package.json` a apontar para la. Autenticado via `gh`.

Lancar uma atualizacao (sempre que mudas algo):
1. Sobe a versao em `package.json` (ex.: `0.1.0` → `0.1.1`). **Tem de subir** ou
   o auto-update nao deteta.
2. Corre (PowerShell):
   ```powershell
   $env:Path += ";C:\Program Files\GitHub CLI"
   $env:GH_TOKEN = (gh auth token)
   $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
   npm run app:publish
   ```
   Compila e publica o instalador + `latest.yml` numa nova Release do GitHub.
3. A app do amigo (ja instalada) verifica no arranque, descarrega em fundo e
   pergunta "Reiniciar e atualizar". Feito — sem reinstalar, sem enviar ficheiros.

Primeira instalacao do amigo (uma so vez):
- Manda-lhe o `Setup.exe` **ou** o link: https://github.com/boda07/meida/releases/latest

## Usar como website (no browser)

A app desktop **ja inclui o website** (o backend serve o `web/dist`). Se quiseres
mesmo abrir no browser em vez da app:

- **Local:** corre `npm run app` (ou `SERVE_WEB=1` + `npm run start` no server) e
  abre `http://localhost:5175` no browser — so funciona nesse computador.
- **Para o amigo aceder pelo browser dele:** tens de **alojar** o backend algures
  com um URL (um VPS, Render/Railway/Fly, ou um tunel tipo Cloudflare Tunnel).
  Isso implica um endereco acessivel pela net (semi-publico). Por isso, para uso
  pessoal e privado, a **app desktop com auto-update** e a melhor opcao.

## Anime (MyAnimeList via Jikan)
A aba **Anime** usa a API publica do MyAnimeList (Jikan, sem chave) — listas
muito melhores que o TMDB. Ao abrir um anime, fazemos *match* para o TMDB
(por titulo/ano) para reutilizar os providers, torrents e legendas. Se nao houver
correspondencia no TMDB, mostramos os metadados mas sem fontes.

## Notas
- Os providers de embed mudam de dominio/formato com frequencia. Se um deixar
  de funcionar, ajusta os templates em `server/src/services/providers.js`.
- Os iframes dos providers trazem anuncios/popups e **nao** mostram as nossas
  legendas (sao paginas externas). Usa "Sem anuncios" ou "Torrents" para legendas.

## Roadmap
- **Fase A (feito):** catalogo + pesquisa + detalhe + player iframe.
- **Fase C (feito):** conta de utilizador (registo/login), marcar como visto e
  nota 1-10, pagina "A minha lista". DB em `server/data/app.db` (SQLite embutido
  no Node 24, sem dependencias nativas).
- **Fase B (feito):** torrents via Torrentio + WebTorrent, com player HTML5
  proprio e Range/seek. Separador "Torrents" na pagina de detalhe.
  - Nota: o browser so reproduz containers/codecs compativeis (mp4/x264). Ficheiros
    .mkv ou x265 podem nao tocar — escolhe um torrent 1080p mp4. Transcodificacao
    com ffmpeg fica para o futuro.
- **Extracao + legendas (feito):** separador "Sem anuncios" que extrai o stream
  direto (m3u8) e toca no player HLS proprio (hls.js), com proxy CORS/Referer em
  `/api/proxy`. Legendas via OpenSubtitles (precisa de `OPENSUBTITLES_API_KEY`) +
  as que vierem do extractor. Faixas de legenda tambem no player de torrents.
  - O extractor e *plugavel* e best-effort: `server/src/services/extractor/`. O
    `embedsu.js` tenta sem dependencias (fragil). Para algo fiavel, corre um
    extractor compativel com Consumet e define `EXTRACTOR_API_BASE` no `.env`.
- **App desktop (feito):** Electron embrulha a UI numa janela (estilo Stremio).
  `npm run app:dev` (dev) ou `npm run app` (produzido). Ver seccao acima.
