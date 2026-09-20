#!/usr/bin/env bash
# Run on the Proxmox VE HOST to create an unprivileged Debian LXC and install JellyGlance.
# Usage:
#   bash create-lxc.sh
#   CTID=130 HOSTNAME=jellyglance bash create-lxc.sh
set -euo pipefail

CTID="${CTID:-}"
HOSTNAME="${HOSTNAME:-jellyglance}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
CORES="${CORES:-2}"
MEMORY="${MEMORY:-2048}"
SWAP="${SWAP:-512}"
DISK="${DISK:-8}"
BRIDGE="${BRIDGE:-vmbr0}"
PASSWORD="${PASSWORD:-}"  # empty => random
INSTALL_SCRIPT_URL="${INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/packaging/proxmox/install-in-lxc.sh}"

if ! command -v pct >/dev/null 2>&1; then
  echo "This script must run on a Proxmox VE host (pct not found)." >&2
  exit 1
fi

if [[ -z "${CTID}" ]]; then
  # next free ID starting at 100
  CTID=100
  while pct status "${CTID}" &>/dev/null; do
    CTID=$((CTID + 1))
  done
fi

if pct status "${CTID}" &>/dev/null; then
  echo "CT ${CTID} already exists." >&2
  exit 1
fi

if [[ -z "${PASSWORD}" ]]; then
  PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 18)"
  GEN_PASS=1
else
  GEN_PASS=0
fi

echo "Refreshing Debian template list..."
pveam update >/dev/null
TEMPLATE="$(pveam available -section system | awk '/debian-12-standard/ {print $2}' | tail -1)"
if [[ -z "${TEMPLATE}" ]]; then
  TEMPLATE="$(pveam available -section system | awk '/debian-13-standard|debian-12-standard/ {print $2}' | tail -1)"
fi
if [[ -z "${TEMPLATE}" ]]; then
  echo "Could not find a debian-*-standard template via pveam." >&2
  exit 1
fi
if ! pveam list "${TEMPLATE_STORAGE}" | grep -q "${TEMPLATE}"; then
  echo "Downloading ${TEMPLATE}..."
  pveam download "${TEMPLATE_STORAGE}" "${TEMPLATE}"
fi

echo "Creating CT ${CTID} (${HOSTNAME})..."
pct create "${CTID}" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "${HOSTNAME}" \
  --cores "${CORES}" \
  --memory "${MEMORY}" \
  --swap "${SWAP}" \
  --rootfs "${STORAGE}:${DISK}" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
  --unprivileged 1 \
  --features nesting=1,keyctl=1 \
  --ostype debian \
  --password "${PASSWORD}" \
  --start 1

# nesting required for Docker in unprivileged LXC
pct set "${CTID}" --features nesting=1,keyctl=1

echo "Waiting for network..."
sleep 5
pct exec "${CTID}" -- bash -lc 'apt-get update -y && apt-get install -y curl ca-certificates openssl'

echo "Installing JellyGlance inside CT ${CTID}..."
pct push "${CTID}" "$(dirname "$0")/install-in-lxc.sh" /root/install-in-lxc.sh 2>/dev/null \
  || pct exec "${CTID}" -- bash -lc "curl -fsSL '${INSTALL_SCRIPT_URL}' -o /root/install-in-lxc.sh"
pct exec "${CTID}" -- bash /root/install-in-lxc.sh

IP="$(pct exec "${CTID}" -- hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Done."
echo "  CTID:     ${CTID}"
echo "  Hostname: ${HOSTNAME}"
echo "  IP:       ${IP:-unknown}"
echo "  Web UI:   http://${IP:-<ct-ip>}:3000"
if [[ "${GEN_PASS}" -eq 1 ]]; then
  echo "  root pw:  ${PASSWORD}"
fi
echo "  App:      /opt/jellyglance inside the CT"
