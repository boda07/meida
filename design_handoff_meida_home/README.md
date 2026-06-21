# Handoff: MEIDA — Homepage redesign (estilo "NOW")

## Objetivo
Redesenhar a homepage da app **MEIDA** (a tua app React + Vite em `web/`) para o visual
do streaming "NOW/Sky" da referência: barra de navegação flutuante em **pílula**, **hero**
de ecrã inteiro com watermark gigante, e **filas horizontais** de cartões com setas.
A navegação é **Home · Movies · TV · Anime** (sem "Sports"). O teu código já tem Anime e
não tem Sports — por isto este handoff é sobre o **aspeto visual**, não sobre a estrutura de rotas.

## Sobre os ficheiros deste bundle
- `MEIDA-Home-reference.html` — protótipo **de referência em HTML** (abre no browser, é interativo).
  NÃO é código para copiar diretamente — é a fonte de verdade do *look & feel* e do comportamento.
  A tarefa é **recriar este design na tua app React existente**, usando os teus componentes e padrões.
- `MEIDA Home.dc.html` — o mesmo design, ficheiro-fonte (ignora a sintaxe `{{ }}`/`<sc-*>`; serve só de referência).

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos e interações são finais. Recria pixel-a-pixel.

## Stack alvo (já existe)
React 18 + Vite, `react-router-dom`, CSS em `web/src/styles.css`. Catálogo vem do backend (TMDB),
com `imageUrl(path,size)` em `web/src/api/client.js`. Posters/backdrops reais existem — usa-os nos cartões
(substituem os placeholders em gradiente do protótipo).

---

## Ecrãs / vistas

### 1. Barra de navegação (pílula flutuante) — `web/src/components/Header.jsx`
Substituir a barra superior atual por uma pílula **fixa, centrada no topo**.
- Posição: `position:fixed; top:18px; left:50%; transform:translateX(-50%); z-index:60`.
- Container: `display:flex; align-items:center; gap:6px; padding:7px; border-radius:999px;`
  `background:rgba(18,18,22,0.72); backdrop-filter:blur(20px);`
  `border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 34px rgba(0,0,0,0.5)`.
- Logo: quadrado 9×9 `border-radius:2px` com a cor de destaque, seguido de "MEIDA"
  em **Archivo 800**, 18px, `letter-spacing:-0.5px`.
- Links (NavLink): "Home / Movies / TV / Anime" — mapear para as tuas rotas `/`, `/movies`, `/series`, `/anime`.
  Cada um é um botão-pílula: `padding:9px 15px; border-radius:999px; font-weight:600; font-size:14px`,
  com **ícone** (16px, stroke) à esquerda.
  - Ativo: `background:#fff; color:#0a0a0b`.
  - Inativo: `background:transparent; color:rgba(255,255,255,0.82)`.
  (usar `NavLink` `isActive` para isto.)
- À direita: botão de **pesquisa** (lupa) circular 38px transparente, e botão de **perfil**
  (`ProfileMenu`) circular 38px `background:rgba(255,255,255,0.1)`.
- Ícones (linha, `stroke=currentColor stroke-width=2`): casa, filmstrip, monitor/TV, estrela (Anime), lupa, pessoa.

### 2. Hero — `web/src/components/Hero.jsx`
- Secção: `position:relative; min-height:90vh; display:flex; align-items:center; overflow:hidden`.
- Fundo: backdrop real do item em destaque (`imageUrl(item.backdrop,"w1280")`), `background-size:cover`.
  No protótipo é um `radial-gradient` escuro — na app usa a imagem.
- Scrims (dois sobrepostos):
  `linear-gradient(90deg, rgba(7,7,8,.94) 0%, rgba(7,7,8,.6) 42%, rgba(7,7,8,.1) 72%)` +
  `linear-gradient(0deg, #070708 1%, rgba(7,7,8,0) 42%)`.
- Watermark: título do item em **Archivo 900**, `clamp(70px,15vw,250px)`, `color:rgba(255,255,255,0.045)`,
  `position:absolute; right:2%; top:48%`, `letter-spacing:-6px`, `pointer-events:none`.
- Conteúdo (`max-width:640px; padding:0 clamp(28px,6vw,90px)`):
  - Eyebrow: ponto 7px da cor de destaque + texto tipo "MEIDA ANIME", 12px, 700, `letter-spacing:2.5px`, `rgba(255,255,255,.72)`.
  - H1: **Archivo 900**, `clamp(46px,7vw,92px)`, `line-height:.94`, `letter-spacing:-2px`.
  - Meta: 13px, 600, `rgba(255,255,255,.6)` (ex.: "2024 · 28 Episódios · M/14 · Fantasia").
  - Sinopse: 16px, `line-height:1.55`, `rgba(255,255,255,.82)`, `max-width:480px`.
  - Ações (`display:flex; gap:12px`):
    - **Play**: pílula branca `padding:14px 32px`, texto `#0a0a0b` 700 16px, ícone play preenchido. Liga ao `/details/...` (ou player).
    - **Mais info**: pílula `background:rgba(255,255,255,.16)`, texto branco, ícone (i).
    - **Mute**: círculo 50px com borda `1px solid rgba(255,255,255,.35)` (toggle do trailer/som).
