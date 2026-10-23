# Integración de soporte Sysbrazo ↔ ChatbotX (ticket #15466)

Guía de la relación entre las partes del panel de soporte: qué piezas
existen, quién llama a quién, el contrato de cada endpoint y las reglas de
comportamiento. Complementa a `contact-sysbrazo-panel.md` (#15467), que cubre
el lookup del cliente y el panel de identidad/servicios/ONU.

- SDD: `spec/feature/15466/`
- Contrato Zod (fuente del tipado del builder):
  `apps/builder/src/features/contacts/schema/sysbrazo-support.ts`
- Mapa de etiquetas (pasos/motivos en español):
  `apps/builder/src/features/contacts/sysbrazo-panel/sysbrazo-labels.ts`

## Las partes

```
ChatbotX builder (inbox, panel del contacto)
 ├─ UI: features/contacts/sysbrazo-panel/*        (card, modales, historial)
 ├─ oRPC: features/contacts/api/private.ts        (gate de permisos)
 └─ Queries: queries/sysbrazo-support.query.ts    (HTTP directo a Sysbrazo)
        │  Authorization: credenciales del nodo `callApi` del flujo
        ▼
Sysbrazo (Laravel)
 ├─ routes/api.php            (grupos Basic-Auth `botmaker|chatbotx`)
 ├─ ChatbotxContactSupportController  (4 endpoints de soporte)
 ├─ ClientController::getClientByDocumentId (lookup compartido con el flujo)
 ├─ ClientSupportTicketsService         (merge Odoo en vivo + Redmine espejo)
 ├─ AutoDiagnosticRunDispatcherJob      (cola `auto-diagnostic`, vía Horizon)
 └─ AutoDiagnosticController::start     (entrada legacy Portal/Bot, lock compartido)
```

- El **flujo de ChatbotX** (worker, nodo `callApi`) usa la MISMA ruta de
  lookup (`by-document`) que el panel, con credenciales `botmaker` o
  `chatbotx` indistintamente.
- La **autorización por persona vive en ChatbotX** (permisos por miembro).
  Sysbrazo solo identifica la integración por Basic Auth.

## Credenciales / consumidores

- Consumidores Basic Auth de Sysbrazo: `botmaker`, `chatbotx`, `portal`.
- El consumidor `chatbotx` se define con `CHATBOTX_USERNAME` /
  `CHATBOTX_PASSWORD` en el `.env` de Sysbrazo (ver `.env.placeholder`).
- El lookup y el panel leen las cabeceras (Authorization incluida) de la
  MISMA fuente única que el flujo: el nodo `callApi` publicado. No hay
  credenciales duplicadas en `.env` de ChatbotX.

## Catálogo de endpoints

| Método | Ruta | Auth | Llama desde | Qué devuelve |
|---|---|---|---|---|
| GET | `/api/botmaker/client/by-document?document_id={doc}&botmaker=1` | `botmaker\|chatbotx` | Panel (lookup) y nodo `callApi` del flujo | Payload completo del cliente; errores como `{ data: { error } }` con 404/422 |
| GET | `/api/botmaker/client/{clientId}/autodiagnostics?page=&per_page=` | `chatbotx\|botmaker` | Card del panel (últimas 3) e historial (páginas de 50) | `{ items, total, page, per_page }`; `per_page` tope 100, default 3 |
| GET | `/api/botmaker/client/{clientId}/autodiagnostics/{runId}` | `chatbotx\|botmaker` | Modal de detalle | Summary + `steps[]` + `executed_step_count` |
| POST | `/api/botmaker/client/{clientId}/autodiagnostics` | `chatbotx\|botmaker` | Botón "Realizar autodiagnóstico" | Body `{ "source": "chatbotx" }`; responde `{ status: ok\|running\|error, run_id, message }`; 409 si el lock de inicio está tomado |
| GET | `/api/botmaker/client/{clientId}/tickets?page=&per_page=` | `chatbotx\|botmaker` | Bloque Tickets | `{ items, total, page, per_page, providers[] }` con `providers[].verified` |

- El `clientId` **nunca lo aporta el navegador**: el builder lo resuelve en
  servidor desde el `document_id` del contacto (mismo lookup de #15467).
- El `runId` se valida contra el cliente resuelto (un run de otro cliente
  responde 404).

## Contrato de datos (enums y shapes)

- `status`: `created | running | delayed | finished | failed | canceled |
  paused | error`.
- `source`: `portal | whatsapp | sysbrazo | chatbotx` (nuevo, #15466).
- `reason`: **código en inglés** (`CLIENT_HAS_OPEN_INCIDENT`,
  `PING_BATCH_RETRY_FAILED`…). El panel lo traduce con `REASON_LABELS` en
  `sysbrazo-labels.ts`, portado de `resources/src/featured/client/
  Autodiagnostic/const.ts` de Sysbrazo.
- `step_name`: snake_case en inglés (`check_credit`,
  `get_cpe_gpon_power_Info`…). Etiquetas en español vía `STEP_LABELS` del
  mismo archivo.
- `steps[].details`: **objeto** (`{...}`). Sysbrazo manda `(object) []`
  cuando no hay detalle. El cliente igual tolera `array | null` (unión zod)
  para degradar sin 500 — ver la sección de reglas antes de tocar.
- Fechas ISO 8601 (`started_at`, `finished_at`); duraciones en segundos
  (`total_duration_seconds`, `step_duration_seconds`); referencias Odoo/
  Redmine como número o string o null.
- Tickets: `is_open`, `is_massive`, `affected_clients`, y `providers[]`
  donde `verified: false` = proveedor caído ("No verificado" en el panel).

## Reglas de comportamiento del cliente

- **La card NO hace polling nunca.** Carga al entrar al contacto, una sola
  vez después de mandar un autodiagnóstico (para mostrar el run nuevo) y con
  el botón "Actualizar". Nada más.
- **El modal de detalle sí sigue el run** (es el lugar del progreso en vivo):
  backoff 3 s → 30 s solo mientras está abierto. Se corta al estado terminal
  o si el run sigue `created` pasados 2 minutos (aviso ámbar
  "quedó sin procesar en el servidor").
- Un run clavado en `created` = la cola de Sysbrazo no lo procesó (job
  encolado sin worker). Refrescar no lo destraba; el problema está del lado
  Sysbrazo, no del panel.

## Permisos (#15466, explícitos por miembro)

- `runAutodiagnostic` — botón Realizar (sin bypass por superAdmin/rol).
- `viewBotFields` / `manageBotFields` — Variables Globales (ver / gestionar).
- Gates: página/sidebar (`require-workspace-permission` + nav), acciones
  server (`assertCanManageBotFields`), API de historial (`canViewBotFields`).

## Lado Sysbrazo — operación

- La cola `auto-diagnostic` la consume **Horizon** (`supervisor-auto-
  diagnostic` en `config/horizon.php`). Si Horizon está caído (local:
  supervisor con `spawnerr EACCES` sobre `/var/log/laravel-horizon.log`), los
  runs quedan `created` para siempre y el job espera en Redis
  (`sysbrazo_database_queues:auto-diagnostic`).
- **Lock de inicio compartido** `auto_diagnostic_start_{clientId}` (10 s):
  lo usan `ChatbotxContactSupportController::start` y
  `AutoDiagnosticController::start` (body en `startLocked`) — dos inicios
  concurrentes no duplican runs.
- Cap de **2 runs exitosos/día** por cliente (solo `source=sysbrazo` exento;
  `chatbotx` está sujeto al cap).
- Setting `chatbotx_autodiagnostic_enabled` (default `false`): el canal
  queda apagado hasta activarlo.
- Settings preexistentes del cliente inverso Sysbrazo→ChatbotX
  (`chatbotx_mocker`, `chatbotx_base_url`, `chatbotx_api_token`,
  migración `2026_08_08_...`) son de OTRA integración (Sysbrazo mandando
  mensajes a ChatbotX vía `ChatBotXService`); hoy nadie la usa y `mocker`
  está en `true`. No confundir con este panel.

## Mapa de archivos

**ChatbotX**
- Contrato: `apps/builder/src/features/contacts/schema/sysbrazo-support.ts`
- Queries (resolución clientId + credenciales + HTTP):
  `apps/builder/src/features/contacts/queries/sysbrazo-support.query.ts`
- API oRPC: `apps/builder/src/features/contacts/api/private.ts`
- UI: `apps/builder/src/features/contacts/sysbrazo-panel/`
  (`autodiagnostic-block`, `-dialog`, `-history-dialog`, `tickets-block`,
  `sysbrazo-labels`, `format-support`)
- Permisos: `packages/database/src/partials/workspace.ts` +
  `apps/builder/src/features/workspace-members/*` + `/admin/users`
- Auditoría: `AuditLog.botFieldId` (migración
  `drizzle/20261022160422_add_audit_log_bot_field_id`) +
  `packages/business/src/bot-field/service.ts`

**Sysbrazo**
- Rutas: `routes/api.php` (grupos `botmaker/client` con
  `botmaker|chatbotx` y `chatbotx|botmaker`)
- Controller: `app/Http/Controllers/Api/ChatbotxContactSupportController.php`
- Tickets: `app/Services/Helpdesk/ClientSupportTicketsService.php`
- Dispatcher: `app/Jobs/AutoDiagnostic/AutoDiagnosticRunDispatcherJob.php`
- Etiquetas/mapas del portal: `resources/src/featured/client/Autodiagnostic/const.ts`

## Regla de cambios de contrato

Si se agrega, renombra o cambia de tipo un campo/enum en Sysbrazo:

1. Actualizar el schema zod (`sysbrazo-support.ts`) — el builder valida con
   zod y un shape nuevo crashea el RPC (500) si no se refleja.
2. Si es un `reason`/`step_name` nuevo, agregarlo a BOTH mapas:
   `sysbrazo-labels.ts` (ChatbotX) y `const.ts` (Sysbrazo) o el panel lo
   muestra formateado en inglés.
3. El cliente puede ser tolerante (union zod) pero la raíz se arregla en
   Sysbrazo: **nunca** dejar que un shape feo se compense solo del lado del
   cliente sin fixear el emisor.
4. Actualizar este doc y los tests (`sysbrazo-support.query.test.ts`,
   `sysbrazo-labels.test.ts`, tests feature de Sysbrazo).
