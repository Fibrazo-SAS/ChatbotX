# Runbook — Levantamiento del servidor DEV ChatbotX (2026-09-04)

> Documenta TODO lo que se hizo/tuvo que modificar para levantar el entorno dev
> desde cero. Sirve de base para levantar PRODUCCIÓN (ver checklist final).
> Código: `Fibrazo-SAS/Fibrazo-ChatbotX` (privado) — el deploy corre desde `main`.

---

## 1. Infraestructura REAL del server dev (diferencias vs `requisitos-chatbotx-dev.md`)

| Recurso | Lo que decían los requisitos | La REALIDAD |
|---|---|---|
| SO | Ubuntu 24.04 | **Debian 12 (bookworm)** |
| Instancia | c7i.xlarge 8GB RAM | c7i.xlarge **16GB RAM** (ampliado 2026-09-07) + **swap 11GB** (colchón, ver §4.1 y §4.5) |
| IP privada | — | `ip-10-6-3-11.us-west-2.compute.internal` |
| IP pública | — | `35.87.134.232` |
| Postgres | Docker (timescale pg18) | **systemd** `postgresql@16-main` (PostgreSQL 16, decidido con Agus) |
| Redis | Docker | **systemd** `redis-server` |
| Storage | RustFS en Docker | RustFS en Docker (puerto 9000) — funciona |
| Dominio | — | `dev-chatbotx.fibrazo.com.co` → Caddy (en el repo) |
| Acceso admin | Teleport | Teleport (`tsh ssh manager@dev-chatbotx-sysbrazo`); el deploy usa SSH por **bastión** `bhdev.fibrazo.com.co` |

**Lección:** los requisitos escritos "en teoría" NO coincidían con lo que Fer entregó.
El server venía con Postgres 16 + Redis en systemd, sin DB de aplicación creada.

## 2. Base de datos — Postgres (lo que hubo que hacer MANUAL en el server)

Datos de Fer (especificación): `chatbotxdb` / `dev_chatbotx_adm` / `fe3Poos1`.

**La DB NO existía.** Se creó así (como root en el server):

```bash
sudo -u postgres psql -c "CREATE USER dev_chatbotx_adm WITH PASSWORD 'fe3Poos1';"
sudo -u postgres psql -c "CREATE DATABASE chatbotxdb OWNER dev_chatbotx_adm;"
sudo -u postgres psql -c "ALTER USER dev_chatbotx_adm SUPERUSER;"   # pgvector requiere superuser
```

Config de red (para que los CONTENEDORES Docker lleguen al postgres del host):

```bash
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = '*'            # antes: 'localhost'

# /etc/postgresql/16/main/pg_hba.conf (agregar)
host  all  dev_chatbotx_adm  172.16.0.0/12  scram-sha-256

systemctl restart postgresql@16-main
```

**Extensión pgvector:** el paquete `postgresql-16-pgvector` YA estaba instalado
(`0.8.6-1.pgdg12+1`). El error "vector is not available" se resolvió al crear el
user como SUPERUSER (pgvector no es "trusted"). Las migraciones crean las tablas solas.

## 3. Red Docker — EL problema central: `localhost` ≠ host

**Síntoma:** `Database migration failed: connect ECONNREFUSED 127.0.0.1:5432`
(dentro del contenedor, `localhost` es el propio contenedor).

**Fix:** las URLs del secret apuntan a `host.docker.internal` en vez de `localhost`.
`docker-compose.apps.yml` YA tiene `extra_hosts: ["host.docker.internal:host-gateway"]`.

| Variable | Valor final (dev) |
|---|---|
| `DATABASE_URL` | `postgresql://dev_chatbotx_adm:fe3Poos1@host.docker.internal:5432/chatbotxdb?schema=public` |
| `REDIS_URL` | `redis://host.docker.internal:6379` |
| `S3_ENDPOINT` | `http://host.docker.internal:9000` |
| `SMTP_SERVER` | `smtp://username:password@host.docker.internal:1025` |

> El `update-secret` vía CLI da `AccessDenied` (rol `sysbrazo-dev-secrets-reader` es
> SOLO lectura). Cambios al secret se hacen por **consola AWS** → Secrets Manager.

