"use server"

import { userService } from "@chatbotx.io/business"
import { superAdminActionClient } from "@/lib/safe-action"
import { reactivatePlatformUserRequest } from "../schema/platform-user"

/**
 * Platform-admin path (/admin/users): clears User.deactivatedAt so the user
 * can sign in again. Existing memberships are untouched (deactivation never
 * deleted them unless the admin explicitly chose "remove from workspaces").
 */
export const reactivatePlatformUserAction = superAdminActionClient
  .inputSchema(reactivatePlatformUserRequest)
  .action(async ({ parsedInput }) => {
    await userService.reactivatePlatformUser(parsedInput.userId)
    return { ok: true }
  })
