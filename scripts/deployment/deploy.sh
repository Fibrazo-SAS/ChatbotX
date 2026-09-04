#!/bin/bash
set -eu

# Deploy — ChatbotX (patrón portal React: SSH con bastión)
#
# Corre DESDE el runner. Se conecta al server saltando por el bastión
# (igual que deploy-portal.sh) y ejecuta: git pull + secret → .env + docker compose.
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE, SECRET_NAME, ENV

echo "Deploying ChatbotX to ${SERVER} (${ENV})"

SSH_JUMP=(-J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no)

ssh "${SSH_JUMP[@]}" "${SSH_USER}@${SERVER}" "
  set -eu
  cd ${WORKSPACE} || exit 1;

  echo 'Pulling latest code';
  git pull --ff-only;

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
