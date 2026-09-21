import { isPlatformSuperAdmin } from "@chatbotx.io/business"
import type {
  WorkspaceMemberPermissions,
  WorkspaceMemberRole,
} from "@chatbotx.io/database/partials"
import type { UserModel } from "@chatbotx.io/database/types"
import { hasWorkspacePermission } from "@/lib/auth/permission-routes"

/**
 * Who may change a flow's `active` status (ticket 15139): the workspace
 * owner, a tenant-level super admin (the workspace `superAdmin` permission
 * flag), or a global platform super admin.
 *
 * Fail closed: a missing permission key is treated as denied
 * (`hasWorkspacePermission` checks `=== true`).
 *
 * Shared by the flows page (UI gating) and `updateFlowAction` (server-side
 * authorization) so the two surfaces cannot drift.
 */
export const canToggleFlowStatus = (props: {
  role: WorkspaceMemberRole
  permissions: WorkspaceMemberPermissions | Record<string, unknown>
  user: Pick<UserModel, "email" | "isPlatformSuperAdmin">
}): boolean =>
  props.role === "owner" ||
  hasWorkspacePermission(props.permissions, "superAdmin") ||
  isPlatformSuperAdmin(props.user)
