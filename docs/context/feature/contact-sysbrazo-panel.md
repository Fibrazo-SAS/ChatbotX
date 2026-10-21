# Panel de contacto Sysbrazo (ticket #15467)

Panel que se muestra en la conversación del inbox (contacts) cuando el
contacto tiene el campo personalizado `document_id`: muestra identidad,
contacto con validaciones, servicios (9 variantes de estado), estado ONU/CPE
y link "Ir a Sysbrazo".

- SDD: `spec/feature/15467/`
- Tickets relacionados (fuera de este panel): Autodiagnóstico y Tickets
  (#15466), Notas (#15465), Multimedia (#15468).
- Fase 2 (fuera de v1): captura manual del documento por el asesor.

## Punto de inflexión

Los datos de Sysbrazo **solo se resuelven on-demand** cuando el contacto del
chat tiene el campo personalizado `document_id`. Sin ese campo el panel no
consulta nada (cero impacto en chats comunes). Si el flujo guarda el campo
mientras el chat está abierto, el pipeline realtime
(`contactCustomFieldChanged`) re-consulta el contacto y el panel aparece sin
refrescar la página.

## Origen de datos y credenciales

- **Endpoint de datos del cliente:** `GET {base}/api/botmaker/client/by-document?document_id={doc}&botmaker=1`
  (payload completo: identidad, contacto, validaciones, balance, TV boxes,
  instalaciones, addons).
- **Endpoint de ONU/CPE:** `GET {base}/api/krill/cpe-onu-status/{clientId}` —
  el mismo que consume el `CpeTechnicalStatus` de Sysbrazo. `?force=1` salta
  la cache de 1 h (botón "Refrescar" del panel). `404`/`500` → "Sin
  información" (normalizado a null).
- **Cabeceras (Authorization):** se leen **solo del paso `callApi` del flujo
  publicado** (fuente única de credenciales — no viven en `.env` ni en
  código). Implementación: `get-sysbrazo-client.query.ts`
  (`findSysbrazoCallApiConfig`, scan recursivo de `data.details.steps`).

## Variable global fija `SYSBRAZO_CLIENT_API_URL`

La URL base sale de **una variable global con nombre FIJO**; el **valor
cambia por entorno**:

```
SYSBRAZO_CLIENT_API_URL =
  {{LOCAL_URL}}/api/botmaker/client/by-document?document_id={{document_id}}&botmaker=1
```

- `{{LOCAL_URL}}` → otra variable global (por entorno: dev/prod/ngrok local;
  un script puede actualizarla solo cuando cambia el túnel).
- `{{document_id}}` → el documento del contacto.
- El panel resuelve los tokens **encadenados** (variables dentro de
  variables). Si el valor es solo la base (`https://...`), completa el path.
- **Fallback:** si la variable no tiene valor, el panel usa la URL del nodo
  `callApi` del flujo. Si quedan tokens sin resolver, error claro.
- **Creación automática (no manual):**
  - Workspaces nuevos: `WorkspaceService.ensureSysbrazoClientApiUrlVariable`
    inserta la fila (idempotente `ON CONFLICT DO NOTHING` — nunca pisa una
    existente ni su valor).
  - Workspaces existentes: migración
    `drizzle/20261020000000_seed_sysbrazo_client_api_url_variable` la
    backfillea al desplegar.
  - Lo único manual es **ponerle el valor** en "Variables globales".

> ⚠️ El flujo (worker) resuelve variables en **una sola pasada**: el nodo
> `callApi` del flujo debe usar la URL "aplanada" (`{{LOCAL_URL}}/api/...`),
> no `{{SYSBRAZO_CLIENT_API_URL}}` anidada.

## Contrato (schema zod real)

`apps/builder/src/features/contacts/schema/sysbrazo-client.ts` — camelCase
real de Sysbrazo: `primary_phone`, `primary_phone_validated`, `alt_phone*`,
`balance` (`dateToExpire` en formato `d-m-y H:i:s`), `tv_boxes` (serial,
model, status), `installation_status`, `addon_subscriptions` (estado y saldo
propios). La ONU (`sysbrazoOnuStatusSchema`) viaja por su propio endpoint:
`state` (up/down/los), `registrationStates`, potencias con `status`,
`uptime`, `olt`, `board`, `port`, `connectedDevices`, `lastDownTime`.

- Teléfonos formato 3-3-4; documento con separador de miles y short-code
  (CC/CE/TI/PA…); iniciales del avatar derivadas de `full_name`.
- "Última sesión" = `last_interaction` de ChatbotX (no de Sysbrazo).

## Bloque Servicios — 9 variantes

| # | Estado | Cómo se muestra |
|---|--------|-----------------|
| 1 | Salida | Sub-header SALIDA + píldora A DESINSTALAR + "Retiro de equipos pendiente" |
| 2 | TV Box perdido | Píldora PERDIDO + "Equipo no recuperado" |
| 3 | Suspendido con TV Box | ✕ SUSPENDIDO + grilla hace X / DESDE + boxes |
| 4/5 | Addon suspendido/por vencer | Fila de addon con saldo propio |
| 6 | Por vencer | ✓ ACTIVO + tiempo restante ámbar |
| 7/8 | Activos | ✓ ACTIVO + TIEMPO RESTANTE / FECHA DE CORTE |
| 9 | Instalación en curso | Píldora A DESIGNAR CUADRILLA |
| — | Lead | LEAD · PENDIENTE VALIDACIÓN · Sin servicio contratado |

Helpers: `apps/builder/src/features/contacts/sysbrazo-panel/format.ts`
(`resolveInternetServiceState`, `resolveAddonState`, `formatIsoDisplay`,
`daysSince`, etc.).

## ONU/CPE

`onu-block.tsx`: card propia colapsable, acoplada a la card principal.
Carga asíncrona (segunda llamada al endpoint Krill) con skeleton propio;
botón "Refrescar" → `force=1`. Banner centrado con estado UP/DOWN/LOS +
tags de `registrationStates`; grilla de métricas centradas (RX Power (DN),
RX Power (UP), TX Power (UP), Uptime, OLT, Puerto, Board, Equipos
conectados); diagnóstico offline (OLT/Puerto/Board/Última caída).

## UI del panel

- Identidad siempre visible; Contacto desplegado por defecto; Servicios y
  ONU contraídos con transición suave (recipe Base UI en `globals.css`,
  scoped `.sysbrazo-panel`).
- Estados de carga/error/no-registrado con skeletons en los 4 idiomas
  (`sysbrazoPanel` en `apps/builder/messages/*.json`).

## Realtime

`customFieldChanged` (business → `broadcastToWorkspaceParty`) →
`contactCustomFieldChanged` (partykit) → `ChatRealtime` → store →
`ContactInboxPanel` re-consulta el contacto → el panel aparece/actualiza sin
F5. Detalles: `packages/partysocket-config/src/schemas.ts`,
`packages/business/src/contact-custom-field/service.ts`.

## Deploy / operación

1. `db:migrate` crea la variable para workspaces existentes (idempotente).
2. En cada entorno: poner el **valor** de `SYSBRAZO_CLIENT_API_URL` (o de la
   variable que referencie, p.ej. `LOCAL_URL`) en "Variables globales".
3. El flujo publicado debe tener el paso `callApi` con la URL aplanada y la
   cabecera `Authorization` de Sysbrazo.
4. Cambio de entorno = cambiar el valor de la variable, nada más.

## Verificación

- Tests: `contacts/__tests__/get-sysbrazo-client.query.test.ts` (URL fija +
  anidados + fallbacks + ONU), `sysbrazo-panel/__tests__/format.test.ts`,
  `contacts/__tests__/sysbrazo-config.test.ts` (92/92 builder).
- Business: 1621/1621 (incluye workspace create → variable automática).
- Sysbrazo: `tests/Unit/KrillControllerPowerStatusTest.php` (14/14).
