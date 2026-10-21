import { describe, expect, test } from "vitest"
import type { SysbrazoClient } from "../../schema/sysbrazo-client"
import {
  daysSince,
  formatDocumentWithThousands,
  formatIsoDisplay,
  formatLastSession,
  formatPhoneDisplay,
  formatSysbrazoDateDisplay,
  getClientInitials,
  resolveAddonState,
  resolveInternetServiceState,
  shortenDocumentType,
} from "../format"

describe("formatDocumentWithThousands", () => {
  test("formats a numeric document with thousands separators", () => {
    expect(formatDocumentWithThousands("1045123456")).toBe("1.045.123.456")
    expect(formatDocumentWithThousands(1_045_123_456)).toBe("1.045.123.456")
  })

  test("leaves a passport-like document untouched", () => {
    expect(formatDocumentWithThousands("ABC12345")).toBe("ABC12345")
  })

  test("handles empty value", () => {
    expect(formatDocumentWithThousands(null)).toBe("")
  })
})

describe("shortenDocumentType", () => {
  test("maps Sysbrazo descriptions to short codes", () => {
    expect(shortenDocumentType("Cédula de ciudadanía")).toBe("CC")
    expect(shortenDocumentType("Cédula de extranjería")).toBe("CE")
    expect(shortenDocumentType("Tarjeta de identidad")).toBe("TI")
    expect(shortenDocumentType("Pasaporte")).toBe("PA")
  })

  test("falls back to the raw description when unmapped", () => {
    expect(shortenDocumentType("NIT")).toBe("NIT")
  })

  test("handles empty value", () => {
    expect(shortenDocumentType(null)).toBe("")
    expect(shortenDocumentType("  ")).toBe("")
  })
})

describe("getClientInitials", () => {
  test("uses first_name + last_name when present", () => {
    expect(
      getClientInitials({
        first_name: "María Fernanda",
        last_name: "Rodríguez Pérez",
        full_name: "María Fernanda Rodríguez Pérez",
      }),
    ).toBe("MR")
  })

  test("derives from a compound full_name alone (first + penultimate word)", () => {
    expect(
      getClientInitials({
        first_name: null,
        last_name: null,
        full_name: "María Fernanda Rodríguez Pérez",
      }),
    ).toBe("MR")
  })

  test("falls back to first + last word of a two-word full_name", () => {
    expect(
      getClientInitials({
        first_name: null,
        last_name: null,
        full_name: "Juan Pérez",
      }),
    ).toBe("JP")
  })

  test("handles a single-word or empty name", () => {
    expect(
      getClientInitials({
        first_name: null,
        last_name: null,
        full_name: "María",
      }),
    ).toBe("M")
    expect(
      getClientInitials({
        first_name: null,
        last_name: null,
        full_name: "",
      }),
    ).toBe("")
  })
})

describe("formatPhoneDisplay", () => {
  test("formats a 10-digit mobile as 3-3-4", () => {
    expect(formatPhoneDisplay("3021231507")).toBe("302 123 1507")
  })

  test("formats a 7-digit landline as 3-4", () => {
    expect(formatPhoneDisplay("7461234")).toBe("746 1234")
  })

  test("leaves other lengths and empty values untouched", () => {
    expect(formatPhoneDisplay("12345")).toBe("12345")
    expect(formatPhoneDisplay("")).toBe("")
    expect(formatPhoneDisplay(null)).toBe("")
  })
})

describe("formatLastSession", () => {
  test("formats as YYYY/MM/DD HH:mm", () => {
    expect(formatLastSession(new Date("2026-10-05T14:32:00"))).toBe(
      "2026/10/05 14:32",
    )
  })

  test("returns empty for null", () => {
    expect(formatLastSession(null)).toBe("")
  })
})

describe("formatIsoDisplay", () => {
  test("converts Sysbrazo ISO datetimes to the mockup format", () => {
    expect(formatIsoDisplay("2026-10-06 08:00:00")).toBe("2026/10/06 08:00")
    expect(formatIsoDisplay("2026-10-06")).toBe("2026/10/06")
  })

  test("leaves invalid or empty values untouched", () => {
    expect(formatIsoDisplay(null)).toBe("")
    expect(formatIsoDisplay("nope")).toBe("nope")
  })
})

