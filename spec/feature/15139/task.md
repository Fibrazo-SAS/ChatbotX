# Tasks: Restrict flow deactivation/activation by role (ticket 15139)

References: `spec.md`, `plan.md`

- [x] Create `canToggleFlowStatus` helper (`lib/auth/flow-status-permissions.ts`) — Owner: `parent`
- [x] Expose `workspaceMemberRole` + `user` in `workspaceActionClient` ctx (`lib/safe-action.ts`) — Owner: `parent`
- [x] Server gate + blocked-attempt audit + 403 in `update-flow-action.ts` — Owner: `feature-integration`
- [x] UI gating: disable Switch + tooltip, prop threading, page capability — Owner: `feature-integration`
- [x] i18n keys: `errors.flowStatusChangeNotAllowed`, `messages.flowStatusChangeNotAllowed`, `auditLogs.details.flowActivationBlocked`, `auditLogs.details.flowDeactivationBlocked` (all locales) — Owner: `feature-integration`
- [x] Unit tests `apps/builder/__tests__/update-flow-action.test.ts` — Owner: `parent`
- [x] Docs `docs/context/flow/flow-status-permissions.md` — Owner: `parent`
- [x] Validate: `pnpm --filter builder lint` (i18n:check) + `check-types` + tests — Owner: `parent`