## 4. Problemas del build/deploy y sus fixes (orden cronológico)

### 4.1 OOM del `next build` → swap 11GB
- **Síntoma:** `Command was killed with SIGKILL` en "Collecting page data" (~13 min de build).
- **Evidencia:** `dmesg | grep killed` → `Out of memory: Killed process (next-build)` (~7.4GB anon-rss).
- **Fix:** swapfile de 11GB en el server (`fallocate -l 11G`, `mkswap`, `swapon`, fstab).
- **Para PROD:** 16GB de RAM real (c7i.2xlarge) o buildear fuera (CI → ghcr.io).

### 4.2 Smoke test `HTTP 000000` → retries
- **Síntoma:** el health check corría ~2s después de arrancar el contenedor → no escuchaba.
- **Fix:** `scripts/deployment/run-smoke-tests.sh` con 18 retries × 5s (90s).

### 4.3 Compose vs systemd → `up -d --no-deps`
- El compose define postgres/redis pero corren en systemd. Levantar apps:
  `docker compose ... up -d --no-deps builder worker realtime javascript-executor caddy`
- No usar `profiles: never` (rompe `depends_on`: "depends on undefined service").

### 4.4 Caddy (dominio + HTTPS) — versionado en el repo
- El server no escuchaba en 80/443 → `Connection refused` en el dominio.
- **Fix:** `Caddyfile` + servicio `caddy` en `docker-compose.dev.yml` (mismo patrón que prod.yml).
  Caddy genera el certificado Let's Encrypt solo (requiere 80 y 443 abiertos en SG).

### 4.5 Segundo deploy → server CONGELADO (swap thrash) → fixes estructurales (2026-09-07)

- **Síntoma:** en el 2º deploy el server se trabó entero (hasta SSH). No fue un OOM limpio:
  el build nuevo competía con las apps viejas corriendo (el worker solo ≈7GB), la RAM se llenó,
  el kernel volcó a swap **en el mismo disco donde Docker escribía capas** → swap thrash → máquina congelada.
- **Fixes aplicados:**
  1. Instancia ampliada a **16GB RAM** + swap reconectado con `vm.swappiness=10`
     (swap solo como último recurso, no thrash agresivo).
  2. `scripts/deployment/deploy.sh`: se **paran las apps viejas** (`stop builder worker realtime javascript-executor`)
     ANTES de compilar → el build corre con ~15GB libres. Caddy queda arriba (mantiene el 503).
  3. `deploy.sh`: el trap ahora **restaura las apps viejas** si el deploy no termina
     (un build fallido no pisa la imagen vieja: `docker compose build` solo re-tagea al terminar)
     y saca el maintenance → nunca más sitio en 503 eterno por un deploy fallido.
  4. `docker-compose.apps.yml`: `mem_limit` a las apps (builder `2g`, worker `8g`, realtime `1g`)
     → un contenedor desbocado muere solo, no mata al server.
- **No aplicado (decisión):** `NODE_OPTIONS=--max-old-space-size=4096` del Dockerfile del worker
  se mantiene — con 16GB + swap hay margen.

### 4.6 Builder en crash-loop `ENETUNREACH 172.17.0.1:5432` (2026-09-07)

- **Síntoma:** `docker ps` → `chatbotx-builder-1  Restarting (1)`; `docker logs` →
  `Database migration failed: connect ENETUNREACH 172.17.0.1:5432` (exit 1, loop de ~30s).
- **Causa:** el `DATABASE_URL` del secret apuntaba a `172.17.0.1` (gateway del **bridge default**
  de Docker `docker0`). El builder está en la red `chatbotx-network` (bridge custom) → esa IP
  **no es una ruta** desde ahí → `ENETUNREACH`. El worker no crashea porque reintenta en silencio;
  el builder sí (migrar es lo primero que hace al arrancar).
- **Fix:** el secret debe usar `host.docker.internal` (ver §3). `172.17.0.1` solo es válido
  desde contenedores del bridge default. Revisar en consola AWS → Secrets Manager.

