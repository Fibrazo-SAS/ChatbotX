# Specification: Workspaces admin view — owner counter, owners ABM, and row actions

## Ticket
- **URL**: Redmine issue #15136 (project: Sysbrazo) — "Chatbox: Mejorar vista de Espacios de Trabajo - Contador de propietarios y ABM integrado"
- **Tracker**: Feature
- **Priority**: Normal
- **Complexity**: Medium (per ticket)
- **Goal**: Improve the platform workspace directory (`/admin/workspaces`) so the super admin can (1) see the number of owners per workspace at a glance, (2) manage owners (add / remove / change role) from a popup without leaving the view, and (3) deactivate or soft-delete a workspace from a per-row "Actions" column.

## Problem
Today the platform workspace directory (`apps/builder/src/app/admin/workspaces`) renders a `DataTable` with name, owners (list of names), member count, tenant, and creation date. There is no owner count indicator, no way to manage a workspace's owners from that screen (the admin must go into each workspace or use `/admin/users`), and no per-row actions to deactivate or soft-delete a workspace.

Scope note: this ticket targets the **platform super-admin directory** (`/admin/workspaces`), the only table-based workspace list in the product. The builder home (`WorkspacesList`) is a card grid and is out of scope.

## Acceptance Criteria
- [ ] The workspaces table shows a per-row **owner counter** ("3 owners" / "1 owner", i18n-pluralized), replacing the plain name list in the "owners" column.
- [ ] Clicking the counter opens a **popup dialog** that lists the workspace's current owners (name, email, role).
- [ ] Inside the popup the admin can:
  - **Add** a user as owner/agent (user search via existing `listPlatformUsers`, role assignment).
  - **Remove** a member.
  - **Change** a member's role (owner ↔ agent).
- [ ] Validation: removing or demoting the **last owner** is rejected with a translated error toast (service guard already exists — see `WorkspaceMemberService.removeMemberForPlatformAdmin` / `updateMembershipForPlatformAdmin`; the UI must surface the thrown error, not reimplement the guard).
- [ ] New **"Actions" column** with, per workspace: **Deactivate** / **Activate**, **Schedule deletion**, and **Cancel deletion** (only when deletion is already scheduled).
- [ ] Soft delete uses the existing `Workspace.scheduledDeletionAt` convention (invariant #14): 24h grace window, `purgeWorkspaces` cron disconnects integrations then hard-deletes. No physical delete from this UI.
- [ ] The list reflects workspace state: workspaces scheduled for deletion show a badge, and their row actions adapt (no duplicate schedule, cancel available; deactivated workspaces show an "inactive" indicator and allow re-activation).
- [ ] Authorization: every new server action is gated to the platform super admin (`superAdminActionClient`, same pattern as `createAdminWorkspaceAction`). The `admin/layout.tsx` `isPlatformSuperAdmin` gate is navigation-only and must not be the only check.
- [ ] i18n: all user-facing strings via `useTranslations()`/`getTranslations()` under `platformAdmin.workspaces.*` (invariant #7). `en.json` + `es.json`; other locales fall back to English.
- [ ] Quality gate: `pnpm lint` + typecheck pass; new unit tests cover the new actions (allowed / last-owner guard / non-platform-admin rejection) and the query response shape.

## Skills & Rules
Load these skills:
- `.agents/skills/builder-ui-i18n` (DataTable column, dialog, dropdown, toasts + translation keys)
- `.agents/skills/feature-scaffold` (admin feature structure: actions/, components/, schema/)
- `.agents/skills/testing-workflow` (verification gate: lint → types → tests)
- `.agents/skills/security-review` (new authorization surface: platform-admin actions)

Rules to follow:
- Invariant #7 (i18n): never hardcode labels/placeholders/toasts.
- Invariant #9 / `.agents/rules/data-access.md`: new app-layer code must NOT import `db` — go through `workspaceService`, `workspaceLifecycleService`, and `workspaceMemberService` (all platform-admin methods already exist).
- Invariant #14: soft delete = `scheduledDeletionAt` convention; mirror `scheduleWorkspaceDeletionAction` (schedule + freeze) and `cancelWorkspaceDeletionAction` (cancel) but with platform-admin auth.
- Authorization is server-side; UI hiding/disabled states are UX only.
- `.bind()` + `bindArgsSchemas` invariant (#4): if any new action binds `workspaceId`, call `.bind(null, workspaceId)` on the client side.

## Do's and Don'ts
- DO reuse the existing business services; the backend for the owners ABM **already exists** (`addMemberForPlatformAdmin`, `updateMembershipForPlatformAdmin`, `removeMemberForPlatformAdmin` with last-owner guards). Only thin safe-action wrappers + UI are needed.
- DO use `superAdminActionClient` for every new action.
- DON'T modify the workspace-scoped member management (`features/workspace-members`) or the workspace-scoped status/deletion actions.
- DON'T change the builder home `WorkspacesList` card grid.
- DON'T add new direct `db` queries in app code; `list-admin-workspaces.ts` already imports `db` (legacy) — extend its existing select only.
- DON'T create new translation keys before checking `apps/builder/messages/en.json` → `platformAdmin.workspaces.*`.

## Docs to Update
- `docs/context/feature/admin-workspace-directory.md` (new) — directory columns, owners ABM flow, row actions, platform-admin authorization model, soft-delete behavior.