- Chevron para baixo: círculo 44px centrado em baixo do hero, faz scroll suave para as filas.

### 3. Filas de conteúdo — `web/src/components/MediaRow.jsx` + `MediaCard.jsx`
- Secção das filas: sobe sobre o hero com `margin-top:-48px`, `padding:0 clamp(20px,4vw,60px) 110px`,
  `display:flex; flex-direction:column; gap:36px; z-index:5`.
- Cabeçalho de cada fila: título `font-size:21px; font-weight:800; letter-spacing:-0.3px` à esquerda,
  e **duas setas** circulares 34px (`‹ ›`) à direita que fazem `scrollBy({left: ±clientWidth*0.85, behavior:'smooth'})`.
- Track: `display:flex; gap:12px; overflow-x:auto; scroll-behavior:smooth` (esconder scrollbar).
- **Cartão** (`MediaCard`):
  - "Destaque/Trending/Continuar a ver" usam cartão **landscape** `width:300px; height:170px`.
  - As restantes filas usam **portrait** `width:184px; height:272px`.
  - `border-radius:11px; overflow:hidden; cursor:pointer`.
  - Imagem real do poster/backdrop a cobrir (`object-fit:cover`).
  - Scrim inferior: `linear-gradient(0deg, rgba(0,0,0,.82) 2%, rgba(0,0,0,0) 56%)`.
  - Badge opcional canto sup. esq. (ex.: "NOVO", "TOP 10"): `padding:4px 8px; border-radius:5px; font-size:10px; font-weight:800`, fundo = cor de destaque.
  - Rodapé: título 15px/800 + subtítulo 11px/600 `rgba(255,255,255,.6)`.
  - "Continuar a ver": barra de progresso 3px no fundo (`background:rgba(255,255,255,.25)` + preenchimento na cor de destaque).
  - Hover: `transform:translateY(-5px) scale(1.035); box-shadow:0 18px 44px rgba(0,0,0,.6)` com `transition:.25s`.

### 4. Filas a mostrar na Home — `web/src/pages/Home.jsx`
Ordem sugerida (mapear às `rows` do backend): **Em Tendência**, **Continuar a Ver**, **Anime Popular**,
**Novos Filmes**, **Séries para Ti**. As páginas Movies/TV/Anime mostram filas filtradas do mesmo tipo.

### 5. Overlay de pesquisa — `web/src/pages/Search.jsx` (ou novo overlay no Header)
Full-screen `background:rgba(7,7,8,.97); backdrop-filter:blur(10px)`, input gigante (28–30px, 700) com
borda inferior, e grelha de resultados `grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px`.

### 6. FAB (canto inf. direito)
Círculo 54px na cor de destaque com ícone sparkle (assistente). Opcional.

---

## Interações & comportamento
- Nav: troca de rota via `NavLink`; estado ativo muda o estilo da pílula.
- Setas das filas: scroll horizontal suave.
- Cartão: clique → `/details/:type/:id` (já existe).
- Play/Mais info no hero → detalhe/player.
- Mute: toggle de estado (som do trailer de fundo, se houver).
- Pesquisa: abre overlay; `onChange` filtra resultados.
- Perfil: dropdown (já tens `ProfileMenu.jsx`) — manter, ajustar ao novo estilo (cantos 14px, blur, fundo `rgba(20,20,26,.96)`).

## Design tokens
- Fundo app: `#070708`. Superfícies: `#101015`, `#15151b`.
- Texto: `#fff`; secundário `rgba(255,255,255,.6)`; eyebrow `rgba(255,255,255,.72)`.
- **Cor de destaque (accent): `#c90303`** (vermelho) — usada em logo, badges, barra de progresso, FAB, eyebrow dot.
- Tipografia: **Archivo** (700/800/900) para títulos/logo; **Manrope** (400–800) para UI/corpo.
  (importar de Google Fonts ou instalar `@fontsource/archivo` e `@fontsource/manrope`).
- Raios: nav/botões `999px`; cartões `11px`; modal `18px`; badges `5px`.
- Sombras: nav `0 10px 34px rgba(0,0,0,.5)`; cartão hover `0 18px 44px rgba(0,0,0,.6)`.
- Espaçamento filas: `gap:36px` vertical, `gap:12px` entre cartões.

## Notas
- Substitui todos os gradientes-placeholder por imagens reais do TMDB via `imageUrl()`.
- Mantém as tuas rotas/contexto de auth existentes — só muda apresentação.
- Os ícones do protótipo são SVGs inline simples (stroke). Podes usar a tua lib de ícones (`icons.jsx`).

## Ficheiros a alterar
- `web/src/components/Header.jsx` — barra em pílula.
- `web/src/components/Hero.jsx` — hero + watermark + ações.
- `web/src/components/MediaRow.jsx` — cabeçalho + setas + track.
- `web/src/components/MediaCard.jsx` — cartão landscape/portrait + badge + progresso + hover.
- `web/src/pages/Home.jsx` — ordem das filas.
- `web/src/components/ProfileMenu.jsx` — estilo do dropdown.
- `web/src/styles.css` — tokens, fontes, classes utilitárias.
