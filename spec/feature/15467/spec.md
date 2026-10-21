# Spec: Panel de contacto — Identidad, contacto y servicios (Sysbrazo) — ticket 15467

## Ticket
- **URL**: https://redmine.fibrazo.com.co/issues/15467 (proyecto Sysbrazo)
- **Tracker**: Feature
- **Priority**: Normal — Complexity: Medium
- **Parent**: #15464
- **Goal**: Mostrar en el panel derecho de la conversación la identidad del
  cliente, su contacto (con estado de validación por dato) y sus servicios
  (con estado actual), para que el asesor atienda sin cambiar de sistema.

## Problema
Hoy el asesor, para saber quién es el cliente y qué servicios tiene, tiene que
salir de ChatbotX e ir a Sysbrazo. El panel derecho de la conversación
(`ContactInboxPanel`) muestra datos propios del contacto (nombre, teléfono,
tags, notas, cupones, citas, secuencias), pero no la identidad/contacto/servicios
que viven en Sysbrazo.

Los datos de Sysbrazo solo se pueden resolver una vez que se conoce el
**documento** del cliente: sin documento no hay clave para cruzar contra el
registro de clientes de Sysbrazo. Por eso el panel tiene dos estados, separados
por un único punto de inflexión: el custom field `document_id`.

## Punto de inflexión (regla)
El flag es el custom field `document_id` del contacto. No hay flujo corriendo
en loop; el panel es una función pura del estado del contacto:

| Estado | Condición | Comportamiento |
|---|---|---|
| **Cliente N** (desconocido) | `document_id` vacío | Muestra "no registra como cliente" + acción de pedir/registrar documento. **No** consulta Sysbrazo. |
| **Cliente resuelto** | `document_id` presente | El panel consulta a Sysbrazo (lookup on-demand) y muestra identidad + contacto + servicios en vivo. |

- El documento lo captura el **flujo de bienvenida** (paso obligatorio,
  **condicionado** a "el contacto aún no tiene `document_id`" para no volver a
  pedírselo a un cliente ya identificado).
- El lookup es **on-demand** (al abrir la conversación / refrescar), no
  congelado en custom fields, para que "hace N horas", "20 d 3 h" y "por vencer"
  estén actualizados.
- La **carga manual del documento por el asesor** queda fuera de v1 (respaldo
  para una iteración posterior); el mecanismo del flag la soporta sin cambios.

## Fuente de datos (Sysbrazo — ya existente, no se crea de cero)
El endpoint del bot `GET /api/botmaker/client/by-document` hoy devuelve un
subconjunto manual (`getClientByDocumentId`). Sysbrazo **ya tiene** el payload
completo; el endpoint debe exponerlo en lugar de armarlo a mano:

- **Identidad**: `full_name`, `document_id`, `document_type_id`, `city`,
  `email`, `address` → `Client::getPortalClientData()`.
- **Contacto + validación por dato**: `phone_number`/`phone_prefix`,
  `alt_phone`/`alt_phone_prefix`, `email`, y `contact_validations`
  (`ContactValidationService::getStatusForClient()` → `{phone_number,
  phone_number_alt, email}` con `status: validated|pending|null`) → alimenta las
  píldoras `VALIDADO`/`PENDIENTE`.
- **Servicios**: `internet_status`, `internet_plan`, `tv_plan`, y
  `getInternetBalanceInfo()` → `statusName`, `daysSuspended`, `valueRemaining`,
  `dateToExpire` (fecha de corte), `timeRemainingDisplay` (value+unit, ej.
  "20 d 3 h").
- **TV Box**: modelo `TvBox` (serial, marca) vía relación `tvBoxes`.
- **"Ir Sysbrazo"**: `https://sysbrazo.fibrazo.com.co/clients/{id}/installation/{id}`
  (el `id` viene de la respuesta).

### Datos de ChatbotX (sin tocar Sysbrazo)
- **Última sesión** = `last_interaction` (último mensaje entrante del contacto,
  `packages/variables/src/utils.ts:460`). Ya existe como system field.
- **Avatar** = iniciales del primer nombre + primer apellido (derivado de
  `full_name`, del lado del panel).

