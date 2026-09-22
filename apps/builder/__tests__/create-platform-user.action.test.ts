// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockCreatePlatformUser,
  mockDeleteUnverified,
  mockRequestPasswordSetup,
  mockHeaders,
} = vi.hoisted(() => ({
  mockCreatePlatformUser: vi.fn(),
  mockDeleteUnverified: vi.fn().mockResolvedValue(undefined),
  mockRequestPasswordSetup: vi.fn().mockResolvedValue(undefined),
  mockHeaders: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { superAdminActionClient: chain }
})

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_BUILDER_URL: "https://builder.test" },
}))

vi.mock("@chatbotx.io/auth/password-setup", () => ({
  requestPasswordSetup: mockRequestPasswordSetup,
}))

vi.mock("@chatbotx.io/business", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chatbotx.io/business")>()),
  userService: {
    createPlatformUser: mockCreatePlatformUser,
    deleteUnverifiedPlatformUser: mockDeleteUnverified,
  },
}))

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}))

const { createPlatformUserAction } = await import(
  "../src/features/users/actions/create-platform-user.action"
)

type Handler = (args: {
  ctx: { user: { id: string; email: string } }
  parsedInput: { email: string; name?: string | null }
}) => Promise<{ id: string; email: string; name: string | null }>

const handler = createPlatformUserAction as unknown as Handler
const ctx = { user: { id: "admin-1", email: "admin@example.com" } }

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteUnverified.mockResolvedValue(undefined)
  mockRequestPasswordSetup.mockResolvedValue(undefined)
})

describe("createPlatformUserAction", () => {
  test("happy path: creates unverified user and requests the set-password email", async () => {
    mockCreatePlatformUser.mockResolvedValue({
      id: "u-1",
      email: "nuevo@fibrazo.com",
      name: "Nuevo",
    })

    const result = await handler({
      ctx,
      parsedInput: { email: "Nuevo@Fibrazo.com", name: "  Nuevo  " },
    })

    expect(result).toEqual({
      id: "u-1",
      email: "nuevo@fibrazo.com",
      name: "Nuevo",
    })
    expect(mockCreatePlatformUser).toHaveBeenCalledWith({
      email: "Nuevo@Fibrazo.com",
      name: "  Nuevo  ",
    })
    expect(mockRequestPasswordSetup).toHaveBeenCalledTimes(1)
    // A synthetic request built from the incoming headers, based on the
    // platform builder URL.
    expect(mockRequestPasswordSetup).toHaveBeenCalledWith({
      email: "nuevo@fibrazo.com",
      request: expect.any(Request),
    })
    const { request } = mockRequestPasswordSetup.mock.calls[0][0]
    expect(request.url).toBe("https://builder.test/")
    expect(mockDeleteUnverified).not.toHaveBeenCalled()
  })

  test("duplicate email: service rejects, no password-setup email requested", async () => {
    mockCreatePlatformUser.mockRejectedValue(
      new Error("A user with email x@y.com already exists"),
    )

    await expect(
      handler({ ctx, parsedInput: { email: "x@y.com" } }),
    ).rejects.toThrow("already exists")

    expect(mockRequestPasswordSetup).not.toHaveBeenCalled()
    expect(mockDeleteUnverified).not.toHaveBeenCalled()
  })

  test("email send failure: rolls back the unverified row and throws", async () => {
    mockCreatePlatformUser.mockResolvedValue({
      id: "u-2",
      email: "fallo@fibrazo.com",
      name: null,
    })
    mockRequestPasswordSetup.mockRejectedValue(new Error("SMTP down"))

    await expect(
      handler({ ctx, parsedInput: { email: "fallo@fibrazo.com" } }),
    ).rejects.toThrow("could not be sent")

    expect(mockDeleteUnverified).toHaveBeenCalledWith("u-2")
  })

  test("gate semantics: isSuperAdmin matches PLATFORM_ADMIN_EMAIL only", async () => {
    process.env.PLATFORM_ADMIN_EMAIL = "admin@example.com"
    const { isSuperAdmin } = await import("@chatbotx.io/business")
    expect(isSuperAdmin({ email: "admin@example.com" })).toBe(true)
    expect(isSuperAdmin({ email: "otro@example.com" })).toBe(false)
    delete process.env.PLATFORM_ADMIN_EMAIL
  })
})
