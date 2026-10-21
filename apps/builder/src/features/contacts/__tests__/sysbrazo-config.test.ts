import { describe, expect, test } from "vitest"
import {
  isNumericDocument,
  isPassportLikeDocument,
  normalizeDocumentId,
} from "../sysbrazo-config"

describe("normalizeDocumentId", () => {
  test("keeps a numeric document as-is", () => {
    expect(normalizeDocumentId("1045123456")).toBe("1045123456")
  })

  test("strips thousands separators and spaces", () => {
    expect(normalizeDocumentId("1.045.123.456")).toBe("1045123456")
    expect(normalizeDocumentId(" 1045123456 ")).toBe("1045123456")
  })

  test("uppercases a passport-like document", () => {
    expect(normalizeDocumentId("abc12345")).toBe("ABC12345")
  })

  test("rejects too-short or empty documents", () => {
    expect(normalizeDocumentId("12")).toBeNull()
    expect(normalizeDocumentId("")).toBeNull()
    expect(normalizeDocumentId("   ")).toBeNull()
  })

  test("rejects invalid characters", () => {
    expect(normalizeDocumentId("10-45-123")).toBeNull()
    expect(normalizeDocumentId("abc")).toBeNull()
  })
})

describe("document format guards", () => {
  test("isNumericDocument matches Sysbrazo's 5-20 digit rule", () => {
    expect(isNumericDocument("1045123456")).toBe(true)
    expect(isNumericDocument("1234")).toBe(false)
    expect(isNumericDocument("abc")).toBe(false)
  })

  test("isPassportLikeDocument matches Sysbrazo's 6-12 alphanumeric rule", () => {
    expect(isPassportLikeDocument("ABC12345")).toBe(true)
    expect(isPassportLikeDocument("ABC1234567")).toBe(true)
    expect(isPassportLikeDocument("ABC")).toBe(false)
    expect(isPassportLikeDocument("a1b2c3d4e5f6g7h8")).toBe(false)
  })

  test("numeric document resolves as numeric, never uppercased", () => {
    expect(normalizeDocumentId("1045123456")).toBe("1045123456")
  })
})
