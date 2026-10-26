/**
 * Lookup del panel contra Sysbrazo (repo `sysbrazo`).
 *
 * La URL base se resuelve por workspace desde la variable global `URL_DEV`
 * (ver `get-sysbrazo-client.query.ts`), con un fallback fijo de plataforma.
 *
 * Las credenciales NO viven aquí: la cabecera de Authorization (y la URL real
 * del endpoint) se leen del nodo `callApi` del flujo del workspace, que es la
 * fuente única — si se cambia el nodo, el panel lo sigue automáticamente.
 */

/** URL base por defecto si el workspace no define la variable global `URL_DEV`. */
export const SYSBRAZO_BOT_BASE_URL_FALLBACK =
  "https://dev-sysbrazo.fibrazo.com.co"

/** Path fijo del endpoint del bot en Sysbrazo. */
export const SYSBRAZO_BOT_PATH = "/api/botmaker/client/by-document"

/**
 * Endpoint dedicado del snapshot ONU/CPE (el mismo que consume el
 * `CpeTechnicalStatus` de Sysbrazo): `/api/krill/cpe-onu-status/{clientId}`.
 * El panel lo consulta aparte del payload del cliente.
 */
export const SYSBRAZO_ONU_PATH = "/api/krill/cpe-onu-status"

/** Nombre del custom field del contacto que guarda el documento. */
export const SYSBRAZO_DOCUMENT_FIELD_NAME = "document_id"

/**
 * Regla de Sysbrazo (`getClientByDocumentId`): dígitos 5–20 o pasaporte
 * alfanumérico 6–12. Se replica aquí para validar antes de consultar.
 */
const NUMERIC_DOCUMENT_RE = /^\d{5,20}$/
const PASSPORT_DOCUMENT_RE = /^[A-Za-z0-9]{6,12}$/
const DOCUMENT_SEPARATORS_RE = /[\s.]/g
const TRAILING_SLASH_RE = /\/$/

export const isNumericDocument = (value: string): boolean =>
  value !== "" && NUMERIC_DOCUMENT_RE.test(value)

export const isPassportLikeDocument = (value: string): boolean =>
  PASSPORT_DOCUMENT_RE.test(value)

/**
 * Normaliza el documento antes del lookup: quita espacios y puntos de miles
 * (el chip muestra `1.045.123.456`, Sysbrazo espera `1045123456`) y pasa el
 * pasaporte a mayúsculas. Devuelve `null` si no cumple la regla.
 */
export const normalizeDocumentId = (raw: string): string | null => {
  const cleaned = raw.replace(DOCUMENT_SEPARATORS_RE, "")
  if (isNumericDocument(cleaned)) {
    return cleaned
  }
  if (isPassportLikeDocument(cleaned)) {
    return cleaned.toUpperCase()
  }
  return null
}

/** URL del botón "Ir Sysbrazo" (ticket #15467). */
export const sysbrazoInstallationUrl = (
  baseUrl: string,
  clientId: string,
): string =>
  `${baseUrl.replace(TRAILING_SLASH_RE, "")}/clients/${clientId}/installation/${clientId}`
