#!/usr/bin/env bash
set -euo pipefail

export HOME="${HOME:-${RUNNER_TEMP:-/tmp}}"
SSH_DIR="${HOME}/.ssh"

mkdir -p "${SSH_DIR}"
chmod 700 "${SSH_DIR}"
echo -e "Host *\n\tStrictHostKeyChecking no\n\n" > "${SSH_DIR}/config"

if [ -w /etc/resolv.conf ] || sudo -n true 2>/dev/null; then
  echo "nameserver 8.8.4.4" | sudo tee /etc/resolv.conf >/dev/null
  echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf >/dev/null
fi
