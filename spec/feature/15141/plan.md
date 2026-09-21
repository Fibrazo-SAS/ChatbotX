# Plan: Auditoría de flujos — cierre de gaps (ticket 15141)

## Approach

Sin cambios de schema ni UI. Solo se completan las emisiones de audit en las operaciones de flow que hoy no registran, se distingue `activate`/`deactivate`, y se enriquece el `detail` con el nombre del flow.

Mecánica existente que se reutiliza (sin tocarla):
- `auditService.record({ workspaceId, action, detail })` → encola job `sendAuditLog` → worker inserta en `AuditLog` (no-op en community).
- Actor/contexto: en acciones de builder viene de `workspaceActionClient` (AsyncLocalStorage); en el worker de `runGuardedDefaultJob` → `runJobWithAuditContext`.
- UI enterprise `/audit-logs` ya lista los logs con filtros.

Decisiones:
1. **Duplicar**: auditar en el **action** (`duplicate-flow.action.ts`) después de que `flowService.duplicate` devuelve el id — se necesita el nombre; se obtiene con un `flowService.findBy` previo (o se pasa el nombre desde el action). Acción `duplicate`.
2. **Restore / revert**: auditar en los **actions** (`restore-flow-version-action.ts`, `revert-to-published-action.ts`) con `auditService.record`. Detail incluye flowId y versionId (restore). Acción `restore` / `revert`.
3. **Import**: auditar en el **worker** (`apps/worker/src/default/handlers/imports/flow-import.ts`), después de `importService.complete`, solo si `row.userId` existe (espejo de `base-import.ts` contacts). Detail con nombre del flujo importado. Acción `import`.
4. **Activate/deactivate**: en `update-flow-action.ts`, si el cambio es solo/en parte el campo `active`, emitir acción `activate` o `deactivate` según el valor; resto de cambios sigue `update`. Detail con nombre.
5. **Nombres en details**: `create` usa `parsedInput.name`; `update`/`publish` usan `flow.name` (ya cargado); `delete` en `flowService.deleteMany` ya carga los flows — agregar nombre al detail existente.

## Files Affected

| Archivo | Cambio |
| --- | --- |
| `apps/builder/src/features/flows/actions/duplicate-flow.action.ts` | **Editar** — emitir `auditService.record` acción `duplicate` con nombre del flow. |
| `apps/builder/src/features/flows/actions/restore-flow-version-action.ts` | **Editar** — emitir `auditService.record` acción `restore` (flowId + versionId). |
| `apps/builder/src/features/flows/actions/revert-to-published-action.ts` | **Editar** — emitir `auditService.record` acción `revert`. |
| `apps/builder/src/features/flows/actions/update-flow-action.ts` | **Editar** — distinguir `activate`/`deactivate`; agregar nombre al detail de `update`. |
| `apps/builder/src/features/flows/actions/create-flow-action.ts` | **Editar** — agregar nombre al detail de `create`. |
| `apps/builder/src/features/flows/actions/publish-flow-action.ts` | **Editar** — agregar nombre al detail de `publish`. |
| `packages/business/src/flow/service.ts` | **Editar** — detail de `deleteMany` con nombre(s) de flow(s). |
| `apps/worker/src/default/handlers/imports/flow-import.ts` | **Editar** — emitir audit `import` tras `complete`, solo si `row.userId`. |
| `apps/builder/__tests__/update-flow-action.test.ts` | **Editar** — asserts nuevos de activate/deactivate y nombre en detail. |
| `apps/builder/__tests__/publish-flow-action.test.ts` | **Editar** — assert del detail con nombre. |
| `packages/business/__tests__/flow.service.test.ts` | **Editar** — assert del detail de deleteMany con nombre (mock del dispatcher). |
| `apps/worker/__tests__/flow-import-handler.test.ts` | **Editar** — assert de audit emitido/omitido según `userId`. |
| `docs/context/audit-log/flow-auditing.md` | **Nuevo** — documentar acciones auditadas y formato de detail. |

## Tests
1. `update-flow-action`: toggle `active:false→true` emite `activate`; `true→false` emite `deactivate`; rename sigue `update`; detail incluye nombre.
2. `publish-flow-action`: detail incluye nombre del flow.
3. `flow.service` deleteMany: detail incluye nombres.
4. `flow-import-handler`: con `userId` emite audit `import`; sin `userId` no emite.

## Risk Assessment
- **Low**: solo se agregan llamadas de audit (fire-and-forget a cola); no cambia comportamiento funcional ni datos. Los jobs de audit son no-op en community edition. Riesgo principal: romper asserts de tests existentes — se actualizan en el mismo cambio.

## Approval Gate
**REQUIRED**: aprobación explícita antes de implementar.
