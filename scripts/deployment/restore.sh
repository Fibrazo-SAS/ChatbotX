#!/bin/bash
set -eu

# Restore — después de un deploy FALLIDO: saca el maintenance y levanta las apps.
# Es el respaldo a nivel workflow del trap de deploy.sh (cubre el caso donde el
# runner muere a mitad de deploy y el trap no llega a correr). Idempotente.
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE, COMPOSE_FILES

: "${BASTION:?BASTION is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${SERVER:?SERVER is required}"
: "${WORKSPACE:?WORKSPACE is required}"

SSH_JUMP=(-J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no)

echo "Restoring apps after failed deploy on ${SERVER}"

# Maintenance OFF (si el build falló, el trap de deploy.sh ya lo hizo; esto re-asegura)
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" "rm -f ${WORKSPACE}/.maintenance"

# Apps up con las imágenes que haya (si el build falló, quedan las viejas)
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} up -d --no-deps builder worker realtime javascript-executor caddy || true"

echo "Restore completed on ${SERVER}"
