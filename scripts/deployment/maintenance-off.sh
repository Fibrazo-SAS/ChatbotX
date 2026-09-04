#!/bin/bash
set -eu

# Deshabilita maintenance mode en el server de ChatbotX (patrón portal: bastión)
#
# Variables de entorno (las pasa el workflow):
#   SSH_USER, BASTION, SERVER, WORKSPACE

echo "Disabling maintenance mode on ${SERVER}"

ssh -J "${SSH_USER}@${BASTION}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" \
  "rm -f ${WORKSPACE}/.maintenance"

echo "Maintenance mode disabled on ${SERVER}"
