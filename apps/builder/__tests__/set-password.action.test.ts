// @vitest-environment node

import { ChatbotXException } from "@chatbotx.io/business/errors"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { mockCompletePasswordSetup, mockGetTranslations } = vi.hoisted(() => ({
  mockCompletePasswordSetup: vi.fn(),
  mockGetTranslations: vi.fn(),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { actionClient: chain }
})

vi.mock("@chatbotx.io/auth/password-setup", () => ({
  completePasswordSetup: mockCompletePasswordSetup,
}))

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
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
}) => Promise<{ email: string }>

const handler = setPasswordAction as unknown as Handler

beforeEach(() => {
  vi.clearAllMocks()
  mockCompletePasswordSetup.mockResolvedValue({ email: "nuevo@example.com" })
  mockGetTranslations.mockResolvedValue((key: string) => `translated:${key}`)
})

describe("setPasswordAction", () => {
  test("happy path: completes the setup and returns the email for the client sign-in", async () => {
    const result = await handler({
      parsedInput: {
        token: "raw-token",
        newPassword: "password123",
        passwordConfirmation: "password123",
      },
    })

    expect(result).toEqual({ email: "nuevo@example.com" })
    expect(mockCompletePasswordSetup).toHaveBeenCalledWith({
      token: "raw-token",
      password: "password123",
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
