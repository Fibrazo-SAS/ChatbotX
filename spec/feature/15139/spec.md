# Specification: Restrict flow deactivation/activation by role

## Ticket
- **URL**: Redmine issue #15139 (project: Sysbrazo) — "Chatbox: Restricción de desactivación de flujos de trabajo por rol"
- **Tracker**: Feature
- **Priority**: High
- **Complexity**: Medium
- **Goal**: The "Agent" workspace role must not be able to deactivate (or activate) flows. Only the workspace owner and superAdmin (tenant-level or global) may change a flow's active status.

## Problem
Today any workspace member with the `flows` permission flag can toggle a flow's `active` status from the flows table (status column Switch → `updateFlowAction`), regardless of their `WorkspaceMemberRole` (`owner` | `agent`). This allows agents to accidentally or maliciously disable critical flows. There is no server-side role check and no audit trail for unauthorized attempts.

## Acceptance Criteria
- [ ] Server-side: an agent (`role === "agent"`, no `superAdmin` permission flag) attempting to change a flow's `active` status is rejected with a 403 and a friendly, translated message.
- [ ] Server-side: the workspace **owner** can activate/deactivate flows.
- [ ] Server-side: an agent with the tenant-level `superAdmin` permission flag can activate/deactivate flows.
- [ ] Server-side: a global super admin (`isPlatformSuperAdmin`) can activate/deactivate flows.
- [ ] Server-side: renaming a flow via `updateFlowAction` remains allowed for agents (the restriction only applies to the `active` status change).
- [ ] UI: the flows table status column is **hidden** for agents that are not allowed (no disabled-looking toggle, no tooltip). The workspace card status switch ("active hours") follows the same rule: hidden for members without the superAdmin permission.
- [ ] Audit: every blocked attempt records an audit log entry identifying the action (e.g. `flowActivationBlocked` / `flowDeactivationBlocked`), the user, their role, timestamp, and the target flow.
- [ ] Tests: `pnpm lint` + typecheck pass and new unit tests cover owner allowed, agent blocked, tenant superAdmin allowed, blocked-attempt audit record, and agent rename still allowed.

## Skills & Rules
Load these skills:
- `.agents/skills/security-review` (role-based authorization change)
- `.agents/skills/builder-ui-i18n` (Switch/tooltip UI + translation keys)
- `.agents/skills/testing-workflow` (verification gate)

Rules to follow:
- i18n is mandatory (invariant #7): all user-facing strings via `useTranslations()` / `getTranslations()`; never hardcode labels.
- No new direct `db` imports in the app layer (invariant #9 / `.agents/rules/data-access.md`). `update-flow-action.ts` already imports `db` (legacy exception); this change must not add new direct DB reads — use the existing `ctx.workspaceMemberPermissions` and audit context role.
- Keep the `workspaceActionClient` middleware change additive and backward compatible (254 callers).
- Preserve the existing audit distinction between `activate` and `deactivate` actions in `update-flow-action.ts`.
- Do NOT change the WhatsApp Flows table (read-only external view) or any other surface — the flows table toggle is the only deactivation surface.

## Docs to Update
- `docs/context/flow/flow-status-permissions.md` (new) — who may change flow `active` status, and how blocked attempts are audited.
