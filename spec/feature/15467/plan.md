# Plan: Panel de contacto — Identidad, contacto y servicios (Sysbrazo) — ticket 15467

## Approach

El panel derecho del inbox (`ContactInboxPanel` → `ContactDetail`) agrega tres
bloques nuevos que se alimentan de un **lookup on-demand a Sysbrazo**, disparado
por un único flag: el custom field `document_id` del contacto.

**A. Contrato del endpoint Sysbrazo (repo `sysbrazo`, no este).**
El endpoint `GET /api/botmaker/client/by-document` hoy arma `clientData` a mano
con un subconjunto. Hay que ampliarlo para devolver el payload completo que
Sysbrazo ya sabe calcular: `Client::getPortalClientData($withInstallations: true)`
+ `getInternetBalanceInfo()` + `tvBoxes` (serial/marca). Sin esto, al panel le
faltan `document_type`, `email`, `alt_phone`, `contact_validations`,
`dateToExpire`/`timeRemainingDisplay` y TV Box. No se crea endpoint nuevo.

**B. Server action de lookup (builder).**
Una acción con `workspaceActionClient` + `externalRequestService.execute()`
(mismo patrón que `flows/actions/test-external-request-action.ts`) hace el GET
a Sysbrazo con el `document_id` ya normalizado, y devuelve la respuesta tipada
(zod). El `document_id` es input no confiable (viene del canal): se valida
(dígitos 5–20 o pasaporte alfanumérico 6–12, regla de Sysbrazo) y se URL-encodea
antes de consultar. `404` / error → estado "no registra como cliente".

**C. Bloque de UI del panel.**
Nuevo `SysbrazoPanel` montado en `ContactInboxPanel`, que:
- lee el `document_id` de los custom fields ya presentes en `contactData`
  (`getContact` ya trae `customFields` con `name` + `value`);
- sin `document_id` → render "no registra" + acción de pedir documento (no consulta);
- con `document_id` → llama a la server action y renderiza Identidad, Contacto
  y Servicios en los 3 anchos responsive del ticket.

**D. Config de credenciales.**
URL base + token/auth de Sysbrazo como configuración a nivel plataforma del
builder (patrón `packages/business/src/**/keys.ts`), no por workspace. A
confirmar con el equipo Sysbrazo el mecanismo de auth exacto (el endpoint dio
401 sin headers; el `callApi` del flujo ya lo tiene configurado en la BD).

## Files Affected

### Repo `sysbrazo` (dependencia, fuera de este repo)
| Archivo | Cambio |
| --- | --- |
| `app/Http/Controllers/Api/ClientController.php` | **Editar** — `getClientByDocumentId`: devolver el payload completo (reusar `getPortalClientData` + `getInternetBalanceInfo` + `tvBoxes`) en vez del `clientData` manual. |

### Repo `chatbotx-source`
| Archivo | Cambio |
| --- | --- |
| `apps/builder/src/features/contacts/sysbrazo-panel/schema.ts` | **Nuevo** — zod del response del endpoint (identidad, contacto, validaciones, servicios, TV box). |
| `apps/builder/src/features/contacts/sysbrazo-panel/actions/get-sysbrazo-client.action.ts` | **Nuevo** — safe-action (`workspaceActionClient`) que valida `document_id`, llama `externalRequestService.execute()` a Sysbrazo y devuelve tipado. |
| `apps/builder/src/features/contacts/sysbrazo-panel/sysbrazo-panel.tsx` | **Nuevo** — componente contenedor: estado sin/con documento, fetch on-demand, render de los 3 bloques. |
| `apps/builder/src/features/contacts/sysbrazo-panel/identity-block.tsx` | **Nuevo** — avatar (iniciales), nombre, chip documento (tipo+número con puntos + copiar), ciudad, última sesión (`last_interaction`). |
| `apps/builder/src/features/contacts/sysbrazo-panel/contact-block.tsx` | **Nuevo** — Principal/Alterno/Correo colapsable, píldora VALIDADO/PENDIENTE, "Sin dato", copiar. |
| `apps/builder/src/features/contacts/sysbrazo-panel/services-block.tsx` | **Nuevo** — servicios colapsable, estado/color, tiempo restante + corte, "Mismo corte", suspendido/TV por internet, TV Box, botón "Ir Sysbrazo". |
| `apps/builder/src/features/contacts/contact-inbox-panel.tsx` | **Editar** — montar `SysbrazoPanel` (sin tocar notas/cupones/citas/tags/secuencias). |
| `apps/builder/src/features/contacts/schema/query.ts` | **Editar** — exponer/leer `document_id` desde `customFields` (ya disponible); tipar lo que haga falta. |
| `apps/builder/messages/{en,es,...}.json` | **Editar** — keys de los bloques, píldoras, estados, botones, avisos de copiado. |
| Config credenciales (env del builder + keys) | **Nuevo** — `SYSBRAZO_BOT_*` para URL base y auth (mecanismo de auth a confirmar). |
| Tests `apps/builder/__tests__/contact-sysbrazo-panel.*` | **Nuevo** — action (validación de documento, 404→no-registra, mapeo) y componente (estados sin/con documento, bloques). |

Verificaciones al implementar:
- Nombre real del custom field `document_id` en la config del flujo de
  bienvenida (debe coincidir con lo que lee el panel).
- Forma exacta del response de Sysbrazo una vez ampliado (contract-first: se
  fija con zod contra una muestra real).
- `externalRequestService.execute` recibe `method/url/headers/body`; confirmar
  timeout/errores y que `headers` con token viajen server-side (sin leakear).

## Tests
1. Action: `document_id` inválido → error sin consultar; válido → GET con query
   encodeada; `404` → `{ found: false }`; `200` → parseado por zod; timeout/red →
   estado de error distinto de "no registra".
2. Componente: sin `document_id` no llama a la action; con `document_id` llama y
   renderiza; loading/error/vacío; píldoras por dato; colores por estado;
   responsive (los 3 anchos).
3. `pnpm lint` + typechecks del builder + suites afectadas.

## Risk Assessment
- **Medium**: agrega un lookup HTTP server-side a un sistema externo con datos
  personales. Mitigado: el `document_id` se valida y URL-encodea (no SSRF, la
  URL base es config), la response se valida con zod, y el acceso es scoped al
  workspace. El cambio de `ContactInboxPanel` es aditivo (no toca lo existente).
- Dependencia externa: el alcance del **contrato Sysbrazo** (endpoint ampliado +
  mecanismo de auth) es el mayor riesgo de coordinación; se aísla en la sección
  A y no bloquea arrancar la UI contra un fixture del contrato.

## Open Questions & Approval Status
- Carga manual del documento por el asesor: **fuera de v1** (nota ya dejada en el
  ticket #15467; si el equipo la pide, se suma en fase 2 sin cambiar el flag).
- Mecanismo de auth de `by-document` (Bearer / x-api-key): a confirmar con el
  equipo Sysbrazo.
- Nombre exacto del custom field del documento: a confirmar contra el flujo.
- Approval status: **pending**.

## Approval Gate
**REQUIRED**: Explicit user approval needed before proceeding to tasks.
Type "aprobado" or "approved" to confirm.
