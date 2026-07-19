#!/bin/sh
set -eu

load_secrets() {
  for var in $(env | grep '^FILE__' || true); do
    var_name=$(echo "${var}" | cut -d= -f1)
    var_value=$(echo "${var}" | cut -d= -f2-)

    if [ ! -f "${var_value}" ]; then
      echo "Error: Secret file '${var_value}' does not exist"
      exit 1
    fi

    new_var_name="${var_name#FILE__}"
    if [ -n "$(eval echo \${$new_var_name:-})" ]; then
      echo "Warning: ${new_var_name} was already set and will be overwritten by ${var_name}"
    fi

    export "${new_var_name}=$(cat "${var_value}")"
  done
}

load_secrets
mkdir -p "${CONFIG_DIR:-/app/config}" "${BACKUP_DIR:-/app/backups}"
exec npm run start -w @jellyglance/api
