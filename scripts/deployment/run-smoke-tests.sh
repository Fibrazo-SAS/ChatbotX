#!/bin/bash
set -eu

# Smoke tests — ChatbotX (patrón portal: bastión)
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, PORT (default 3123)

PORT="${PORT:-3123}"

echo "Running smoke tests on ${SERVER}"

HTTP_CODE=$(ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" \
  "curl -sf -o /dev/null -w '%{http_code}' http://localhost:${PORT}/api/health" \
  || echo "000")

echo "Builder health: HTTP ${HTTP_CODE}"

if [ "${HTTP_CODE}" != "200" ]; then
  echo "SMOKE FAILED: builder health returned ${HTTP_CODE}" >&2
  exit 1
fi

echo "Smoke tests passed on ${SERVER}"
