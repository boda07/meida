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
