// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auditRecord: vi.fn().mockResolvedValue(undefined),
  duplicate: vi.fn(),
  findBy: vi.fn(),
  findById: vi.fn(),
  restore: vi.fn().mockResolvedValue(undefined),
  revertDraftToPublished: vi.fn(),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.bindArgsSchemas = () => chain
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { workspaceActionClient: chain }
})

vi.mock("@chatbotx.io/business/audit", () => ({
  auditService: { record: mocks.auditRecord },
}))

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}))

vi.mock("@chatbotx.io/business", () => ({
  flowService: {
    duplicate: (...args: unknown[]) => mocks.duplicate(...args),
    findBy: (...args: unknown[]) => mocks.findBy(...args),
  },
  flowVersionService: {
    findById: (...args: unknown[]) => mocks.findById(...args),
    restore: (...args: unknown[]) => mocks.restore(...args),
    revertDraftToPublished: (...args: unknown[]) =>
      mocks.revertDraftToPublished(...args),
  },
}))

const { duplicateFlowAction } = await import(
  "../src/features/flows/actions/duplicate-flow.action"
)
const { restoreFlowVersionAction } = await import(
  "../src/features/flows/actions/restore-flow-version-action"
)
const { revertToPublishedAction } = await import(
  "../src/features/flows/actions/revert-to-published-action"
)

describe("flow audit actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auditRecord.mockResolvedValue(undefined)
    mocks.restore.mockResolvedValue(undefined)
  })

  test("duplicate emits a duplicate audit row with the copied flow name", async () => {
    mocks.duplicate.mockResolvedValue("flow-copy-1")
    mocks.findBy.mockResolvedValue({ name: "Original _copy" })

    const handler = duplicateFlowAction as unknown as (args: {
      bindArgsParsedInputs: [string, string]
    }) => Promise<string>

    await expect(
      handler({ bindArgsParsedInputs: ["ws-1", "flow-1"] }),
    ).resolves.toBe("flow-copy-1")

    expect(mocks.duplicate).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      id: "flow-1",
    })
    expect(mocks.auditRecord).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      action: "duplicate",
      detail: "auditLogs.details.flowDuplicated",
      flowId: "flow-copy-1",
    })
  })

  test("restore emits a restore audit row with flow and version ids", async () => {
    mocks.findById.mockResolvedValue({
      id: "version-9",
      flowId: "flow-1",
      workspaceId: "ws-1",
      nodes: [],
      edges: [],
    })
    mocks.findBy.mockResolvedValue({ name: "Original flow" })

    const handler = restoreFlowVersionAction as unknown as (args: {
      bindArgsParsedInputs: [string, string]
      parsedInput: { versionId: string }
    }) => Promise<unknown>

    await handler({
      bindArgsParsedInputs: ["ws-1", "flow-1"],
      parsedInput: { versionId: "version-9" },
    })

    expect(mocks.restore).toHaveBeenCalledTimes(1)
    expect(mocks.auditRecord).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      action: "restore",
      detail: "auditLogs.details.flowRestored",
      flowId: "flow-1",
    })
  })

  test("revert emits a revert audit row with the flow id", async () => {
    mocks.revertDraftToPublished.mockResolvedValue({ nodes: [], edges: [] })
    mocks.findBy.mockResolvedValue({ name: "Original flow" })

    const handler = revertToPublishedAction as unknown as (args: {
      bindArgsParsedInputs: [string, string]
    }) => Promise<unknown>

    await handler({ bindArgsParsedInputs: ["ws-1", "flow-1"] })

    expect(mocks.revertDraftToPublished).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      flowId: "flow-1",
    })
    expect(mocks.auditRecord).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      action: "revert",
      detail: "auditLogs.details.flowReverted",
      flowId: "flow-1",
    })
  })
})
