import { describe, expect, test } from "vitest"
import {
  sysbrazoAutodiagnosticsResponseSchema,
  sysbrazoDiagnosticDetailSchema,
  sysbrazoStartDiagnosticResponseSchema,
  sysbrazoTicketSchema,
  sysbrazoTicketsResponseSchema,
} from "../schema/sysbrazo-support"

const summaryFixture = {
  id: 121_000,
  status: "canceled",
  source: "sysbrazo",
  reason: "Cliente tiene un incidente abierto",
  user_name: null,
  started_at: null,
  finished_at: "2026-10-08 10:54:22",
  total_duration_seconds: null,
  executed_step_count: 0,
  odoo_ticket_id: null,
  redmine_issue_id: null,
}

describe("sysbrazoAutodiagnosticsResponseSchema", () => {
  test("parses a list with total and pagination metadata", () => {
    const parsed = sysbrazoAutodiagnosticsResponseSchema.parse({
      items: [summaryFixture],
      total: 12,
      page: 1,
      per_page: 3,
    })

    expect(parsed.total).toBe(12)
    expect(parsed.items[0]?.source).toBe("sysbrazo")
  })

  test("accepts numeric Odoo references and string Redmine ids", () => {
    const parsed = sysbrazoAutodiagnosticsResponseSchema.parse({
      items: [
        {
          ...summaryFixture,
          odoo_ticket_id: 4587,
          redmine_issue_id: "IMS0004201",
        },
      ],
      total: 1,
    })

    expect(parsed.items[0]?.odoo_ticket_id).toBe(4587)
    expect(parsed.items[0]?.redmine_issue_id).toBe("IMS0004201")
  })

  test("accepts the new chatbotx source", () => {
    const parsed = sysbrazoAutodiagnosticsResponseSchema.parse({
      items: [{ ...summaryFixture, source: "chatbotx" }],
      total: 1,
    })

    expect(parsed.items[0]?.source).toBe("chatbotx")
  })
})

describe("sysbrazoDiagnosticDetailSchema", () => {
  test("parses steps with durations and rejects an unknown step status", () => {
    const parsed = sysbrazoDiagnosticDetailSchema.parse({
      ...summaryFixture,
      status: "failed",
      reason: "PING_BATCH_RETRY_FAILED",
      started_at: "2026-10-06 16:16:13",
      total_duration_seconds: 21,
      steps: [
        {
          step_number: 1,
          step_name: "initializing",
          status: "success",
          details: { reason: "INITIALIZATION_SUCCESS" },
          step_duration_seconds: 3,
        },
        {
          step_number: 6,
          step_name: "finalizing",
          status: "pending",
          details: {},
          step_duration_seconds: null,
        },
      ],
    })

    expect(parsed.steps).toHaveLength(2)
    expect(parsed.steps[0]?.step_duration_seconds).toBe(3)

    expect(() =>
      sysbrazoDiagnosticDetailSchema.parse({
        ...summaryFixture,
        steps: [{ step_number: 1, step_name: "x", status: "weird" }],
      }),
    ).toThrow()
  })
})

describe("sysbrazoStartDiagnosticResponseSchema", () => {
  test("parses ok with run_id and running without one", () => {
    expect(
      sysbrazoStartDiagnosticResponseSchema.parse({
        status: "ok",
        run_id: 121_001,
        message: "Auto diagnostic started",
      }).run_id,
    ).toBe(121_001)

    expect(
      sysbrazoStartDiagnosticResponseSchema.parse({
        status: "running",
        run_id: null,
        message: "Ya existe un autodiagnóstico en ejecución",
      }).status,
    ).toBe("running")
  })
})

describe("sysbrazoTicketsResponseSchema", () => {
  test("parses an individual open Odoo ticket and a massive finished one", () => {
    const parsed = sysbrazoTicketsResponseSchema.parse({
      items: [
        {
          provider: "odoo",
          id: "15294",
          display_id: "15294",
          url: "https://odoo.example.com/web#id=15294",
          status: "En progreso",
          is_open: true,
          title: "Corte de fibra en el sector",
          team: "Soporte técnico N2",
          city: "Montería",
          opened_at: "2026-10-05 09:10",
          updated_at: "2026-10-08 11:14",
          is_massive: false,
          affected_clients: null,
        },
        {
          provider: "redmine",
          id: "IMS0004753",
          display_id: "IMS0004753",
          url: "https://redmine.example.com/issues/IMS0004753",
          status: "Resuelto",
          is_open: false,
          title: "Masivo | PER-OLT02 | … | Corte de fibra",
          team: "Planta externa",
          city: "Cartagena",
          opened_at: "2026-10-08 11:14",
          updated_at: "2026-10-08 12:00",
          is_massive: true,
          affected_clients: 7,
        },
      ],
      total: 6,
      page: 1,
      per_page: 3,
      providers: [{ provider: "odoo", verified: true, error: null }],
    })

    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[1]?.affected_clients).toBe(7)
  })

  test("parses a provider failure without inventing success", () => {
    const parsed = sysbrazoTicketsResponseSchema.parse({
      items: [],
      total: 0,
      providers: [
        { provider: "odoo", verified: false, error: "timeout" },
        { provider: "redmine", verified: false, error: "502" },
      ],
    })

    expect(parsed.providers?.every((p) => !p.verified)).toBe(true)
  })
})

describe("sysbrazoTicketSchema", () => {
  test("tolerates missing optional display fields", () => {
    const parsed = sysbrazoTicketSchema.parse({
      provider: "odoo",
      id: "1",
      is_open: false,
      is_massive: false,
    })

    expect(parsed.title).toBeUndefined()
    expect(parsed.display_id).toBeUndefined()
  })
})
