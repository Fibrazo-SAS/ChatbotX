import { botFieldService } from "../bot-field/service"
import { externalRequestService } from "../external-request/service"
import { flowVersionService } from "../flow-version/service"

export const SYSBRAZO_DOCUMENT_FIELD_NAME = "document_id"

const SYSBRAZO_BOT_PATH = "/api/botmaker/client/by-document"
const SYSBRAZO_BASE_URL_VARIABLE = "SYSBRAZO_CLIENT_API_URL"
const DOCUMENT_ID_TOKEN_NAME = "document_id"
const MAX_RESOLUTION_PASSES = 5
const TRAILING_SLASHES_RE = /\/+$/
const VARIABLE_TOKEN_RE = /\{\{(\w+)\}\}/g
const RESIDUAL_TOKEN_RE = /\{\{\w+\}\}/
const NUMERIC_DOCUMENT_RE = /^\d{5,20}$/
const PASSPORT_DOCUMENT_RE = /^[A-Za-z0-9]{6,12}$/
const DOCUMENT_SEPARATORS_RE = /[\s.]/g

type CallApiConfig = {
  headers: Array<{ key: string; value: string }>
  url: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const extractTokenNames = (text: string): string[] => {
  const names = new Set<string>()
  for (const match of text.matchAll(VARIABLE_TOKEN_RE)) {
    if (match[1]) {
      names.add(match[1])
    }
  }
  return [...names]
}

const interpolate = (text: string, mapping: Record<string, string>): string =>
  text.replace(VARIABLE_TOKEN_RE, (token, name: string) =>
    mapping[name] === undefined ? token : mapping[name],
  )

export const normalizeSysbrazoDocumentId = (raw: string): string | null => {
  const cleaned = raw.replace(DOCUMENT_SEPARATORS_RE, "")
  if (NUMERIC_DOCUMENT_RE.test(cleaned)) {
    return cleaned
  }
  return PASSPORT_DOCUMENT_RE.test(cleaned) ? cleaned.toUpperCase() : null
}

const resolveNestedVariables = async (
  workspaceId: string,
  template: string,
  documentId: string,
): Promise<string> => {
  let current = template

  for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass++) {
    const tokens = extractTokenNames(current)
    if (tokens.length === 0) {
      break
    }

    const mapping: Record<string, string> = {}
    for (const name of tokens) {
      if (name === DOCUMENT_ID_TOKEN_NAME) {
        mapping[name] = documentId
        continue
      }
      const field = await botFieldService.findByKey({ workspaceId, key: name })
      if (typeof field?.value === "string" && field.value.trim() !== "") {
        mapping[name] = field.value.trim()
      }
    }

    const next = interpolate(current, mapping)
    if (next === current) {
      break
    }
    current = next
  }

  return current
}

const extractHeaders = (raw: unknown): CallApiConfig["headers"] =>
  Array.isArray(raw)
    ? raw.flatMap((header) =>
        isRecord(header) &&
        typeof header.key === "string" &&
        typeof header.value === "string"
          ? [{ key: header.key.trim(), value: header.value }]
          : [],
      )
    : []

const collectSysbrazoCallApiSteps = (
  value: unknown,
  configs: CallApiConfig[],
): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSysbrazoCallApiSteps(item, configs)
    }
    return
  }
  if (!isRecord(value)) {
    return
  }
  if (
    value.stepType === "callApi" &&
    typeof value.url === "string" &&
    value.url.includes(SYSBRAZO_BOT_PATH)
  ) {
    configs.push({ url: value.url, headers: extractHeaders(value.headers) })
  }
  for (const child of Object.values(value)) {
    collectSysbrazoCallApiSteps(child, configs)
  }
}

const findSysbrazoCallApiConfig = async (
  workspaceId: string,
): Promise<CallApiConfig | null> => {
  const versions =
    await flowVersionService.listLatestPublishedByWorkspace(workspaceId)
  for (const version of versions) {
    for (const node of Array.isArray(version.nodes) ? version.nodes : []) {
      const configs: CallApiConfig[] = []
      collectSysbrazoCallApiSteps(node, configs)
      const config = configs.find((candidate) => candidate.url !== "")
      if (config) {
        return config
      }
    }
  }
  return null
}

const buildLookupUrl = (template: string, documentId: string): string => {
  let url = template.trim()
  if (!url.includes(SYSBRAZO_BOT_PATH)) {
    url = `${url.replace(TRAILING_SLASHES_RE, "")}${SYSBRAZO_BOT_PATH}?document_id=${documentId}&botmaker=1`
  }
  if (RESIDUAL_TOKEN_RE.test(url)) {
    throw new Error("The Sysbrazo URL template has unresolved variables")
  }
  return url
}

const getClientId = (responseBody: string): string | null => {
  const parsed: unknown = JSON.parse(responseBody)
  if (!(isRecord(parsed) && Array.isArray(parsed.data))) {
    return null
  }
  const client = parsed.data[0]
  if (
    !(
      isRecord(client) &&
      (typeof client.id === "string" || typeof client.id === "number")
    )
  ) {
    return null
  }
  const id = String(client.id).trim()
  return id === "" ? null : id
}

class SysbrazoClientLookupService {
  async findByDocument(input: {
    documentId: string
    workspaceId: string
  }): Promise<{ baseUrl?: string; found: boolean; sysbrazoClientId?: string }> {
    const documentId = normalizeSysbrazoDocumentId(input.documentId)
    if (!documentId) {
      return { found: false }
    }

    const config = await findSysbrazoCallApiConfig(input.workspaceId)
    if (!config) {
      throw new Error(
        "Sysbrazo callApi step not found in the workspace published flows",
      )
    }
    const field = await botFieldService.findByKey({
      workspaceId: input.workspaceId,
      key: SYSBRAZO_BASE_URL_VARIABLE,
    })
    const template =
      typeof field?.value === "string" && field.value.trim() !== ""
        ? field.value.trim()
        : config.url
    const url = buildLookupUrl(
      await resolveNestedVariables(input.workspaceId, template, documentId),
      documentId,
    )
    const headers = await Promise.all(
      config.headers.map(async (header) => ({
        key: header.key,
        value: await resolveNestedVariables(
          input.workspaceId,
          header.value,
          documentId,
        ),
      })),
    )
    const result = await externalRequestService.execute(
      { method: "GET", url, headers },
      { workspaceId: input.workspaceId },
    )
    if (result.statusCode === 404) {
      return { found: false }
    }
    if (result.statusCode >= 400) {
      throw new Error(`Sysbrazo lookup failed with status ${result.statusCode}`)
    }
    const sysbrazoClientId = getClientId(result.responseBody)
    return sysbrazoClientId
      ? { found: true, sysbrazoClientId, baseUrl: new URL(url).origin }
      : { found: false }
  }
}

export const sysbrazoClientLookupService = new SysbrazoClientLookupService()
