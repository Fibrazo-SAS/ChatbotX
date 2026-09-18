// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  selectWhere: vi.fn(),
  selectLimit: vi.fn(),
  deleteWhere: vi.fn(),
}))

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    select: (...args: unknown[]) => {
      mocks.selectFrom(...args)
      return { from: () => ({ where: mocks.selectWhere }) }
    },
    delete: () => ({ where: mocks.deleteWhere }),
  },
  inArray: (...args: unknown[]) => ({ inArray: args }),
  lt: (...args: unknown[]) => ({ lt: args }),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  auditLogModel: { id: "audit.id", createdAt: "audit.createdAt" },
}))

vi.mock("@chatbotx.io/logger", () => ({
  getChildLogger: () => ({ info: vi.fn() }),
}))

vi.mock("@chatbotx.io/worker-config", () => ({
  AUDIT_LOG_RETENTION_DAYS: 90,
}))

const { purgeAuditLogs } = await import(
  "../src/schedule/handlers/purge-audit-logs"
)

describe("purgeAuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("deletes rows older than the retention window", async () => {
    mocks.selectWhere.mockReturnValue({ limit: mocks.selectLimit })
    mocks.selectLimit.mockResolvedValue([{ id: "old-1" }, { id: "old-2" }])
    mocks.deleteWhere.mockResolvedValue(undefined)

    const deleted = await purgeAuditLogs()

    expect(deleted).toBe(2)
    expect(mocks.selectWhere).toHaveBeenCalled()
    expect(mocks.deleteWhere).toHaveBeenCalled()
  })

  test("deletes nothing when no rows are expired", async () => {
    mocks.selectWhere.mockReturnValue({ limit: mocks.selectLimit })
    mocks.selectLimit.mockResolvedValue([])

    const deleted = await purgeAuditLogs()

    expect(deleted).toBe(0)
    expect(mocks.deleteWhere).not.toHaveBeenCalled()
  })
})
