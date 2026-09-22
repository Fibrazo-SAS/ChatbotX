"use server"

import { requestPasswordSetup } from "@chatbotx.io/auth/password-setup"
import { userService, workspaceMemberService } from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { headers } from "next/headers"
import { env } from "@/env"
import { superAdminActionClient } from "@/lib/safe-action"
import {
  type CreatePlatformUserResponse,
  createPlatformUserRequest,
} from "../schema/platform-user"

export const createPlatformUserAction = superAdminActionClient
  .inputSchema(createPlatformUserRequest)
  .action(async ({ parsedInput }): Promise<CreatePlatformUserResponse> => {
    // New-user onboarding (ticket 15137): instead of a sign-in magic link,
    // the platform-created user gets a single-use, 24h set-password email.
    // The sender only delivers to already-registered emails
    // (packages/auth → requestPasswordSetup), so the unverified row MUST
    // exist before the email is requested.
    const user = await userService.createPlatformUser({
      email: parsedInput.email,
      name: parsedInput.name ?? null,
    })

    // Optional immediate membership requested by the platform admin. Done
    // BEFORE the sign-in email: if the email fails, the user rollback below
    // cascades to this membership (workspaceMemberModel.userId → onDelete
    // cascade), so a failed send never leaves a dangling member row.
    if (parsedInput.workspaceId) {
      try {
        await workspaceMemberService.addMemberForPlatformAdmin({
          workspaceId: parsedInput.workspaceId,
          userId: user.id,
          role: parsedInput.role,
        })
      } catch (error) {
        await userService.deleteUnverifiedPlatformUser(user.id)
        throw new ChatbotXException(
          error instanceof Error ? error.message : "unknown error",
        )
      }
    }

    const requestHeaders = await headers()
    // Build a synthetic request carrying the incoming headers so
    // requestPasswordSetup resolves tenant/brand/SMTP/public origin exactly
    // like the better-auth email hooks do. Platform users live in the root
    // tenant, so the email goes out through the platform SMTP with the
    // platform brand and links back to the platform origin.
    const headerEntries: [string, string][] = []
    requestHeaders.forEach((value, key) => {
      headerEntries.push([key, value])
    })
    const syntheticRequest = new Request(env.NEXT_PUBLIC_BUILDER_URL, {
      headers: headerEntries,
    })
    try {
      await requestPasswordSetup({
        email: user.email,
        request: syntheticRequest,
      })
    } catch (error) {
      // Roll back the unverified row: a transient SMTP/auth failure would
      // otherwise leave an account that can never get in (a retry would
      // trip the duplicate-email gate). Only unverified platform rows are
      // removable — verified accounts are never touched by this path.
      await userService.deleteUnverifiedPlatformUser(user.id)
      throw new ChatbotXException(
        `User created but the password-setup email could not be sent: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      )
    }

    // NOTE: no audit record here — audit rows are workspace-scoped
    // (AuditService drops records without a workspaceId), and platform
    // user creation has no workspace. The creation itself is visible in
    // /admin/users.

    return { id: user.id, email: user.email, name: user.name }
  })
