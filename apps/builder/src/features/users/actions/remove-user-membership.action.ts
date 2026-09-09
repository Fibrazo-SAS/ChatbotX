"use server"

import { workspaceMemberService } from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { removeUserMembershipRequest } from "../schema/platform-user"

/**
 * Platform-admin path (/admin/users): removes a user from ONE workspace.
 * Usage is decremented and the removal audited via
 * workspaceMemberService.delete; the "last owner" guard lives in the service.
 */
export const removeUserMembershipAction = superAdminActionClient
  .inputSchema(removeUserMembershipRequest)
  .action(async ({ parsedInput }) => {
    await workspaceMemberService.removeMemberForPlatformAdmin({
      workspaceId: parsedInput.workspaceId,
      userId: parsedInput.userId,
    })
    return { ok: true }
  })
