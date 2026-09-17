# Spec: Auditoría de cambios en flujos por workspace (cierre de gaps)

## Ticket
- **URL**: https://redmine.fibrazo.example/issues/15141 (tracker fibrazo)
- **Tracker**: Feature (Security / Auditing)
- **Priority**: Normal — Complexity: Medium
- **Goal**: Completar el audit logging de los flujos de trabajo: toda mutación de un flow registra quién, qué, cuándo y en qué workspace, consultable en la UI enterprise de audit-logs existente.

## Problema
El sistema de audit logging ya existe en la plataforma (tabla `AuditLog`, `auditService`, worker `sendAuditLog`, UI enterprise `/audit-logs`), pero la cobertura sobre los flujos es parcial:

- `create` y `update` (incluido el toggle activo/inactivo) auditan con detail que solo lleva el **id** del flow, sin nombre.
- `publish` audita igual (sin nombre).
- `delete` audita (sin nombre).
- **No auditan**: `duplicate`, `restore version`, `revert to published`, `import` (el import de flujos corre async en el worker y no emite fila de audit).
- El toggle de activación se registra como `"update"` genérico, no como `activate`/`deactivate` — incumple las acciones pedidas en el ticket.

## Criterios de aceptación
- [ ] `duplicate` de un flow emite audit row con acción `duplicate` (usuario, workspace, id y nombre).
- [ ] `restore version` emite audit row con acción `restore` (id del flow y de la versión restaurada).
- [ ] `revert to published` emite audit row con acción `revert`.
- [ ] Import de flujo (worker) emite audit row con acción `import` (usuario atribuible = el que inició el import; si no hay userId no se emite — mismo patrón que contacts).
- [ ] Toggle activo/inactivo emite `activate` / `deactivate` en lugar de `update` genérico.
- [ ] Los details de `create`/`update`/`publish`/`delete` incluyen el **nombre** del flow además del id.
- [ ] Los logs son visibles en la UI enterprise de audit-logs existente (filtro por keyword/acción ya funciona).
- [ ] Tests actualizados/agregados pasan; `pnpm lint` y typecheck del builder limpios.
- [ ] Sin migraciones de DB (la tabla `AuditLog` ya existe con índices).
- [ ] Sin cambios de UI (la página de audit-logs ya existe y es solo-lectura para superAdmin).

## Skills & Rules
- .agents/skills/business-data-access (audit en capa de negocio vía `BaseService.audit`)
- .agents/skills/worker-development (audit en `runFlowImport`)
- Reglas: data-access (no `db` directo nuevo en capa de app para escrituras de audit), i18n (sin strings nuevos de UI en este alcance), git.md.

## Do's and Don'ts
- SÍ usar `auditService.record` (actions de builder) y `this.audit` (services de business) — nunca tocar el modelo `AuditLog` directamente.
- SÍ reutilizar el patrón de import de contacts (`base-import.ts`): emitir solo si `row.userId` existe, con `source` explícito.
- NO agregar migraciones ni columnas a `AuditLog` en este alcance.
- NO auditar el autosave del borrador (`updateDraftFlowVersionAction`) — se dispara por keystroke; el evento con valor es `publish`.
- NO tocar la UI de audit-logs ni sus permisos (ya solo superAdmin).
- Los strings de `detail` mantienen el estilo existente en inglés, ej. `"created a new flow (\"Name\", #id)"`.

## Docs to Update
- docs/context/audit-log/flow-auditing.md (nuevo — cobertura de acciones auditadas por operación de flow y formato del detail).
