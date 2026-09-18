// @vitest-environment node
import type { UserModel } from "@chatbotx.io/database/types"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { isPlatformSuperAdminSpy } = vi.hoisted(() => ({
  isPlatformSuperAdminSpy: vi.fn(),
}))

vi.mock("@chatbotx.io/business", () => ({
  isPlatformSuperAdmin: isPlatformSuperAdminSpy,
}))
vi.mock("@/env", () => ({ isCloud: () => true }))

const { resolveCredentialScopedUserId } = await import(
  "../src/features/platform-credentials/scope"
)

const asUser = (id: string) => ({ id }) as UserModel

describe("resolveCredentialScopedUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("rejects a non-super-admin requesting platform scope", () => {
    isPlatformSuperAdminSpy.mockReturnValue(false)

    expect(() =>
      resolveCredentialScopedUserId(asUser("user-1"), "platform"),
    ).toThrow("Unauthorized")
  })

  test("resolves platform scope to undefined for a super admin", () => {
    isPlatformSuperAdminSpy.mockReturnValue(true)

    expect(
      resolveCredentialScopedUserId(asUser("admin-1"), "platform"),
    ).toBeUndefined()
  })

  test("resolves user scope to the caller's own id without checking super-admin status", () => {
    isPlatformSuperAdminSpy.mockReturnValue(false)

    expect(resolveCredentialScopedUserId(asUser("user-1"), "user")).toBe(
      "user-1",
    )
    expect(isPlatformSuperAdminSpy).not.toHaveBeenCalled()
  })
})
