# Plan: Horarios de atención (v2: N schedules por workspace) — ticket 15295

## Approach
Reemplaza el modelo v1 (schedule único) por el de la guía del equipo. La
migración v1 nunca se aplicó: se regenera desde cero, sin migración de datos.

**A. Entidad `BusinessHours` remodelada (N filas por workspace).**
`{ id, workspaceId, name (único por workspace), timezone (nullable → workspace),
active, intervals, holidays }`.
- `intervals`: `[{ startMinute, endMinute, days: [bool×7] }]` (0 = Dom).
  Un intervalo con todos los días apagados se rechaza en zod.
- `holidays`: `["YYYY-MM-DD"]` (se muestra/edita DD-MM-YYYY), únicas.
- Evaluación = `workspace.isActiveNow` AND `schedule.active` AND no-feriado
  AND match semanal en `schedule.timezone ?? workspace.timezone`.

**B. Step `checkBusinessHours` con `scheduleId`.**
El editor ofrece un picker de horarios del workspace (espejar
`appointment-scheduling`: query `list-*-for-flow` + mecanismo de store/select
que use ese step). Sin selección o schedule borrado → `success` + warn.
El handler verifica `schedule.workspaceId === conversation.workspaceId`.

**C. Settings: lista + edición.**
Sidebar → página de lista (tabla: nombre, activo, resumen, acciones
editar/borrar + Nuevo horario) y página de edición (nombre, timezone
override con opción "workspace", toggle activo, editor de intervalos con
toggles por día, lista de feriados).

Mecánica reutilizada: routing por estados, `computeTriggerAt` (overnight),
`workspaceIdrequestParams`/bind, `assertCurrentUserCanAccessChatbot`,
`TimeSelect`-like minute selects, `useHookFormAction`.

Decisiones propuestas (reversibles en revisión):
1. Nombre único por workspace (trim + case-insensitive).
2. Límites: 28 intervalos y 100 feriados por horario.
3. Viewer del step sin nombre del schedule en v1 (solo editor).
4. Sin duplicar horario en v1.
5. Sin cambios a `isActiveNow` ni al hub de tools.

## Files Affected

| Archivo | Cambio |
| --- | --- |
| `packages/database/src/schema/business-hours.ts` | **Editar** — `+ name`, `timezone` nullable, `holidays` jsonb; quitar unique de `workspaceId`, agregar unique `(workspaceId, name)`. |
| `packages/database/drizzle/20260928193123_*` | **Borrar y regenerar** — la migración nunca se aplicó. |
| `packages/database/src/partials/business-hours.ts` | **Reescribir** — schema de intervalo con `days: [bool×7]` + schema de feriados + validadores. |
| `packages/business/src/business-hours/service.ts` | **Reescribir** — CRUD (list/get/create/rename/upsert/delete) + `isWithinBusinessHours({ workspaceId, scheduleId, at })` + scope check. |
| `packages/flow-config/src/steps/check-business-hours.ts` | **Editar** — `+ scheduleId` (zodBigintAsString, default `""`). |
| `apps/worker/src/integration/handlers/check-business-hours.ts` | **Editar** — carga por `scheduleId`, verifica workspace, sin selección/borrado → `success` + warn. |
| `apps/builder/src/features/flows/react-flow/steps/check-business-hours/editor.tsx` | **Reescribir** — picker de schedule (patrón appointment-scheduling) + link a settings. |
| `apps/builder/src/features/flows/react-flow/steps/check-business-hours/viewer.tsx` | **Editar** — texto según `scheduleId` vacío o no (sin nombre en v1). |
| `apps/builder/src/features/business-hours/` | **Reescribir** — schema CRUD, actions (create/rename/upsert/delete), queries (list/get/for-flow), form de edición (intervalos con toggles + feriados), tabla de lista. |
| `apps/builder/src/app/space/[workspaceId]/business-hours/page.tsx` | **Reescribir** — página de lista. |
| `apps/builder/src/app/space/[workspaceId]/business-hours/[id]/edit/page.tsx` | **Nuevo** — página de edición. |
| `apps/builder/messages/{en,es,pt-BR,pt-PT}.json` | **Editar** — keys de CRUD, intervalos, feriados, picker. |
| Tests (worker handler, business service, builder actions) | **Reescribir/actualizar** al nuevo modelo. |
| `docs/context/flow/business-hours.md` | **Reescribir**. |

Verificaciones al implementar:
- Patrón exacto del picker en flujos (`appointment-scheduling` editor + store/query).
- Patrón de tabla de lista + delete action con `execute()` sin args (invariante #6).
- `en.d.json.ts`: confirmar si requiere regeneración (hasta ahora no bloqueó types).

## Tests
1. Service: CRUD con scoping, unicidad de nombre, evaluación con toggles
   por día, overnight + spill, override de tz, feriado pisa todo,
   schedule de otro workspace → rechazado, sin selección → dentro.
2. Handler: `success`/`skip` según service; scheduleId vacío/borrado →
   `success` + warn; error → `skip`.
3. Builder: actions CRUD con `workspaceId` bindeado; delete sin args.
4. `pnpm lint` + typechecks + suites afectadas.

## Risk Assessment
- **Medium**: remodela lo construido pero nada está desplegado ni migrado;
  el blast radius sigue contenido (mismos archivos, sin cambios a
  comportamiento existente). Riesgo principal: picker en flujos más
  complejo que un link (mitigado espejando appointment-scheduling).

## Open Questions & Approval Status
- Las 4 preguntas del spec con propuesta incluida.
- Approval status: **pending**.

## Approval Gate
**REQUIRED**: Explicit user approval needed before proceeding to tasks.
Type "aprobado" or "approved" to confirm.
