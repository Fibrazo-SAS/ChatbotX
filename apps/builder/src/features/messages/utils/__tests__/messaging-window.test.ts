import { describe, expect, test } from "vitest"
import { isMessagingWindowExpired } from "../messaging-window"

const now = new Date("2026-11-02T12:00:00Z")
const oneHourAgo = new Date("2026-11-02T11:00:00Z")
const twentyFiveHoursAgo = new Date("2026-11-01T11:00:00Z")

describe("isMessagingWindowExpired", () => {
  test("returns false for channels without a window", () => {
    expect(
      isMessagingWindowExpired({
        channel: "webchat",
        lastIncomingMessageAt: twentyFiveHoursAgo,
        now,
      }),
    ).toBe(false)
  })

  test("returns false for windowed channels within the 24 hours", () => {
    expect(
      isMessagingWindowExpired({
        channel: "whatsapp",
        lastIncomingMessageAt: oneHourAgo,
        now,
      }),
    ).toBe(false)
  })

  test("returns true for windowed channels past the 24 hours", () => {
    expect(
      isMessagingWindowExpired({
        channel: "whatsapp",
        lastIncomingMessageAt: twentyFiveHoursAgo,
        now,
      }),
    ).toBe(true)
  })

  test("returns false when the last incoming message is missing", () => {
    expect(
      isMessagingWindowExpired({
        channel: "messenger",
        lastIncomingMessageAt: null,
        now,
      }),
    ).toBe(false)
  })

  test("returns false for unknown channels", () => {
    expect(
      isMessagingWindowExpired({
        channel: "unknown-channel",
        lastIncomingMessageAt: twentyFiveHoursAgo,
        now,
      }),
    ).toBe(false)
  })
})
