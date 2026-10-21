import { describe, expect, test } from "vitest"
import { sysbrazoClientListResponseSchema } from "../schema/sysbrazo-client"

describe("sysbrazoClientListResponseSchema", () => {
  test("tolerates numeric phone values from Sysbrazo", () => {
    const parsed = sysbrazoClientListResponseSchema.parse({
      data: [
        {
          id: 590_475,
          primary_phone: 3_212_315_312,
          alt_phone: 3_772_459_512,
          alt_phone_prefix: 57,
        },
      ],
    })

    expect(parsed.data[0]?.alt_phone).toBe("3772459512")
    expect(parsed.data[0]?.primary_phone).toBe("3212315312")
    expect(parsed.data[0]?.alt_phone_prefix).toBe("57")
  })

  test("keeps string values as-is", () => {
    const parsed = sysbrazoClientListResponseSchema.parse({
      data: [{ id: 1, alt_phone: "+57 3772459512" }],
    })

    expect(parsed.data[0]?.alt_phone).toBe("+57 3772459512")
  })

  test("accepts nulls and missing fields everywhere", () => {
    const parsed = sysbrazoClientListResponseSchema.parse({
      data: [{ id: 1 }],
    })

    expect(parsed.data[0]?.email).toBeUndefined()
    expect(parsed.data[0]?.alt_phone).toBeUndefined()
  })
})