## Criterios de aceptación
- [ ] Panel con 4 bloques: Identidad (avatar/nombre/documento/ciudad/última
  sesión), Contacto (Principal/Alterno/Correo, colapsable), Servicios
  (colapsable, con botón "Ir Sysbrazo"), y los módulos existentes (notas,
  cupones, citas, tags, secuencias).
- [ ] Responsive 3 versiones: Pequeña (240–299 px), Estrecha (300–379 px,
  defecto 360), Escritorio (≥380 px), según el ticket.
- [ ] Documento: chip tipo + número con puntos de miles (`CC 1.045.123.456`) +
  copiar solo el número ("Documento copiado").
- [ ] Contacto: sin dato → "Sin dato" atenuado; píldora `VALIDADO`/`PENDIENTE`
  por dato; copiar teléfono (sin espacios) / correo solo con valor.
- [ ] Servicios: ícono con color por estado (verde activo, ámbar por vencer,
  rojo suspendido); activo → tiempo restante + fecha de corte (≤48 h → ámbar
  con reloj); TV con mismo corte → "Mismo corte que Internet"; suspendido →
  "Suspendido hace N" + "Desde" (o "Sin fecha registrada"); TV suspendida por
  Internet → atenuada + "Por Internet suspendido"; TV Box → nombre, serial
  (copiar), marca.
- [ ] Punto de inflexión: sin `document_id` no se consulta Sysbrazo; con
  `document_id` se hace lookup on-demand y se refresca.
- [ ] El flujo de bienvenida pide el documento condicionado a "si aún no lo
  tiene".
- [ ] Lookup autenticado: la server action reutiliza las mismas credenciales que
  el paso `callApi` ya usa contra Sysbrazo (config a nivel plataforma, no por
  workspace).
- [ ] Todos los strings con `useTranslations()`; sin `db` directo en `apps/`;
  tests del servicio/action/componente; `pnpm lint` + typecheck limpios.

## Decisiones tomadas (no son preguntas abiertas)
1. **Mecanismo**: lookup on-demand desde el panel, flag `document_id`. Cubre
   cualquier fuente del documento (bot hoy; manual en el futuro) y da datos
   frescos.
2. **"Última sesión"**: `last_interaction` de ChatbotX (no hay tracking de
   "último acceso al portal" en Sysbrazo).
3. **Carga manual del asesor**: fuera de v1 (respaldo, fase 2).
4. **`callApi` no es acción de trigger** (`triggerActions` no lo incluye); por
   eso el lookup vive en una server action del panel, no en un trigger.

## Skills & Rules
- .agents/skills/builder-ui-i18n (panel + useTranslations + responsive)
- .agents/skills/feature-scaffold (nuevo bloque de feature en el inbox)
- .agents/skills/orpc-api (server action / endpoint del panel)
- .agents/skills/security-review (datos personales del cliente; el `document_id`
  viene del canal → validar antes de consultar; tenant isolation)
- .agents/skills/testing-workflow (lint → types → test → coverage)
- .agents/skills/integration-channel (patrón de llamada HTTP a terceros, como
  referencia del `callApi`)
- Reglas: data-access (sin `db` directo en `apps/`), git.md

## Do's and Don'ts
- SÍ normalizar el `document_id` antes de consultar (Sysbrazo valida: dígitos
  5–20 o pasaporte alfanumérico 6–12).
- SÍ tratar el `document_id` como input no confiable (viene del canal): validar
  y acotar antes del lookup; nunca exponer datos de otro cliente.
- SÍ mantener el lookup autenticado y scoped al workspace del contacto.
- SÍ reutilizar el payload completo de Sysbrazo (`getPortalClientData` +
  `getInternetBalanceInfo` + `tvBoxes`); NO replicar el `clientData` manual.
- NO hardcodear strings; NO importar `db` en `apps/`; NO inventar endpoint nuevo
  en Sysbrazo (reusar/ampliar el existente).
- NO romper el `ContactInboxPanel` existente: agregar los bloques sin eliminar
  notas/cupones/citas/tags/secuencias.

## Docs to Update
- docs/context/feature/contact-sysbrazo-panel.md (nuevo: flujo del punto de
  inflexión, contrato del endpoint Sysbrazo, mapeo ticket→datos)
