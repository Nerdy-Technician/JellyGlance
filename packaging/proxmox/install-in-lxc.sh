#!/usr/bin/env bash
# Run INSIDE a Debian/Ubuntu LXC (or VM) to install Docker + JellyGlance.
# Usage: curl -fsSL .../install-in-lxc.sh | bash
#    or: bash install-in-lxc.sh
set -euo pipefail

APP_DIR="${JELLYGLANCE_DIR:-/opt/jellyglance}"
COMPOSE_URL="${JELLYGLANCE_COMPOSE_URL:-https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/packaging/proxmox/docker-compose.yml}"
ENV_URL="${JELLYGLANCE_ENV_URL:-https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/packaging/proxmox/.env.example}"
IMAGE="${JELLYGLANCE_IMAGE:-ghcr.io/nerdy-technician/jellyglance:latest}"

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root (or sudo)." >&2
    exit 1
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "Docker + Compose already present."
    return
  fi
  echo "Installing Docker Engine + Compose plugin..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  # Works on Debian/Ubuntu; detect ID
  # shellcheck disable=SC1091
  . /etc/os-release
  CODENAME="${VERSION_CODENAME:-stable}"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
}

write_stack() {
  mkdir -p "${APP_DIR}/config" "${APP_DIR}/backups" "${APP_DIR}/postgres"
  if [[ -f ./docker-compose.yml ]]; then
    cp ./docker-compose.yml "${APP_DIR}/docker-compose.yml"
  else
    curl -fsSL "${COMPOSE_URL}" -o "${APP_DIR}/docker-compose.yml"
  fi
  if [[ ! -f "${APP_DIR}/.env" ]]; then
    if [[ -f ./.env.example ]]; then
      cp ./.env.example "${APP_DIR}/.env"
    else
      curl -fsSL "${ENV_URL}" -o "${APP_DIR}/.env"
    fi
    # Generate secrets if still placeholders
    if grep -q 'change-me\|replace-me' "${APP_DIR}/.env" 2>/dev/null; then
      PW="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
      JWT="$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)"
      sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${PW}/" "${APP_DIR}/.env"
      sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT}/" "${APP_DIR}/.env"
      echo "Generated POSTGRES_PASSWORD and JWT_SECRET in ${APP_DIR}/.env"
    fi
  fi
  # Optional image override
  if [[ -n "${IMAGE}" ]]; then
    sed -i "s|image: ghcr.io/nerdy-technician/jellyglance:.*|image: ${IMAGE}|" "${APP_DIR}/docker-compose.yml"
  fi
}

start_stack() {
  cd "${APP_DIR}"
  docker compose pull
  docker compose up -d
  echo
  echo "JellyGlance is starting."
  echo "  App dir:  ${APP_DIR}"
  echo "  Web UI:   http://$(hostname -I 2>/dev/null | awk '{print $1}'):${WEBUI_PORT:-3000}"
  echo "  Config:   ${APP_DIR}/.env"
  echo "Complete the first-run wizard in the browser (Jellyfin URL + API key)."
}

need_root
install_docker
write_stack
start_stack
