import { externalRequestService } from "@chatbotx.io/business"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth/utils"
import {
  type SysbrazoAutodiagnosticsLookup,
  type SysbrazoDiagnosticDetail,
  type SysbrazoStartDiagnosticResponse,
  type SysbrazoTicketsLookup,
  sysbrazoAutodiagnosticsResponseSchema,
  sysbrazoDiagnosticDetailSchema,
  sysbrazoStartDiagnosticResponseSchema,
  sysbrazoTicketsResponseSchema,
} from "../schema/sysbrazo-support"
import {
  type SysbrazoNotesResponse,
  sysbrazoNotesResponseSchema,
} from "../schema/sysbrazo-notes"
import {
  getSysbrazoClientByDocument,
  resolveContactSysbrazoDocumentId,
  resolveSysbrazoRequest,
} from "./get-sysbrazo-client.query"

/**
 * Consultas de soporte del panel (#15466) contra los endpoints nuevos de
 * Sysbrazo. El `clientId` de Sysbrazo NUNCA lo aporta el navegador: se
 * resuelve en servidor desde el contacto (mismo lookup de #15467). Las
 * cabeceras (Authorization incluida) salen de la MISMA fuente única que el
 * lookup: el nodo `callApi` del flujo — no hay una credencial separada.
 */

const AUTODIAGNOSTICS_PATH = "/api/botmaker/client"
const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 3
const MAX_PER_PAGE = 100

type SupportContext = {
  clientId: string
  origin: string
  headers: Array<{ key: string; value: string }>
}

