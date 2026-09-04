#!/bin/bash
set -eu

# Deploy — ChatbotX (patrón portal React: deploy-portal.sh)
#
# 1. chown de la carpeta en el server
# 2. rsync del código desde el runner (que tiene el checkout)
# 3. En el server: .env desde AWS Secrets Manager + docker compose up
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

# 2. Sync del código (rsync desde el runner, igual que el portal)
/usr/bin/rsync \
  -e "ssh -J ${SSH_USER}@${BASTION} -o StrictHostKeyChecking=no" \
  -rlz --verbose --checksum --delete --itemize-changes \
  --exclude-from="${RSYNC_EXCLUDE}" \
  . "${SSH_USER}@${SERVER}:${WORKSPACE}"

# 3. En el server: .env desde AWS Secrets Manager + levantar contenedores
ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" "
  set -eu
  cd ${WORKSPACE} || exit 1;

  echo 'Generating .env from AWS Secrets Manager';
  aws secretsmanager get-secret-value \
    --secret-id ${SECRET_NAME} \
    --region ${AWS_REGION:-us-west-2} \
    --query SecretString --output text \
    | python3 -c 'import sys, json; [print(f\"{k}={v}\") for k, v in json.load(sys.stdin).items()]' > .env;

  echo 'Building and starting containers';
  docker compose ${COMPOSE_FILES} up -d --build;
"

echo "Deploy completed on ${SERVER}"
