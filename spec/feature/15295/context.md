# Context: Franja horaria de atención en flujos (ticket 15295)

## Resumen
No existía el concepto de "horario de atención" en el producto. Esta
iteración agregó: tabla `BusinessHours` (1 fila por workspace, intervalos
semanales JSONB), `BusinessHoursService` con evaluación pura y testeable,
step `checkBusinessHours` (success = dentro, skip = fuera) en el nodo
performAction, y página de settings `/space/[workspaceId]/business-hours`.

## Qué se hizo
- flow-config: `stepTypes` + schema con states `[success, skip]` + export +
  entrada en `actionSteps` (cubre publish e import/export sin tocar unions).
- database: modelo + partials zod + types + relations (import + spread) +
  migración `20260928132020_business_hours_schedule` generada e
  inspeccionada (**no aplicada**: requiere OK explícito).
- business: `BusinessHoursService` (get/upsert + `isWithinBusinessHours` +
  helper puro `isMinuteWithinSchedule`) + export en barrel.
- worker: `handleCheckBusinessHours` + registro en `flowStepHandlers`.
- builder: viewer/editor/`StepDefinition` + `allSteps` + menú performAction
  (grupo flowActions) + keys i18n en en/es/pt-BR/pt-PT (i18n:check ✅).
- settings: feature `business-hours` (schema/action/query/form) + página.
- Tests nuevos: handler (3), service (10), action scoping (1).
- Docs: `docs/context/flow/business-hours.md` (nuevo).

## Archivos cambiados
- `packages/flow-config/src/steps/check-business-hours.ts` (nuevo)
- `packages/flow-config/src/steps/step-action.ts`, `src/index.ts`, `src/shared.ts`
- `packages/database/src/{partials,relations,schema}/business-hours.ts` (nuevos)
- `packages/database/src/{partials,schema,types,relations}/index.ts`
- `packages/database/drizzle/20260928132020_business_hours_schedule/` (nuevo)
- `packages/business/src/business-hours/{service,index}.ts` (nuevos)
- `packages/business/src/index.ts`
- `apps/worker/src/integration/handlers/check-business-hours.ts` (nuevo)
- `apps/worker/src/integration/handlers/step.ts`
- `apps/builder/src/features/flows/react-flow/steps/check-business-hours/` (nuevo)
- `apps/builder/src/features/flows/react-flow/steps/index.tsx`
- `apps/builder/src/features/flows/react-flow/nodes/perform-action/menu.tsx`
- `apps/builder/src/features/business-hours/` (nuevo: schema/action/queries/components)
- `apps/builder/src/app/space/[workspaceId]/business-hours/page.tsx` (nuevo)
- `apps/builder/messages/{en,es,pt-BR,pt-PT}.json`
- Tests: `apps/worker/__tests__/check-business-hours-handler.test.ts`,
  `packages/business/__tests__/business-hours.service.test.ts`,
  `apps/builder/__tests__/business-hours-action.test.ts` (nuevos)
- `spec/feature/15295/{spec,plan,task,context}.md`

## Verificación
- `pnpm lint` ✅ (exit 0; 1 error de `useAwait` corregido a mano tras `pnpm fix`)
- typecheck ✅: flow-config, database, business, worker, builder (tsc --noEmit)
- vitest ✅: flow-config (370), database (545), business (1618 incl. 10 nuevos),
  worker (1931 incl. 3 nuevos), builder action test (1 nuevo)
- builder suite completa: solo 3 fallos pre-existentes en
  `broadcasts-calendar.test.tsx` (test date-dependiente de agosto 2026;
  verificado que falla también en árbol limpio vía `git stash -u`)
- i18n:check ✅ (4 locales en sync)

## Enmienda v2 (guía del equipo: N horarios con toggles, tz y feriados)
- Modelo reescrito: schedules nombrados (unique por workspace) con
  `timezone` override, `intervals[{start,end,days[7]}]` y `holidays[]`.
- Step con `scheduleId` + picker en editor (store oRPC for-flow) + viewer
  con nombre; settings con lista + edición; sidebar intacto.
- Migración regenerada de cero (la v1 nunca se aplicó).
- Fix display del `Select` de horas: faltaba la prop `items` (mostraba
  minutos crudos); vista previa de la lista con resumen por schedule.
- Fix DB local: la tabla v1 huérfana (vacía) se dropeó y se aplicó la v2
  (`20260929172331`, verificada: columnas + unique workspace+name).
- Verificación v2: lint exit 0, types (5 workspaces), suites sin regresión
  (solo 3 fallos pre-existentes date-dependientes en broadcasts-calendar).

## Enmienda posterior (a pedido): toggle de activado
- Columna `active` (default true) en `BusinessHours` + switch en la página.
  Schedule desactivado = se ignora = siempre dentro (fail-open).
- Migración regenerada desde cero (`20260928193123_business_hours_schedule`;
  la anterior nunca se aplicó en ningún lado).
- Tests y docs actualizados (service 11 tests, action con `active`).
- Sidebar: item bajo Secuencias (`businessHours.sidebarTitle`,
  `PERMISSION_NAV.flows`; sin cambios en guards de landing).
- Sin override de timezone: columna eliminada vía migración
  `20260929192952_business_hours_drop_timezone`; la página muestra la tz
  del workspace como referencia (`workspaceTimezoneNote`).

## Desviaciones del plan
- La evaluación hace AND con `workspaceService.isActiveNow` (ventana
  del workspace: `isActive` + `startTime`/`endTime`), no solo la tabla
  semanal. Racional: coherencia con el gate existente de mensajes
  (received-message, automated-response, comment-automation); sin schedule
  semanal el step equivale a ese gate. Sin cambio de archivos.
- Sin schedule → `success` (fail-open) como preveía la decisión 3.
- No se agregó card en el hub de tools (`ToolsList` con permisos; se linkea
  directo desde el editor del step).

## Fuera de alcance (pendiente de futuras iteraciones del ticket)
- Schedules por inbox/canal, feriados/excepciones, múltiples schedules.
- Mensaje automático fuera de horario a nivel inbox (ver #14542).
- Aplicar la migración en la DB (bloquea QA manual: ver "Cómo probar").

## Cómo probar
1. Aplicar la migración (requiere aprobación explícita):
   `pnpm --filter @chatbotx.io/database db:migrate` (SQL ya inspeccionado).
2. Levantar infra + builder + worker.
3. En un workspace: `/space/<id>/business-hours` → cargar franjas (probar
   overnight, ej. viernes 22:00–06:00, y día cerrado).
4. En un flujo: nodo performAction → Check Business Hours → conectar
   Success (dentro) y Skip (fuera) a mensajes distintos → publicar y disparar
   dentro/fuera de horario (o manipular franjas para simular).
5. Sin schedule cargado: el step siempre toma Success (fail-open documentado).
