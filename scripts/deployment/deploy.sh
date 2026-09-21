set -eu

# Deploy — ChatbotX (patrón deploy-v3 de sysbrazo)
#
# 1. rsync del código desde el runner (que tiene el checkout)
# 2. En el server (UNA sola sesión SSH): permisos, .env desde AWS Secrets
#    Manager, stop de las apps viejas, prune y builds secuenciales + up.
#
# Maintenance mode es habilitado/deshabilitado por stages de CI dedicados
# (maintenance_on / maintenance_off), no por este script. Cuando corre, la app
# ya está en maintenance en el server. Un deploy fallido lo restaura el stage
# `restore` del workflow (scripts/deployment/restore.sh).
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE, SECRET_NAME, ENV, COMPOSE_FILES

: "${BASTION:?BASTION is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${SERVER:?SERVER is required}"
: "${WORKSPACE:?WORKSPACE is required}"
: "${SECRET_NAME:?SECRET_NAME is required}"

RSYNC_EXCLUDE="${RSYNC_EXCLUDE:-rsync_exclude}"

echo "Deploying ChatbotX to ${SERVER} (${ENV})"

# 1. Sync del código (rsync desde el runner, igual que el portal)
/usr/bin/rsync \
  -e "ssh -J ${SSH_USER}@${BASTION} -o StrictHostKeyChecking=no" \
  -rlz --verbose --checksum --delete --itemize-changes \
  --exclude-from="${RSYNC_EXCLUDE}" \
  . "${SSH_USER}@${SERVER}:${WORKSPACE}"

# 2. Post-sync setup + builds + up (UNA sola sesión SSH en el server)
ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" "
  set -eu
  export TERM=xterm;

  printf \"Changing to web directory '%s'\n\" ${WORKSPACE};
  cd ${WORKSPACE} || exit 1;

  echo 'Fixing workspace permissions';
  sudo chown ${SSH_USER}:www-data -R ${WORKSPACE};

  echo 'Generating .env from AWS Secrets Manager';
  aws secretsmanager get-secret-value \
    --secret-id ${SECRET_NAME} \
    --region ${AWS_REGION:-us-west-2} \
    --query SecretString --output text \
    | python3 -c 'import sys, json; [print(f\"{k}={v}\") for k, v in json.load(sys.stdin).items()]' > .env;

  echo 'Stopping old app containers before build';
  docker compose ${COMPOSE_FILES} stop builder worker realtime javascript-executor;

  # Prune ANTES del build: en este pipeline el cache de build no rinde (el
  # mount de pnpm no coincide con el store real y el source se copia nuevo en
  # cada build) y acumula GBs hasta llenar el disco del server (fue la causa
  # del ENOSPC en el apt-get del Dockerfile). Se limpian solo capas dangling;
  # las imágenes de los contenedores actuales quedan intactas.
  echo 'Pruning Docker build cache and dangling images';
  docker builder prune -af >/dev/null 2>&1 || true; docker image prune -f >/dev/null 2>&1 || true;

  # Build SECUENCIAL — una imagen a la vez para no saturar la RAM del server.
  echo 'Building builder (1/4)...';
  docker compose ${COMPOSE_FILES} build builder;

  echo 'Building worker (2/4)...';
  docker compose ${COMPOSE_FILES} build worker;

  echo 'Building javascript-executor (3/4)...';
  docker compose ${COMPOSE_FILES} build javascript-executor;

  echo 'Building realtime (4/4)...';
  docker compose ${COMPOSE_FILES} build realtime;

  # postgres/redis corren en systemd (no se levantan desde el compose, pero el
  # proyecto necesita sus definiciones para los depends_on). `filesystem`
  # (rustfs) sí vive en Docker y no tiene deploy propio, así que se levanta acá;
  # `filesystem-init` es idempotente (crea el bucket + public anónimo).
  echo 'Starting app + storage containers (--no-deps)...';
  docker compose ${COMPOSE_FILES} up -d --no-deps filesystem filesystem-init builder worker realtime javascript-executor caddy;
"

echo "Deploy completed on ${SERVER}"
