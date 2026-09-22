import { createHash } from "node:crypto"
import { beforeEach, describe, expect, test, vi } from "vitest"

/**
 * Hoisted mock handles. `vi.mock` factories run before module top-level, so any
 * value a factory references must be created with `vi.hoisted`.
 */
const {
  getPublicOriginFromRequest,
  getTenantSettings,
  resolveSmtpForTenant,
  getTenantId,
  resolveTenantOwnerId,
  sendSignUpVerification,
  userFindFirst,
  accountFindFirst,
  updateSet,
  updateReturning,
  insertValues,
} = vi.hoisted(() => ({
  getPublicOriginFromRequest: vi.fn(),
  getTenantSettings: vi.fn(),
  resolveSmtpForTenant: vi.fn(),
  getTenantId: vi.fn(),
  resolveTenantOwnerId: vi.fn(),
  sendSignUpVerification: vi.fn(),
  userFindFirst: vi.fn(),
  accountFindFirst: vi.fn(),
  updateSet: vi.fn(),
  updateReturning: vi.fn(),
  insertValues: vi.fn(),
}))

// Minimal ChatbotXException so `instanceof` / code assertions work without
// pulling the real business error module graph.
vi.mock("@chatbotx.io/business/errors", () => ({
  ChatbotXException: class ChatbotXException extends Error {
    code?: string
    constructor(message: string, code?: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock("better-auth", () => ({
  APIError: class APIError extends Error {
    status?: number
    constructor(status: number, opts: { message: string }) {
      super(opts.message)
      this.status = status
    }
  },
}))

vi.mock("better-auth/crypto", () => ({
  hashPassword: (p: string) => Promise.resolve(`hashed:${p}`),
}))

vi.mock("@chatbotx.io/mail", () => ({
  DEFAULT_SIGNUP_SUBJECT: "Welcome to {{brandName}} — set your password",
  sendSignUpVerification,
}))

vi.mock("@chatbotx.io/utils", () => ({ getPublicOriginFromRequest }))

vi.mock("@chatbotx.io/database/schema", () => ({
  accountModel: { id: "Account.id" },
  userModel: { id: "User.id" },
  ROOT_TENANT_ID: "1",
}))

// `db.query.userModel.findFirst` drives token/user lookups; `db.update().set()
// .where().returning()` is captured by spies; `db.transaction(cb)` runs the
// callback with a tx supporting update/insert/query.
vi.mock("@chatbotx.io/database/client", () => {
  const updateChain = {
    set: (vals: unknown) => {
      updateSet(vals)
      return {
        where: () => ({ returning: () => updateReturning() }),
      }
    },
  }
  const tx = {
    update: () => updateChain,
    insert: () => ({
      values: (vals: unknown) => {
        insertValues(vals)
        return { returning: () => [] }
      },
    }),
    query: { accountModel: { findFirst: accountFindFirst } },
  }
  return {
    db: {
      query: { userModel: { findFirst: userFindFirst } },
      update: () => updateChain,
      transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
    },
    and: (...clauses: unknown[]) => clauses,
    eq: (a: unknown, b: unknown) => [a, b],
  }
})

vi.mock("../src/tenant-email", () => ({
  getTenantSettings,
  resolveSmtpForTenant,
}))

vi.mock("../src/tenant-context", () => ({
  getTenantId,
  resolveTenantOwnerId,
}))

import {
  completePasswordSetup,
  requestPasswordSetup,
} from "../src/password-setup"

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex")

const SET_PASSWORD_URL_PATTERN =
  /^https:\/\/builder\.test\/auth\/set-password\?token=[A-Za-z0-9_-]+$/

const PLATFORM_INFO = {
  name: "ChatbotX",
  logoLightUrl: "https://builder.test/brand/logo.svg",
  signupEmailTemplate: null,
}

const tokenFromEmail = (): string => {
  const call = sendSignUpVerification.mock.calls.at(-1) as [
    string,
    { verificationUrl: string },
    unknown?,
  ]
  return new URL(call[1].verificationUrl).searchParams.get("token") as string
}

beforeEach(() => {
  vi.clearAllMocks()
  getPublicOriginFromRequest.mockResolvedValue("https://builder.test")
  getTenantSettings.mockResolvedValue(PLATFORM_INFO)
  resolveSmtpForTenant.mockResolvedValue({ kind: "default" })
  getTenantId.mockReturnValue("1")
  resolveTenantOwnerId.mockResolvedValue(null)
  userFindFirst.mockResolvedValue({ id: "u-1", name: "Nuevo" })
  updateReturning.mockResolvedValue([{ id: "u-1" }])
})

describe("requestPasswordSetup", () => {
  test("rejects unknown emails with the same posture as the magic-link hook", async () => {
    userFindFirst.mockResolvedValue(undefined)

    await expect(
      requestPasswordSetup({
        email: "ghost@example.com",
        request: new Request("https://builder.test"),
      }),
    ).rejects.toThrow("Your email is not registered with ChatbotX")

    expect(sendSignUpVerification).not.toHaveBeenCalled()
  })

  test("mints a hashed-at-rest token and emails the set-password link", async () => {
    await requestPasswordSetup({
      email: "nuevo@example.com",
      request: new Request("https://builder.test"),
    })

    // Stored on the user row: only the SHA-256 digest, never the raw token.
    const [setValues] = updateSet.mock.calls[0]
    expect(setValues).toMatchObject({
      passwordSetupTokenHash: expect.any(String) as string,
      passwordSetupTokenExpiresAt: expect.any(Date) as Date,
    })
    expect(setValues.passwordSetupTokenHash).toHaveLength(64)
    expect(setValues.passwordSetupTokenHash).not.toContain(tokenFromEmail())
    expect(sha256(tokenFromEmail())).toBe(setValues.passwordSetupTokenHash)

    // ~24h expiry window.
    const expiresAt = setValues.passwordSetupTokenExpiresAt as Date
    const ttlMs = expiresAt.getTime() - Date.now()
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(ttlMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000)

    // Email: platform brand, default SMTP (no transport), correct link host.
    expect(sendSignUpVerification).toHaveBeenCalledWith(
      "nuevo@example.com",
      expect.objectContaining({
        brandName: "ChatbotX",
        brandLogoUrl: "https://builder.test/brand/logo.svg",
        subject: "Welcome to {{brandName}} — set your password",
        userName: "Nuevo",
        verificationUrl: expect.stringMatching(
          SET_PASSWORD_URL_PATTERN,
        ) as string,
      }),
    )
  })

  test("skips everything when the tenant SMTP is blocked", async () => {
    resolveSmtpForTenant.mockResolvedValue({ kind: "blocked" })

    await requestPasswordSetup({
      email: "nuevo@example.com",
      request: new Request("https://builder.test"),
    })

    expect(updateSet).not.toHaveBeenCalled()
    expect(sendSignUpVerification).not.toHaveBeenCalled()
  })

  test("sends over the reseller transport when one is resolved", async () => {
    const transport = {
      host: "smtp.reseller.test",
      fromEmail: "no-reply@reseller.test",
      fromName: "Reseller Co",
    }
    resolveSmtpForTenant.mockResolvedValue({ kind: "transport", transport })

    await requestPasswordSetup({
      email: "nuevo@example.com",
      request: new Request("https://reseller.test"),
    })

    expect(sendSignUpVerification).toHaveBeenCalledWith(
      "nuevo@example.com",
      expect.anything(),
      transport,
    )
  })

  test("reuses the caller-provided context and user without re-resolving", async () => {
    await requestPasswordSetup({
      email: "nuevo@example.com",
      request: new Request("https://builder.test"),
      context: {
        originUrl: "https://builder.test",
        platformInfo: {
          name: "ChatbotX",
          logoLightUrl: "https://logo",
          signupEmailTemplate: null,
        },
        smtpResolution: { kind: "default" },
      },
      user: { id: "u-9", name: "Otro" },
    })

    expect(userFindFirst).not.toHaveBeenCalled()
    expect(getTenantSettings).not.toHaveBeenCalled()
    expect(sendSignUpVerification).toHaveBeenCalledWith(
      "nuevo@example.com",
      expect.objectContaining({ userName: "Otro" }),
    )
  })
})

describe("completePasswordSetup", () => {
  test("rejects unknown tokens with setPasswordLinkInvalid", async () => {
    userFindFirst.mockResolvedValue(undefined)

    await expect(
      completePasswordSetup({ token: "bogus", password: "password123" }),
    ).rejects.toMatchObject({ code: "setPasswordLinkInvalid" })

    expect(updateSet).not.toHaveBeenCalled()
  })

  test("rejects expired tokens", async () => {
    userFindFirst.mockResolvedValue({
      id: "u-1",
      tenantId: "1",
      passwordSetupTokenExpiresAt: new Date(Date.now() - 60_000),
    })

    await expect(
      completePasswordSetup({ token: "expired", password: "password123" }),
    ).rejects.toMatchObject({ code: "setPasswordLinkInvalid" })
  })

  test("happy path: verifies, completes onboarding, consumes the token and creates the credential account", async () => {
    const token = "raw-token-value"
    userFindFirst.mockResolvedValue({
      id: "u-1",
      tenantId: "1",
      passwordSetupTokenExpiresAt: new Date(Date.now() + 60_000),
    })
    accountFindFirst.mockResolvedValue(undefined)

    await completePasswordSetup({ token, password: "password123" })

    // Claim: verified + onboarded + token cleared, constrained on the hash.
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerified: true,
        onboardingCompletedAt: expect.any(Date) as Date,
        passwordSetupTokenHash: null,
        passwordSetupTokenExpiresAt: null,
      }),
    )
    // Credential account row — same convention as provisioning.ts.
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "u-1",
        providerId: "credential",
        password: "hashed:password123",
        userId: "u-1",
        tenantId: "1",
      }),
    )
  })

  test("updates the password when a credential account already exists", async () => {
    userFindFirst.mockResolvedValue({
      id: "u-1",
      tenantId: "1",
      passwordSetupTokenExpiresAt: new Date(Date.now() + 60_000),
    })
    accountFindFirst.mockResolvedValue({ id: "Account.id" })

    await completePasswordSetup({ token: "t", password: "password123" })

    expect(insertValues).not.toHaveBeenCalled()
    // updateSet receives both the user claim and the account password update.
    expect(updateSet).toHaveBeenCalledWith({ password: "hashed:password123" })
  })

  test("single-use: a second submit (already-consumed token) fails the claim and writes nothing", async () => {
    userFindFirst.mockResolvedValue({
      id: "u-1",
      tenantId: "1",
      passwordSetupTokenExpiresAt: new Date(Date.now() + 60_000),
    })
    // The atomic claim loses: token no longer matches (row updated elsewhere).
    updateReturning.mockResolvedValue([])

    await expect(
      completePasswordSetup({ token: "t", password: "password123" }),
    ).rejects.toMatchObject({ code: "setPasswordLinkInvalid" })

    expect(insertValues).not.toHaveBeenCalled()
  })
})
