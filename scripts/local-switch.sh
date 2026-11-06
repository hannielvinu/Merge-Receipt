#!/usr/bin/env bash
# Bootstrap a loopback-only demo instance. Run from a Linux shell or WSL.
set -euo pipefail
umask 077
stack_dir="${SWITCH_STACK_DIR:-$HOME/merge-receipt-switch}"
mkdir -p "$stack_dir"
cd "$stack_dir"
release=https://raw.githubusercontent.com/sandbox-quantum/switch/switch-v0.31.0
if [[ ! -f compose.yml ]]; then
  curl -fsSL "$release/deploy/local/standalone-docker-compose.yml" -o compose.download
  mv compose.download compose.yml
fi
if [[ ! -f .env ]]; then
  curl -fsSL "$release/.env.example" -o .env.download
  sed -i -e 's/^SWITCH_VERSION=.*/SWITCH_VERSION=0.31.0/' \
    -e 's|^FRONTEND_BASE_URL=.*|FRONTEND_BASE_URL=http://localhost:3000|' .env.download
  for key in DB_PASSWORD DB_OWNER_PASSWORD AGENT_REGISTRATION_TOKEN GATEWAY_ADMIN_PASSWORD MATTERMOST_ADMIN_PASSWORD MATTERMOST_USER_PASSWORD; do
    sed -i "s|^${key}=.*|${key}=$(openssl rand -hex 24)|" .env.download
  done
  sed -i "s|^SECRET_KEYS=.*|SECRET_KEYS=receipt:$(openssl rand -hex 32)|" .env.download
  mv .env.download .env
fi
docker compose --progress quiet --profile collab --profile gateway up -d
docker compose --profile collab --profile gateway ps
printf '\nGateway: http://localhost:3000\nSwitch API: http://localhost:8000\nMattermost: http://localhost:8065\n'
printf 'Local credentials are in %s/.env\n' "$stack_dir"
