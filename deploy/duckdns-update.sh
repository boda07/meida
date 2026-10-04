#!/usr/bin/env bash
# Mantém o subdomínio DuckDNS a apontar para o IP público deste servidor.
# Corre em cron a cada 5 minutos (ver deploy/README.md).
set -euo pipefail

# Preenche estes dois valores (o domínio SEM ".duckdns.org"):
DUCKDNS_DOMAIN="SEU-SUBDOMINIO"
DUCKDNS_TOKEN="O-TEU-TOKEN"

curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=&verbose" >/dev/null
