# Prompt para colar no Claude Code

Copia o texto abaixo (estando na raiz do teu projeto, com a pasta `design_handoff_meida_home/` lá dentro):

---

Tenho uma app de streaming em React + Vite na pasta `web/` (catálogo MEIDA, dados do TMDB).
Quero redesenhar a homepage para o visual descrito em `design_handoff_meida_home/README.md`
(estilo "NOW/Sky": nav flutuante em pílula, hero de ecrã inteiro com watermark, filas horizontais
de cartões com setas). Abre também o protótipo `design_handoff_meida_home/MEIDA-Home-reference.html`
no browser para veres o look & feel e as interações.

Regras:
- É um redesenho **visual de alta fidelidade**. Recria pixel-a-pixel os tokens, tipografia e espaçamentos do README.
- **Não** mudes a estrutura de rotas, o backend, nem o contexto de autenticação. A nav é Home/Movies/TV/Anime (já existe, sem Sports).
- Usa as **imagens reais** do TMDB nos cartões/hero via `imageUrl()` de `web/src/api/client.js` (substitui os gradientes-placeholder do protótipo).
- Cor de destaque: `#c90303`. Fontes: Archivo (títulos) + Manrope (UI) — adiciona-as via Google Fonts ou `@fontsource`.
- Mantém os meus componentes existentes e os padrões do código; reescreve só o que for preciso.

Ficheiros a alterar (ver README para detalhe de cada um):
`web/src/components/Header.jsx`, `Hero.jsx`, `MediaRow.jsx`, `MediaCard.jsx`,
`web/src/pages/Home.jsx`, `web/src/components/ProfileMenu.jsx`, `web/src/styles.css`.

Começa por me mostrar um plano curto (que classes CSS / props vais introduzir) antes de editares.

---
