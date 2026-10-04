# Servidor partilhado grátis (sem cartão) — "dados na nuvem"

Guia para pôr as **contas, biblioteca, diário, perfis, seguidores e comentários**
do MEIDA num servidor **grátis e sem cartão**, para tu e os teus amigos usarem a
mesma coisa em computadores diferentes.

> **Importante — o vídeo NÃO passa por aqui.** As fontes, torrents,
> Real-Debrid e o streaming continuam a correr **em cada computador**. Só sobem
> para a nuvem os **dados leves** (JSON/SQLite). Foi de propósito: assim o vídeo
> fica sempre rápido e nunca depende do servidor grátis.

---

## Como funciona

Cada app instalada arranca **sempre** um servidor **local** (é ele que serve o
interface e o vídeo). Quando o modo "dados na nuvem" está ligado, a app encaminha
**só** os pedidos de dados para o servidor partilhado:

```
   ┌─────────────── o teu PC / o PC do amigo ───────────────┐
   │  App (interface + vídeo + Real-Debrid) = servidor LOCAL │
   └───────────┬─────────────────────────────────────────────┘
               │  (só contas, biblioteca, diário, social, comentários)
               ▼
      https://meida-xxxx.fadehost.app      ← servidor PARTILHADO (grátis)
               │
               ▼
           SQLite  (/data/meida.db)
```

- **Local** (fica no PC): `/api/catalog`, `/api/details`, `/api/sources`,
  `/api/stream`, `/api/play`, `/api/torrents`, `/api/debrid`, `/api/wp`…
- **Partilhado** (vai para a nuvem): `/api/auth`, `/api/library`,
  `/api/progress`, `/api/social`, `/api/comments`, `/api/mal`, `/api/anilist`…

A app sabe distinguir sozinha; tu não configuras rotas.

---

## O que vais precisar

- Uma conta **FadeHost** (grátis, **sem cartão de crédito**) —
  <https://fadehost.com> → *Start free trial* / registo.
- O repositório **público** `github.com/boda07/meida` ligado à conta GitHub.
- (Opcional) As chaves do MyAnimeList / AniList, se usares essas ligações.

> **Alternativa** sem cartão: *velixir* (1 GB de disco, também hiberna). O
> processo é o mesmo: repositório + comando de arranque `node server/src/index.js`
> + variáveis abaixo. O FadeHost tem a vantagem de ter `/data` persistente
> documentado.

---

## Passo 1 — Criar a app no FadeHost

1. Regista-te em <https://fadehost.com> e entra no painel (*laplace*).
2. **App Hosting → New app**.
3. Liga o **GitHub** e escolhe o repositório **`boda07/meida`**.
4. Na configuração, define:
   - **Install command** (se o painel tiver): `npm --prefix server install --omit=dev`
   - **Build command:** `npm --prefix server install --omit=dev`
     (o servidor partilhado é só API — **não** precisa de compilar o `web`).
   - **Start command:** `node server/src/index.js`
   - **Node version:** **24** (o `package.json` já traz
     `"engines": { "node": ">=24" }` — se o painel perguntar, escolhe 24).
5. **Região:** a mais próxima de ti (ex.: *France* ou *Montreal*).

> **Porquê instalar só o `server`?** O `package.json` da raiz é da app de
> desktop (Electron); não queremos que o hosting instale/descarregue o Electron.
> Este comando instala apenas as dependências do backend.

---

## Passo 2 — Variáveis de ambiente

No painel, secção **Environment / Secrets**, adiciona:

| Nome | Valor | Obrigatório |
|---|---|---|
| `NODE_ENV` | `production` | Sim |
| `JWT_SECRET` | uma string aleatória longa (ver abaixo) | Sim |
| `DB_DIR` | `/data` | Sim |
| `ADMIN_TOKEN` | outra string aleatória (protege a migração) | Sim |
| `TMDB_API_KEY` *ou* `TMDB_ACCESS_TOKEN` | a tua chave TMDB | Recomendado |
| `MAL_CLIENT_ID` / `MAL_CLIENT_SECRET` | só se usares MAL | Opcional |
| `MAL_REDIRECT_URI` | `https://O-TEU-ENDERECO/api/mal/callback` | Se usares MAL |
| `ANILIST_CLIENT_ID` / `ANILIST_CLIENT_SECRET` | só se usares AniList | Opcional |
| `ANILIST_REDIRECT_URI` | `https://O-TEU-ENDERECO/api/anilist/callback` | Se usares AniList |

Gera os segredos no teu PC (PowerShell):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Não** definas `SERVE_WEB` nem `HOST` aqui. O servidor partilhado é só API
> (CORS ligado), e escuta em `0.0.0.0` por defeito.

