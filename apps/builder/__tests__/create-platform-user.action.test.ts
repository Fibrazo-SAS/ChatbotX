// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockCreatePlatformUser,
  mockDeleteUnverified,
  mockSignInMagicLink,
  mockHeaders,
} = vi.hoisted(() => ({
  mockCreatePlatformUser: vi.fn(),
  mockDeleteUnverified: vi.fn().mockResolvedValue(undefined),
  mockSignInMagicLink: vi.fn().mockResolvedValue(undefined),
  mockHeaders: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { superAdminActionClient: chain }
})

vi.mock("@chatbotx.io/business", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chatbotx.io/business")>()),
  userService: {
    createPlatformUser: mockCreatePlatformUser,
    deleteUnverifiedPlatformUser: mockDeleteUnverified,
  },
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { signInMagicLink: mockSignInMagicLink } },
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
  mockSignInMagicLink.mockResolvedValue(undefined)
})

describe("createPlatformUserAction", () => {
  test("happy path: creates unverified user, sends magic link, audits", async () => {
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
    expect(mockSignInMagicLink).toHaveBeenCalledTimes(1)
    expect(mockSignInMagicLink).toHaveBeenCalledWith({
      body: { email: "nuevo@fibrazo.com" },
      headers: expect.anything(),
    })
    expect(mockDeleteUnverified).not.toHaveBeenCalled()
  })

  test("duplicate email: service rejects, no magic link sent", async () => {
    mockCreatePlatformUser.mockRejectedValue(
      new Error("A user with email x@y.com already exists"),
    )

    await expect(
      handler({ ctx, parsedInput: { email: "x@y.com" } }),
    ).rejects.toThrow("already exists")

    expect(mockSignInMagicLink).not.toHaveBeenCalled()
    expect(mockDeleteUnverified).not.toHaveBeenCalled()
  })

  test("email send failure: rolls back the unverified row and throws", async () => {
    mockCreatePlatformUser.mockResolvedValue({
      id: "u-2",
      email: "fallo@fibrazo.com",
      name: null,
    })
    mockSignInMagicLink.mockRejectedValue(new Error("SMTP down"))

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
