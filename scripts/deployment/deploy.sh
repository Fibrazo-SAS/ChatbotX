#!/bin/bash
set -eu

# Deploy — ChatbotX (patrón portal React: rsync desde el runner)
#
# 1. chown de la carpeta en el server
# 2. rsync del código desde el runner (que tiene el checkout)
# 3. En el server: .env desde AWS Secrets Manager
# 4. Build SECUENCIAL (de a una imagen — el server de 8GB no aguanta builds
#    en paralelo) + up
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE, SECRET_NAME, ENV

: "${BASTION:?BASTION is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${SERVER:?SERVER is required}"
: "${WORKSPACE:?WORKSPACE is required}"
: "${SECRET_NAME:?SECRET_NAME is required}"

RSYNC_EXCLUDE="${RSYNC_EXCLUDE:-rsync_exclude}"
SSH_JUMP=(-J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no)

echo "Deploying ChatbotX to ${SERVER} (${ENV})"

# 1. Permisos de la carpeta en el server (como deploy-portal.sh)
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && sudo chown ${SSH_USER}:www-data -R ${WORKSPACE}"


# 1.5 Maintenance mode ON (patrón portal): .maintenance es visible para Caddy.
#     El rsync ya no lo borra (está en rsync_exclude). El trap garantiza el OFF
#     aunque un build falle.
MAINTENANCE_ON() {
  ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" "touch ${WORKSPACE}/.maintenance"
}
MAINTENANCE_OFF() {
  ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" "rm -f ${WORKSPACE}/.maintenance"
}

MAINTENANCE_ON

# Si el deploy no llega al final (build que falla, ssh cortado), el trap
# restaura las apps viejas (un build fallido no pisa la imagen vieja) y
# saca el maintenance. Caddy queda arriba todo el tiempo sirviendo el 503.
RESTORE_NEEDED=1
restore_on_exit() {
  if [ "${RESTORE_NEEDED}" = "1" ]; then
    echo 'Deploy incomplete — restoring previous app containers...'
    ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
      "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} up -d --no-deps builder worker realtime javascript-executor caddy || true"
  fi
  MAINTENANCE_OFF
}
trap restore_on_exit EXIT

# 2. Sync del código (rsync desde el runner, igual que el portal)
/usr/bin/rsync \
  -e "ssh -J ${SSH_USER}@${BASTION} -o StrictHostKeyChecking=no" \
  -rlz --verbose --checksum --delete --itemize-changes \
  --exclude-from="${RSYNC_EXCLUDE}" \
  . "${SSH_USER}@${SERVER}:${WORKSPACE}"

# 3. En el server: .env desde AWS Secrets Manager
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" "
  set -eu
  cd ${WORKSPACE} || exit 1;

  echo 'Generating .env from AWS Secrets Manager';
  aws secretsmanager get-secret-value \
    --secret-id ${SECRET_NAME} \
    --region ${AWS_REGION:-us-west-2} \
    --query SecretString --output text \
    | python3 -c 'import sys, json; [print(f\"{k}={v}\") for k, v in json.load(sys.stdin).items()]' > .env;
"

# 3.5 Parar las apps viejas ANTES de compilar: el server (16GB) no aguanta el
#     build con el stack corriendo (el worker solo se come ~7GB). Si el stop
#     falla, el trap restaura y aborta limpio.
echo 'Stopping old app containers before build...'
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} stop builder worker realtime javascript-executor"

# 3.6 Prune de Docker ANTES del build: en este pipeline el cache de build no
#     rinde (el mount de pnpm no coincide con el store real y el source se
#     copia nuevo en cada build) y acumula GBs hasta llenar el disco del
#     server (fue la causa del ENOSPC en el apt-get del Dockerfile). Se limpia
#     el cache y solo capas dangling; las imágenes de los contenedores
#     actuales quedan intactas, así que el rollback del trap sigue disponible.
echo 'Pruning Docker build cache and dangling images before build...'
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "docker builder prune -af >/dev/null 2>&1 || true; docker image prune -f >/dev/null 2>&1 || true"

# 4. Build SECUENCIAL — una imagen a la vez para no saturar los 8GB
echo 'Building builder (1/4)...'
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} build builder"

echo 'Building worker (2/4)...'
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} build worker"

echo 'Building javascript-executor (3/4)...'
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} build javascript-executor"

echo 'Building realtime (4/4)...'
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} build realtime"

# 5. Levantar apps + storage con --no-deps (postgres/redis corren en systemd,
#    no los levantamos desde el compose — pero el proyecto necesita sus
#    definiciones para los depends_on). `filesystem` (rustfs) SÍ vive en Docker
#    y no tiene deploy propio, así que se levanta acá; `filesystem-init` es
#    idempotente (crea el bucket + public anónimo) y asegura que exista.
echo 'Starting app + storage containers (--no-deps)...'
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" \
  "cd ${WORKSPACE} && docker compose ${COMPOSE_FILES} up -d --no-deps filesystem filesystem-init builder worker realtime javascript-executor caddy"

RESTORE_NEEDED=0

echo "Deploy completed on ${SERVER}"
