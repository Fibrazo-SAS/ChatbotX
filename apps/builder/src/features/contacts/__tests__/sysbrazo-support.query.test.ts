import { beforeEach, describe, expect, test, vi } from "vitest"

const executeMock = vi.fn()
vi.mock("@chatbotx.io/business", () => ({
  externalRequestService: { execute: executeMock },
}))

const getCurrentUserMock = vi.fn()
vi.mock("@/lib/auth/utils", () => ({
  getCurrentUser: getCurrentUserMock,
}))

// El query de soporte resuelve el cliente y el documento a través del
// query de #15467; se mockea completo para aislar el contrato de soporte.
const lookupMock = vi.fn()
const resolveDocumentMock = vi.fn()
const resolveRequestMock = vi.fn()
vi.mock("../queries/get-sysbrazo-client.query", () => ({
  getSysbrazoClientByDocument: lookupMock,
  resolveContactSysbrazoDocumentId: resolveDocumentMock,
  resolveSysbrazoRequest: resolveRequestMock,
}))

const {
  getSysbrazoAutodiagnostics,
  getSysbrazoAutodiagnosticDetail,
  getSysbrazoTickets,
  startSysbrazoAutodiagnostic,
} = await import("../queries/sysbrazo-support.query")

const FAILED_STATUS_ERROR_RE = /failed with status 500/
const CONTACT_NOT_FOUND_RE = /Contact not found/

const okResult = (responseBody: string) => ({
  statusCode: 200,
  durationMs: 10,
  responseBody,
  responseHeaders: {},
})

const summary = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
})

const resolveOkContext = () => {
  lookupMock.mockResolvedValue({ found: true, client: { id: 88_213 } })
  resolveDocumentMock.mockResolvedValue("1045123456")
  resolveRequestMock.mockResolvedValue({
    url: "https://sysbrazo.example.com/api/botmaker/client/by-document?document_id=1045123456&botmaker=1",
    headers: [{ key: "Authorization", value: "Basic dGVzdA==" }],
  })
}

beforeEach(() => {
  executeMock.mockReset()
  lookupMock.mockReset()
  resolveDocumentMock.mockReset()
  resolveRequestMock.mockReset()
  resolveOkContext()
})

