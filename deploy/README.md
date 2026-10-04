# Alojar o MEIDA num servidor grátis (Oracle Cloud Always Free)

> **Queres grátis e SEM cartão?** Usa antes o guia
> [`SERVIDOR-PARTILHADO.md`](./SERVIDOR-PARTILHADO.md) (FadeHost, grátis, sem
> cartão, `/data` persistente). Esta página é a alternativa com **Oracle Cloud**
> — também é grátis, mas o registo **pede cartão só para verificação** (o
> *Always Free* não cobra).

Guia para pôr o **MEIDA** (web + API + base de dados) num servidor **sempre
ligado, grátis**, para tu e os teus amigos usarem a **mesma conta, biblioteca,
seguidores e comentários**. No fim ficas com um endereço do género
`https://meu-meida.duckdns.org` — e é esse o URL que a **app desktop** passa a
usar por defeito.

> Porque é que isto é preciso: cada app instalada arranca hoje um servidor
> **local** com a sua própria base de dados. Para os comentários/perfis se
> cruzarem, os dois têm de apontar para **o mesmo servidor**.

---

## Como funciona (visão geral)

```
  App (tu)     ─┐
                ├──►  https://meu-meida.duckdns.org  ──►  Caddy (HTTPS)  ──►  MEIDA (Node)  ──►  SQLite
  App (amigo)  ─┘        (DuckDNS)                        reverse proxy        :5175           server/data/meida.db
```

