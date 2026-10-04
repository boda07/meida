#!/usr/bin/env bash
# ============================================================================
#  MEIDA — preparar uma VM Ubuntu (Oracle Cloud Always Free) para alojar o app
# ============================================================================
#  Instala tudo o que é preciso e deixa o servidor pronto a receber o código:
#    - Node.js 24 (o mesmo runtime do node:sqlite usado pela base de dados)
#    - Caddy (reverse proxy + HTTPS automático)
#    - git e ferramentas de build
#    - utilizador de sistema "meida" e a pasta /opt/meida
#    - portas 80/443 abertas no firewall do sistema
#
#  Uso (na VM, depois de copiar/clonar o projeto):
#    sudo bash deploy/bootstrap.sh
#
#  É idempotente: podes correr de novo sem problemas.
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/meida}"
APP_USER="${APP_USER:-meida}"

if [[ $EUID -ne 0 ]]; then
  echo "Corre com sudo:  sudo bash deploy/bootstrap.sh" >&2
  exit 1
fi

echo "==> [1/6] Pacotes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git unzip build-essential python3 \
  iptables-persistent

echo "==> [2/6] Node.js 24"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
echo "    node $(node -v) | npm $(npm -v)"

echo "==> [3/6] Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi
echo "    $(caddy version)"

echo "==> [4/6] Utilizador de sistema e pastas"
id -u "$APP_USER" >/dev/null 2>&1 \
  || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
# Permite correr git (como root) numa pasta que pode ficar do utilizador "meida".
git config --system --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

echo "==> [5/6] Firewall do sistema (portas 80 e 443)"
iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
netfilter-persistent save >/dev/null 2>&1 || true

echo "==> [6/6] Pronto"
cat <<'FIM'

  Falta (ver deploy/README.md para o passo-a-passo):
    1) pôr o código em /opt/meida  (git clone + checkout da versão)
    2) criar o server/.env          (copiar de deploy/server.env.example)
    3) editar o deploy/Caddyfile    (o teu subdomínio DuckDNS)
    4) configurar o DuckDNS + cron
    5) correr  sudo bash deploy/deploy.sh

  Na Oracle, não te esqueças de abrir as portas 80 e 443 na Security List
  (Networking -> VCN -> Security Lists -> Default -> Add Ingress Rules).

FIM
