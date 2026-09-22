import { createHash, randomBytes } from "node:crypto"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { and, db, eq } from "@chatbotx.io/database/client"
import {
  accountModel,
  ROOT_TENANT_ID,
  userModel,
} from "@chatbotx.io/database/schema"
import {
  DEFAULT_SIGNUP_SUBJECT,
  type EmailTemplate,
  sendSignUpVerification,
} from "@chatbotx.io/mail"
import { getPublicOriginFromRequest } from "@chatbotx.io/utils"
import { APIError } from "better-auth"
import { hashPassword } from "better-auth/crypto"
import { getTenantId, resolveTenantOwnerId } from "./tenant-context"
import {
  getTenantSettings,
  resolveSmtpForTenant,
  type SmtpResolution,
} from "./tenant-email"

/** Short expiry for the set-password link (ticket 15137: ~24h). */
const SETUP_LINK_TTL_MS = 24 * 60 * 60 * 1000

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex")

/**
 * Context the magic-link hook already resolved; callers that haven't (the
 * platform-admin creation action) let `requestPasswordSetup` resolve it.
 */
export type PasswordSetupContext = {
  originUrl: string
  platformInfo: {
    name: string
    logoLightUrl: string
    signupEmailTemplate: EmailTemplate | null
  }
  smtpResolution: SmtpResolution
}

type PasswordSetupUser = { id: string; name: string | null }

/**
 * Mint a single-use, 24h set-password token for a user and email them the
 * `/auth/set-password?token=…` link. Only the SHA-256 digest is stored; the
 * raw token exists solely in the recipient's inbox.
 *
 * Tenant-aware exactly like the other auth email hooks: the brand, SMTP and
 * link host resolve from the request (white-label) — never from client input.
 * For the platform-admin path the user is created in the root tenant, so the
 * email goes out through the platform SMTP with the platform brand.
 *
 * Throws `APIError` (400) for unknown emails — parity with the magic-link
 * hook's enumeration posture.
 */
export async function requestPasswordSetup(input: {
  email: string
  request: Request
  context?: PasswordSetupContext
  user?: PasswordSetupUser
}): Promise<void> {
  const { email } = input

  let context = input.context
  let user = input.user
  if (!(context && user)) {
    const [originUrl, platformInfo, smtpResolution] = await Promise.all([
      getPublicOriginFromRequest(input.request),
      getTenantSettings(input.request),
      resolveSmtpForTenant(),
    ])
    context = {
      originUrl,
      platformInfo: {
        name: platformInfo.name,
        logoLightUrl: platformInfo.logoLightUrl,
        signupEmailTemplate: platformInfo.signupEmailTemplate,
      },
      smtpResolution,
    }

    // Same tenant-scoped lookup as the magic-link hook (tenant + reseller
    // owner fallback). The tenant-bound email uniqueness guarantees at most
    // one match.
    const tenantId = getTenantId()
    const ownerId = await resolveTenantOwnerId(tenantId)
    const found = await db.query.userModel.findFirst({
      where: {
        email,
        OR: [
          { tenantId },
          ...(ownerId ? [{ id: ownerId, tenantId: ROOT_TENANT_ID }] : []),
        ],
      },
      columns: { id: true, name: true },
    })
    if (!found) {
      throw new APIError(400, {
        message: `Your email is not registered with ${context.platformInfo.name}`,
      })
    }
    user = found
  }

  if (context.smtpResolution.kind === "blocked") {
    return
  }

  const token = randomBytes(32).toString("base64url")
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + SETUP_LINK_TTL_MS)

  // Store the pending setup on the user row BEFORE sending: the token is
  // needed for the link. On send failure the creation action rolls the whole
  // unverified row back, so a failed send never leaves a usable orphan token.
  await db
    .update(userModel)
    .set({
      passwordSetupTokenHash: tokenHash,
      passwordSetupTokenExpiresAt: expiresAt,
    })
    .where(eq(userModel.id, user.id))

  const verificationUrl = new URL("/auth/set-password", context.originUrl)
  verificationUrl.searchParams.set("token", token)

  // Reuses the existing email-verification template (the sign-up one), so a
  // tenant's configured `signupEmailTemplate` custom copy/branding applies
  // automatically. Completing the link verifies the email AND sets the first
  // password in one step.
  const props = {
    brandName: context.platformInfo.name,
    brandLogoUrl: context.platformInfo.logoLightUrl,
    brandUrl: new URL("/", context.originUrl).toString(),
    subject: DEFAULT_SIGNUP_SUBJECT,
    userName: user.name ?? email,
    verificationUrl: verificationUrl.toString(),
    customTemplate: context.platformInfo.signupEmailTemplate,
  }

  if (context.smtpResolution.kind === "transport") {
    await sendSignUpVerification(email, props, context.smtpResolution.transport)
  } else {
    await sendSignUpVerification(email, props)
  }
}

/**
 * Verify a set-password token and set the user's first password. Completes
 * onboarding: marks the email verified, stamps `onboardingCompletedAt` and
 * consumes the token — all in one transaction together with the credential
 * `Account` write, so a partial failure can never leave a verified account
 * without credentials (or vice versa).
 *
 * The token is looked up by its hash (unique index), so no tenant context is
 * needed: the token itself is unguessable and per-user, which makes this
 * tenant-safe by construction.
 *
 * Single-use: the claim is an UPDATE constrained on the still-matching hash,
 * so a double submit or replay loses the race and reports the same generic
 * "invalid link" error.
 */
export async function completePasswordSetup(input: {
  token: string
  password: string
}): Promise<void> {
  const tokenHash = sha256(input.token)

  const user = await db.query.userModel.findFirst({
    where: { passwordSetupTokenHash: tokenHash },
    columns: {
      id: true,
      tenantId: true,
      passwordSetupTokenExpiresAt: true,
    },
  })

  const expired =
    !user?.passwordSetupTokenExpiresAt ||
    user.passwordSetupTokenExpiresAt < new Date()
  if (!user || expired) {
    throw new ChatbotXException(
      "Invalid or expired set-password link",
      "setPasswordLinkInvalid",
      400,
    )
  }

  // Same hasher better-auth uses for email+password sign-in, so the credential
  // verifies through the normal signIn.email path (see provisioning.ts).
  const hashedPassword = await hashPassword(input.password)

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(userModel)
      .set({
        emailVerified: true,
        onboardingCompletedAt: new Date(),
        passwordSetupTokenHash: null,
        passwordSetupTokenExpiresAt: null,
      })
      .where(
        and(
          eq(userModel.id, user.id),
          eq(userModel.passwordSetupTokenHash, tokenHash),
        ),
      )
      .returning({ id: userModel.id })

    if (!claimed) {
      throw new ChatbotXException(
        "Invalid or expired set-password link",
        "setPasswordLinkInvalid",
        400,
      )
    }

    // Credential account row — same convention as provisioning.ts
    // (providerId "credential", accountId = user id, tenant stamped).
    // Update defensively if a row already exists.
    const existing = await tx.query.accountModel.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
        tenantId: user.tenantId,
      },
    })
    if (existing) {
      await tx
        .update(accountModel)
        .set({ password: hashedPassword })
        .where(eq(accountModel.id, existing.id))
    } else {
      await tx.insert(accountModel).values({
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
        userId: user.id,
        tenantId: user.tenantId,
      })
    }
  })
}