### 4.7 Websocket caído — realtime (PartyKit) no arranca + rewrite `/ws` horneado en build (2026-09-11)

- **Síntoma:** el chat en vivo no actualiza en tiempo real. El builder loguea
  `Failed to proxy http://localhost:1999/parties/workspaces/... ECONNREFUSED 127.0.0.1:1999`.
- **Dos causas encadenadas:**
  1. **Realtime nunca arrancaba.** PartyKit `dev` NO lee el `process.env` del contenedor: lee variables
     solo desde un `.env` en disco (`findUpSync(".env")` → `dotenv.parse`), que inyecta al Worker como
     `PARTYKIT_PROCESS_ENV`. El commit que sacó el `COPY .env` del Dockerfile dejó el contenedor sin `.env`
     → `REALTIME_BROADCAST_SECRET` era `undefined` en el Worker → `createEnv` (exige `z.string().min(32)`)
     tiraba y nunca bindeaba `:1999`.
     **Fix (PR #24):** el entrypoint del realtime materializa `REALTIME_BROADCAST_SECRET` y
     `NEXT_PUBLIC_BUILDER_URL` en un `.env` desde el entorno del contenedor antes de arrancar.
  2. **El builder apuntaba `/ws` a `localhost:1999`.** El rewrite `/ws/:path* → NEXT_PUBLIC_INTERNAL_WS_URL`
     se evalúa en `next build` (queda horneado en `routes-manifest.json`), NO en runtime. Sin la var en el
     build caía al default `http://localhost:1999`. Setearla en el compose `environment` NO alcanzaba (es runtime).
     **Fix (PR #25):** build ARG `NEXT_PUBLIC_INTERNAL_WS_URL=http://realtime:1999` en el Dockerfile del builder.
- **Verificación:**
  ```bash
  docker logs chatbotx-realtime-1 --tail 20        # "Ready on http://0.0.0.0:1999" + "101 Switching Protocols"
  docker exec chatbotx-builder-1 sh -c 'grep -o "realtime:1999" /app/apps/builder/.next/routes-manifest.json'
  ```

### 4.8 Storage (rustfs) caído + presigned URL con `host.docker.internal` (2026-09-11)

- **Síntoma:** el import de flujos falla. El browser intenta `PUT` a
  `http://host.docker.internal:9000/...` y no resuelve (host Docker-interno).
- **Dos causas:**
  1. **rustfs estaba caído.** `chatbotx-filesystem-1` → `Exited (255)` desde el 5/9, **sin `restart` policy**.
     El deploy de apps (`up -d --no-deps builder worker realtime javascript-executor caddy`) NO levanta el filesystem.
     **Fix:** `docker compose ... up -d filesystem filesystem-init` + `restart: unless-stopped` en `docker-compose.yml`.
  2. **La URL presignada se firmaba contra el endpoint interno.** `getPresignedUpload`/`getPresignedDownload`
     firmaban contra `S3_ENDPOINT` (= `host.docker.internal:9000`), que el navegador no puede resolver.
     La firma AWS incluye el `Host`, así que NO se puede reescribir el host después de firmar.
     **Fix:** nueva env `S3_PUBLIC_ENDPOINT` (host público del storage) contra la que se firman las presigned URLs
     (fallback a `S3_ENDPOINT`), + ruta `/chatbotx/*` → `filesystem:9000` en Caddy (mismo dominio, reusa el HTTPS).
- **Config necesaria en dev (sin DNS nuevo):**
  - `Caddyfile`: `handle /chatbotx/* { header_up Host {host} → reverse_proxy filesystem:9000 }` en el sitio `dev-chatbotx.fibrazo.com.co`
  - Secret: `S3_PUBLIC_ENDPOINT=https://dev-chatbotx.fibrazo.com.co`
  - (El path `/chatbotx/*` es el bucket en path-style y viaja intacto para conservar la firma S3.)

## 5. Pipeline de deploy (cómo funciona HOY)

```
push a main (privado)
  → GitHub Actions runner self-hosted `gl-runner01` (máquina ip-10-7-3-8)
  → init-ssh.sh (config SSH con bastión bhdev.fibrazo.com.co)
  → webfactory/ssh-agent (key `sysbrazo@fibrazo.com.co`)
  → deploy.sh: rsync → .env desde AWS (JSON→KEY=value con python3) → **stop apps viejas** → builds secuenciales → up -d --no-deps (si falla a mitad: trap restaura las apps viejas + maintenance off)
  → run-smoke-tests.sh: curl /api/health en :3123 con retries
```

Archivos clave: `.github/workflows/deploy-devel.yml`, `scripts/deployment/*.sh`, `rsync_exclude`.
Secret: `dev/chatbotx/all-secret` (us-west-2).

## 6. Checklist para PRODUCCIÓN (diferencias con dev)

- [ ] **RAM:** 16GB reales mínimo (build OOM con 8GB — swap no es solución para prod)
- [ ] **DB:** systemd o RDS, pero con: `listen_addresses='*'`, pg_hba para la red docker,
      `pgvector` instalado, y el user de la app con **SUPERUSER** (o pre-crear la extensión)
- [ ] **Secret** `prod/chatbotx/all-secret` con `host.docker.internal` en las URLs (NO localhost)
- [ ] `docker-compose.prod.yml` (ya existe) + `Caddyfile` con el dominio de prod (hoy tiene el dev hardcodeado)
- [ ] `RUN_DB_SEED` **false** en prod (hoy dev siembra demo — el seed crea `demo@example.com` y NO el admin;
      para tener el admin: seed modificado o registrar el `PLATFORM_ADMIN_EMAIL` en sign-up)
- [ ] **`LICENSE_KEY`** configurado (sin él, el builder arranca en modo degradado/enterprise incompleto)
- [ ] Redis con política de eviction **noeviction** (hoy: allkeys-lru → warning)
- [ ] Security Group: 80/443 abiertos (Caddy/Let's Encrypt) + 3123 (health) — el SG actual acepta 80
- [ ] `SERVER` y `SECRET_NAME` en `deploy-production.yml` (hoy: `<SERVER-PROD-PENDIENTE>`)
- [ ] **Websocket (ver §4.7):** `NEXT_PUBLIC_INTERNAL_WS_URL` ya va como build arg en el Dockerfile del
      builder; el `.env` del realtime lo genera el entrypoint. Confirmar que el dominio público llegue a `/ws`.
- [ ] **Storage público (ver §4.8):** en dev reusa el dominio con la ruta `/chatbotx/*` en Caddy + `S3_PUBLIC_ENDPOINT`
      en el secret. En prod NO usar un contenedor rustfs suelto sin HA — idealmente S3 gestionado + CDN/dominio propio.
- [ ] Portar los fixes de dev a prod: `deploy.sh` con stop de apps antes del build + trap de restore,
      `mem_limit` en `docker-compose.apps.yml` (ya en el repo)

## 7. Comandos de diagnóstico útiles

```bash
# ¿OOM al buildear? (correr justo después del fallo)
dmesg | grep -i "killed\|oom\|out of memory" | tail -20

# ¿El builder no arranca?
docker ps | grep builder
docker logs chatbotx-builder-1 --tail 80

# ¿Postgres escucha para Docker?
ss -tlnp | grep 5432

# Probar conexión como la hace el contenedor
GATEWAY=$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}')
PGPASSWORD='fe3Poos1' psql -h "${GATEWAY}" -U dev_chatbotx_adm -d chatbotxdb -c "SELECT 1;"

# Ver el secret (lectura OK con el rol del server)
aws secretsmanager get-secret-value --secret-id dev/chatbotx/all-secret --region us-west-2 --query SecretString --output text

# ¿Realtime (websocket) arriba?
docker logs chatbotx-realtime-1 --tail 20   # buscar "Ready on http://0.0.0.0:1999"

# ¿El rewrite /ws quedó bien horneado?
docker exec chatbotx-builder-1 sh -c 'grep -o "realtime:1999\|localhost:1999" /app/apps/builder/.next/routes-manifest.json'

# ¿Storage (rustfs) arriba?
docker ps -a | grep filesystem
curl -s -o /dev/null -w '%{http_code}\n' http://host.docker.internal:9000/health
```
