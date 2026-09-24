"use server"

import { workspaceService } from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { updateAdminWorkspaceStatusRequest } from "../schema/admin-workspace"

/**
 * Platform-admin path (/admin/workspaces): activates or deactivates a
 * workspace. Unlike the workspace-scoped `updateWorkspaceStatusAction`
 * (which requires workspace-membership superAdmin), this one is gated to the
 * platform super admin — the operator of the workspace directory.
 */
export const updateAdminWorkspaceStatusAction = superAdminActionClient
  .inputSchema(updateAdminWorkspaceStatusRequest)
  .action(async ({ parsedInput }) => {
    await workspaceService.update({
      id: parsedInput.workspaceId,
      data: { isActive: parsedInput.isActive },
    })

    return { ok: true }
  })
