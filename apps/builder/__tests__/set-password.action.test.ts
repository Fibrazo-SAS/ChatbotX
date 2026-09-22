// @vitest-environment node

import { ChatbotXException } from "@chatbotx.io/business/errors"
import { APIError } from "better-auth"
import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockCompletePasswordSetup,
  mockGetTranslations,
  mockSignInEmail,
  mockHeaders,
} = vi.hoisted(() => ({
  mockCompletePasswordSetup: vi.fn(),
  mockGetTranslations: vi.fn(),
  mockSignInEmail: vi.fn(),
  mockHeaders: vi.fn(),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { actionClient: chain }
})

vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { signInEmail: mockSignInEmail } },
}))

vi.mock("@chatbotx.io/auth/password-setup", () => ({
  completePasswordSetup: mockCompletePasswordSetup,
}))

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}))

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}))

const { setPasswordAction } = await import(
  "../src/features/auth/actions/set-password.action"
)

type Handler = (args: {
  parsedInput: {
    token: string
    newPassword: string
    passwordConfirmation: string
  }
}) => Promise<{ ok: boolean }>

const handler = setPasswordAction as unknown as Handler

beforeEach(() => {
  vi.clearAllMocks()
  mockCompletePasswordSetup.mockResolvedValue({ email: "nuevo@example.com" })
  mockSignInEmail.mockResolvedValue(undefined)
  mockHeaders.mockResolvedValue(new Headers())
  mockGetTranslations.mockResolvedValue((key: string) => `translated:${key}`)
})

describe("setPasswordAction", () => {
  test("happy path: completes the setup and signs the user in with their new password", async () => {
    const result = await handler({
      parsedInput: {
        token: "raw-token",
        newPassword: "password123",
        passwordConfirmation: "password123",
      },
    })

    expect(result).toEqual({ ok: true })
    expect(mockCompletePasswordSetup).toHaveBeenCalledWith({
      token: "raw-token",
      password: "password123",
    })
    expect(mockSignInEmail).toHaveBeenCalledWith({
      body: { email: "nuevo@example.com", password: "password123" },
      headers: expect.any(Headers),
    })
  })

  test("invalid/expired link surfaces a translated message with the same code", async () => {
    mockCompletePasswordSetup.mockRejectedValue(
      new ChatbotXException(
        "Invalid or expired set-password link",
        "setPasswordLinkInvalid",
        400,
      ),
    )

    await expect(
      handler({
        parsedInput: {
          token: "stale",
          newPassword: "password123",
          passwordConfirmation: "password123",
        },
      }),
    ).rejects.toMatchObject({
      code: "setPasswordLinkInvalid",
      message: "translated:setPasswordLinkInvalid",
    })

    expect(mockSignInEmail).not.toHaveBeenCalled()
  })

  test("sign-in failures after setup are wrapped with setPasswordSignInFailed", async () => {
    mockSignInEmail.mockRejectedValue(
      new APIError(401, { message: "Invalid email or password" }),
    )

    await expect(
      handler({
        parsedInput: {
          token: "t",
          newPassword: "password123",
          passwordConfirmation: "password123",
        },
      }),
    ).rejects.toMatchObject({ code: "setPasswordSignInFailed" })
  })

  test("other ChatbotXExceptions are rethrown untouched", async () => {
    mockCompletePasswordSetup.mockRejectedValue(
      new ChatbotXException("Something else", "otherCode", 400),
    )

    await expect(
      handler({
        parsedInput: {
          token: "t",
          newPassword: "password123",
          passwordConfirmation: "password123",
        },
      }),
    ).rejects.toMatchObject({ code: "otherCode", message: "Something else" })

    expect(mockSignInEmail).not.toHaveBeenCalled()
  })

  test("unexpected errors are wrapped in a generic failure", async () => {
    mockCompletePasswordSetup.mockRejectedValue(new Error("boom"))

    await expect(
      handler({
        parsedInput: {
          token: "t",
          newPassword: "password123",
          passwordConfirmation: "password123",
        },
      }),
    ).rejects.toMatchObject({ code: "setPasswordFailed" })
  })
})
