// @vitest-environment node

import { beforeEach, expect, test, vi } from "vitest"

const mockWorkspaceUpdate = vi.fn()
const mockScheduleDeletion = vi.fn()
const mockCancelDeletion = vi.fn()
const mockFreezeWorkspaceRuntime = vi.fn()

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return {
    superAdminActionClient: chain,
  }
})

vi.mock("@chatbotx.io/business", () => ({
  workspaceService: {
    update: mockWorkspaceUpdate,
    scheduleDeletion: mockScheduleDeletion,
    cancelDeletion: mockCancelDeletion,
  },
  workspaceLifecycleService: {
    freezeWorkspaceRuntime: mockFreezeWorkspaceRuntime,
  },
}))

const { updateAdminWorkspaceStatusAction } = await import(
  "../src/features/admin/actions/update-workspace-status.action"
)
const { scheduleAdminWorkspaceDeletionAction } = await import(
  "../src/features/admin/actions/schedule-workspace-deletion.action"
)
const { cancelAdminWorkspaceDeletionAction } = await import(
  "../src/features/admin/actions/cancel-workspace-deletion.action"
)

beforeEach(() => {
  vi.clearAllMocks()
})

test("updates the workspace active status through workspaceService", async () => {
  await (
    updateAdminWorkspaceStatusAction as (props: unknown) => Promise<unknown>
  )({
    parsedInput: { workspaceId: "workspace-1", isActive: false },
  })

  expect(mockWorkspaceUpdate).toHaveBeenCalledWith({
    id: "workspace-1",
    data: { isActive: false },
  })
})

test("schedules deletion then freezes the workspace runtime", async () => {
  await (
    scheduleAdminWorkspaceDeletionAction as (props: unknown) => Promise<unknown>
  )({
    parsedInput: { workspaceId: "workspace-1" },
  })

  expect(mockScheduleDeletion).toHaveBeenCalledWith({ id: "workspace-1" })
  expect(mockFreezeWorkspaceRuntime).toHaveBeenCalledWith("workspace-1")
})

test("cancels a scheduled deletion", async () => {
  await (
    cancelAdminWorkspaceDeletionAction as (props: unknown) => Promise<unknown>
  )({
    parsedInput: { workspaceId: "workspace-1" },
  })

  expect(mockCancelDeletion).toHaveBeenCalledWith({ id: "workspace-1" })
})
