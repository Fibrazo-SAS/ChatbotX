#!/usr/bin/env bash
# ChatbotX — control del entorno local (fork fibrazo/sysbrazo)
#
# UN solo script para todo el ciclo de vida del dev-stack:
#
#   bash scripts/start.sh           → limpia instancias previas + arranca todo (builder ya buildeado, rápido)
#   bash scripts/start.sh --build   → limpia + rebuild del builder + arranca (1ª vez o tras cambios)
#   bash scripts/start.sh --dev     → limpia + arranca con builder en modo dev (hot-reload, lento)
#   bash scripts/start.sh --stop    → solo apaga todo el dev-stack (no arranca nada)
#
# Siempre: apaga lo viejo ANTES de levantar nada (no pisa puertos 3123/1999
# ni deja procesos tsx/esbuild/workerd huérfanos).
set -uo pipefail

cd "$(dirname "$0")/.."   # raíz del repo

BUILD=0
MODE="prod"
STOP_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=1 ;;
    --dev) MODE="dev" ;;
    --stop) STOP_ONLY=1 ;;
    -h|--help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Arg desconocido: $arg (ver bash scripts/start.sh --help)"; exit 1 ;;
  esac
done

###############################################################################
# stop_stack — apaga TODO proceso del dev-stack de ChatbotX
#
# Detecta procesos por dos vías:
#   1) cmdline que menciona el path del proyecto (binarios de node_modules:
#      next, tsx workers, partykit, workerd, esbuild, concurrently, pnpm)
#   2) cwd dentro del proyecto (pnpm/next-server/`sh -c` sin el path en args)
#
# Protecciones — NUNCA toca: editor Cursor y extensiones, ngrok, MCPs,
# codegraph, shells interactivas, ni la cadena de ancestros de este script.
###############################################################################
stop_stack() {
  local PROJECT_DIR="$PWD"
  local SELF=$$

  # Ancestros de este script: protegidos (terminal/sesión que lo invoca)
  declare -A PROTECTED=()
  local p=$SELF
  while [ "$p" != "1" ] && [ -n "$p" ]; do
    PROTECTED[$p]=1
    p="$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')"
  done

  # cmdline sin fallar si el proceso ya murió (race de /proc)
  cmdline_of() { ( tr '\0' ' ' < "/proc/$1/cmdline" ) 2>/dev/null || true; }

  # Herramientas que viven en el proyecto pero NO son del dev-stack
  is_excluded() {
    case "$1" in
      *codegraph*|*cursor*|*ngrok*|*mcp-*|*npm\ exec*|*"@modelcontextprotocol"*) return 0 ;;
      *) return 1 ;;
    esac
  }

  # Solo binarios del stack dev
  is_dev_cmd() {
    case "$1" in
      *node_modules*|*/pnpm\ *|*/pnpm|*next-server*|*"next start"*|*"next dev"*|*turbo*|*concurrently*|*pino-pretty*) return 0 ;;
      *) return 1 ;;
    esac
  }

  local pids victims=() pid cmd target i alive
  local -a stubborn=()
  mapfile -t pids < <(
    {
      pgrep -f -- "$PROJECT_DIR" 2>/dev/null || true
      for proc in /proc/[0-9]*; do
        pid="${proc#/proc/}"
        target="$(readlink "$proc/cwd" 2>/dev/null || true)"
        case "$target" in
          "$PROJECT_DIR"|"$PROJECT_DIR"/*) echo "$pid" ;;
        esac
      done
    } | sort -n -u
  )

  for pid in "${pids[@]}"; do
    [ -z "$pid" ] && continue
    [ -n "${PROTECTED[$pid]:-}" ] && continue
    cmd="$(cmdline_of "$pid")"
    [ -z "$cmd" ] && continue                       # zombie / ya muerto
    is_excluded "$cmd" && continue
    is_dev_cmd "$cmd" || continue
    case "$cmd" in bash*|zsh*|fish*) continue ;; esac
    victims+=("$pid")
  done

  if [ "${#victims[@]}" -eq 0 ]; then
    echo "✓ No hay instancias previas del dev-stack."
    return 0
  fi

  echo "🔎 Deteniendo ${#victims[@]} procesos del dev-stack..."
  kill -TERM "${victims[@]}" 2>/dev/null || true

  # Hasta 6s de gracia (BullMQ cierra sockets/redis limpio)
  for i in $(seq 1 12); do
    alive=0
    for pid in "${victims[@]}"; do
      kill -0 "$pid" 2>/dev/null && alive=$((alive + 1))
    done
    [ "$alive" -eq 0 ] && break
    sleep 0.5
  done

  stubborn=()
  for pid in "${victims[@]}"; do
    kill -0 "$pid" 2>/dev/null && stubborn+=("$pid")
  done
  if [ "${#stubborn[@]}" -gt 0 ]; then
    echo "💀 ${#stubborn[@]} no respondieron → SIGKILL"
    kill -9 "${stubborn[@]}" 2>/dev/null || true
  fi
  echo "✓ Dev-stack apagado."

  # Verificación de puertos clave
  local port
  for port in 3123 1999; do
    if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "⚠  Puerto $port sigue ocupado: $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
    fi
  done
}

if [ "$STOP_ONLY" -eq 1 ]; then
  stop_stack
  exit 0
fi

echo "=== 0/6 Pre-limpieza: instancias previas ==="
stop_stack
echo ""

# Instala dependencias solo si falta algo (algún workspace sin node_modules).
# Detecta el caso de "tsdown: not found" / "node_modules missing" y lo resuelve solo.
ensure_install() {
  local need=0
  if [ ! -d node_modules ] || [ ! -x node_modules/.bin/turbo ]; then
    need=1
  else
    for dir in apps/* packages/* integrations/*; do
      if [ -f "$dir/package.json" ] && [ ! -d "$dir/node_modules" ]; then
        echo "  → falta node_modules en: $dir"
        need=1
      fi
    done
  fi
  if [ "$need" = "1" ]; then
    echo "=== 0/6 Dependencias: faltan paquetes, corriendo pnpm install ==="
    CI=true pnpm install --no-frozen-lockfile || { echo "❌ Falló pnpm install"; exit 1; }
  else
    echo "=== 1/6 Dependencias: OK ==="
  fi
}

ensure_install

echo "=== 2/6 Infraestructura (postgres/redis/s3) ==="
docker compose up -d postgres redis filesystem filesystem-init

echo "=== 3/6 ngrok (2 túneles) ==="
if ! pgrep -f 'ngrok start' >/dev/null 2>&1; then
  nohup ngrok start --all > /tmp/opencode/ngrok.log 2>&1 &
  sleep 5
  echo "ngrok arrancado"
else
  echo "ngrok ya estaba corriendo"
fi

echo "=== 4/6 URL del túnel chatbotx ==="
CHATBOTX_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
  | python3 -c "import json,sys; ts=[t for t in json.load(sys.stdin).get('tunnels',[]) if t.get('name')=='chatbotx']; print(ts[0]['public_url'] if ts else '')" 2>/dev/null)
if [ -z "$CHATBOTX_URL" ]; then
  echo "⚠ No encontré el túnel 'chatbotx'. Revisá ngrok (paso 3)."
else
  echo "URL chatbotx: $CHATBOTX_URL"

  echo "=== 5/6 Actualizar .env + webhook de Telegram ==="
  sed -i "s#^NEXT_PUBLIC_BROKER_URL=.*#NEXT_PUBLIC_BROKER_URL=${CHATBOTX_URL}#" .env

  BOT_TOKEN=$(docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -t -A \
    -c "SELECT auth->>'secretText' FROM \"IntegrationTelegram\" LIMIT 1;" 2>/dev/null)
  BOT_ID=$(docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -t -A \
    -c "SELECT \"botId\" FROM \"IntegrationTelegram\" LIMIT 1;" 2>/dev/null)
  if [ -n "$BOT_TOKEN" ]; then
    curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
      -H 'content-type: application/json' \
      -d "{\"url\":\"${CHATBOTX_URL}/integrations/telegram/webhook?botId=${BOT_ID}\"}" \
      | python3 -m json.tool
  else
    echo "⚠ Sin bot de Telegram conectado — salteo el webhook."
  fi
fi

echo "=== 6/6 Apps ==="
# worker + realtime (dev: livianos, no son los que demoran)
setsid env NODE_OPTIONS='--dns-result-order=ipv4first --no-network-family-autoselection' pnpm --filter worker dev > /tmp/opencode/worker-dev.log 2>&1 < /dev/null &
nohup pnpm --filter realtime dev > /tmp/opencode/realtime-dev.log 2>&1 &

# builder
if [ "$MODE" = "dev" ]; then
  echo "Builder en DEV (hot-reload, lento)..."
  nohup pnpm --filter builder dev > /tmp/opencode/builder-dev.log 2>&1 &
elif [ "$BUILD" = "1" ] || [ ! -f apps/builder/.next/BUILD_ID ]; then
  echo "Build del builder (tarda unos minutos la primera vez)..."
  # Build seguro: heap capado (el build del builder ya lo hace via
  # scripts/build-builder.mjs) + baja prioridad + 4 cores, para que no congele
  # la UI ni mate la máquina de 14GB cuando hay IDE/Docker abiertos.
  if ! NODE_OPTIONS="--max-old-space-size=4096" nice -n 19 taskset -c 0-3 pnpm exec turbo build --concurrency=2; then
    echo ""
    echo "❌ El build FALLÓ. NO arranco el builder."
    echo "   (worker y realtime ya quedaron corriendo en background)"
    echo "   Revisá el error de arriba. Si dice 'tsdown: not found' o"
    echo "   'node_modules missing', corré: pnpm install"
    exit 1
  fi
  setsid env NODE_OPTIONS='--dns-result-order=ipv4first --no-network-family-autoselection' pnpm --filter builder exec dotenv -e .env -e ../../.env -- next start -p 3123 \
    > /tmp/opencode/builder-prod.log 2>&1 < /dev/null &
else
  echo "Builder en PROD (ya buildeado)..."
  setsid env NODE_OPTIONS='--dns-result-order=ipv4first --no-network-family-autoselection' pnpm --filter builder exec dotenv -e .env -e ../../.env -- next start -p 3123 \
    > /tmp/opencode/builder-prod.log 2>&1 < /dev/null &
fi

echo ""
echo "✅ Listo."
echo "   Builder  → http://localhost:3123  (log: /tmp/opencode/builder-prod.log)"
echo "   Realtime → http://localhost:1999"
echo ""
echo "Verificar Telegram:"
echo "   docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c 'SELECT \"createdAt\", left(\"text\",40) FROM \"Message\" ORDER BY \"createdAt\" DESC LIMIT 3;'"
