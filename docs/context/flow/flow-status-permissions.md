# Flow status permissions

Who may change a flow's `active` status (activate/deactivate) — ticket 15139.

## Rule

Changing a flow's `active` status requires one of:

1. **Workspace owner** (`WorkspaceMember.role === "owner"`).
2. **Tenant-level super admin** (the workspace `permissions.superAdmin` flag).
3. **Global platform super admin** (`isPlatformSuperAdmin(user)` — the env
   `PLATFORM_ADMIN_EMAIL` account or a promoted `User.isPlatformSuperAdmin`).

Agents (`role === "agent"`) without the super admin flag cannot activate **or**
deactivate a flow (the whole toggle is blocked, both directions).

Everything else on flows stays unchanged for agents: rename, `enableInInbox`
(inbox visibility), edit, publish, duplicate, delete — those are governed by the
existing `flows` permission flag, not by this rule.

## Enforcement (two layers)

- **Server (authoritative)** — `updateFlowAction` /
  `apps/builder/src/features/flows/actions/update-flow-action.ts`. When
  `parsedInput.active` differs from the stored value, the caller's
  `role` + `permissions` + `user` (exposed by `workspaceActionClient`'s ctx) are
  checked via `canToggleFlowStatus`
  (`apps/builder/src/lib/auth/flow-status-permissions.ts`). Denied attempts:
  - throw `ChatbotXException(..., "flowStatusChangeNotAllowed", 403)` — the
    safe-action error handler surfaces the translated message
    (`errors.flowStatusChangeNotAllowed`) as a toast;
  - record an audit entry (`flowActivationBlocked` / `flowDeactivationBlocked`)
    with the actor's userId, role, timestamp and the target `flowId`
    (`auditLogs.details.flowActivationBlocked` / `flowDeactivationBlocked`).
- **UI** — the flows table status Switch is disabled with an explanatory tooltip
  for members that cannot toggle (`messages.flowStatusChangeNotAllowed`). The
  capability is computed once per request on the flows page
  (`getCurrentUserAndTargetWorkspace` is React-cached, so it reuses the rows
  `requireWorkspacePermission` already loaded) and passed down as
  `canToggleFlowStatus`.

## Surfaces

The flows table status column is the **only** place a flow's `active` status can
be changed (the flow editor has no status toggle, and the WhatsApp Flows table
is a read-only view of Facebook-managed flows). `enableInInbox` is deliberately
out of scope: it hides a flow from the inbox but does not deactivate it.

## Audit actions

| action | meaning |
|---|---|
| `activate` / `deactivate` | allowed status change (pre-existing) |
| `flowActivationBlocked` / `flowDeactivationBlocked` | denied attempt, logged for audit |

Audit rows carry the actor's `role` automatically (the workspace action
middleware stamps it into the audit context).
