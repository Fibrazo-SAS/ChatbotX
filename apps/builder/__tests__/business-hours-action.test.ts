// @vitest-environment node

import { describe, expect, test, vi } from "vitest"

const { mockCreate, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockCreate: vi.fn(async () => ({ id: "sched-1" })),
  mockUpdate: vi.fn(async () => ({})),
  mockDelete: vi.fn(async () => undefined),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.bindArgsSchemas = () => chain
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { workspaceActionClient: chain }
})

vi.mock("@chatbotx.io/business", () => ({
  businessHoursService: {
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
  },
}))

const { createBusinessHoursAction } = await import(
  "../src/features/business-hours/actions/create-business-hours.action"
)
const { updateBusinessHoursAction } = await import(
  "../src/features/business-hours/actions/update-business-hours.action"
)
const { deleteBusinessHoursAction } = await import(
  "../src/features/business-hours/actions/delete-business-hours.action"
)

type ActionFn<T> = (args: {
  bindArgsParsedInputs: [string] | [string, string]
  parsedInput: T
}) => Promise<unknown>

describe("business hours actions", () => {
  test("create passes the bound workspace id", async () => {
    await (createBusinessHoursAction as unknown as ActionFn<{ name: string }>)({
      bindArgsParsedInputs: ["ws-1"],
      parsedInput: { name: "Soporte" },
    })
    expect(mockCreate).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      name: "Soporte",
    })
  })

  test("update passes every field with bound ids", async () => {
    const parsedInput = {
      name: "Soporte",
      active: false,
      intervals: [],
      holidays: ["2026-12-25"],
    }
    await (
      updateBusinessHoursAction as unknown as ActionFn<typeof parsedInput>
    )({
      bindArgsParsedInputs: ["ws-1", "sched-1"],
      parsedInput,
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      id: "sched-1",
      ...parsedInput,
    })
  })

  test("delete uses bound ids with no input payload", async () => {
    await (deleteBusinessHoursAction as unknown as ActionFn<never>)({
      bindArgsParsedInputs: ["ws-1", "sched-1"],
      parsedInput: undefined as never,
    })
    expect(mockDelete).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      id: "sched-1",
    })
  })
})
