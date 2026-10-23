import { describe, expect, test } from "vitest"
import {
  formatDiagnosticDate,
  formatDurationSeconds,
  formatTicketDate,
  minutesSince,
} from "../format-support"

describe("formatDiagnosticDate", () => {
  test("formats ISO with seconds as YYYY/MM/DD HH:mm:ss", () => {
    expect(formatDiagnosticDate("2026-10-08T10:54:22Z")).toBe(
      "2026/10/08 10:54:22",
    )
    expect(formatDiagnosticDate("2026-10-08 10:54:22")).toBe(
      "2026/10/08 10:54:22",
    )
  })

  test("returns the raw value when it is not an ISO datetime", () => {
    expect(formatDiagnosticDate("—")).toBe("—")
    expect(formatDiagnosticDate(null)).toBe("")
  })
})

describe("formatTicketDate", () => {
  test("formats ISO as YYYY/MM/DD HH:mm (no seconds)", () => {
    expect(formatTicketDate("2026-10-05T09:10:00Z")).toBe("2026/10/05 09:10")
    expect(formatTicketDate("2026-09-28 16:05")).toBe("2026/09/28 16:05")
  })
})

describe("minutesSince", () => {
  test("returns whole minutes elapsed", () => {
    const minutes = minutesSince(
      new Date(Date.now() - 21 * 60_000).toISOString(),
    )
    expect(minutes).toBe(21)
  })

  test("returns null for invalid dates", () => {
    expect(minutesSince("not-a-date")).toBeNull()
    expect(minutesSince(null)).toBeNull()
  })
})

describe("formatDurationSeconds", () => {
  test("formats seconds with the s suffix", () => {
    expect(formatDurationSeconds(52)).toBe("52s")
    expect(formatDurationSeconds(null)).toBeNull()
  })
})
