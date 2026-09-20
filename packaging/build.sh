#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="${ROOT}/packaging"
DIST="${PKG}/dist"
VERSION="$(node -p "require('${ROOT}/package.json').version" 2>/dev/null || echo dev)"
STAMP="$(date -u +%Y%m%d)"
NAME="jellyglance-packaging-${VERSION}-${STAMP}"
OUT="${DIST}/${NAME}"

rm -rf "${OUT}"
mkdir -p "${OUT}/unraid/templates" "${OUT}/proxmox"

cp -a "${PKG}/unraid/templates/." "${OUT}/unraid/templates/"
cp -a "${PKG}/unraid/docker-compose.yml" "${PKG}/unraid/.env.example" "${PKG}/unraid/templates.json" "${OUT}/unraid/"
cp -a "${PKG}/proxmox/." "${OUT}/proxmox/"
cp -a "${PKG}/README.md" "${OUT}/README.md"

# Validate XML if xmllint exists
if command -v xmllint >/dev/null 2>&1; then
  for f in "${OUT}/unraid/templates/"*.xml; do
    xmllint --noout "${f}"
    echo "OK xml: $(basename "${f}")"
  done
else
  # minimal well-formedness
  for f in "${OUT}/unraid/templates/"*.xml; do
    python3 -c "import xml.etree.ElementTree as ET; ET.parse('${f}'); print('OK xml:', '${f}'.split('/')[-1])"
  done
fi

# Shell syntax check
bash -n "${OUT}/proxmox/install-in-lxc.sh"
bash -n "${OUT}/proxmox/create-lxc.sh"
echo "OK shell scripts"

mkdir -p "${DIST}"
tar -C "${DIST}" -czf "${DIST}/${NAME}.tar.gz" "${NAME}"
(
  cd "${DIST}"
  sha256sum "${NAME}.tar.gz" > "${NAME}.tar.gz.sha256"
)
echo
echo "Built:"
echo "  ${DIST}/${NAME}.tar.gz"
echo "  ${DIST}/${NAME}.tar.gz.sha256"
ls -lh "${DIST}/${NAME}.tar.gz"
