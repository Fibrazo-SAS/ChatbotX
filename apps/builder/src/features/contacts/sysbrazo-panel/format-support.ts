/**
 * Formatos del bloque Autodiagnóstico y Tickets (#15466):
 * `YYYY/MM/DD HH:mm:ss` (autodiagnóstico) y `YYYY/MM/DD HH:mm` (tickets),
 * más antigüedad relativa ("Actualizado hace N min") y duración en segundos.
 */

const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/

/** `2026-10-08T10:54:22Z` / `2026-10-08 10:54:22` → `2026/10/08 10:54:22`. */
export const formatDiagnosticDate = (
  value: string | null | undefined,
): string => {
  const match = value?.trim() ? ISO_DATETIME_RE.exec(value.trim()) : null
  if (!match) {
    return value ?? ""
  }
  const [, year, month, day, hours, minutes, seconds] = match
  const time = hours ? `${hours}:${minutes ?? "00"}:${seconds ?? "00"}` : ""
  return `${year}/${month}/${day}${time ? ` ${time}` : ""}`
}

/** `2026-10-05T09:10:00Z` → `2026/10/05 09:10` (fechas de tickets). */
export const formatTicketDate = (value: string | null | undefined): string => {
  const match = value?.trim() ? ISO_DATETIME_RE.exec(value.trim()) : null
  if (!match) {
    return value ?? ""
  }
  const [, year, month, day, hours, minutes] = match
  const time = hours ? ` ${hours}:${minutes ?? "00"}` : ""
  return `${year}/${month}/${day}${time}`
}

/** Minutos completos desde una fecha ISO; null si no es válida. */
export const minutesSince = (
  value: string | null | undefined,
): number | null => {
  const parsed = value ? new Date(value.replace(" ", "T")) : null
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null
  }
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60_000))
}

/** `42` → `"42s"` (duración real de la ejecución/paso). */
export const formatDurationSeconds = (
  seconds: number | null | undefined,
): string | null => (seconds == null ? null : `${seconds}s`)

/**
 * Ventana tras la cual un run que sigue en "created" se considera sin
 * procesar por el worker de Sysbrazo (encolado y nadie lo consume). Los
 * clientes dejan de hacer polling y avisan al usuario.
 */
export const STALE_CREATED_RUN_MS = 2 * 60_000

export const isStaleCreatedRun = ({
  status,
  started_at,
}: {
  status: string
  started_at?: string | null
}): boolean => {
  if (status !== "created" || !started_at) {
    return false
  }
  const parsed = new Date(started_at.replace(" ", "T"))
  if (Number.isNaN(parsed.getTime())) {
    return false
  }
  return Date.now() - parsed.getTime() > STALE_CREATED_RUN_MS
}
