# Tasks: Auditoría de flujos — cierre de gaps (ticket 15141)

- [x] Audit en `duplicate-flow.action.ts` (acción `duplicate`, con nombre) — Owner: feature-integration
- [x] Audit en `restore-flow-version-action.ts` (acción `restore`) — Owner: feature-integration
- [x] Audit en `revert-to-published-action.ts` (acción `revert`) — Owner: feature-integration
- [x] Audit en worker `runFlowImport` (acción `import`, gate `row.userId`) — Owner: feature-integration
- [x] Distinguir `activate`/`deactivate` en `update-flow-action.ts` — Owner: feature-integration
- [x] Nombre del flow en details de create/update/publish/delete — Owner: feature-integration
- [x] Tests: update-flow (activate/deactivate + nombre), publish (nombre), flow-audit-actions (nuevo), flow-import-handler (audit/omitir) — Owner: debug-specialist
- [x] `pnpm lint` (ultracite) en archivos tocados + typecheck builder/business/worker — Owner: parent
- [x] Docs: `docs/context/audit-log/flow-auditing.md` — Owner: parent
