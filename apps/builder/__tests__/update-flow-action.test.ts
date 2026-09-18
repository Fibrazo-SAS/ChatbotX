// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockFindOrFail,
  mockAuditRecord,
  mockDbUpdate,
  mockDbUpdateSet,
  mockDbUpdateWhere,
  mockDbUpdateReturning,
  mockIsPlatformSuperAdmin,
} = vi.hoisted(() => {
  const mockDbUpdateReturning = vi.fn().mockResolvedValue([{ id: "10" }])
  const mockDbUpdateWhere = vi
    .fn()
    .mockReturnValue({ returning: mockDbUpdateReturning })
  const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateWhere })
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet })

  return {
    mockFindOrFail: vi.fn(),
    mockAuditRecord: vi.fn().mockResolvedValue(undefined),
    mockDbUpdate,
    mockDbUpdateSet,
    mockDbUpdateWhere,
    mockDbUpdateReturning,
    mockIsPlatformSuperAdmin: vi.fn().mockReturnValue(false),
  }
})

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.bindArgsSchemas = () => chain
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { workspaceActionClient: chain }
})

vi.mock("@chatbotx.io/business", () => ({
  isPlatformSuperAdmin: mockIsPlatformSuperAdmin,
}))

vi.mock("@chatbotx.io/business/audit", () => ({
  auditService: { record: mockAuditRecord },
}))

vi.mock("@chatbotx.io/business/errors", () => {
  class ChatbotXException extends Error {
    code = "systemError"
    httpStatusCode = 400

    constructor(message: string, code?: string, httpStatusCode?: number) {
      super(message)
      this.name = "ChatbotXException"
      if (code) {
        this.code = code
      }
      if (httpStatusCode) {
        this.httpStatusCode = httpStatusCode
      }
    }
  }
  return { ChatbotXException }
})

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}))

vi.mock("@chatbotx.io/database/client", () => ({
  db: { update: mockDbUpdate },
  eq: (...args: unknown[]) => ({ eq: args }),
  findOrFail: mockFindOrFail,
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  flowModel: { id: "flowModel.id" },
}))

vi.mock("@chatbotx.io/utils", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  return { ...original }
})

const { updateFlow } = await import(
  "../src/features/flows/actions/update-flow-action"
)

const flowRow = {
  id: "10",
  workspaceId: "1",
  name: "Onboarding",
  active: true,
  enableInInbox: true,
}

const baseUser = {
  email: "member@example.com",
  isPlatformSuperAdmin: false,
}

const ownerAuth = {
  role: "owner" as const,
  permissions: {},
  user: baseUser,
}

const agentAuth = {
  role: "agent" as const,
  permissions: { flows: true },
  user: baseUser,
}

const tenantSuperAdminAgentAuth = {
  role: "agent" as const,
  permissions: { superAdmin: true, flows: true },
  user: baseUser,
}

describe("updateFlow — flow status toggle authorization (ticket 15139)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOrFail.mockResolvedValue(flowRow)
    mockDbUpdateReturning.mockResolvedValue([{ id: "10" }])
    mockDbUpdateWhere.mockReturnValue({ returning: mockDbUpdateReturning })
    mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateWhere })
    mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet })
    mockIsPlatformSuperAdmin.mockReturnValue(false)
  })

  test("owner can deactivate a flow and the change is audited as deactivate", async () => {
    await updateFlow(
      { workspaceId: "1", id: "10" },
      { active: false },
      ownerAuth,
    )

    expect(mockDbUpdateSet).toHaveBeenCalledWith({ active: false })
    expect(mockAuditRecord).toHaveBeenCalledWith({
      workspaceId: "1",
      flowId: "10",
      action: "deactivate",
      detail: "auditLogs.details.flowDeactivated",
    })
  })

  test("agent cannot deactivate a flow: 403, blocked audit, no DB update", async () => {
    await expect(
      updateFlow({ workspaceId: "1", id: "10" }, { active: false }, agentAuth),
    ).rejects.toMatchObject({
      httpStatusCode: 403,
      code: "flowStatusChangeNotAllowed",
      message: "errors.flowStatusChangeNotAllowed",
    })

    expect(mockAuditRecord).toHaveBeenCalledWith({
      workspaceId: "1",
      flowId: "10",
      action: "flowDeactivationBlocked",
      detail: "auditLogs.details.flowDeactivationBlocked",
    })
    expect(mockDbUpdateSet).not.toHaveBeenCalled()
  })

  test("agent cannot activate an inactive flow either (whole toggle blocked)", async () => {
    mockFindOrFail.mockResolvedValue({ ...flowRow, active: false })

    await expect(
      updateFlow({ workspaceId: "1", id: "10" }, { active: true }, agentAuth),
    ).rejects.toMatchObject({
      httpStatusCode: 403,
      code: "flowStatusChangeNotAllowed",
    })

    expect(mockAuditRecord).toHaveBeenCalledWith({
      workspaceId: "1",
      flowId: "10",
      action: "flowActivationBlocked",
      detail: "auditLogs.details.flowActivationBlocked",
    })
    expect(mockDbUpdateSet).not.toHaveBeenCalled()
  })

  test("agent with the tenant-level superAdmin permission can deactivate", async () => {
    await updateFlow(
      { workspaceId: "1", id: "10" },
      { active: false },
      tenantSuperAdminAgentAuth,
    )

    expect(mockDbUpdateSet).toHaveBeenCalledWith({ active: false })
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deactivate" }),
    )
  })

  test("global platform super admin (agent role) can deactivate", async () => {
    mockIsPlatformSuperAdmin.mockReturnValue(true)

    await updateFlow(
      { workspaceId: "1", id: "10" },
      { active: false },
      agentAuth,
    )

    expect(mockDbUpdateSet).toHaveBeenCalledWith({ active: false })
  })

  test("agent can still rename a flow", async () => {
    await updateFlow(
      { workspaceId: "1", id: "10" },
      { name: "New name" },
      agentAuth,
    )

    expect(mockDbUpdateSet).toHaveBeenCalledWith({ name: "New name" })
    expect(mockAuditRecord).toHaveBeenCalledWith({
      workspaceId: "1",
      flowId: "10",
      action: "update",
      detail: "auditLogs.details.flowUpdated",
    })
  })

  test("agent can still toggle inbox visibility (enableInInbox is not gated)", async () => {
    await updateFlow(
      { workspaceId: "1", id: "10" },
      { enableInInbox: false },
      agentAuth,
    )

    expect(mockDbUpdateSet).toHaveBeenCalledWith({ enableInInbox: false })
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update" }),
    )
  })

  test("no-op status update records nothing and writes nothing", async () => {
    await updateFlow(
      { workspaceId: "1", id: "10" },
      { active: true },
      ownerAuth,
    )

    expect(mockDbUpdateSet).not.toHaveBeenCalled()
    expect(mockAuditRecord).not.toHaveBeenCalled()
  })
})
