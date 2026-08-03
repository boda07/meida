# AGENTS.md — Memória do projeto MEIDA

Instruções e contexto duradouro para assistentes de IA que trabalhem neste repo.

## Stack

- `server/` — backend Express (Node ESM), porta **5175**, corre com `npm run dev` (`node --watch`). Dados em `server/data/` (JSON + cache).
- `web/` — frontend React + Vite, porta **5173** (dev). Build → `web/dist/`, servido pelo backend (`SERVE_WEB=1`).
- `electron/` — app desktop (Electron) que arranca o backend com o Node embutido.
- UI em português (pt-PT). `#c90303` é a cor de destaque.

## Processo de release (importante)

1. Bump da versão em `package.json` (raiz) — ex.: `0.9.9`.
2. Atualizar o changelog da app: `web/src/changelog.js` (linguagem simples, sem termos técnicos, mais recente em cima).
3. Atualizar `CHANGELOG.md` (raiz) — changelog técnico, com secções e detalhes.
4. Commit + push.
5. **Publicar com binários**: `npm run app:publish` (usa `GH_TOKEN` — `gh auth token` resolve-o com scope `repo`; gera o instalador + `latest.yml` + `.blockmap` e faz upload para a release do GitHub; depois corre `scripts/prune-releases.mjs` que mantém só as 3 releases mais recentes).
6. O botão "Procurar atualização" da app depende dos **assets da release** (`latest.yml`). **NUNCA** criar a release só com `gh release create` sem binários — isso parte o auto-update (o electron-updater lê `https://github.com/boda07/meida/releases/latest/download/latest.yml`).

Se for preciso uma release apenas textual (notas), usar `gh release create` **depois** do `app:publish` com `--notes-file`.

## Regras de edição

- **Usar sempre a ferramenta `edit`** para alterar ficheiros. `Set-Content -replace` corrompe UTF-8 (partiu acentos/cedilhas no passado).
- **Não fazer `git push`** a menos que o utilizador peça explicitamente.
- Lint: `npm run lint` (ESLint, 0 erros esperado). Testes: `npm test` (backend, node:test). Build web: `npm run build` em `web/`.
- Verificar sempre lint/typecheck/build após alterações.

## Bugs corrigidos (não repetir erros)

- **"Continua a ver" abria no episódio 1**: causa = `<React.StrictMode>` (dev) consome `takeResumeEpisode()` 2x. Corrigido com `loadedSeasonRef` em `web/src/pages/Details.jsx` — a retoma só é aplicada na 1ª carga efetiva da temporada.
- **"Procurar atualização" não funcionava**: as releases v0.9.6–0.9.9 foram criadas só com notas (`gh release create` sem binários), sem `latest.yml`/instalador → o `electron-updater` falha a comparar versões. Corrigido publicando a v0.9.9 via `npm run app:publish` (que gera `MEIDA-Setup-x.x.x.exe`, `.blockmap` e `latest.yml` e os anexa à release). **Regra:** uma release destino de upgrade **precisa** de assets — nunca usar `gh release create` puro para uma versão que deve ser atualizável.

## Funcionalidades recentes

- **Notas pessoais 0-100** (antes 1-10): UI, servidor, importações MAL (`*10`), Letterboxd (`*10`), AniList (nativo 0-100), e migração dos dados antigos em `server/src/store.js` (guarda `meta.scoreScale = 100`, corre uma vez).
- **Jogo "Compara as tuas notas"** (`/compare`, link no `ProfileMenu.jsx`): pares de títulos vistos escolhidos ao acaso; ↑/↓ ajustam a nota de cada item (1 em 1); botão "Manter e próximo" no meio passa ao par seguinte.
- **"Comparar avaliação"** (`web/src/components/CompareRating.jsx`, botão na ficha): modal com o título atual de um lado e um título já visto (aleatório) do outro; ↑/↓ ajustam a nota do título atual.
- Estilos de comparação em `web/src/styles.css` (`.compare-*`, `.cmp-btn`). Atenção: a coluna central usa `align-self: stretch`; remover `order` dos itens do grid (o `order` reposiciona a coluna central para a direita).

## O que o utilizador pediu

- Página de redesenho de UI: ver `design_handoff_meida_home/README.md` (estilo "NOW/Sky").
- Sempre que terminar uma funcionalidade, perguntar se quer commit/push/release (ele costuma querer).
