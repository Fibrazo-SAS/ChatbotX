"use server"

import { workspaceService } from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { cancelAdminWorkspaceDeletionRequest } from "../schema/admin-workspace"

/**
 * Platform-admin path (/admin/workspaces): cancels a scheduled soft-delete,
 * restoring the workspace to its normal lifecycle. Mirrors
 * `cancelWorkspaceDeletionAction`, but gated to the platform super admin.
 */
export const cancelAdminWorkspaceDeletionAction = superAdminActionClient
  .inputSchema(cancelAdminWorkspaceDeletionRequest)
  .action(async ({ parsedInput }) => {
    await workspaceService.cancelDeletion({
      id: parsedInput.workspaceId,
    })

    return { ok: true }
  })
