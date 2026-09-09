"use server"

import { isSuperAdmin, userService } from "@chatbotx.io/business"
import { z } from "zod"
import { superAdminActionClient } from "@/lib/safe-action"

const setPlatformSuperAdminRequest = z.object({
  userId: z.string(),
  value: z.boolean(),
})

/**
 * Platform admin console: grant/revoke /admin access to another user.
 * superAdminActionClient already gates on the console gate — this action
 * additionally requires the ENV admin (isSuperAdmin), so only the
 * PLATFORM_ADMIN_EMAIL account can promote or demote.
 */
export const setPlatformSuperAdminAction = superAdminActionClient
  .inputSchema(setPlatformSuperAdminRequest)
  .action(async ({ ctx, parsedInput }) => {
    if (!isSuperAdmin(ctx.user)) {
      throw new Error(
        "Only the platform admin account can grant or revoke platform super admin",
      )
    }

    await userService.setPlatformSuperAdmin({
      userId: parsedInput.userId,
      value: parsedInput.value,
      actorIsEnvAdmin: true,
    })

    return { ok: true }
  })
