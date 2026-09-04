#!/bin/bash
set -eu

# Smoke tests — ChatbotX (patrón portal: bastión)
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, PORT (default 3123)

PORT="${PORT:-3123}"
RETRIES="${RETRIES:-18}"      # intentos (18 * 5s = 90s de espera máxima)
RETRY_DELAY="${RETRY_DELAY:-5}" # segundos entre intentos

echo "Running smoke tests on ${SERVER} (retries: ${RETRIES} x ${RETRY_DELAY}s)"

HTTP_CODE="000"
for i in $(seq 1 "${RETRIES}"); do
  HTTP_CODE=$(ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" \
    "curl -sf -o /dev/null -w '%{http_code}' http://localhost:${PORT}/api/health" \
    || echo "000")

  if [ "${HTTP_CODE}" = "200" ]; then
    break
  fi

  echo "  attempt ${i}/${RETRIES}: builder health HTTP ${HTTP_CODE} (waiting ${RETRY_DELAY}s...)"
  sleep "${RETRY_DELAY}"
done

echo "Builder health: HTTP ${HTTP_CODE}"

if [ "${HTTP_CODE}" != "200" ]; then
  echo "SMOKE FAILED: builder health returned ${HTTP_CODE} after ${RETRIES} attempts" >&2
  exit 1
fi

echo "Smoke tests passed on ${SERVER}"
