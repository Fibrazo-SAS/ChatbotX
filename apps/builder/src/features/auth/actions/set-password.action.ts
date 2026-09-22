"use server"

import { completePasswordSetup } from "@chatbotx.io/auth/password-setup"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { APIError } from "better-auth"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth/auth"
import { actionClient } from "@/lib/safe-action"
import { setPasswordRequest } from "../schema/action"

/**
 * Public (unauthenticated) action for the initial password setup page: the
 * caller has no session yet — they authenticate by holding the single-use
 * token from their email. The token itself (not a session, not client input)
 * identifies the account, so there is no tenant or user input to trust here
 * beyond the token's strength (256-bit, hashed at rest, 24h expiry).
 *
 * On success the user is signed in with the credentials they just defined
 * (better-auth's `nextCookies` plugin relays the session cookie), so they
 * land directly in the app — no extra login step after onboarding.
 */
export const setPasswordAction = actionClient
  .inputSchema(setPasswordRequest)
  .action(async ({ parsedInput }) => {
    let email: string
    try {
      const result = await completePasswordSetup({
        token: parsedInput.token,
        password: parsedInput.newPassword,
      })
      email = result.email
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

    // The password is set and the email verified at this point — sign in with
    // the exact credentials from this request. A failure here is unexpected
    // (the credential row was just written) and is surfaced as an error.
    try {
      await auth.api.signInEmail({
        body: { email, password: parsedInput.newPassword },
        headers: await headers(),
      })
    } catch (error) {
      if (error instanceof APIError) {
        throw new ChatbotXException(
          error.body?.message ?? "Failed to sign in after password setup",
          "setPasswordSignInFailed",
          400,
        )
      }
      throw error
    }

    return { ok: true }
  })
