import type { SysbrazoAddon, SysbrazoClient } from "../schema/sysbrazo-client"

const DIGITS_ONLY_RE = /^\d+$/
const PHONE_DISPLAY_RE = /^\d{7,10}$/
const THOUSANDS_SEPARATOR_RE = /\B(?=(\d{3})+(?!\d))/g
const WHITESPACE_RE = /\s+/

/** `1045123456` → `1.045.123.456`; un pasaporte alfanumérico queda sin formatear. */
export const formatDocumentWithThousands = (
  value: string | number | null | undefined,
): string => {
  const str = String(value ?? "")
  if (DIGITS_ONLY_RE.test(str)) {
    return str.replace(THOUSANDS_SEPARATOR_RE, ".")
  }
  return str
}

/**
 * Short-code del tipo de documento, replicando `getDocumentTypeShortCode()`
 * de Sysbrazo (`ClientShared`): "Cédula de ciudadanía" → "CC", etc. Si no hay
 * mapeo, devuelve la descripción tal cual.
 */
const DOCUMENT_TYPE_SHORT_CODES: Record<string, string> = {
  "Cédula de ciudadanía": "CC",
  "Cédula de extranjería": "CE",
  "Registro civil": "RC",
  "Tarjeta de identidad": "TI",
  "Tarjeta de extranjería": "TE",
  Pasaporte: "PA",
  "Documento de identificación extranjero": "DIE",
  "NIT de otro país": "NIT-EXT",
}

export const shortenDocumentType = (
  description: string | null | undefined,
): string => {
  const trimmed = description?.trim() ?? ""
  if (trimmed === "") {
    return ""
  }
  return DOCUMENT_TYPE_SHORT_CODES[trimmed] ?? trimmed
}

const resolveLastNameWord = (words: string[]): string => {
  if (words.length >= 3) {
    return words.at(-2) ?? ""
  }
  if (words.length === 2) {
    return words.at(-1) ?? ""
  }
  return ""
}

/**
 * Iniciales del avatar. Sysbrazo expone solo `full_name` (p.ej. "María
 * Fernanda Rodríguez Pérez"): se toman primera palabra + penúltima ("MR"),
 * asumiendo dos apellidos; con una o dos palabras, primera + última ("Juan
 * Pérez" → "JP"). Si el payload trae `first_name`/`last_name`, tienen
 * prioridad.
 */
export const getClientInitials = (
  client: Pick<SysbrazoClient, "first_name" | "last_name" | "full_name">,
): string => {
  const fullNameWords = (client.full_name ?? "")
    .trim()
    .split(WHITESPACE_RE)
    .filter(Boolean)

  const firstName = client.first_name?.trim() || fullNameWords[0] || ""
  const lastName =
    client.last_name?.trim() || resolveLastNameWord(fullNameWords)

  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

/**
 * Formato de display del teléfono nacional colombiano (mockup del ticket):
 * `3021231507` → `302 123 1507` (3-3-4) y `7461234` → `746 1234` (3-4).
 * Cualquier otra longitud queda sin formatear.
 */
export const formatPhoneDisplay = (
  value: string | null | undefined,
): string => {
  const digits = (value ?? "").trim()
  if (!PHONE_DISPLAY_RE.test(digits)) {
    return digits
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`
  }
  return digits
}

/** `2026/10/05 14:32` — formato fijo del ticket para "última sesión". */
export const formatLastSession = (date: Date | null | undefined): string => {
  if (!date) {
    return ""
  }
  const pad = (n: number): string => String(n).padStart(2, "0")
  const d = new Date(date)
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/**
 * Estado visual del servicio de Internet a partir del status GAIAA y el
 * balance. Devuelve la clave de traducción; "expiring" se marca cuando el
 * corte está a 48 h o menos.
 */
export type ServiceState = "active" | "expiring" | "suspended" | "inactive"

const HOURS_48_MS = 48 * 60 * 60 * 1000

/** `dateToExpire` llega como "d-m-y H:i:s" (p.ej. "08-09-24 18:00:00"). */
const SYSBRAZO_DATE_RE =
  /^(\d{2})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/

const parseSysbrazoDate = (value: string): Date | null => {
  const match = SYSBRAZO_DATE_RE.exec(value.trim())
  if (!match) {
    return null
  }
  const [, day, month, shortYear, hours, minutes, seconds] = match
  const date = new Date(
    2000 + Number(shortYear),
    Number(month) - 1,
    Number(day),
    Number(hours ?? 0),
    Number(minutes ?? 0),
    Number(seconds ?? 0),
  )
  return Number.isNaN(date.getTime()) ? null : date
}

/** `dateToExpire` ("d-m-y H:i:s") → "2026/10/06 08:00" (formato del mockup). */
export const formatSysbrazoDateDisplay = (
  value: string | null | undefined,
): string => {
  if (!value) {
    return ""
  }
  const parsed = parseSysbrazoDate(value)
  if (!parsed) {
    return value
  }
  const pad = (n: number): string => String(n).padStart(2, "0")
  return (
    `${parsed.getFullYear()}/${pad(parsed.getMonth() + 1)}/${pad(parsed.getDate())} ` +
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  )
}

export const resolveInternetServiceState = (
  client: SysbrazoClient,
): ServiceState => {
  const status = (client.internet_status ?? "").toLowerCase()

  if (status.includes("suspend")) {
    return "suspended"
  }

  if (status.includes("inactive") || status.includes("inactivo")) {
    return "inactive"
  }

  const dateToExpire = client.balance?.dateToExpire
  if (dateToExpire) {
    const parsed = parseSysbrazoDate(dateToExpire)
    const expiry = (parsed ?? new Date(dateToExpire)).getTime()
    if (!Number.isNaN(expiry) && expiry - Date.now() <= HOURS_48_MS) {
      return "expiring"
    }
  }

  if (status.includes("active") || status.includes("activo")) {
    return "active"
  }

  return "inactive"
}

/** `2026-10-06 08:00:00` → `2026/10/06 08:00` (formato del mockup). */
const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/

export const formatIsoDisplay = (value: string | null | undefined): string => {
  const match = value?.trim() ? ISO_DATETIME_RE.exec(value.trim()) : null
  if (!match) {
    return value ?? ""
  }
  const [, year, month, day, hours, minutes] = match
  return `${year}/${month}/${day}${hours ? ` ${hours}:${minutes ?? "00"}` : ""}`
}

/** Días completos transcurridos desde una fecha ISO; null si no es válida. */
export const daysSince = (value: string | null | undefined): number | null => {
  const parsed = value ? new Date(value.replace(" ", "T")) : null
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null
  }
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000))
}

/** Estado visual de una suscripción add-on (saldo y estado propios). */
export type AddonState = "active" | "expiring" | "suspended" | "inactive"

export const resolveAddonState = (addon: SysbrazoAddon): AddonState => {
  const status = (addon.status ?? "").toLowerCase()

  if (status.includes("suspend")) {
    return "suspended"
  }

  if (status.includes("inactive")) {
    return "inactive"
  }

  const expiresAt = addon.balance_expires_at
  if (expiresAt) {
    const expiry = new Date(expiresAt.replace(" ", "T")).getTime()
    if (!Number.isNaN(expiry) && expiry - Date.now() <= HOURS_48_MS) {
      return "expiring"
    }
  }

  if (status.includes("active")) {
    return "active"
  }

  return "inactive"
}
