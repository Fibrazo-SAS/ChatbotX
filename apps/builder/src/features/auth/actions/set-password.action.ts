"use server"

import { completePasswordSetup } from "@chatbotx.io/auth/password-setup"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { getTranslations } from "next-intl/server"
import { actionClient } from "@/lib/safe-action"
import { setPasswordRequest } from "../schema/action"

/**
 * Public (unauthenticated) action for the initial password setup page: the
 * caller has no session yet — they authenticate by holding the single-use
 * token from their email. The token itself (not a session, not client input)
 * identifies the account, so there is no tenant or user input to trust here
 * beyond the token's strength (256-bit, hashed at rest, 24h expiry).
 */
export const setPasswordAction = actionClient
  .inputSchema(setPasswordRequest)
  .action(async ({ parsedInput }) => {
    try {
      await completePasswordSetup({
        token: parsedInput.token,
        password: parsedInput.newPassword,
      })
    } catch (error) {
      if (
        error instanceof ChatbotXException &&
        error.code === "setPasswordLinkInvalid"
      ) {
        const t = await getTranslations("auth")
        throw new ChatbotXException(
          t("setPasswordLinkInvalid"),
          "setPasswordLinkInvalid",
          400,
        )
      }
      if (error instanceof ChatbotXException) {
        throw error
      }
      throw new ChatbotXException(
        "Failed to set password",
        "setPasswordFailed",
        400,
      )
    }

    return { ok: true }
  })
