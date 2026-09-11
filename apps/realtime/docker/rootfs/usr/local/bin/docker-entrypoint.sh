#!/bin/bash

cd /app/apps/realtime;

# PartyKit `dev` does NOT read the container's process environment — it reads
# variables from a `.env` file on disk (findUpSync(".env") → dotenv) and injects
# them into the Worker's `process.env`. Since we stopped baking `.env` into the
# image (env is injected at runtime via env_file), materialize the vars the
# realtime server needs onto disk before starting.
: > .env
for var in REALTIME_BROADCAST_SECRET NEXT_PUBLIC_BUILDER_URL; do
  if [ -n "${!var}" ]; then
    printf '%s=%s\n' "$var" "${!var}" >> .env
  fi
done

NODE_OPTIONS=--no-node-snapshot HOSTNAME=${HOSTNAME:-0.0.0.0} PORT=${PORT:-1999} pnpm dlx partykit dev;
