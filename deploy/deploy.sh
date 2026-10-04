#!/usr/bin/env bash
# ============================================================================
#  MEIDA — instalar/atualizar o servidor (corre na VM, dentro de /opt/meida)
# ============================================================================
#    sudo bash deploy/deploy.sh
#
#  - instala as dependências (server + web)
#  - compila o frontend (web/dist)
#  - instala/atualiza o serviço systemd e o Caddy
#  - reinicia o backend
#
#  Para atualizar depois de novos commits:  git pull && sudo bash deploy/deploy.sh
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/meida}"
APP_USER="${APP_USER:-meida}"

if [[ $EUID -ne 0 ]]; then
  echo "Corre com sudo:  sudo bash deploy/deploy.sh" >&2
  exit 1
fi

cd "$APP_DIR"

if [[ ! -f server/.env ]]; then
  echo "Falta o server/.env. Copia de deploy/server.env.example e preenche." >&2
  exit 1
fi

echo "==> [1/4] Dependências do backend"
npm --prefix server install --omit=dev

echo "==> [2/4] Frontend (build)"
npm --prefix web install
npm --prefix web run build

echo "==> [3/4] Serviços (systemd + Caddy)"
install -m 644 deploy/meida.service /etc/systemd/system/meida.service
install -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

systemctl daemon-reload
systemctl enable --now caddy
systemctl enable meida
systemctl restart meida
systemctl reload caddy

echo "==> [4/4] Estado"
sleep 1
systemctl --no-pager --lines=5 status meida || true
echo
echo "Healthcheck local:"
curl -fsS http://127.0.0.1:5175/api/health || echo "  (ainda a arrancar; vê: journalctl -u meida -f)"
echo