describe("daysSince", () => {
  test("returns whole days elapsed since an ISO datetime", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
    const pad = (n: number): string => String(n).padStart(2, "0")
    const iso =
      `${twoDaysAgo.getFullYear()}-${pad(twoDaysAgo.getMonth() + 1)}-` +
      `${pad(twoDaysAgo.getDate())} ${pad(twoDaysAgo.getHours())}:00:00`

    expect(daysSince(iso)).toBe(2)
  })

  test("returns null for invalid values", () => {
    expect(daysSince(null)).toBeNull()
    expect(daysSince("invalid")).toBeNull()
  })
})

describe("resolveAddonState", () => {
  test("suspended by status", () => {
    expect(resolveAddonState({ status: "SUSPENDED" })).toBe("suspended")
  })

  test("inactive by status", () => {
    expect(resolveAddonState({ status: "INACTIVE" })).toBe("inactive")
  })

  test("expiring when cutoff is within 48h", () => {
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const pad = (n: number): string => String(n).padStart(2, "0")
    const iso =
      `${in24h.getFullYear()}-${pad(in24h.getMonth() + 1)}-` +
      `${pad(in24h.getDate())} ${pad(in24h.getHours())}:00:00`

    expect(
      resolveAddonState({ status: "ACTIVE", balance_expires_at: iso }),
    ).toBe("expiring")
  })

  test("active by status with a far cutoff", () => {
    expect(
      resolveAddonState({
        status: "ACTIVE",
        balance_expires_at: "2030-01-01 00:00:00",
      }),
    ).toBe("active")
  })
})

describe("formatSysbrazoDateDisplay", () => {
  test("converts Sysbrazo d-m-y H:i:s to the mockup format", () => {
    expect(formatSysbrazoDateDisplay("08-09-24 18:00:00")).toBe(
      "2024/09/08 18:00",
    )
  })

  test("returns empty for missing values and keeps unparseable as-is", () => {
    expect(formatSysbrazoDateDisplay(null)).toBe("")
    expect(formatSysbrazoDateDisplay("nope")).toBe("nope")
  })
})

describe("resolveInternetServiceState", () => {
  const base = (overrides: Partial<SysbrazoClient>): SysbrazoClient => ({
    id: "1",
    ...overrides,
  })

  test("suspended", () => {
    expect(
      resolveInternetServiceState(base({ internet_status: "SUSPENDED" })),
    ).toBe("suspended")
  })

  test("inactive", () => {
    expect(
      resolveInternetServiceState(base({ internet_status: "INACTIVE" })),
    ).toBe("inactive")
  })

  test("active", () => {
    expect(
      resolveInternetServiceState(base({ internet_status: "ACTIVE" })),
    ).toBe("active")
  })

  test("expiring when the Sysbrazo d-m-y cutoff is within 48h", () => {
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const pad = (n: number): string => String(n).padStart(2, "0")
    const sysbrazoDate =
      `${pad(in24h.getDate())}-${pad(in24h.getMonth() + 1)}-` +
      `${pad(in24h.getFullYear() % 100)} ${pad(in24h.getHours())}:` +
      `${pad(in24h.getMinutes())}:00`

    expect(
      resolveInternetServiceState(
        base({
          internet_status: "ACTIVE",
          balance: { dateToExpire: sysbrazoDate },
        }),
      ),
    ).toBe("expiring")
  })

  test("active when the cutoff is far in the future", () => {
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const pad = (n: number): string => String(n).padStart(2, "0")
    const sysbrazoDate = `${pad(far.getDate())}-${pad(far.getMonth() + 1)}-${pad(far.getFullYear() % 100)} 12:00:00`

    expect(
      resolveInternetServiceState(
        base({
          internet_status: "ACTIVE",
          balance: { dateToExpire: sysbrazoDate },
        }),
      ),
    ).toBe("active")
  })
})
