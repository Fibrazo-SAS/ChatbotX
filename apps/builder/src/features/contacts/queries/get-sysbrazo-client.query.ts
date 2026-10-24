import {
  botFieldService,
  externalRequestService,
  flowVersionService,
} from "@chatbotx.io/business"
import {
  type SysbrazoLookupResponse,
  type SysbrazoOnuStatus,
  sysbrazoClientListResponseSchema,
  sysbrazoOnuStatusSchema,
} from "../schema/sysbrazo-client"
import {
  normalizeDocumentId,
  SYSBRAZO_BOT_PATH,
  SYSBRAZO_DOCUMENT_FIELD_NAME,
  SYSBRAZO_ONU_PATH,
} from "../sysbrazo-config"
import { listContactCustomFields } from "./list-contact-fields.query"

/**
 * Variable global FIJA del workspace con la URL (o plantilla) de Sysbrazo
 * para traer los datos del cliente. El nombre es fijo y es la convención;
 * el VALOR cambia por entorno (dev/prod/ngrok local) y puede referenciar
 * otras variables globales (`{{LOCAL_URL}}`) y `{{document_id}}`, que el
 * panel resuelve encadenado. Si el workspace no la define, se cae al nodo
 * `callApi` del flujo publicado.
 */
const SYSBRAZO_BASE_URL_VARIABLE = "SYSBRAZO_CLIENT_API_URL"
const DOCUMENT_ID_TOKEN_NAME = "document_id"
const TRAILING_SLASHES_RE = /\/+$/
const VARIABLE_TOKEN_RE = /\{\{(\w+)\}\}/g
const MAX_RESOLUTION_PASSES = 5

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

/**
 * Resolución encadenada de `{{...}}`: `document_id` → el documento del
 * contacto; cualquier otro token → variable global del workspace por nombre.
 * Itera hasta estabilizar (soporta variables dentro de variables, p.ej.
 * `SYSBRAZO_CLIENT_API_URL = {{LOCAL_URL}}/api/...`) con tope de pasadas
 * contra ciclos.
 */
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

const RESIDUAL_TOKEN_RE = /\{\{\w+\}\}/

/** URL del lookup ya resuelta y completa (path incluido), o error claro. */
const buildLookupUrl = (resolved: string, documentId: string): string => {
  let url = resolved.trim()

  // Sin el path del endpoint → era una URL base: completarla.
  if (!url.includes(SYSBRAZO_BOT_PATH)) {
    url = `${url.replace(TRAILING_SLASHES_RE, "")}${SYSBRAZO_BOT_PATH}?document_id=${documentId}&botmaker=1`
  }

  if (RESIDUAL_TOKEN_RE.test(url)) {
    throw new Error(
      `The Sysbrazo URL template has unresolved variables: ${url}`,
    )
  }

  return url
}

type CallApiConfig = {
  url: string
  headers: Array<{ key: string; value: string }>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const extractHeaders = (raw: unknown): CallApiConfig["headers"] =>
  Array.isArray(raw)
    ? raw
        .filter(
          (header): header is { key: string; value: string } =>
            Boolean(header) &&
            typeof header === "object" &&
            typeof (header as { key?: unknown }).key === "string" &&
            typeof (header as { value?: unknown }).value === "string",
        )
        .map((header) => ({ key: header.key.trim(), value: header.value }))
    : []

/**
 * Recorre el JSON de un nodo buscando el sub-paso `callApi` de Sysbrazo. En el
 * flujo real el paso no es un nodo del lienzo: vive anidado como objeto con
 * `stepType: "callApi"` dentro de `data.details.steps` (u otros contenedores)
 * de un nodo tipo `sendMessage`/`performAction`. La búsqueda recursiva cubre
 * cualquier anidado sin depender de una forma concreta.
 */
const collectSysbrazoCallApiSteps = (
  value: unknown,
  acc: CallApiConfig[],
): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSysbrazoCallApiSteps(item, acc)
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
    acc.push({ url: value.url, headers: extractHeaders(value.headers) })
  }

  for (const child of Object.values(value)) {
    collectSysbrazoCallApiSteps(child, acc)
  }
}

/**
 * El paso `callApi` del flujo como fuente única de la config del lookup.
 *
 * Busca en las versiones publicadas de los flujos del workspace el sub-paso
 * `callApi` cuya URL apunte al endpoint de Sysbrazo del bot
 * (`/api/botmaker/client/by-document`) y devuelve su URL + cabeceras tal cual
 * están configuradas (incluida la Authorization). Si cambian el paso, el panel
 * lo sigue sin tocar código ni `.env`.
 */
const findSysbrazoCallApiConfig = async (
  workspaceId: string,
): Promise<CallApiConfig | null> => {
  const versions =
    await flowVersionService.listLatestPublishedByWorkspace(workspaceId)

  for (const version of versions) {
    const nodes = Array.isArray(version.nodes) ? version.nodes : []

    for (const node of nodes) {
      const matches: CallApiConfig[] = []
      collectSysbrazoCallApiSteps(node, matches)
      const match = matches.find((candidate) => candidate.url !== "")
      if (match) {
        return match
      }
    }
  }

  return null
}