/** Resuelve el contexto (clientId + URL base + cabeceras) o null sin contacto. */
const resolveSupportContext = async ({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<SupportContext | null> => {
  const lookup = await getSysbrazoClientByDocument({ workspaceId, contactId })
  if (!lookup.found) {
    return null
  }

  const documentId = await resolveContactSysbrazoDocumentId({
    workspaceId,
    contactId,
  })
  if (documentId === null) {
    return null
  }

  const { url, headers } = await resolveSysbrazoRequest(workspaceId, documentId)

  return {
    clientId: String(lookup.client.id),
    origin: new URL(url).origin,
    headers,
  }
}

const clampPerPage = (perPage: number): number =>
  Math.min(Math.max(Math.trunc(perPage) || DEFAULT_PER_PAGE, 1), MAX_PER_PAGE)

const clampPage = (page: number): number =>
  Math.max(Math.trunc(page) || DEFAULT_PAGE, 1)

/** Ejecuta y parsea JSON; los status >= 400 son error explícito del bloque. */
const executeSupportJson = async <T>({
  context,
  path,
  method = "GET",
  body,
  workspaceId,
  parse,
}: {
  context: SupportContext
  path: string
  method?: "GET" | "POST" | "PATCH"
  body?: unknown
  workspaceId: string
  parse: (raw: unknown) => T
}): Promise<T> => {
  const headers = [...context.headers]
  if (
    method === "POST" &&
    !headers.some((h) => h.key.toLowerCase() === "content-type")
  ) {
    headers.push({ key: "Content-Type", value: "application/json" })
  }

  const result = await externalRequestService.execute(
    {
      method,
      url: `${context.origin}${path}`,
      headers,
      ...(body === undefined
        ? {}
        : { body: { bodyType: "json", jsonBody: JSON.stringify(body) } }),
    },
    { workspaceId },
  )

  if (result.statusCode >= 400) {
    throw new Error(
      `Sysbrazo support request failed with status ${result.statusCode}: ${path}`,
    )
  }

  return parse(JSON.parse(result.responseBody))
}

/**
 * Últimas ejecuciones de autodiagnóstico (más reciente primero) con total
 * para el historial. Sin contacto Sysbrazo → `{ found: false }`.
 */
export const getSysbrazoAutodiagnostics = async ({
  workspaceId,
  contactId,
  page = DEFAULT_PAGE,
  perPage = DEFAULT_PER_PAGE,
}: {
  workspaceId: string
  contactId: string
  page?: number
  perPage?: number
}): Promise<SysbrazoAutodiagnosticsLookup> => {
  const context = await resolveSupportContext({ workspaceId, contactId })
  if (!context) {
    return { found: false }
  }

  const safePage = clampPage(page)
  const safePerPage = clampPerPage(perPage)
  const parsed = await executeSupportJson({
    context,
    workspaceId,
    path:
      `${AUTODIAGNOSTICS_PATH}/${encodeURIComponent(context.clientId)}/autodiagnostics` +
      `?page=${safePage}&per_page=${safePerPage}`,
    parse: (raw) => sysbrazoAutodiagnosticsResponseSchema.parse(raw),
  })

  return { found: true, items: parsed.items, total: parsed.total }
}

/**
 * Detalle/progreso de una ejecución. `run_id` se valida contra el cliente
 * resuelto en servidor (nunca se acepta un run de otro cliente).
 */
export const getSysbrazoAutodiagnosticDetail = async ({
  workspaceId,
  contactId,
  runId,
}: {
  workspaceId: string
  contactId: string
  runId: number
}): Promise<SysbrazoDiagnosticDetail> => {
  const context = await resolveSupportContext({ workspaceId, contactId })
  if (!context) {
    throw new Error("Contact not found in Sysbrazo")
  }

  return executeSupportJson({
    context,
    workspaceId,
    path:
      `${AUTODIAGNOSTICS_PATH}/${encodeURIComponent(context.clientId)}` +
      `/autodiagnostics/${encodeURIComponent(String(runId))}`,
    parse: (raw) => sysbrazoDiagnosticDetailSchema.parse(raw),
  })
}

/**
 * Inicia un autodiagnóstico desde ChatbotX (origen `chatbotx`, fijado por
 * el endpoint de Sysbrazo). Devuelve la ejecución creada o la activa
 * existente. Un 4xx del upstream (p.ej. permiso/estado) se normaliza a
 * `{ status: "error", message }` sin romper el panel.
 */
export const startSysbrazoAutodiagnostic = async ({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<SysbrazoStartDiagnosticResponse> => {
  const context = await resolveSupportContext({ workspaceId, contactId })
  if (!context) {
    return { status: "error", message: "Contact not found in Sysbrazo" }
  }

  const headers = [...context.headers]
  if (!headers.some((h) => h.key.toLowerCase() === "content-type")) {
    headers.push({ key: "Content-Type", value: "application/json" })
  }

  // Quién lanza el run desde ChatbotX (#15466): viaja como `started_by` para
  // que Sysbrazo lo guarde en el run y el historial muestre al asesor.
  const user = await getCurrentUser()
  const startedBy =
    user == null
      ? null
      : {
          name: user.name ?? user.email,
          email: user.email,
        }

  const result = await externalRequestService.execute(
    {
      method: "POST",
      url:
        `${context.origin}${AUTODIAGNOSTICS_PATH}` +
        `/${encodeURIComponent(context.clientId)}/autodiagnostics`,
      headers,
      body: {
        bodyType: "json",
        // El origen lo fija el backend de Sysbrazo; el asesor y el workspace
        // viajan en el contexto del canal autorizado, no como input libre.
        jsonBody: JSON.stringify({
          source: "chatbotx",
          ...(startedBy ? { started_by: startedBy } : {}),
        }),
      },
    },
    { workspaceId },
  )

  if (result.statusCode >= 400) {
    return {
      status: "error",
      message: `Sysbrazo start failed with status ${result.statusCode}`,
    }
  }

  return sysbrazoStartDiagnosticResponseSchema.parse(
    JSON.parse(result.responseBody),
  )
}

/**
 * Tickets del cliente (abiertos primero, luego más recientes). Sin contacto
 * Sysbrazo → `{ found: false }`; un proveedor caído viaja como
 * `providers[].verified === false` para mostrar "No verificado".
 */
export const getSysbrazoTickets = async ({
  workspaceId,
  contactId,
  page = DEFAULT_PAGE,
  perPage = DEFAULT_PER_PAGE,
}: {
  workspaceId: string
  contactId: string
  page?: number
  perPage?: number
}): Promise<SysbrazoTicketsLookup> => {
  const context = await resolveSupportContext({ workspaceId, contactId })
  if (!context) {
    return { found: false }
  }

  const safePage = clampPage(page)
  const safePerPage = clampPerPage(perPage)
  const parsed = await executeSupportJson({
    context,
    workspaceId,
    path:
      `${AUTODIAGNOSTICS_PATH}/${encodeURIComponent(context.clientId)}/tickets` +
      `?page=${safePage}&per_page=${safePerPage}`,
    parse: (raw) => sysbrazoTicketsResponseSchema.parse(raw),
  })

  return {
    found: true,
    items: parsed.items,
    total: parsed.total ?? parsed.items.length,
    page: safePage,
    perPage: safePerPage,
    providers: parsed.providers ?? undefined,
  }
}

export const getSysbrazoNotes = async ({
  workspaceId,
  contactId,
  origin,
  page = 1,
}: {
  workspaceId: string
  contactId: string
  origin?: "chat" | "sysbrazo"
  page?: number
}): Promise<SysbrazoNotesResponse | null> => {
  const context = await resolveSupportContext({ workspaceId, contactId })
  if (!context) {
    return null
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new Error("User not found")
  }

  const query = new URLSearchParams({ page: String(clampPage(page)) })
  if (origin) {
    query.set("origin", origin)
  }

  return await executeSupportJson({
    context,
    workspaceId,
    path: `${AUTODIAGNOSTICS_PATH}/${encodeURIComponent(context.clientId)}/notes?${query}`,
    parse: (raw) => sysbrazoNotesResponseSchema.parse(raw),
  })
}

export const createSysbrazoNote = async ({
  workspaceId,
  contactId,
  notes,
}: {
  workspaceId: string
  contactId: string
  notes: string
}): Promise<SysbrazoNotesResponse["items"][number] | null> => {
  const context = await resolveSupportContext({ workspaceId, contactId })
  if (!context) {
    return null
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new Error("User not found")
  }

  const result = await executeSupportJson({
    context,
    workspaceId,
    method: "POST",
    path: `${AUTODIAGNOSTICS_PATH}/${encodeURIComponent(context.clientId)}/notes`,
    body: {
      notes,
      actor_id: String(user.id),
      requested_by: user.name ?? user.email,
    },
    parse: (raw) => z.object({ item: sysbrazoNotesResponseSchema.shape.items.element }).parse(raw),
  })

  return result.item
}

export const updateSysbrazoNote = async ({
  workspaceId,
  contactId,
  noteId,
  notes,
}: {
  workspaceId: string
  contactId: string
  noteId: string
  notes: string
}): Promise<SysbrazoNotesResponse["items"][number] | null> => {
  const context = await resolveSupportContext({ workspaceId, contactId })
  if (!context) {
    return null
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new Error("User not found")
  }

  const result = await executeSupportJson({
    context,
    workspaceId,
    method: "PATCH",
    path: `${AUTODIAGNOSTICS_PATH}/${encodeURIComponent(context.clientId)}/notes/${encodeURIComponent(noteId)}`,
    body: {
      notes,
      actor_id: String(user.id),
    },
    parse: (raw) => z.object({ item: sysbrazoNotesResponseSchema.shape.items.element }).parse(raw),
  })

  return result.item
}
