import type { ConversationModel } from "@chatbotx.io/database/types"
import { checkBusinessHoursStepDefaultFn } from "@chatbotx.io/flow-config"
import { describe, expect, test, vi } from "vitest"
import type { ExecuteStepProps } from "../src/integration/handlers/flow-utils"

const { isWithinBusinessHours, loggerError } = vi.hoisted(() => ({
  isWithinBusinessHours: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock("@chatbotx.io/business", () => ({
  businessHoursService: { isWithinBusinessHours },
}))

vi.mock("../src/lib/logger", () => ({
  logger: { error: loggerError },
}))

const { handleCheckBusinessHours } = await import(
  "../src/integration/handlers/check-business-hours"
)

const makeProps = (scheduleId: string) =>
  ({
    conversation: {
      id: "conversation-1",
      workspaceId: "workspace-1",
      contactId: "contact-1",
    } as ConversationModel,
    step: { ...checkBusinessHoursStepDefaultFn(), scheduleId },
  }) as ExecuteStepProps<ReturnType<typeof checkBusinessHoursStepDefaultFn>>

describe("handleCheckBusinessHours", () => {
  test("passes the selected schedule and returns success when inside", async () => {
    isWithinBusinessHours.mockResolvedValueOnce(true)
    const result = await handleCheckBusinessHours(makeProps("sched-1"))
    expect(result).toEqual({ status: "success", result: null })
    expect(isWithinBusinessHours).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      scheduleId: "sched-1",
    })
  })

  test("returns skip when outside business hours", async () => {
    isWithinBusinessHours.mockResolvedValueOnce(false)
    const result = await handleCheckBusinessHours(makeProps("sched-1"))
    expect(result).toEqual({ status: "skip", result: null })
  })

  test("forwards an empty selection as undefined (fail-open)", async () => {
    isWithinBusinessHours.mockResolvedValueOnce(true)
    await handleCheckBusinessHours(makeProps(""))
    expect(isWithinBusinessHours).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      scheduleId: undefined,
    })
  })

  test("returns skip and logs when evaluation throws", async () => {
    isWithinBusinessHours.mockRejectedValueOnce(new Error("db down"))
    const result = await handleCheckBusinessHours(makeProps("sched-1"))
    expect(result).toEqual({ status: "skip", result: null })
    expect(loggerError).toHaveBeenCalled()
  })
})
