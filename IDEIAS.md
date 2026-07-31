# Ideias / próximos passos

Lista de coisas que podemos alterar ou adicionar à MEIDA. Organizada por prioridade e categoria.

## Fiabilidade
- [x] **Mangá também no Tenrai** — `manga.js` usa o mesmo `jikanFetch` (já fica coberto pelo mirror), mas `getMangaGenres` usa `Promise.all` (mesmo bug do anime que o `allSettled` resolveu) — vale corrigir. *(feito: `getMangaGenresRaw` em `server/src/services/manga.js` usa `allSettled` + cache em disco)*
- [x] **Cache resiliente** — guardar respostas do Jikan/Tenrai em disco (pasta `data/`) para quando ambas as APIs estiverem em baixo o catálogo ainda abrir com dados em cache. *(feito: `server/src/services/cache.js` + `jikanFetch`)*
- [x] **Health-check dos providers** — teste periódico automático (ex.: 1x/dia) de todos os providers e sinalizar os mortos na UI, em vez de descobrir por tentativa/erro quando um título não dá. *(feito: `server/src/services/providerHealth.js` + rota `/api/providers/health`; frontend `web/src/components/useProviderHealth.js` — mortos riscados no seletor e saltados na escolha automática)*
- [x] **Timeouts mais baixos no pick/épisódios** — os ~4.9s da 1ª chamada com Jikan em baixo podem ser reduzidos com `tries: 1` no Jikan quando o mirror está ativo. *(feito: `JIKAN_RETRIES = 1` em `server/src/services/jikan.js` — 704ms vs ~4.2s)*

## Conteúdo / catálogo
- [x] **Filmes/séries não-anime com fallback** — hoje filmes dependem 100% do TMDB; adicionar fallback de detalhes via TMDB alternativo ou IMDb. *(feito: `tmdbFetch` resiliente — cada resposta fica em disco e, se o TMDB falhar (rede/5xx/chave), serve a última conhecida; séries têm fallback extra via TVMaze (`server/src/services/tvmaze.js` — detalhes + episódios por temporada, procura por título+ano do índice `tvidx` alimentado pelo catálogo e pela library)*
- [x] **Trailers** — no player ou nos detalhes, ligação ao trailer do TMDB (barato de implementar). *(feito: `web/src/components/Trailer.jsx` + `trailer` em `tmdb.js getDetails` e em `jikan.js getAnimeDetails` via `/anime/{id}/videos`)*
- [ ] **Temporadas do anime** — a página de detalhes de anime não mostra temporadas/episódios por temporada; o Jikan tem `/anime/{id}/episodes` e dá para agrupar por season.
- [ ] **Recomendações relacionadas** — "Se gostaste disto" nos detalhes (o TMDB e o Jikan ambos têm `/similar`).

## Experiência / UI
- [x] **Continue Watching no player** — já existe `ContinueWatching.jsx`; verificar se retoma mesmo a meio de um episódio ou só marca visto. *(feito: posição guardada via `POST /api/progress/position` (`setProgressPosition` em `store.js`); `VideoPlayer`/`HlsPlayer` recebem `startAt` (retoma no `loadedmetadata`) e `onProgress` (reporta ~1x/5s); `Details.jsx` calcula o `startAt` só para o mesmo episódio; cards com barra de progresso; limpa ao mudar de episódio/acabar)*
- [x] **Listas personalizadas** — criar listas próprias ("Para ver", "Favoritos", listas temáticas) além da Library. *(feito: `lists` no `server/src/store.js` + rotas `/api/lists...` em `routes/library.js`; frontend `web/src/components/AddToList.jsx` (botão "+ Lista" nos detalhes) + chips/gestão em `web/src/pages/Library.jsx`)*
- [ ] **Multi-perfil** — a app já tem auth; adicionar perfis por utilizador com progresso separado.
- [x] **Modo offline da Library** — abrir a Library e ver o que tens sem internet (com cache local). *(feito: `server/src/services/net.js` — deteção de rede (3 falhas → offline 60s, retry automático); `getMeta` do TMDB com cache em disco (30d); `/api/library` sem pedidos externos offline e devolve `online`; banner no frontend + posters quebrados caem no placeholder)*
- [x] **Atalhos de teclado no player** (F para fullscreen, ←/→ para saltar 10s, M para mute) — confirmar o que o HlsPlayer já tem. *(feito: `web/src/components/usePlayerShortcuts.js` ligado ao VideoPlayer e HlsPlayer)*
- [x] **Acessibilidade** — foco visível, contraste, aria-labels nos botões de ícones. *(feito: `:focus-visible` global em `styles.css`; aria-labels em botões de ícones (Library, nav-dice); `aria-hidden` em todos os SVGs decorativos; contraste das setas do hero)*

## Integrações novas
- [x] **MAL API v2 de verdade** — já há `mal.clientId/clientSecret` na config; a Library de anime hoje usa scraping do Jikan. Ligar a API oficial do MAL para listas/estado precisos. *(feito: OAuth2 PKCE + ligar/desligar em `server/src/routes/mal.js`; `importMalList` em `mal.js` (estado preciso: visto/ver/watchlist, nota pessoal, progresso, diário); `getMeanScores` usa a API oficial na Library; sync AUTOMATICO ao abrir a Library (máx. 6h, retry na falha) — AniList/Jikan ficam só como reserva para quem não liga o MAL)*
- [ ] **AniList sync** — importar/exportar listas entre MAL e AniList.
- [ ] **Trakt** — scrobble do que vês (alternativa ao Letterboxd para séries).
- [ ] **Telegram/notificações push** — avisar quando um título da lista sai um novo episódio.

## Operacional
- [ ] **Testes automatizados** — não há nenhum; pelo menos testes de integração do `jikanFetch` (mock do Jikan a falhar → Tenrai) e dos providers.
- [ ] **Lint** — não existe config de ESLint; adicionar para evitar regressões.
- [ ] **README / self-hosting docs** — o README está vazio; documentar setup, .env, build, release.
- [ ] **Logs estruturados + página de estado** — ver no servidor qual provider falhou para quê.
- [ ] **Migração Jikan→Tenrai completa** — quando o Jikan morrer (1-out-2026), inverter a ordem (Tenrai primeiro, Jikan fallback) ou remover o Jikan.

## Ideias de produto (mais ambiciosas)
- [ ] **Watch Party a funcionar sem Supabase** — hoje está ligado ao Supabase; alternativa self-hosted.
- [ ] **Extensão para o aniwatch-api local** — hoje o `ANIME_EXTRACTOR_BASE` aponta para um host; embeber no docker-compose.
- [ ] **Escolhe algo para mim por mood** — escolher por "quero rir" / "quero algo relaxante" mapeando géneros.
