# Changelog

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
