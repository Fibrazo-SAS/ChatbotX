import { beforeEach, describe, expect, test, vi } from "vitest"

const executeMock = vi.fn()
const findByKeyMock = vi.fn()
const listLatestPublishedByWorkspaceMock = vi.fn()
vi.mock("@chatbotx.io/business", () => ({
  externalRequestService: { execute: executeMock },
  botFieldService: { findByKey: findByKeyMock },
  flowVersionService: {
    listLatestPublishedByWorkspace: listLatestPublishedByWorkspaceMock,
  },
}))

const listContactCustomFieldsMock = vi.fn()
vi.mock("@/features/contacts/queries/list-contact-fields.query", () => ({
  listContactCustomFields: listContactCustomFieldsMock,
}))

const { getSysbrazoClientByDocument, getSysbrazoClientOnu } = await import(
  "../queries/get-sysbrazo-client.query"
)

const noFields = () => ({ data: [] })
const withDocument = (value: string) => ({
  data: [{ name: "document_id", value }],
})

const okResult = (responseBody: string) => ({
  statusCode: 200,
  durationMs: 10,
  responseBody,
  responseHeaders: {},
})

/**
 * Réplica de la forma real del flujo: el paso callApi NO es un nodo del
 * lienzo, vive anidado en `data.details.steps` de un nodo `sendMessage`.
 */
const sysbrazoCallApiVersion = (overrides?: {
  url?: string
  headers?: unknown
}) => ({
  nodes: [
    {
      type: "sendMessage",
      data: {
        details: {
          steps: [
            {
              id: "step-call-api",
              stepType: "callApi",
              method: "GET",
              url:
                overrides?.url ??
                "https://sysbrazo.example.com/api/botmaker/client/by-document?document_id={{document_id}}&botmaker=1",
              headers: overrides?.headers ?? [
                {
                  key: "Authorization",
                  value: "Basic Ym90bWFrZXJfcGF5bWVudDpmbUU4eFA4NlRQWTk=",
                },
              ],
            },
            {
              id: "step-send-text",
              stepType: "sendText",
              text: "{{URL_DEV}}/api/botmaker/client/by-document",
            },
          ],
        },
      },
    },
  ],
})

