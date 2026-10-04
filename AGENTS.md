# AGENTS.md — Memória do projeto MEIDA

Instruções e contexto duradouro para assistentes de IA que trabalhem neste repo.

## Stack

- `server/` — backend Express (Node ESM), porta **5175**, corre com `npm run dev` (`node --watch`). Dados em `server/data/` (JSON + cache).
- `web/` — frontend React + Vite, porta **5173** (dev). Build → `web/dist/`, servido pelo backend (`SERVE_WEB=1`).
- `electron/` — app desktop (Electron) que arranca o backend com o Node embutido.
- UI em português (pt-PT). `#c90303` é a cor de destaque.

## Numeração das versões (NUNCA saltar números)

A escala é **1–10**, não semver. O último número é um contador que vai de 0 a 9:

```
0.9.7 → 0.9.8 → 0.9.9 → 1.0.0 → 1.1.0 → 1.1.1 → ... → 1.1.9 → 1.2.0 → ... → 1.2.9 → 1.3.0
```

- **Cada release incrementa exatamente 1.** A próxima versão é quase sempre `MAIOR.MENOR + 1` (o patch).
- **Ao chegar a `.9`, o próximo é `.0` do minor seguinte** (`1.1.9` → `1.2.0`, `1.2.9` → `1.3.0`). É o que aconteceu em `0.9.9` → `1.0.0`.
- **Proibido saltar** (ex.: `1.1.3` → `1.2.0` saltou `1.1.4` a `1.1.9`). Mesmo para uma release grande: a partir de `1.1.3` a próxima era `1.1.4`, e só depois de `1.1.9` é que se sobe para `1.2.0`.
- Antes de bumpar, confirmar a última versão publicada: `gh api repos/boda07/meida/releases | ConvertFrom-Json | Select-Object -First 1 tag_name`, ou `node -p "require('./package.json').version"`.
- Excepção já consumida: a **1.2.0** foi publicada com este salto (6 versões em diante) e o utilizador mandou deixá-la assim. Não voltar a acontecer.

## Processo de release (importante)

1. Bump da versão em `package.json` (raiz) — **+1 segundo a regra de numeração acima** (ex.: `0.9.9`).
2. Atualizar o changelog da app: `web/src/changelog.js` (linguagem simples, sem termos técnicos, mais recente em cima).
3. Atualizar `CHANGELOG.md` (raiz) — changelog técnico, com secções e detalhes.
4. Commit + push.
5. **Publicar com binários**: `npm run app:publish` (usa `GH_TOKEN` — `gh auth token` resolve-o com scope `repo`; gera o instalador + `latest.yml` + `.blockmap` e faz upload para a release do GitHub; depois corre `scripts/prune-releases.mjs` que mantém só as 3 releases mais recentes).
6. O botão "Procurar atualização" da app depende dos **assets da release** (`latest.yml`). **NUNCA** criar a release só com `gh release create` sem binários — isso parte o auto-update (o electron-updater lê `https://github.com/boda07/meida/releases/latest/download/latest.yml`).

Se for preciso uma release apenas textual (notas), usar `gh release create` **depois** do `app:publish` com `--notes-file`.

## Regras de edição

- **Usar sempre a ferramenta `edit`** para alterar ficheiros. `Set-Content -replace` corrompe UTF-8 (partiu acentos/cedilhas no passado).
- **Nunca fazer `git push` sem o utilizador pedir primeiro.** Sempre que o utilizador autorizar push, é **obrigatório** atualizar a versão (`package.json` → `web/src/changelog.js` → `CHANGELOG.md`) **e** publicar a release do Git (tag + `gh release` com binários via `npm run app:publish`).**
- **A CHANGELOG DA APP (`web/src/changelog.js`) É OBRIGATÓRIA EM TODA A RELEASE.** Nunca fazer bump de versão / commit / release sem acrescentar a entrada dessa versão em `web/src/changelog.js` (linguagem simples, mais recente em cima) — é o que o utilizador vê no "o que mudou" dentro da app. Verificar SEMPRE que fica lá antes de qualquer push.

## Servidor partilhado (nuvem)

- Endereço: **`https://meida.fadehost.app`** (grátis, sem cartão, `/data` persistente, hiberna quando parado). Só dados — **vídeo é sempre local**.
- Está embutido no build em `electron/default-server.txt` (só o URL, uma linha). Precedência no `electron/main.cjs`: env `MEIDA_DEFAULT_SERVER` > ficheiro > "".
- Guardar: `JWT_SECRET`, `ADMIN_TOKEN` (rota `/api/admin/seed`), `TMDB_*`, `MAL_*`. Ver `deploy/SERVIDOR-PARTILHADO.md`.
- **`MAL_REDIRECT_URI` tem de ser `https://meida.fadehost.app/api/mal/callback`** no FadeHost **e** em myanimelist.net/apiconfig. Sem isto o OAuth do MAL volta para `localhost:5175` e falha.
- Migração de dados: `npm --prefix server run export:json -- saida.json` e depois `POST /api/admin/seed` com `x-admin-token`. O export **inclui** `user_tokens` (MAL/AniList/Letterboxd) mas **não** sessões JWT — é o certo, o remoto tem outro `JWT_SECRET`, por isso o utilizador entra uma vez com a senha normal.