- **Caddy** trata do HTTPS automaticamente (Let's Encrypt).
- **DuckDNS** dá-te o subdomínio grátis.
- O MEIDA corre como serviço **systemd** (arranca sozinho e reinicia se cair).
- A app desktop liga-se a este servidor **por defeito** (modo remoto).

---

## 0. O que vais precisar

- Conta **Oracle Cloud** (Always Free). Pede cartão **só para verificação** — o
  *Always Free* não cobra.
- Conta **DuckDNS** (grátis, login com Google/GitHub).
- As tuas chaves do `server/.env` (TMDB, MAL, …).

---

## 1. Criar a máquina na Oracle

1. Regista-te em <https://www.oracle.com/cloud/free/> e entra na consola.
2. **Menu → Compute → Instances → Create instance**.
3. **Image:** Ubuntu 24.04.
4. **Shape:** *Ampere* → `VM.Standard.A1.Flex` — usa **1 OCPU / 6 GB** (podes
   subir até 4/24 sem custo). Se aparecer *"out of capacity"*, muda de
   *Availability Domain* ou de região e tenta outra vez.
5. **SSH keys:** deixa gerar e **descarrega a chave privada** (ou adiciona a tua
   pública).
6. **Create**. Quando estiver *Running*, anota o **Public IP address**.

### Abrir as portas 80 e 443 na Oracle

Ainda na consola: **Networking → Virtual Cloud Networks → (a tua VCN) →
Security Lists → Default Security List → Add Ingress Rules**:

| Source CIDR | IP Protocol | Destination Port Range |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

> A porta 5175 **não** precisa de ir à internet: fica só interna (o Caddy fala
> com ela em `127.0.0.1`).

---

## 2. DuckDNS (subdomínio grátis)

1. Entra em <https://www.duckdns.org> e faz login.
2. Cria um domínio, por exemplo `meu-meida` → fica `meu-meida.duckdns.org`.
3. Copia o teu **token** (aparece no topo da página).

---

## 3. Ligar à VM por SSH

No Windows (PowerShell), se usares a chave descarregada:

```powershell
ssh -i C:\caminho\chave.key ubuntu@<IP>
```

*(Na Oracle, a chave costuma vir em formato `.key`/OpenSSH. Se for `.pem`, igual.)*

---

## 4. Pôr o código no servidor e correr o bootstrap

**Na VM**, primeiro põe o projeto em `/opt/meida` (o repositório é público):

```bash
sudo git clone https://github.com/boda07/meida.git /opt/meida
cd /opt/meida
```

> Se o repositório for privado, usa um token:
> `sudo git clone https://<TOKEN>@github.com/boda07/meida.git /opt/meida`
>
> Em alternativa (sem git), copia do teu computador:
> `scp -i chave.key -r C:\Users\white\Documents\Meida ubuntu@<IP>:/tmp/meida`
> e depois `sudo mkdir -p /opt/meida && sudo cp -a /tmp/meida/. /opt/meida/`.

Agora instala tudo (Node 24, Caddy, utilizador, firewall):

```bash
sudo bash deploy/bootstrap.sh
```

---

## 5. Configurar o DuckDNS (atualização automática)

Edita `deploy/duckdns-update.sh` e põe o teu domínio (sem `.duckdns.org`) e o
token:

```bash
sudo nano /opt/meida/deploy/duckdns-update.sh
#   DUCKDNS_DOMAIN="meu-meida"
#   DUCKDNS_TOKEN="o-teu-token"
```

Instala o cron (a cada 5 minutos) e corre uma vez:

```bash
sudo chmod +x /opt/meida/deploy/duckdns-update.sh
sudo /opt/meida/deploy/duckdns-update.sh
( crontab -l 2>/dev/null; echo "*/5 * * * * /opt/meida/deploy/duckdns-update.sh >/dev/null 2>&1" ) | crontab -
```

Testa (deve responder `OK`): <https://www.duckdns.org>.

---

## 6. Configurar o servidor

### 6.1 Caddyfile

Edita `deploy/Caddyfile` e troca `SEU-SUBDOMINIO.duckdns.org` pelo teu:

```bash
sudo nano /opt/meida/deploy/Caddyfile
#   meu-meida.duckdns.org {
#     encode gzip
#     reverse_proxy 127.0.0.1:5175
#   }
```

### 6.2 `server/.env`

```bash
sudo cp /opt/meida/deploy/server.env.example /opt/meida/server/.env
sudo nano /opt/meida/server/.env
```

Preenche, **no mínimo**:

- **`JWT_SECRET`** — gera um com:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  > Guarda este valor. Se o mudares, todos têm de voltar a fazer login.
- **TMDB** (`TMDB_API_KEY` ou `TMDB_ACCESS_TOKEN`) — para o catálogo.
- Se usares MAL/AniList, atualiza os `*_REDIRECT_URI` para o teu domínio.

---

## 7. Instalar e arrancar

```bash
cd /opt/meida
sudo bash deploy/deploy.sh
```

Isto instala as dependências, compila o frontend, ativa o `systemd` + Caddy e
reinicia tudo. Verifica:

```bash
curl https://meu-meida.duckdns.org/api/health
# -> {"ok":true,"tmdbConfigured":true}
```

Logs em direto, se algo falhar:

```bash
journalctl -u meida -f
journalctl -u caddy -f
```

---

## 8. Levar os teus dados (contas/biblioteca)

Do **teu computador** para o servidor:

```powershell
scp -i C:\caminho\chave.key server\data\data.json ubuntu@<IP>:/tmp/data.json
```

Na **VM** (importa para a base; para o serviço antes):

```bash
sudo systemctl stop meida
sudo -u meida env DB_DIR=/opt/meida/server/data \
  node /opt/meida/server/src/db/import-json.js /tmp/data.json
sudo systemctl start meida
```

> Numa base nova isto corre à primeira. Se já houver utilizadores e quiseres
> importar na mesma, acrescenta `--force`.
> Apaga o `/tmp/data.json` no fim (tem hashes/tokens).

---

## 9. Pôr a app a ligar-se a este servidor

Há duas formas:

- **Automática (recomendado):** escreve o endereço em
  `electron/default-server.txt` (só o URL, numa linha), faz *bump* de versão +
  changelog e publica (`npm run app:publish`). No próximo update, as apps ligam-se
  sozinhas — os amigos não fazem nada.
- **Manual (instantâneo):** na app, **Definições → Servidor → Servidor remoto**,
  metes `https://meu-meida.duckdns.org` e *Guardar e reiniciar*. Útil para testar.

Se um amigo já tiver usado a app em modo *Este computador*, ele pode ter a
escolha gravada — nesse caso muda uma vez nas Definições (ou eu faço uma
migração que força o servidor novo).

---

## 10. Atualizar o servidor depois

Sempre que houver código novo:

```bash
cd /opt/meida
sudo git pull
sudo bash deploy/deploy.sh
```

---

## Resolução de problemas

| Sintoma | Causa provável |
|---|---|
| `https://…` não abre | Portas 80/443 fechadas na **Security List** da Oracle, ou o DuckDNS ainda não propagou. |
| Erro de certificado no Caddy | O domínio no `Caddyfile` não corresponde ao DuckDNS, ou a porta 80 está fechada (Let's Encrypt precisa dela). |
| `JWT_SECRET não está definido` nos logs | Falta `JWT_SECRET` no `server/.env`. |
| Catálogo vazio | `TMDB_API_KEY`/`TMDB_ACCESS_TOKEN` em falta no `server/.env`. |
| `out of capacity` na Oracle | Muda de Availability Domain/região, ou tenta mais tarde. |
| App não aparece ligada | Confirma o URL em Definições → Servidor; testa `/api/health` no browser. |

### Cópia de segurança (recomendado)

A base de dados é um ficheiro só:

```bash
sudo systemctl stop meida
sudo cp /opt/meida/server/data/meida.db /opt/meida/server/data/backup-$(date +%F).db
sudo systemctl start meida
```

Podes pôr isto num cron diário.
