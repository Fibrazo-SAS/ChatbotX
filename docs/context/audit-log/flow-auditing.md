# Flow auditing (audit log de flujos)

## Qué registra

Toda mutación de un flujo de trabajo (`flow`) emite una fila en la tabla
`AuditLog` vía `auditService.record` (builder) o `this.audit` (business). El
registro captura usuario (o `system` para jobs), workspace, acción, detalle
legible, IP/user-agent (cuando vienen del request) y timestamp.

El worker `sendAuditLog` persiste las filas. En edición **community** es un
no-op; la consulta solo existe en la UI enterprise (`/audit-logs`, superAdmin
solo-lectura).

## Acciones auditadas por operación

| Operación | Acción auditada | Detail (formato) |
| --- | --- | --- |
| Crear flow | `create` | `created a new flow ("Name", #id)` |
| Renombrar / toggle inbox | `update` | `updated a flow ("Name", #id)` |
| Activar flow | `activate` | `activated a flow ("Name", #id)` |
| Desactivar flow | `deactivate` | `deactivated a flow ("Name", #id)` |
| Publicar borrador | `publish` | `published a flow ("Name", #id)` |
| Eliminar (1 o N) | `delete` | `deleted flow(s) ("Name", #id, …)` |
| Duplicar | `duplicate` | `duplicated a flow ("Name", #id)` |
| Restaurar versión | `restore` | `restored flow version (#versionId) of flow (#flowId)` |
| Revertir borrador a publicado | `revert` | `reverted flow (#flowId) draft to its published version` |
| Importar flujo (worker) | `import` | `imported a flow ("Name", #id)` |

## Notas de diseño

- El autosave del borrador (`updateDraftFlowVersionAction`) **no** audita: se
  dispara por cada cambio de canvas; el evento con valor de auditoría es
  `publish`.
- El import de flujos corre async en el worker (`runFlowImport`); la fila de
  audit se emite tras `importService.complete` solo si `row.userId` existe
  (mismo gate que el import de contactos). Sin userId atribuible no se emite.
- `activate`/`deactivate` se distinguen de `update` para cumplimiento: el
  toggle de la tabla de flujos queda trazable por separado.
- Los details incluyen el **nombre** legible además del id (el id sigue
  presente por unicidad y para join).

## Retención

Sin política de retención automática por el momento (pendiente de definición
de producto). Los índices `AuditLog_workspaceId_createdAt_id_idx` y
`AuditLog_workspaceId_userId_createdAt_id_idx` cubren las queries de la UI.
