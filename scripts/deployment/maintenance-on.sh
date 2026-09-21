#!/bin/bash
set -eu

# Habilita maintenance mode en el server de ChatbotX (patrón portal: bastión)
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE

echo "Enabling maintenance mode on ${SERVER}"

ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" \
  "touch ${WORKSPACE}/.maintenance"

echo "Maintenance mode enabled on ${SERVER}"
