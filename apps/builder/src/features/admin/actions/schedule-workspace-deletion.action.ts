"use server"

import {
  workspaceLifecycleService,
  workspaceService,
} from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { scheduleAdminWorkspaceDeletionRequest } from "../schema/admin-workspace"

/**
 * Platform-admin path (/admin/workspaces): soft-deletes a workspace via the
 * `scheduledDeletionAt` convention (invariant #14) — the workspace keeps
 * running during the grace window, and `purgeWorkspaces` hard-deletes it
 * after 24h. Mirrors `scheduleWorkspaceDeletionAction` (schedule + freeze),
 * but gated to the platform super admin instead of workspace membership.
 */
export const scheduleAdminWorkspaceDeletionAction = superAdminActionClient
  .inputSchema(scheduleAdminWorkspaceDeletionRequest)
  .action(async ({ parsedInput }) => {
    await workspaceService.scheduleDeletion({
      id: parsedInput.workspaceId,
    })

    await workspaceLifecycleService.freezeWorkspaceRuntime(
      parsedInput.workspaceId,
    )

    return { ok: true }
  })
