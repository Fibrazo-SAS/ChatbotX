# Plan: Restrict flow deactivation/activation by role (ticket 15139)

## Approach

Defense in depth: **server-side authorization** (authoritative) + **UI gating** (UX). Agents keep all existing flow permissions (rename, edit, publish, etc.); only the flow `active` status toggle is restricted.

**Decisions (defaults — spec open questions):**
1. Scope: only the `active` toggle. `enableInInbox` stays unrestricted (it does not deactivate the flow).
2. The whole toggle is blocked for agents (cannot activate nor deactivate) — simpler and safer UX.
3. UI: the Switch is **disabled with an explanatory tooltip** (not hidden), so agents still see the real flow status.
4. "superAdmin" mapping: `role === "owner"` OR tenant-level `permissions.superAdmin === true` OR global `isPlatformSuperAdmin(user)`.

## Changes

### 1. Server-side gate (authoritative)

- **`apps/builder/src/lib/auth/flow-status-permissions.ts`** (new)
  Shared pure helper `canToggleFlowStatus({ role, permissions, user })`:
  `role === "owner" || hasWorkspacePermission(permissions, "superAdmin") || isPlatformSuperAdmin(user)`.
  Reused by the RSC page (UI gating) and the server action (authorization) so they cannot drift.

- **`apps/builder/src/lib/safe-action.ts`**
  In `workspaceActionClientAllowExpired`, expose `workspaceMemberRole: member.role` and `user: ctx.user` in the returned ctx. Additive only — no behavior change for the 254 existing callers.

- **`apps/builder/src/features/flows/actions/update-flow-action.ts`**
  - Export `updateFlow` (mirrors the `publishFlow` pattern) for direct unit testing.
  - When `parsedInput.active !== undefined && parsedInput.active !== flow.active` (state change) and `canToggleFlowStatus(...)` is false:
    1. `auditService.record({ workspaceId, flowId, action: "flowActivationBlocked" | "flowDeactivationBlocked", detail: t("auditLogs.details.flowDeactivationBlocked", { name }) })` — the audit actor already carries userId, role, ipAddress, timestamp (set by the workspace middleware).
    2. Throw `new ChatbotXException(t("errors.flowStatusChangeNotAllowed"), "flowStatusChangeNotAllowed", 403)` → surfaced as a translated toast by the safe-action error handler.
  - Rename (`name`) and `enableInInbox` updates are NOT gated (agents keep them).

### 2. UI gating

- **`apps/builder/src/features/flows/flows-table-columns.tsx`**
  New prop `canToggleFlowStatus: boolean`. Status column Switch: `disabled={isPending || !canToggleFlowStatus}` + Tooltip (`messages.flowStatusChangeNotAllowed`) when not allowed. Add `onError` toast fallback for stale-session races.

- **`apps/builder/src/features/flows/flows-table.tsx`**
  Accept and forward `canToggleFlowStatus` to `getFlowColumns` (added to `useMemo` deps).

- **`apps/builder/src/app/space/[workspaceId]/(has-folder)/flows/page.tsx`**
  After `requireWorkspacePermission(workspaceId, "flows")`, compute the capability from `getCurrentUserAndTargetWorkspace(workspaceId)` (React `cache`-ed — no extra DB round-trip) and pass it to `FlowsTable`. Fail closed (`false`) when membership is missing.

### 3. i18n

- `apps/builder/messages/en.json` + `es.json`:
  - `errors.flowStatusChangeNotAllowed` — server 403 message ("Only the owner or a superAdmin can activate or deactivate flows.").
  - `messages.flowStatusChangeNotAllowed` — tooltip label.
  - `auditLogs.details.flowActivationBlocked` / `flowDeactivationBlocked` — audit log details.
  Other locales fall back to English (existing convention).

### 4. Tests

- **`apps/builder/__tests__/update-flow-action.test.ts`** (new, mirrors `publish-flow-action.test.ts` mocking style):
  - owner can deactivate (no throw, audit `deactivate` recorded).
  - agent without superAdmin → throws 403 + audit `flowDeactivationBlocked` recorded.
  - agent with tenant `superAdmin` permission → allowed.
  - platform super admin (agent role) → allowed.
  - agent rename still allowed (no block, no blocked audit).
  - no-op update (same value) → no audit.

### 5. Docs

- `docs/context/flow/flow-status-permissions.md` (new): who may change flow `active`, and how blocked attempts are audited.

## Files affected

| File | Change |
|---|---|
| `apps/builder/src/lib/auth/flow-status-permissions.ts` | new helper |
| `apps/builder/src/lib/safe-action.ts` | expose `workspaceMemberRole` + `user` in ctx |
| `apps/builder/src/features/flows/actions/update-flow-action.ts` | role gate + blocked-attempt audit + 403 |
| `apps/builder/src/features/flows/flows-table-columns.tsx` | disable Switch + tooltip |
| `apps/builder/src/features/flows/flows-table.tsx` | thread prop |
| `apps/builder/src/app/space/[workspaceId]/(has-folder)/flows/page.tsx` | compute capability |
| `apps/builder/messages/en.json`, `es.json` | new keys |
| `apps/builder/__tests__/update-flow-action.test.ts` | new tests |
| `docs/context/flow/flow-status-permissions.md` | new doc |

## Risk assessment

**Low–Medium.** The only shared-file change (`safe-action.ts`) is additive and backward compatible. Server rejection remains the source of truth even if UI gating misses a surface; the flows table Switch is the only `active` toggle in the product (verified: editor and WhatsApp Flows table have none).

## Approval gates

- Plan approval required before coding (explicit "ok"/"aprobado"/"approved").
- No DB migrations. No changes to WhatsApp Flows table, publish flow, or delete flow.
