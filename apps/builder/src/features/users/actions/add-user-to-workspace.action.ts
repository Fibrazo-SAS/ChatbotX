"use server"

import { userService, workspaceMemberService } from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { addUserToWorkspaceRequest } from "../schema/platform-user"

/**
 * Platform-admin path (/admin/users): adds an EXISTING user to a workspace,
 * skipping the invitation flow. The user keeps whatever sessions they have;
 * membership takes effect on their next workspace load.
 */
export const addUserToWorkspaceAction = superAdminActionClient
  .inputSchema(addUserToWorkspaceRequest)
  .action(async ({ parsedInput }) => {
    await userService.findByIdOrFail(parsedInput.userId)

    await workspaceMemberService.addMemberForPlatformAdmin({
      workspaceId: parsedInput.workspaceId,
      userId: parsedInput.userId,
      role: parsedInput.role,
    })

    return { ok: true }
  })
