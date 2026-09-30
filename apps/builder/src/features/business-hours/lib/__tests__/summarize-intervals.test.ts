import { describe, expect, test } from "vitest"
import { summarizeIntervals } from "../summarize-intervals"

const t = ((key: string, values?: Record<string, string | number>) => {
  if (key === "businessHours.moreIntervals") {
    return `+${values?.count} more`
  }
  return key.split(".").pop() ?? key
}) as Parameters<typeof summarizeIntervals>[1]

const ALL = [true, true, true, true, true, true, true]
const MON_FRI = [false, true, true, true, true, true, false]

describe("summarizeIntervals", () => {
  test("collapses consecutive days sharing a range", () => {
    expect(
      summarizeIntervals(
        [{ startMinute: 540, endMinute: 1200, days: MON_FRI }],
        t,
      ),
    ).toEqual(["1–5 09:00–20:00"])
  })

  test("lists non-consecutive days separately", () => {
    expect(
      summarizeIntervals(
        [
          {
            startMinute: 540,
            endMinute: 960,
            days: [false, true, false, true, false, false, true],
          },
        ],
        t,
      ),
    ).toEqual(["1, 3, 6 09:00–16:00"])
  })

  test("caps lines with an overflow counter", () => {
    const intervals = [0, 1, 2, 3].map((day) => ({
      startMinute: 540 + day * 60,
      endMinute: 600 + day * 60,
      days: ALL.map((_, index) => index === day),
    }))
    expect(summarizeIntervals(intervals, t)).toEqual([
      "0 09:00–10:00",
      "1 10:00–11:00",
      "2 11:00–12:00",
      "+1 more",
    ])
  })

  test("skips ranges with no active days", () => {
    expect(
      summarizeIntervals(
        [
          {
            startMinute: 540,
            endMinute: 1080,
            days: [false, false, false, false, false, false, false],
          },
        ],
        t,
      ),
    ).toEqual([])
  })
})
