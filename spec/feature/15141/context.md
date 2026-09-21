# Context: Auditoría de flujos — cierre de gaps (ticket 15141)

## Resumen
La infraestructura de audit logging ya existía (tabla `AuditLog`,
`auditService`, worker `sendAuditLog`, UI enterprise `/audit-logs`). Esta
iteración cerró los gaps de cobertura sobre los flujos sin tocar schema ni UI.

## Qué se hizo
- Audit agregado a: duplicate, restore version, revert to published, import
  de flujos (worker, gateado por `row.userId`).
- El toggle activo/inactivo emite `activate`/`deactivate` en vez de `update`.
- Details de create/update/publish/delete ahora incluyen el nombre del flow.
- Tests nuevos/actualizados en builder, business y worker.

## Archivos cambiados
- `apps/builder/src/features/flows/actions/duplicate-flow.action.ts`
- `apps/builder/src/features/flows/actions/restore-flow-version-action.ts`
- `apps/builder/src/features/flows/actions/revert-to-published-action.ts`
- `apps/builder/src/features/flows/actions/update-flow-action.ts`
- `apps/builder/src/features/flows/actions/create-flow-action.ts`
- `apps/builder/src/features/flows/actions/publish-flow-action.ts`
- `packages/business/src/flow/service.ts` (detail de deleteMany)
- `apps/worker/src/default/handlers/imports/flow-import.ts`
- `apps/builder/__tests__/update-flow-action.test.ts`
- `apps/builder/__tests__/publish-flow-action.test.ts`
- `apps/builder/__tests__/flow-audit-actions.test.ts` (nuevo)
- `apps/worker/__tests__/flow-import-handler.test.ts`
- `docs/context/audit-log/flow-auditing.md` (nuevo)
- `spec/feature/15141/{spec,plan,task,context}.md`

## Verificación
- typecheck: builder ✅, business ✅, worker ✅ (tsc --noEmit)
- ultracite check en archivos tocados ✅ (1 error de nested ternary corregido)
- vitest: builder (update/publish/audit-actions/audit-logs-query/download/export: 31 tests), business (flow/flow-version/audit: 23), worker (flow-import/run-import/send-audit-log: 21) — todos ✅

## Desviaciones del plan
- Ninguna estructural. Se agregó test dedicado `flow-audit-actions.test.ts`
  para los 3 actions nuevos (no estaba listado explícitamente).

## Fuera de alcance (pendiente de futuras iteraciones del ticket)
- `changesDetails` JSON estructurado (requiere migración de schema).
- Endpoint público/API para consulta de audit logs (hoy solo UI enterprise).
- Política de retención automática de logs.

## Cómo probar
1. Levantar infra + apps (`docker compose up -d` + `pnpm dev` en edition
   enterprise, o al menos builder+worker+realtime).
2. En un workspace: crear, renombrar, activar/desactivar, duplicar, publicar,
   restaurar versión, revertir, eliminar e importar un flujo.
3. Como superAdmin: `/space/[workspaceId]/audit-logs` → verificar filas con
   acciones `create|update|activate|deactivate|publish|delete|duplicate|restore|revert|import`
   y details con nombre del flow.
4. En community edition los jobs de audit son no-op (comportamiento esperado).
