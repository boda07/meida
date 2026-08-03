# IDEIAS — MEIDA

Lista viva de ideias para a app. Marca com `[x]` as que forem feitas e move-as
para a secção "Feitas".

## Estatísticas / perfil
- [ ] Página de **estatísticas** (`/stats`): distribuição das notas (histograma), nº de títulos visto/assistidos, tempo total gasto, género mais visto, "nota mais dada", década favorita.
- [ ] **Resumo anual/personalizado** ("o teu ano em revisão"): totais por mês, gráficos, top do ano — estilo Spotify Wrapped.

## Library / notas
- [ ] **Barra de nota visual** nos cartões (gradiente colorido por nota).
- [ ] **Marcar como visto ao dar nota** (uma ação única).
- [ ] **Vista timeline**: ordenar por data em que viste, com linhas cronológicas.

## Recomendações / descoberta
- [ ] **Notifica quando sai próximo episódio** dos teus em seguimento.
- [ ] **Top semanal**: ranking da tua lista por trending ou nota.
- [ ] **"Podias gostar"**: recomendações baseadas nas notas altas (similaridade de géneros/tags).

## Multi-utilizador / social
- [ ] **Estadísticas comparadas com a média dos utilizadores** (rating global por título).
- [ ] **Listas públicas/compartilháveis** (link para mostreres a tua biblioteca).

## Player / visual
- [ ] **Modo cinema**: player em fullscreen com UI limpa e auto-hide dos controlos. **(Decidido: o fullscreen/auto-hide nativo do `<video>` chega — não fazer.)**
- [ ] **Dark mode unificado** + tema custom por utilizador (a app já é maioritariamente escura; falta terminar).
- [ ] **Bookmarks/timestamps por episódio** (notas de episódio, não só da série).

## UX / fluxos rápidos
- [x] **Quick add à library** dos cartões do catalogo (home/search/category): ícone `+` no canto — adiciona à watchlist ou marca como visto sem abrir a ficha, com optimistic update. (`LibraryContext`, `MediaCard.jsx`). Também mostra as badges de visto/watchlist em todos os cartões.
- [ ] **Keyboard shortcut "o"** para marcar visto/nota na Library (como no /compare).

## Importação / dados
- [x] **Exportar a tua biblioteca/diário (CSV/JSON)** — botão nas Definições → "Os teus dados". JSON para backup, CSV para Excel/Sheets. Servidor entrega JSON em `GET /api/export`; o CSV é gerado no browser.
- [ ] **Filtrar Library por nota/estado/tipo** (mais filtros no `LibraryControls`).

## Gamificação
- [x] **Sistema de conquistas/badges** — página `/achievements` + link no menu. Badges calculados a partir da library/diário (Primeiro passo, Matiné, Cinéfilo, Maratonista, Otaku, Crítico, Biblioteca, Centenário, …) com ícones SVG (sem emojis).
- [x] **Streak/racha diária** — dias consecutivos com atividade (baseado nas datas do diário/progresso e da library); racha atual + melhor racha.

---

## Melhorias já feitas (para referência)
- Compara as tuas notas (`/compare`), Comparar avaliação (`CompareRating`), Notas 0-100, export CSV/JSON, gamificação (badges + streak), quick-add nos cartões, comparar com a comunidade.