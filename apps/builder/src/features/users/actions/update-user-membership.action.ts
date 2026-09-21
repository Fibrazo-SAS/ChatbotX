"use server"

import { workspaceMemberService } from "@chatbotx.io/business"
import { isCommunity } from "@/env"
import { getSuperAdminPermissions } from "@/features/workspace-members/helpers"
import { superAdminActionClient } from "@/lib/safe-action"
import { updateUserMembershipRequest } from "../schema/platform-user"

/**
 * Platform-admin path (/admin/users): changes a user's role in a workspace.
 * The "never demote the last owner" guard lives in the service.
 */
export const updateUserMembershipAction = superAdminActionClient
  .inputSchema(updateUserMembershipRequest)
  .action(async ({ parsedInput }) => {
    // Community edition pins every member to full super-admin permissions
    // (same rule as the workspace-scoped update flow).
    const permissions = isCommunity()
      ? getSuperAdminPermissions()
      : parsedInput.permissions

    await workspaceMemberService.updateMembershipForPlatformAdmin({
      workspaceId: parsedInput.workspaceId,
      userId: parsedInput.userId,
      role: parsedInput.role,
      permissions,
    })
    return { ok: true }
  })
