#!/usr/bin/env bash
set -eu

# Habilita maintenance mode en el server de ChatbotX (patrón deploy-v3: bastión)
#
# Expected environment variables (provided by the workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE

: "${BASTION:?BASTION is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${SERVER:?SERVER is required}"
: "${WORKSPACE:?WORKSPACE is required}"

echo "Enabling maintenance mode on ${SERVER}"

ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" "
  set -eu
  export TERM=xterm;
  touch ${WORKSPACE}/.maintenance;
"

echo "Maintenance mode enabled on ${SERVER}"
