"use server"

import { userService, workspaceMemberService } from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { deactivatePlatformUserRequest } from "../schema/platform-user"

/**
 * Platform-admin path (/admin/users): soft-deactivate a user (e.g. they left
 * the company). Sets User.deactivatedAt and revokes all their sessions
 * immediately; the auth layer refuses any NEW session while the flag is set.
 * Optionally also removes them from every workspace ("desafectar"). No data
 * is deleted — reactivation fully restores the account.
 */
export const deactivatePlatformUserAction = superAdminActionClient
  .inputSchema(deactivatePlatformUserRequest)
  .action(async ({ parsedInput }) => {
    await userService.deactivatePlatformUser(parsedInput.userId)

    if (parsedInput.removeFromWorkspaces) {
      await workspaceMemberService.removeAllByUserId(parsedInput.userId)
    }

    return { ok: true }
  })