## Bugs corrigidos (não repetir erros)

- **Release publicada sem `latest.yml` (auto-update partido)**: ao correr `npm run app:publish`, o GitHub devolveu `422 "Published releases must have a valid tag"` ao criar a release `v1.2.0`. Ficou a release publicada **só com o instalador** (1 asset em vez de 3) — sem `latest.yml` o botão "Procurar atualização" não funciona (o mesmo sintoma das v0.9.6–0.9.9). **Corrigido** correndo `npm run app:publish` outra vez: com a release já existente o electron-builder faz *update* em vez de *create* e envia os 3 assets. **Regra:** depois de publicar, confirmar `gh api repos/boda07/meida/releases` → a release nova tem de ter **3 assets** (`latest.yml`, `MEIDA-Setup-x.y.z.exe`, `MEIDA-Setup-x.y.z.exe.blockmap`), e `curl -sL https://github.com/boda07/meida/releases/latest/download/latest.yml` tem de devolver `version: <a que publicaste>`.
- **`gh` (GitHub CLI) não estava instalado** nesta máquina (`C:\Program Files\GitHub CLI`), logo `gh auth token` falhava e o `electron-builder --publish` não tinha `GH_TOKEN`. Instalado com `winget install --id GitHub.cli -e`; o login do utilizador é preciso **uma vez** (`gh auth login --web --git-protocol https`) e pode ser feito noutro terminal — o token fica no keyring do Windows.
- **"Continua a ver" abria no episódio 1**: causa = `<React.StrictMode>` (dev) consome `takeResumeEpisode()` 2x. Corrigido com `loadedSeasonRef` em `web/src/pages/Details.jsx` — a retoma só é aplicada na 1ª carga efetiva da temporada.
- **"Procurar atualização" não funcionava**: as releases v0.9.6–0.9.9 foram criadas só com notas (`gh release create` sem binários), sem `latest.yml`/instalador → o `electron-updater` falha a comparar versões. Corrigido publicando a v0.9.9 via `npm run app:publish` (que gera `MEIDA-Setup-x.x.x.exe`, `.blockmap` e `latest.yml` e os anexa à release). **Regra:** uma release destino de upgrade **precisa** de assets — nunca usar `gh release create` puro para uma versão que deve ser atualizável.

## Funcionalidades recentes

- **Notas pessoais 0-100** (antes 1-10): UI, servidor, importações MAL (`*10`), Letterboxd (`*10`), AniList (nativo 0-100), e migração dos dados antigos em `server/src/store.js` (guarda `meta.scoreScale = 100`, corre uma vez).
- **Jogo "Compara as tuas notas"** (`/compare`, link no `ProfileMenu.jsx`): pares de títulos vistos escolhidos ao acaso; ↑/↓ ajustam a nota de cada item (1 em 1); botão "Manter e próximo" no meio passa ao par seguinte.
- **"Comparar avaliação"** (`web/src/components/CompareRating.jsx`, botão na ficha): modal com o título atual de um lado e um título já visto (aleatório) do outro; ↑/↓ ajustam a nota do título atual.
- Estilos de comparação em `web/src/styles.css` (`.compare-*`, `.cmp-btn`). Atenção: a coluna central usa `align-self: stretch`; remover `order` dos itens do grid (o `order` reposiciona a coluna central para a direita).

## O que o utilizador pediu

- Redesenho de UI ("NOW/Sky") abandonado — `design_handoff_meida_home/` removido.
- Sempre que terminar uma funcionalidade, perguntar se quer commit/push/release (ele costuma querer).
- **NUNCA push sem autorização. Todo push ⇒ obrigatório bump de versão + tag + release no GitHub (com assets via `npm run app:publish`).**
- **LEMBRAR SEMPRE:** em cada release, atualizar PRIMEIRO a changelog da app em `web/src/changelog.js` (ver "Regras de edição" acima — é obrigatório, não é opcional).
- **Ideias e melhorias vivem em `IDEIAS.md`** (raiz). Quando o utilizador pedir ideias, consultar esse ficheiro primeiro e adicionar novas ideias lá. Marcar `[x]` as que forem feitas e mover para "Feitas".
