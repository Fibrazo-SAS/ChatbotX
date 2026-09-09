"use server"

import { workspaceService } from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { createAdminWorkspaceRequest } from "../schema/admin-workspace"

/**
 * Platform admin console: create a workspace. The service enforces "only
 * platform admins can create workspaces" (now including flag-based platform
 * super admins). The chosen owner (or the creating admin) becomes the
 * workspace's owner member.
 */
export const createAdminWorkspaceAction = superAdminActionClient
  .inputSchema(createAdminWorkspaceRequest)
  .action(async ({ ctx, parsedInput }) => {
    const ownerId = parsedInput.ownerId ?? ctx.user.id

    const workspace = await workspaceService.create({
      data: {
        name: parsedInput.name,
        ownerId,
      },
      createdBy: ctx.user.id,
    })

    return { id: workspace.id, name: workspace.name }
  })