/**
 * Resuelve la URL + cabeceras del lookup: la URL sale de la variable global
 * FIJA `SYSBRAZO_CLIENT_API_URL` (plantilla con tokens anidados); si el
 * workspace no la define, cae a la URL del nodo `callApi` del flujo. Las
 * cabeceras (Authorization) siempre salen del nodo — es la fuente única de
 * credenciales.
 */
export const resolveSysbrazoRequest = async (
  workspaceId: string,
  documentId: string,
): Promise<{
  url: string
  headers: Array<{ key: string; value: string }>
}> => {
  const config = await findSysbrazoCallApiConfig(workspaceId)
  if (!config) {
    throw new Error(
      "Sysbrazo callApi step not found in the workspace published flows",
    )
  }

  const field = await botFieldService.findByKey({
    workspaceId,
    key: SYSBRAZO_BASE_URL_VARIABLE,
  })
  const template =
    typeof field?.value === "string" && field.value.trim() !== ""
      ? field.value.trim()
      : config.url

  const url = buildLookupUrl(
    await resolveNestedVariables(workspaceId, template, documentId),
    documentId,
  )
  const headers = await Promise.all(
    config.headers.map(async (header) => ({
      key: header.key,
      value: await resolveNestedVariables(
        workspaceId,
        header.value,
        documentId,
      ),
    })),
  )

  return { url, headers }
}

/**
 * Documento del contacto normalizado para Sysbrazo (`document_id` custom
 * field validado con la misma regla del upstream), o `null` si no hay
 * documento o no cumple la regla. Helper compartido: lo usa el lookup
 * principal y las consultas de soporte (autodiagnósticos/tickets), que
 * necesitan el mismo documento para resolver credenciales sin repetir la
 * lectura del custom field.
 */
export const resolveContactSysbrazoDocumentId = async ({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<string | null> => {
  const { data: fields } = await listContactCustomFields({
    workspaceId,
    contactId,
  })

  const documentField = fields.find(
    (field) => field.name === SYSBRAZO_DOCUMENT_FIELD_NAME,
  )
  const rawDocumentId = documentField?.value?.trim() ?? ""

  if (rawDocumentId === "") {
    return null
  }

  return normalizeDocumentId(rawDocumentId)
}

/**
 * Lookup on-demand del panel contra Sysbrazo, gatillado por el custom field
 * `document_id` del contacto (el "punto de inflexión"). Sin documento → no
 * consulta. `404` → `{ found: false }` (no registra como cliente).
 *
 * El `document_id` es input no confiable (viene del canal): se normaliza y
 * valida antes de consultar, replicando la regla de Sysbrazo.
 */
export const getSysbrazoClientByDocument = async ({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<SysbrazoLookupResponse> => {
  const documentId = await resolveContactSysbrazoDocumentId({
    workspaceId,
    contactId,
  })

  if (documentId === null) {
    return { found: false }
  }

  const { url, headers } = await resolveSysbrazoRequest(workspaceId, documentId)

  const result = await externalRequestService.execute(
    {
      method: "GET",
      url,
      headers,
    },
    { workspaceId },
  )

  if (result.statusCode === 404) {
    return { found: false }
  }

  if (result.statusCode >= 400) {
    throw new Error(`Sysbrazo lookup failed with status ${result.statusCode}`)
  }

  const parsed = sysbrazoClientListResponseSchema.parse(
    JSON.parse(result.responseBody),
  )
  const client = parsed.data[0]

  if (!client) {
    return { found: false }
  }

  return { found: true, client, baseUrl: new URL(url).origin }
}

/**
 * Snapshot ONU/CPE dedicado, consultado aparte del lookup principal (el
 * endpoint que consume el propio `CpeTechnicalStatus` de Sysbrazo:
 * `/api/krill/cpe-onu-status/{clientId}`). `force` salta la cache de 1 h
 * (botón "Refrescar" del panel). `404` (sin CPE provisionada) → `null`.
 *
 * La URL base y las cabeceras salen de la misma config del nodo `callApi`
 * del flujo (fuente única), igual que el lookup principal.
 */
export const getSysbrazoClientOnu = async ({
  workspaceId,
  clientId,
  force = false,
}: {
  workspaceId: string
  clientId: string
  force?: boolean
}): Promise<SysbrazoOnuStatus | null> => {
  const { url: lookupUrl, headers } = await resolveSysbrazoRequest(
    workspaceId,
    "0",
  )
  const origin = new URL(lookupUrl).origin
  const url =
    `${origin}${SYSBRAZO_ONU_PATH}/${encodeURIComponent(clientId)}` +
    (force ? "?force=1" : "")

  const result = await externalRequestService.execute(
    {
      method: "GET",
      url,
      headers,
    },
    { workspaceId },
  )

  // 404 = sin CPE provisionada; 500 = Krill no disponible/falló (p.ej.
  // ambiente local sin Krill configurado). Ambos se normalizan a null para
  // que el panel muestre "Sin información" en vez de romper.
  if (result.statusCode === 404 || result.statusCode === 500) {
    return null
  }

  if (result.statusCode >= 400) {
    throw new Error(
      `Sysbrazo ONU status failed with status ${result.statusCode}`,
    )
  }

  return sysbrazoOnuStatusSchema.parse(JSON.parse(result.responseBody))
}
