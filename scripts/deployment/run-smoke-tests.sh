#!/usr/bin/env bash
set -eu

# Smoke tests — ChatbotX (patrón deploy-v3: UNA sesión SSH)
#
# El loop de retries corre DENTRO del server: una sola conexión SSH por job.
# (Antes era una conexión por intento — hasta 18 por deploy — y el bastión
# podía interpretar esa ráfaga como un ataque y bloquear la IP del runner.)
#
# Expected environment variables (provided by the workflow):
#   SSH_USER, BASTION, SERVER, PORT (default 3123)

: "${BASTION:?BASTION is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${SERVER:?SERVER is required}"

PORT="${PORT:-3123}"
RETRIES="${RETRIES:-18}"        # intentos (18 * 5s = 90s de espera máxima)
RETRY_DELAY="${RETRY_DELAY:-5}" # segundos entre intentos

echo "Running smoke tests on ${SERVER} (retries: ${RETRIES} x ${RETRY_DELAY}s)"

ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" "
  set -eu
  export TERM=xterm;
  HTTP_CODE='000';
  for i in \$(seq 1 ${RETRIES}); do
    HTTP_CODE=\$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:${PORT}/api/health || echo '000');
    if [ \"\${HTTP_CODE}\" = '200' ]; then
      break;
    fi;
    echo \"  attempt \${i}/${RETRIES}: builder health HTTP \${HTTP_CODE} (waiting ${RETRY_DELAY}s...)\";
    sleep ${RETRY_DELAY};
  done;
  printf 'Builder health: HTTP %s\n' \"\${HTTP_CODE}\";
  [ \"\${HTTP_CODE}\" = '200' ] || { echo 'SMOKE FAILED' >&2; exit 1; };
"

echo "Smoke tests passed on ${SERVER}"
