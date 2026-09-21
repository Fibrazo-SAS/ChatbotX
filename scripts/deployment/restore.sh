#!/usr/bin/env bash
set -eu

# Restore — después de un deploy FALLIDO: saca el maintenance y levanta las
# apps (patrón deploy-v3: UNA sesión SSH).
#
# Es el respaldo a nivel workflow (cubre el caso donde el runner muere a mitad
# de deploy). Idempotente: si el build falló, quedan las imágenes viejas y
# `up` las levanta tal cual estaban.
#
# Expected environment variables (provided by the workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE, COMPOSE_FILES

: "${BASTION:?BASTION is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${SERVER:?SERVER is required}"
: "${WORKSPACE:?WORKSPACE is required}"

echo "Restoring apps after failed deploy on ${SERVER}"

ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" "
  set -eu
  export TERM=xterm;

  printf \"Changing to web directory '%s'\n\" ${WORKSPACE};
  cd ${WORKSPACE} || exit 1;

  echo 'Removing maintenance mode';
  rm -f ${WORKSPACE}/.maintenance;

  # Apps up con las imágenes que haya (si el build falló, quedan las viejas).
  echo 'Starting app containers';
  docker compose ${COMPOSE_FILES} up -d --no-deps builder worker realtime javascript-executor caddy || true;
"

echo "Restore completed on ${SERVER}"