describe("getSysbrazoAutodiagnostics", () => {
  test("returns found:false when the contact is not a Sysbrazo client", async () => {
    lookupMock.mockResolvedValue({ found: false })

    const result = await getSysbrazoAutodiagnostics({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({ found: false })
    expect(executeMock).not.toHaveBeenCalled()
  })

  test("calls the support list endpoint with default pagination", async () => {
    executeMock.mockResolvedValueOnce(
      okResult(JSON.stringify({ items: [summary()], total: 1 })),
    )

    const result = await getSysbrazoAutodiagnostics({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({
      found: true,
      items: [expect.objectContaining({ id: 121_000 })],
      total: 1,
    })
    const [input] = executeMock.mock.calls[0] ?? []
    expect(input.url).toBe(
      "https://sysbrazo.example.com/api/botmaker/client/88213/autodiagnostics?page=1&per_page=3",
    )
    expect(input.method).toBe("GET")
    expect(input.headers).toContainEqual({
      key: "Authorization",
      value: "Basic dGVzdA==",
    })
  })

  test("clamps perPage to 100 and page to positive integers", async () => {
    executeMock.mockResolvedValueOnce(
      okResult(JSON.stringify({ items: [], total: 0 })),
    )

    await getSysbrazoAutodiagnostics({
      workspaceId: "ws-1",
      contactId: "contact-1",
      page: 0,
      perPage: 500,
    })

    const [input] = executeMock.mock.calls[0] ?? []
    expect(input.url).toContain("?page=1&per_page=100")
  })

  test("throws on a 500 upstream", async () => {
    executeMock.mockResolvedValueOnce({
      statusCode: 500,
      durationMs: 10,
      responseBody: "",
      responseHeaders: {},
    })

    await expect(
      getSysbrazoAutodiagnostics({
        workspaceId: "ws-1",
        contactId: "contact-1",
      }),
    ).rejects.toThrow(FAILED_STATUS_ERROR_RE)
  })
})

describe("getSysbrazoAutodiagnosticDetail", () => {
  test("calls the run detail endpoint scoped to the resolved client", async () => {
    executeMock.mockResolvedValueOnce(
      okResult(
        JSON.stringify({
          ...summary(),
          steps: [
            {
              step_number: 1,
              step_name: "initializing",
              status: "success",
              details: {},
            },
          ],
        }),
      ),
    )

    const result = await getSysbrazoAutodiagnosticDetail({
      workspaceId: "ws-1",
      contactId: "contact-1",
      runId: 121_000,
    })

    expect(result.id).toBe(121_000)
    const [input] = executeMock.mock.calls[0] ?? []
    expect(input.url).toBe(
      "https://sysbrazo.example.com/api/botmaker/client/88213/autodiagnostics/121000",
    )
  })

  test("throws when the contact is not a Sysbrazo client", async () => {
    lookupMock.mockResolvedValue({ found: false })

    await expect(
      getSysbrazoAutodiagnosticDetail({
        workspaceId: "ws-1",
        contactId: "contact-1",
        runId: 1,
      }),
    ).rejects.toThrow(CONTACT_NOT_FOUND_RE)
  })
})

describe("startSysbrazoAutodiagnostic", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
  })

  test("posts to the start endpoint with the chatbotx source fixed", async () => {
    getCurrentUserMock.mockResolvedValue(null)
    executeMock.mockResolvedValueOnce(
      okResult(
        JSON.stringify({
          status: "ok",
          run_id: 121_001,
          message: "Auto diagnostic started",
        }),
      ),
    )

    const result = await startSysbrazoAutodiagnostic({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({
      status: "ok",
      run_id: 121_001,
      message: "Auto diagnostic started",
    })
    const [input] = executeMock.mock.calls[0] ?? []
    expect(input.method).toBe("POST")
    expect(input.url).toBe(
      "https://sysbrazo.example.com/api/botmaker/client/88213/autodiagnostics",
    )
    expect(input.body).toEqual({
      bodyType: "json",
      jsonBody: JSON.stringify({ source: "chatbotx" }),
    })
  })

  test("attaches who launched the run (started_by) when the user resolves", async () => {
    getCurrentUserMock.mockResolvedValue({
      name: "Asesor Uno",
      email: "asesor@example.com",
    })
    executeMock.mockResolvedValueOnce(
      okResult(
        JSON.stringify({
          status: "ok",
          run_id: 121_002,
          message: "Auto diagnostic started",
        }),
      ),
    )

    await startSysbrazoAutodiagnostic({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    const [input] = executeMock.mock.calls[0] ?? []
    expect(JSON.parse(input.body.jsonBody)).toEqual({
      source: "chatbotx",
      started_by: {
        name: "Asesor Uno",
        email: "asesor@example.com",
      },
    })
  })

  test("normalizes an upstream 403 to an error response without throwing", async () => {
    executeMock.mockResolvedValueOnce({
      statusCode: 403,
      durationMs: 10,
      responseBody: "",
      responseHeaders: {},
    })

    const result = await startSysbrazoAutodiagnostic({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result.status).toBe("error")
    expect(result.message).toContain("403")
  })

  test("returns an error response when the contact is missing", async () => {
    lookupMock.mockResolvedValue({ found: false })

    const result = await startSysbrazoAutodiagnostic({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result.status).toBe("error")
    expect(executeMock).not.toHaveBeenCalled()
  })
})

describe("getSysbrazoTickets", () => {
  test("maps providers metadata and defaults total from items", async () => {
    executeMock.mockResolvedValueOnce(
      okResult(
        JSON.stringify({
          items: [
            {
              provider: "odoo",
              id: "15294",
              display_id: "15294",
              url: null,
              status: "En progreso",
              is_open: true,
              title: "Corte de fibra",
              team: "Soporte técnico N2",
              city: "Montería",
              opened_at: "2026-10-05 09:10",
              updated_at: "2026-10-08 11:14",
              is_massive: false,
              affected_clients: null,
            },
          ],
          providers: [{ provider: "odoo", verified: false, error: "timeout" }],
        }),
      ),
    )

    const result = await getSysbrazoTickets({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.total).toBe(1)
      expect(result.providers?.[0]?.verified).toBe(false)
    }
    const [input] = executeMock.mock.calls[0] ?? []
    expect(input.url).toBe(
      "https://sysbrazo.example.com/api/botmaker/client/88213/tickets?page=1&per_page=3",
    )
  })

  test("returns found:false for a missing contact", async () => {
    lookupMock.mockResolvedValue({ found: false })

    const result = await getSysbrazoTickets({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({ found: false })
  })
})