Faz **Deploy**. No fim tens um endereço tipo
`https://meida-xxxx.fadehost.app`.

---

## Passo 3 — Confirmar que está a responder

Abre no browser (ou com `curl`):

```
https://meida-xxxx.fadehost.app/api/health
```

Deve responder:

```json
{"ok":true,"tmdbConfigured":true}
```

> Se estiver a hibernar, a primeira resposta pode demorar uns segundos — é
> normal no plano grátis.

---

## Passo 4 — Levar os teus dados (contas + biblioteca)

Isto copia a tua base **atual** (as contas e bibliotecas como estão agora, sem
as contas de teste já apagadas) para o servidor. **No teu PC**, na pasta do
projeto:

```powershell
# 1. Exporta a base local para um JSON (corre dentro de server/, usa server/data)
cd C:\Users\white\Documents\Meida
npm --prefix server run export:json -- "$env:TEMP\remote-seed.json"

# 2. Envia-a para o servidor (troca O-TEU-ENDERECO e O-TOKEN)
curl.exe -X POST "https://O-TEU-ENDERECO/api/admin/seed" `
  -H "x-admin-token: O-TOKEN" `
  -H "Content-Type: application/json" `
  --data-binary "@$env:TEMP\remote-seed.json"
```

Exemplo de resposta:

```json
{"ok":true,"scoreScale":100,"counts":{"users":4,"library":1453,...}}
```

> - O `x-admin-token` é o valor que puseste em `ADMIN_TOKEN`. Se estiver errado,
>   o servidor responde **404** (nem revela que a rota existe).
> - Se já tiveres dados lá e quiseres substituir, junta `?force=1` ao URL.
> - Apaga o `remote-seed.json` no fim (tem hashes de password e tokens).

---

## Passo 5 — Ligar a app a este servidor

Há duas formas.

### A) Para ti e para o amigo, automaticamente (recomendado)

1. Abre `electron/default-server.txt` e escreve lá **só** o endereço:
   ```
   https://meida-xxxx.fadehost.app
   ```
2. Faz *bump* de versão + `web/src/changelog.js` + `CHANGELOG.md` e publica:
   ```
   npm run app:publish
   ```

Na próxima atualização, qualquer instalação **nova** liga-se sozinha à nuvem —
o amigo só tem de atualizar a app, como pediste.

> Quem já tinha a app aberta em modo "Este computador" fica com a escolha
> antiga gravada; nesse caso muda uma vez em **Definições → Servidor**. (As
> instalações do amigo que nunca mexeram nas Definições ligam-se sozinhas.)

### B) Manual (para testar já)

Na app: **Definições → Servidor → Servidor remoto**, escreve o endereço e
*Guardar e reiniciar*.

---

## Passo 6 — O amigo

1. Instala/atualiza a app (a versão com o endereço lá dentro).
2. Abre e faz login com a conta dele (a que já existe na biblioteca partilhada).
3. Pronto: vê a mesma biblioteca, perfis e comentários. O vídeo corre no PC dele.

> **Se o amigo tiver coisas novas que ainda não estão na biblioteca:** antes de
> trocar de servidor, ele pode ir a **Definições → Exportar JSON** e guardar o
> ficheiro. Depois, já ligado à nuvem, usa **Importar** com esse ficheiro — a
> importação é um *merge* que não apaga o que já lá está.

---

## Manutenção

**Atualizar o código no servidor (quando houver versão nova do MEIDA):**
se o auto-deploy estiver ligado, faz *push* e ele reconstrói sozinho; senão,
carrega em *Deploy* no painel.

**Cópia de segurança:** o `FadeHost` dá acesso a ficheiros (file manager/SFTP).
Copia de tempos a tempos o ficheiro `/data/meida.db` (é a base toda).

**Voltar a semear / recuperar:** repete o Passo 4 com `?force=1`.

---

## Resolução de problemas

| Sintoma | Causa provável |
|---|---|
| O deploy falha no arranque | A usar Node < 24 (falta `node:sqlite`). Confirma Node **24**. |
| `JWT_SECRET não está definido` | Falta `JWT_SECRET` e `NODE_ENV=production`. |
| Os dados não aparecem no app | `default-server.txt` vazio numa release antiga, ou a app ficou em modo local. Vê Definições → Servidor. |
| Login do MAL/AniList volta atrás | `MAL_REDIRECT_URI`/`ANILIST_REDIRECT_URI` não apontam para o endereço deste servidor. |
| Primeira abertura lenta | O plano grátis hiberna; acorda à primeira chamada. |
| `/api/admin/seed` dá 404 | `ADMIN_TOKEN` não definido no servidor, ou o `x-admin-token` não bate certo. |
