# Task Checklist: Workspaces admin view — owner counter, owners ABM, row actions (#15136)

> References: [spec.md](./spec.md), [plan.md](./plan.md). Approval: plan approved 2026-09-23.

## Task Checklist

1. [x] (Owner: feature-integration) Extend `adminWorkspaceResource` schema + add request schemas for row actions — `apps/builder/src/features/admin/schema/admin-workspace.ts`. Reference plan.md §1.
2. [x] (Owner: feature-integration) Extend `listAdminWorkspaces` with `isActive`, `scheduledDeletionAt`, `members`, `ownerCount` — `apps/builder/src/features/admin/queries/list-admin-workspaces.ts`. Reference plan.md §1.
3. [x] (Owner: feature-integration) Add platform-admin server actions: status toggle, schedule deletion, cancel deletion — `apps/builder/src/features/admin/actions/*.action.ts`. Reference plan.md §2.
4. [x] (Owner: feature-integration) Build the members ABM dialog — `apps/builder/src/features/admin/components/manage-workspace-owners-dialog.tsx` (reuses `/admin/users` member actions). Reference plan.md §3.
5. [x] (Owner: feature-integration) Update the table: clickable owner counter, state badges, Actions dropdown + deletion confirm — `apps/builder/src/features/admin/components/admin-workspaces-table.tsx`. Reference plan.md §3.
6. [x] (Owner: feature-integration) i18n keys `platformAdmin.workspaces.*` in `en.json` + `es.json`. Reference plan.md §4.
7. [x] (Owner: feature-integration) Tests: `admin-workspace-actions.test.ts` + `list-admin-workspaces.test.ts`. Reference plan.md §5.
8. [x] (Owner: feature-integration) Docs: `docs/context/feature/admin-workspace-directory.md`. Reference plan.md §6.

## Completion Criteria
- [x] All checklist items marked done
- [x] `pnpm --filter builder lint` (i18n check) passed
- [x] `pnpm --filter builder check-types` passed
- [x] Targeted tests passed (5/5) — `admin-workspace-actions.test.ts`, `list-admin-workspaces.test.ts`
- [x] Documentation updated
