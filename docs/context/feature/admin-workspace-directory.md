# Admin workspace directory: owner counter, members ABM, and row actions

> Ticket: #15136 (Sysbrazo) — implemented 2026-09.

## Surface

The platform workspace directory (`/admin/workspaces`) — the only
table-based workspace list in the product — is gated to the platform super
admin by `apps/builder/src/app/admin/layout.tsx`
(`isPlatformSuperAdmin`). Navigation gating only; every mutating server
action below also runs through `superAdminActionClient`
(`apps/builder/src/lib/safe-action.ts`), which is the authorization source of
truth.

## List payload

`listAdminWorkspaces` (`features/admin/queries/list-admin-workspaces.ts`)
returns per row (schema: `features/admin/schema/admin-workspace.ts`
`adminWorkspaceResource`):

- `owners` — members with `role === "owner"` (id, name, email)
- `members` — **all** members with their role (drives the ABM dialog)
- `ownerCount` / `memberCount` — derived counts
- `isActive`, `scheduledDeletionAt` — row state for badges and actions

The owners column renders the **clickable counter** ("N owners",
i18n-pluralized). Clicking it (or "Manage members" in the row Actions menu)
opens `ManageWorkspaceOwnersDialog`.

## Members ABM

`features/admin/components/manage-workspace-owners-dialog.tsx` reuses the
existing platform-admin member actions from the `/admin/users` console
(`features/users/actions/`):

- `addUserToWorkspaceAction` → `WorkspaceMemberService.addMemberForPlatformAdmin`
- `updateUserMembershipAction` → `updateMembershipForPlatformAdmin`
- `removeUserMembershipAction` → `removeMemberForPlatformAdmin`

The **last-owner guards live server-side** in
`packages/business/src/workspace-member/service.ts` (never remove/demote the
workspace's last owner). The dialog does optimistic UI + revert on error and
surfaces service errors as toasts (serverError text, same convention as the
users console). Add-member searches users through `listPlatformUsers`
(client-side filter over the first 100 users, mirroring
`CreateAdminWorkspaceDialog`).

## Row actions (Actions column)

| Action | Action file | Service call |
|---|---|---|
| Activate / Deactivate | `update-workspace-status.action.ts` | `workspaceService.update({ data: { isActive } })` |
| Delete workspace (soft) | `schedule-workspace-deletion.action.ts` | `workspaceService.scheduleDeletion` + `workspaceLifecycleService.freezeWorkspaceRuntime` |
| Cancel deletion | `cancel-workspace-deletion.action.ts` | `workspaceService.cancelDeletion` |

Soft delete follows the platform convention (invariant #14):
`scheduledDeletionAt` + 24h grace, then the `purgeWorkspaces` cron
disconnects integrations and hard-deletes. The delete action goes through an
`AlertDialog` confirm; status changes are direct (reversible). Rows show a
"destructive" badge when scheduled for deletion and an "inactive" badge when
`isActive` is false; the Actions menu adapts (cancel vs schedule, activate vs
deactivate). All actions call `router.refresh()` on success so the
server-rendered table re-fetches.

These actions differ from the workspace-scoped
`update-workspace-status-action` / `schedule-workspace-deletion-action`
(`features/workspaces/actions/`): those require **workspace membership**
superAdmin, while the admin-console versions are gated to the **platform**
super admin and take an explicit `workspaceId` input.

## i18n

New keys under `platformAdmin.workspaces.*` in
`apps/builder/messages/en.json` + `es.json` (`owners.*`, `actions.*`,
`state.*`). Other locales fall back to English (existing convention). The
`messages/en.d.json.ts` types file is next-intl-generated — it refreshes on
the next dev/build run.
