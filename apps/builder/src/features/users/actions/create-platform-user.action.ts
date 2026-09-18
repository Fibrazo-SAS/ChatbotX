"use server"

import { userService, workspaceMemberService } from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { headers } from "next/headers"
import { auth } from "@/lib/auth/auth"
import { superAdminActionClient } from "@/lib/safe-action"
import {
  type CreatePlatformUserResponse,
  createPlatformUserRequest,
} from "../schema/platform-user"

export const createPlatformUserAction = superAdminActionClient
  .inputSchema(createPlatformUserRequest)
  .action(async ({ parsedInput }): Promise<CreatePlatformUserResponse> => {
    // The magic-link sender only delivers to already-registered emails
    // (packages/auth → sendMagicLink hook), so the unverified row MUST exist
    // before the link is requested.
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
    try {
      await auth.api.signInMagicLink({
        body: { email: user.email },
        headers: requestHeaders,
      })
    } catch (error) {
      // Roll back the unverified row: a transient SMTP/auth failure would
      // otherwise leave an account that can never sign in (a retry would
      // trip the duplicate-email gate). Only unverified platform rows are
      // removable — verified accounts are never touched by this path.
      await userService.deleteUnverifiedPlatformUser(user.id)
      throw new ChatbotXException(
        `User created but the sign-in email could not be sent: ${
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
