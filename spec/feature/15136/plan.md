# Plan: Workspaces admin view — owner counter, owners ABM, and row actions (ticket 15136)

## Approach

Thin-layer addition on top of an already-complete backend. All business logic needed by the ticket exists in `packages/business`:

- `WorkspaceMemberService.addMemberForPlatformAdmin({ workspaceId, userId, role })`
- `WorkspaceMemberService.updateMembershipForPlatformAdmin({ workspaceId, userId, role, permissions? })` — includes the "never demote the last owner" guard
- `WorkspaceMemberService.removeMemberForPlatformAdmin({ workspaceId, userId })` — includes the "never remove the last owner" guard
- `workspaceService.update({ id, data: { isActive } })`, `workspaceService.scheduleDeletion({ id })` + `workspaceLifecycleService.freezeWorkspaceRuntime(id)`, `workspaceService.cancelDeletion({ id })`

So the work is: (1) extend the admin list query/schema with owner count and workspace state, (2) add five thin `superAdminActionClient` server actions, (3) build the owners dialog and the Actions dropdown column, (4) i18n, (5) tests, (6) docs.

**Decisions (defaults — pending spec approval):**
1. Target surface: `/admin/workspaces` only (platform super-admin directory). The builder home card grid is out of scope.
2. The "owners" column becomes a clickable counter badge (`ownerCount` + i18n pluralization); the owner name list moves inside the ABM dialog. This matches the ticket ("contador en número" + click → popup).
3. ABM dialog manages **all members** (owners and agents) of the workspace — the ticket's "cambiar rol (propietario → agente)" implies listing non-owners too; listing only owners would make "change role" and "add as agent" impossible. The counter stays owner-specific.
4. "Desactivar" = `isActive: false` (mirrors `updateWorkspaceStatusAction` semantics); the row action is a toggle (Deactivate / Activate).
5. Soft delete = the existing `scheduledDeletionAt` convention (invariant #14); the Actions menu offers "Cancel deletion" only when `scheduledDeletionAt` is set.
6. Server actions take an explicit `workspaceId` input (no route-context bind) since the dialog/table operate over arbitrary workspaces.

## Changes

### 1. Admin list query + schema

- **`apps/builder/src/features/admin/queries/list-admin-workspaces.ts`**
  - Add `isActive` and `scheduledDeletionAt` to the `columns` select.
  - In the response map, add `ownerCount: owners.length` (owners array already filtered by role).
  - (No new direct-db pattern: this legacy file already imports `db`; only the existing select is extended.)

- **`apps/builder/src/features/admin/schema/admin-workspace.ts`**
  - `adminWorkspaceResource`: add `ownerCount: z.number()`, `isActive: z.boolean()`, `scheduledDeletionAt: z.date().nullish()`.
  - Add request schemas for the new actions (below) following the existing `createAdminWorkspaceRequest` style (zod, min/max, enum reuse from `@chatbotx.io/database/partials` `workspaceMemberRoles` where applicable).

### 2. New server actions (`apps/builder/src/features/admin/actions/`)

All use `superAdminActionClient` (same as `createAdminWorkspaceAction`) — the client already rejects non-platform-super-admins server-side. Throw `ChatbotXException` with translated messages on service errors (e.g. "cannot remove the last owner").

- `add-workspace-member.action.ts` → `workspaceMemberService.addMemberForPlatformAdmin({ workspaceId, userId, role })`
- `update-workspace-member-role.action.ts` → `workspaceMemberService.updateMembershipForPlatformAdmin({ workspaceId, userId, role })`
- `remove-workspace-member.action.ts` → `workspaceMemberService.removeMemberForPlatformAdmin({ workspaceId, userId })`
- `update-workspace-status.action.ts` → `workspaceService.update({ id: workspaceId, data: { isActive } })`
- `schedule-workspace-deletion.action.ts` → `workspaceService.scheduleDeletion({ id })` + `workspaceLifecycleService.freezeWorkspaceRuntime(workspaceId)` (mirrors the workspace-scoped action)
- `cancel-workspace-deletion.action.ts` → `workspaceService.cancelDeletion({ id })`

### 3. UI (`apps/builder/src/features/admin/components/`)

- **`manage-workspace-owners-dialog.tsx`** (new, client component)
  - Trigger: the owner counter badge in the table row (also callable from the Actions dropdown "Manage owners").
  - Lists members (name, email, role badge) from the row's owners/members data, refreshed after each mutation (`router.refresh()`).
  - "Add member": combobox search over `listPlatformUsers({ keyword })` (existing server query) + role select (`owner` | `agent`).
  - "Change role" and "Remove" per member, with confirm for removal.
  - Surface service guard errors (last owner) as translated `toast.error` from the action `onError`.
- **`admin-workspaces-table.tsx`** (edit)
  - Replace the owners name-list cell with a clickable counter badge (`platformAdmin.workspaces.owners.count` with pluralization) opening `ManageWorkspaceOwnersDialog`.
  - New "Actions" column: `DropdownMenu` (per-row) with Activate/Deactivate, Manage owners, Schedule deletion / Cancel deletion (conditional on `isActive` / `scheduledDeletionAt`). Use confirm dialogs for destructive actions (mirror existing `DeleteWorkspaceMemberDialog` pattern).
  - Row state: badge for scheduled-for-deletion workspaces; muted/inactive indicator when `isActive === false`.
- **`apps/builder/src/app/admin/workspaces/page.tsx`** (no functional change; verify `router.refresh()` behavior via table re-fetch after actions — the table is fed by `promises` from the server, so actions close with `router.refresh()` like `CreateAdminWorkspaceDialog` does today).

### 4. i18n

- `apps/builder/messages/en.json` + `es.json` — new keys under `platformAdmin.workspaces.*`:
  - `owners.count` ("{count} owner" / "{count} owners" — use next-intl plural), `owners.manageTitle`, `owners.addMember`, `owners.changeRole`, `owners.remove`, `owners.removeConfirm`, `owners.lastOwnerError`, `owners.memberAdded`, `owners.memberRemoved`, `owners.roleChanged`
  - `actions.deactivate` / `actions.activate` / `actions.scheduleDeletion` / `actions.cancelDeletion` (+ confirm/error/success toasts)
  - `state.scheduledForDeletion` badge label, `state.inactive` indicator
- Check existing keys first (table already uses `platformAdmin.workspaces.owner`, `.members`, `.tenant`, `.createdAt`, `.platformTenant`).

### 5. Tests

- **`apps/builder/__tests__/admin-workspace-actions.test.ts`** (new) — mirror existing action-test mocking style (e.g. `update-flow-action.test.ts`):
  - add member → `addMemberForPlatformAdmin` called with parsed input.
  - update role → service called; service "last owner" error surfaces as `ChatbotXException`.
  - remove member → service called; last-owner guard error surfaced.
  - status action → `workspaceService.update` with `isActive`.
  - schedule deletion → `scheduleDeletion` + `freezeWorkspaceRuntime` called; cancel → `cancelDeletion` called.
  - non-platform-admin rejected by `superAdminActionClient` (client-level test if the pattern allows; otherwise covered by the shared client's existing tests).
- **`apps/builder/__tests__/list-admin-workspaces.test.ts`** (new, small) — response includes `ownerCount` and state fields with the expected values.

### 6. Docs

- `docs/context/feature/admin-workspace-directory.md` (new): columns, owners ABM, row actions, platform-admin authorization, soft-delete lifecycle.

## Files affected

| File | Change |
|---|---|
| `apps/builder/src/features/admin/queries/list-admin-workspaces.ts` | add `isActive`, `scheduledDeletionAt`, `ownerCount` |
| `apps/builder/src/features/admin/schema/admin-workspace.ts` | extend resource; add request schemas |
| `apps/builder/src/features/admin/actions/add-workspace-member.action.ts` | new |
| `apps/builder/src/features/admin/actions/update-workspace-member-role.action.ts` | new |
| `apps/builder/src/features/admin/actions/remove-workspace-member.action.ts` | new |
| `apps/builder/src/features/admin/actions/update-workspace-status.action.ts` | new |
| `apps/builder/src/features/admin/actions/schedule-workspace-deletion.action.ts` | new |
| `apps/builder/src/features/admin/actions/cancel-workspace-deletion.action.ts` | new |
| `apps/builder/src/features/admin/components/manage-workspace-owners-dialog.tsx` | new |
| `apps/builder/src/features/admin/components/admin-workspaces-table.tsx` | counter badge, Actions column, state badges |
| `apps/builder/messages/en.json`, `es.json` | new `platformAdmin.workspaces.*` keys |
| `apps/builder/__tests__/admin-workspace-actions.test.ts` | new |
| `apps/builder/__tests__/list-admin-workspaces.test.ts` | new |
| `docs/context/feature/admin-workspace-directory.md` | new |

## Risk assessment

**Low–Medium.**
- Backend already exists (all three member ABM methods with last-owner guards; schedule/cancel deletion). No DB migrations, no schema changes.
- New actions are additive and use the existing `superAdminActionClient` — no shared-file middleware changes (unlike #15139).
- Main risks: (a) list payload grows per row (members already loaded — acceptable at pagination cap of 50/row); (b) UI refresh semantics after mutations in a table fed by server-side `promises` — mitigated by `router.refresh()` as `CreateAdminWorkspaceDialog` already does.
- The owners counter will show "0 owners" for a workspace with no owner (possible in legacy data) — the dialog must not block adding an owner in that state; the last-owner guard naturally does not trigger when count is 0.

## Approval gates

- Plan approval required before coding (explicit "ok"/"aprobado"/"approved").
- No DB migrations. No changes to workspace-scoped member management or the home cards list.
- After implementation: `pnpm lint` + typecheck + tests, then `context.md` + docs update.
