import type { DatabaseClient } from "@chatbotx.io/database/client"
import { afterEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  isActiveNow: vi.fn(() => true),
}))

vi.mock("../src/workspace/service", () => ({
  workspaceService: { isActiveNow: mocks.isActiveNow },
}))

vi.mock("../src/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock("@chatbotx.io/redis", () => ({
  invalidateCacheByTags: vi.fn(async () => undefined),
}))

import {
  businessHoursService,
  isMinuteWithinIntervals,
} from "../src/business-hours/service"

afterEach(() => {
  vi.clearAllMocks()
  mocks.isActiveNow.mockReturnValue(true)
})

const MONDAY_9AM_ART = new Date("2026-09-28T12:00:00.000Z")
const MONDAY_6PM_ART = new Date("2026-09-28T21:00:00.000Z")

const ALL_DAYS = [true, true, true, true, true, true, true]
const MON_FRI = [false, true, true, true, true, true, false]

const mockTx = (workspace: unknown, schedule: unknown) =>
  ({
    query: {
      workspaceModel: { findFirst: vi.fn(async () => workspace) },
      businessHoursModel: { findFirst: vi.fn(async () => schedule) },
    },
  }) as unknown as DatabaseClient

const activeWorkspace = {
  isActive: true,
  startTime: null,
  endTime: null,
  timezone: "America/Argentina/Buenos_Aires",
}

describe("isMinuteWithinIntervals", () => {
  const intervals = [{ startMinute: 540, endMinute: 1080, days: MON_FRI }]

  test("matches inside the window on active days", () => {
    expect(
      isMinuteWithinIntervals({ weekday: 1, minute: 540, intervals }),
    ).toBe(true)
    expect(
      isMinuteWithinIntervals({ weekday: 5, minute: 720, intervals }),
    ).toBe(true)
  })

  test("end is exclusive and inactive days do not match", () => {
    expect(
      isMinuteWithinIntervals({ weekday: 1, minute: 1080, intervals }),
    ).toBe(false)
    expect(
      isMinuteWithinIntervals({ weekday: 0, minute: 720, intervals }),
    ).toBe(false)
    expect(
      isMinuteWithinIntervals({ weekday: 6, minute: 720, intervals }),
    ).toBe(false)
  })

  test("overnight windows cover both sides of midnight", () => {
    const overnight = [{ startMinute: 1320, endMinute: 360, days: ALL_DAYS }]
    expect(
      isMinuteWithinIntervals({
        weekday: 5,
        minute: 1400,
        intervals: overnight,
      }),
    ).toBe(true)
    expect(
      isMinuteWithinIntervals({ weekday: 6, minute: 60, intervals: overnight }),
    ).toBe(true)
    expect(
      isMinuteWithinIntervals({
        weekday: 6,
        minute: 400,
        intervals: overnight,
      }),
    ).toBe(false)
  })

  test("yesterday spill only applies to overnight intervals", () => {
    const sameDay = [{ startMinute: 540, endMinute: 1080, days: MON_FRI }]
    // Saturday 10:00 is not covered by Friday's same-day interval.
    expect(
      isMinuteWithinIntervals({ weekday: 6, minute: 600, intervals: sameDay }),
    ).toBe(false)
  })
})

describe("isWithinBusinessHours", () => {
  test("returns false when the workspace does not exist", async () => {
    const within = await businessHoursService.isWithinBusinessHours({
      workspaceId: "missing",
      scheduleId: "sched-1",
      tx: mockTx(null, null),
    })
    expect(within).toBe(false)
  })

  test("returns false when the workspace active window is closed", async () => {
    mocks.isActiveNow.mockReturnValueOnce(false)
    const within = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      scheduleId: "sched-1",
      tx: mockTx(activeWorkspace, null),
    })
    expect(within).toBe(false)
  })

  test("returns true without schedule selection (fail-open)", async () => {
    const within = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      tx: mockTx(activeWorkspace, null),
    })
    expect(within).toBe(true)
  })

  test("returns true for missing or disabled schedules (fail-open)", async () => {
    const missing = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      scheduleId: "gone",
      at: MONDAY_6PM_ART,
      tx: mockTx(activeWorkspace, null),
    })
    expect(missing).toBe(true)

    const disabled = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      scheduleId: "sched-1",
      at: MONDAY_6PM_ART,
      tx: mockTx(activeWorkspace, {
        active: false,
        intervals: [],
        holidays: [],
      }),
    })
    expect(disabled).toBe(true)
  })

  test("evaluates weekly intervals with day toggles", async () => {
    const schedule = {
      active: true,
      intervals: [{ startMinute: 540, endMinute: 1080, days: MON_FRI }],
      holidays: [],
    }
    const inside = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      scheduleId: "sched-1",
      at: MONDAY_9AM_ART,
      tx: mockTx(activeWorkspace, schedule),
    })
    expect(inside).toBe(true)

    const outside = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      scheduleId: "sched-1",
      at: MONDAY_6PM_ART,
      tx: mockTx(activeWorkspace, schedule),
    })
    expect(outside).toBe(false)
  })

  test("holidays close the schedule regardless of intervals", async () => {
    const schedule = {
      active: true,
      intervals: [{ startMinute: 0, endMinute: 1439, days: ALL_DAYS }],
      holidays: ["2026-09-28"],
    }
    const within = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      scheduleId: "sched-1",
      at: MONDAY_9AM_ART,
      tx: mockTx(activeWorkspace, schedule),
    })
    expect(within).toBe(false)
  })

  test("evaluates in the workspace timezone", async () => {
    const bogotaWorkspace = { ...activeWorkspace, timezone: "America/Bogota" }
    const schedule = {
      active: true,
      intervals: [{ startMinute: 540, endMinute: 1080, days: MON_FRI }],
      holidays: [],
    }
    // 12:00Z = 09:00 ART but 07:00 Bogota (UTC-5) -> outside 09:00-18:00.
    const within = await businessHoursService.isWithinBusinessHours({
      workspaceId: "ws-1",
      scheduleId: "sched-1",
      at: MONDAY_9AM_ART,
      tx: mockTx(bogotaWorkspace, schedule),
    })
    expect(within).toBe(false)
  })
})

describe("create", () => {
  const mockInsertTx = (existing: { id: string; name: string }[] = []) => {
    const returning = vi.fn(async () => [
      { id: "sched-1", workspaceId: "ws-1" },
    ])
    const values = vi.fn(() => ({ returning }))
    return {
      tx: {
        insert: vi.fn(() => ({ values })),
        query: {
          businessHoursModel: { findMany: vi.fn(async () => existing) },
        },
      } as unknown as DatabaseClient,
      values,
    }
  }

  test("trims the name and stores defaults", async () => {
    const { tx, values } = mockInsertTx()
    await businessHoursService.create({
      workspaceId: "ws-1",
      name: "  Soporte  ",
      tx,
    })
    expect(values).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      name: "Soporte",
      active: true,
      intervals: [],
      holidays: [],
    })
  })

  test("rejects duplicate names case-insensitively", async () => {
    const { tx } = mockInsertTx([{ id: "other", name: "Soporte" }])
    await expect(
      businessHoursService.create({
        workspaceId: "ws-1",
        name: "soporte",
        tx,
      }),
    ).rejects.toMatchObject({ code: "nameAlreadyExists" })
  })
})