describe("getSysbrazoClientByDocument", () => {
  beforeEach(() => {
    executeMock.mockReset()
    listContactCustomFieldsMock.mockReset()
    findByKeyMock.mockReset()
    findByKeyMock.mockResolvedValue(null)
    listLatestPublishedByWorkspaceMock.mockReset()
    listLatestPublishedByWorkspaceMock.mockResolvedValue([
      sysbrazoCallApiVersion(),
    ])
  })

  test("returns found:false without consulting Sysbrazo when document_id is absent", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(noFields())

    const result = await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({ found: false })
    expect(executeMock).not.toHaveBeenCalled()
  })

  test("returns found:false when the document is invalid", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(withDocument("12"))

    const result = await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({ found: false })
    expect(executeMock).not.toHaveBeenCalled()
  })

  test("maps a 404 to found:false", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )
    executeMock.mockResolvedValueOnce({
      statusCode: 404,
      durationMs: 10,
      responseBody: "",
      responseHeaders: {},
    })

    const result = await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({ found: false })
    expect(executeMock).toHaveBeenCalledTimes(1)
  })

  test("uses the callApi node URL and headers, interpolating document_id", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1.045.123.456"),
    )
    executeMock.mockResolvedValueOnce(
      okResult(JSON.stringify({ data: [{ id: "1", full_name: "María" }] })),
    )

    const result = await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(result).toEqual({
      found: true,
      baseUrl: "https://sysbrazo.example.com",
      client: { id: "1", full_name: "María" },
    })

    const [input] = executeMock.mock.calls[0] as [
      {
        url: string
        method: string
        headers: Array<{ key: string; value: string }>
      },
    ]
    expect(input.url).toContain("document_id=1045123456")
    expect(input.url).toContain("botmaker=1")
    expect(input.headers).toEqual([
      {
        key: "Authorization",
        value: "Basic Ym90bWFrZXJfcGF5bWVudDpmbUU4eFA4NlRQWTk=",
      },
    ])
  })

  test("throws on an unexpected upstream error", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )
    executeMock.mockResolvedValueOnce({
      statusCode: 500,
      durationMs: 10,
      responseBody: "",
      responseHeaders: {},
    })

    await expect(
      getSysbrazoClientByDocument({
        workspaceId: "ws-1",
        contactId: "contact-1",
      }),
    ).rejects.toThrow("Sysbrazo lookup failed with status 500")
  })

  test("uses the fixed SYSBRAZO_CLIENT_API_URL template with nested variables", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )
    findByKeyMock
      .mockResolvedValueOnce({
        value:
          "{{LOCAL_URL}}/api/botmaker/client/by-document?document_id={{document_id}}&botmaker=1",
      })
      .mockResolvedValueOnce({ value: "https://abc123.ngrok-free.app" })
    executeMock.mockResolvedValueOnce(
      okResult(JSON.stringify({ data: [{ id: "1" }] })),
    )

    await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    expect(findByKeyMock).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      key: "SYSBRAZO_CLIENT_API_URL",
    })
    expect(findByKeyMock).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      key: "LOCAL_URL",
    })

    const [input] = executeMock.mock.calls[0] as [{ url: string }]
    expect(input.url).toBe(
      "https://abc123.ngrok-free.app/api/botmaker/client/by-document?document_id=1045123456&botmaker=1",
    )
  })

  test("completes the path when the fixed variable holds only the base URL", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )
    findByKeyMock.mockResolvedValueOnce({
      value: "https://abc123.ngrok-free.app/",
    })
    executeMock.mockResolvedValueOnce(
      okResult(JSON.stringify({ data: [{ id: "1" }] })),
    )

    await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    const [input] = executeMock.mock.calls[0] as [{ url: string }]
    expect(input.url).toBe(
      "https://abc123.ngrok-free.app/api/botmaker/client/by-document?document_id=1045123456&botmaker=1",
    )
  })

  test("falls back to the flow node URL when the fixed variable is missing", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )
    executeMock.mockResolvedValueOnce(
      okResult(JSON.stringify({ data: [{ id: "1" }] })),
    )

    await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    const [input] = executeMock.mock.calls[0] as [{ url: string }]
    expect(input.url).toBe(
      "https://sysbrazo.example.com/api/botmaker/client/by-document?document_id=1045123456&botmaker=1",
    )
  })

  test("throws when the template still has unresolved variables", async () => {
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )
    findByKeyMock.mockResolvedValueOnce({
      value:
        "{{MISSING_VAR}}/api/botmaker/client/by-document?document_id={{document_id}}&botmaker=1",
    })

    await expect(
      getSysbrazoClientByDocument({
        workspaceId: "ws-1",
        contactId: "contact-1",
      }),
    ).rejects.toThrow("unresolved variables")
  })

  test("skips nodes that are not the Sysbrazo callApi step", async () => {
    listLatestPublishedByWorkspaceMock.mockResolvedValueOnce([
      {
        nodes: [
          {
            type: "sendMessage",
            data: {
              details: {
                steps: [{ stepType: "sendText", text: "hola" }],
              },
            },
          },
          {
            type: "sendMessage",
            data: {
              details: {
                steps: [
                  {
                    stepType: "callApi",
                    url: "https://otra.api.com/datos",
                    headers: [],
                  },
                ],
              },
            },
          },
        ],
      },
      sysbrazoCallApiVersion(),
    ])

    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )
    executeMock.mockResolvedValueOnce(
      okResult(JSON.stringify({ data: [{ id: "1" }] })),
    )

    await getSysbrazoClientByDocument({
      workspaceId: "ws-1",
      contactId: "contact-1",
    })

    const [input] = executeMock.mock.calls[0] as [{ url: string }]
    expect(input.url).toContain("/api/botmaker/client/by-document")
  })

  test("appends force=1 when force is requested on the dedicated ONU endpoint", async () => {
    executeMock.mockResolvedValueOnce(okResult(JSON.stringify({ state: "up" })))

    await getSysbrazoClientOnu({
      workspaceId: "ws-1",
      clientId: "52981",
      force: true,
    })

    const [input] = executeMock.mock.calls[0] as [{ url: string }]
    expect(input.url).toBe(
      "https://sysbrazo.example.com/api/krill/cpe-onu-status/52981?force=1",
    )
  })

  test("does not append force by default on the ONU endpoint", async () => {
    executeMock.mockResolvedValueOnce(okResult(JSON.stringify({ state: "up" })))

    await getSysbrazoClientOnu({
      workspaceId: "ws-1",
      clientId: "52981",
    })

    const [input] = executeMock.mock.calls[0] as [{ url: string }]
    expect(input.url).toBe(
      "https://sysbrazo.example.com/api/krill/cpe-onu-status/52981",
    )
  })

  test("returns null when the ONU endpoint answers 404 (no CPE)", async () => {
    executeMock.mockResolvedValueOnce({ statusCode: 404 })

    const result = await getSysbrazoClientOnu({
      workspaceId: "ws-1",
      clientId: "52981",
    })

    expect(result).toBeNull()
  })

  test("parses the Krill ONU snapshot payload", async () => {
    executeMock.mockResolvedValueOnce(
      okResult(
        JSON.stringify({
          state: "up",
          registrationStates: ["online"],
          lastDownTime: null,
          rxPower: { value: "-19.39 dBm", status: "ok" },
          txPower: { value: "2.69 dBm", status: "ok" },
          upstreamPower: { value: "-23.1 dBm", status: "ok" },
          uptime: "1d 18h 12m",
          olt: "BDG-OLT01",
          port: "4",
          board: "7",
          connectedDevices: 0,
        }),
      ),
    )

    const result = await getSysbrazoClientOnu({
      workspaceId: "ws-1",
      clientId: "52981",
    })

    expect(result?.state).toBe("up")
    expect(result?.rxPower).toEqual({ value: "-19.39 dBm", status: "ok" })
    expect(result?.registrationStates).toEqual(["online"])
  })

  test("throws when no callApi node for Sysbrazo exists in the workspace", async () => {
    listLatestPublishedByWorkspaceMock.mockResolvedValueOnce([
      {
        nodes: [
          {
            type: "sendMessage",
            data: { details: { steps: [{ stepType: "sendText" }] } },
          },
        ],
      },
    ])
    listContactCustomFieldsMock.mockResolvedValueOnce(
      withDocument("1045123456"),
    )

    await expect(
      getSysbrazoClientByDocument({
        workspaceId: "ws-1",
        contactId: "contact-1",
      }),
    ).rejects.toThrow(
      "Sysbrazo callApi step not found in the workspace published flows",
    )
  })
})
