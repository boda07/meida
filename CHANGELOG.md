# Changelog

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
