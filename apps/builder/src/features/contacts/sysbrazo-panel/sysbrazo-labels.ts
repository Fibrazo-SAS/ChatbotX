/**
 * Mapeos de Sysbrazo para autodiagnósticos (#15466), porteados de
 * `resources/src/featured/client/Autodiagnostic/const.ts` del repo sysbrazo.
 *
 * Sysbrazo guarda nombres de paso y códigos de motivo en inglés (snake_case)
 * y los traduce en su frontend; acá se replica ese mismo mapeo para que el
 * panel de ChatbotX muestre exactamente lo mismo que el portal. Los textos
 * están en español fijo porque así es el contenido de Sysbrazo (mismo
 * criterio que el resto de datos que vienen de ese backend).
 */

export const STEP_LABELS: Record<string, string> = {
  initializing: "Inicializando diagnóstico",
  check_credit: "Validando estado de cuenta",
  get_cpe_status_info: "Verificando encendido del router (CPE)",
  get_cpe_gpon_power_Info: "Revisando niveles de señal de fibra óptica",
  ping_internet_cpe: "Comprobando Ping de internet",
  get_cpe_devices_quantity: "Comprobando dispositivos conectados",
  analyze_wifi_signal_quality: "Analizando calidad de red WiFi",
  finalizing: "Finalizando diagnóstico",
}

/** Motivos de bloqueo previos al arranque: no se ejecutó ningún paso. */
export const BLOCKED_REASONS_AUTO_DIAGNOSTIC = new Set([
  "BLOCKED_BY_RULES",
  "CLIENT_HAS_OPEN_INCIDENT",
  "CLIENT_AFFECTED_BY_KRILL_ALARM",
  "CPE_NOT_FOUND",
  "CLIENT_NOT_FOUND",
])

/** Motivos que Sysbrazo usa para encolar automáticamente un ticket. */
export const RAISE_TICKET_REASONS = new Set([
  "PING_NOT_COMPLETE",
  "PING_NO_SUCCESS",
  "CPE_STATE_NOT_UP",
  "CPE_LOSS_OF_SIGNAL",
  "CPE_OFFLINE",
  "CPE_GPON_POWER_LOW",
  "RECONFIG_FAILED",
  "REBOOT_FAILED",
  "REPROVISION_FAILED",
])

/**
 * Traducción de los códigos de reason que vienen del backend en inglés
 * (bloqueos, cancelaciones, pasos de control, crédito, CPE, GPON, ping,
 * dispositivos, WiFi y auto-repair).
 */
export const REASON_LABELS: Record<string, string> = {
  // Bloqueos
  CLIENT_NOT_FOUND: "Cliente no encontrado",
  CLIENT_HAS_OPEN_INCIDENT: "Cliente tiene un incidente abierto",
  CLIENT_AFFECTED_BY_KRILL_ALARM: "Cliente afectado por alarma Krill",
  CLIENT_STATUS_INACTIVE: "Cliente con servicio inactivo",
  CPE_NOT_FOUND: "CPE no encontrado",
  BLOCKED_BY_RULES: "Bloqueado por reglas del sistema",
  AUTO_DIAGNOSTIC_DISABLED: "Autodiagnóstico deshabilitado",

  // Cancelaciones / errores de sistema
  TIMEOUT_EXCEEDED: "Tiempo de espera agotado",
  DISPATCHER_EXCEPTION: "Error interno del sistema",
  AUTO_REPAIR_EXECUTOR_EXCEPTION: "Error interno en reparación automática",
  CANCELED_BY_USER: "Cancelado por el usuario",
  ADMIN_CANCEL_ALL: "Cancelado por administrador",

  // Steps de control
  INITIALIZATION_SUCCESS: "Inicialización exitosa",
  FINALIZATION_SUCCESS: "Finalización exitosa",
  UNKNOWN_STEP: "Paso no reconocido",

  // Crédito
  NO_INTERNET_BALANCE: "Sin saldo de internet",
  DAILY_CREDIT_LIMIT_REACHED: "Límite diario de crédito alcanzado",
  CREDIT_EXPIRED: "Crédito vencido",
  CREDIT_VALID: "Crédito vigente",

  // CPE Status
  CPE_STATE_UP: "CPE encendido",
  CPE_STATE_NOT_UP: "CPE apagado",
  CPE_STATE_NOT_UP_AUTO_REPAIR_PENDING: "CPE apagado (reparación pendiente)",
  CPE_LOSS_OF_SIGNAL: "Pérdida de señal (LOS)",
  CPE_OFFLINE: "CPE desconectado",
  CPE_DYINGGASP: "CPE sin autenticación (Dying Gasp)",
  KRILL_POST_FAILED: "Error al consultar estado del CPE",

  // Potencia GPON
  CPE_GPON_POWER_LOW: "Potencia GPON baja",
  CPE_GPON_POWER_LOW_AUTO_REPAIR_PENDING:
    "Potencia GPON baja (reparación pendiente)",
  DNXR_VALUE_NOT_FOUND: "No se pudo medir la potencia GPON",
  DNXR_VALUE_NOT_FOUND_AUTO_REPAIR_PENDING:
    "Sin medición GPON (reparación pendiente)",

  // Ping
  PING_OK: "Ping exitoso",
  PING_NO_SUCCESS: "Ping sin respuesta",
  PING_NOT_COMPLETE: "Ping no completado",
  PING_NOT_SUPPORTED_FOR_MODEL: "Modelo de CPE no soporta ping",
  RUN_IPPING_DIAGNOSTIC_FAILED: "Error al iniciar prueba de ping",
  GET_IP_PING_RESULT_FAILED: "Error al obtener resultado del ping",
  NO_IPPING_RESULT: "Sin resultado de ping",
  PING_NOT_NEW_OR_INVALID: "Resultado de ping no válido",
  BATCH_RETRY_DELAYED: "Reintentando prueba de ping…",
  PING_BATCH_RETRY_FAILED: "Ping falló después de reintentos",
  PING_BATCH_RETRY_FAILED_AUTO_REPAIR_PENDING:
    "Ping falló (reparación pendiente)",

  // Dispositivos
  CPE_TOO_MANY_DEVICES: "Demasiados dispositivos conectados",
  CPE_DEVICES_QUANTITY_OK: "Cantidad de dispositivos OK",

  // WiFi
  WIFI_LOW_SIGNAL_DETECTED: "Señal WiFi baja detectada",
  WIFI_SIGNAL_OK: "Señal WiFi OK",
  CLIENT_OR_CPE_NOT_FOUND: "Cliente o CPE no encontrado",

  // Auto-repair
  REBOOT_FAILED: "Reinicio del CPE fallido",
  REBOOT_SUCCESS: "Reinicio del CPE exitoso",
  RECONFIG_FAILED: "Reconfiguración del CPE fallida",
  RECONFIG_SUCCESS: "Reconfiguración del CPE exitosa",
  REPROVISION_FAILED: "Reprovisión del CPE fallida",
  AUTO_REPAIR_FAILED: "Reparación automática fallida",
  AUTO_REPAIR_SERVICE_GET_STATUS_INFO_FAILED:
    "Error al verificar estado post-reparación",
}

/**
 * Traducción de mensajes de paso que se guardan en inglés en la BD.
 */
const STEP_MESSAGE_TRANSLATIONS: Record<string, string> = {
  // Auto-repair
  "Initialization completed": "Inicialización de reparación completada",
  "Finalization complete": "Reparación automática finalizada",

  // Speedtest
  "Speedtest download started": "Prueba de descarga iniciada",
  "Speedtest download completed": "Prueba de descarga completada",
  "Speedtest upload started": "Prueba de subida iniciada",
  "Speedtest upload completed": "Prueba de subida completada",
}

/** Mensajes dinámicos de speedtest ("X is taking longer than expected"). */
const SPEEDTEST_TAKING_LONGER_RE =
  /^Speedtest (\w+) is taking longer than expected$/

export const translateStepMessage = (message: string): string => {
  const known = STEP_MESSAGE_TRANSLATIONS[message]
  if (known) {
    return known
  }

  // Mensajes dinámicos con tipo variable
  const takingLongerMatch = message.match(SPEEDTEST_TAKING_LONGER_RE)
  if (takingLongerMatch) {
    const typeLabels: Record<string, string> = {
      download: "descarga",
      upload: "subida",
    }
    const type = typeLabels[takingLongerMatch[1]] ?? takingLongerMatch[1]
    return `La prueba de ${type} está tomando más tiempo del esperado`
  }

  return message
}

/** `check_credit` → `Check Credit` (fallback cuando no hay etiqueta propia). */
export const formatStepName = (name: string): string =>
  name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export const getStepLabel = (name: string): string =>
  STEP_LABELS[name] ?? formatStepName(name)

/** Código de motivo → texto en español; fallback: título del código. */
export const getReasonLabel = (reason: string): string =>
  REASON_LABELS[reason] ?? formatStepName(reason)

/** `42` → `42s`; `330` → `5m 30s` (igual que Sysbrazo). */
export const formatElapsed = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`
  }
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/**
 * Resumen legible de los detalles de un paso (misma lógica que
 * `summarizeDetails` de Sysbrazo). Devuelve null cuando no hay nada
 * que valga la pena mostrar; tolera arrays/null (Sysbrazo varía el shape).
 */
export const summarizeStepDetails = (details: unknown): string | null => {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null
  }

  const record = details as Record<string, unknown>

  if (record.creditInfo) {
    const credit = record.creditInfo as {
      hasExpired?: boolean
      expirationDate?: string
    }
    const expired = credit.hasExpired ? "expirado" : "vigente"
    const date = credit.expirationDate ?? null
    return date ? `Crédito ${expired}: ${date}` : `Crédito ${expired}`
  }
  if (record.error) {
    return `Error: ${String(record.error)}`
  }
  if (record.message) {
    return translateStepMessage(String(record.message))
  }
  if (record.dnrx !== undefined) {
    return `dnrx: ${String(record.dnrx)} dBm`
  }
  if (record["Cpe state:"] ?? record.state) {
    const state = record["Cpe state:"] ?? record.state
    return `CPE: ${String(state)}`
  }
  if (record.ipping) {
    const ping = record.ipping as {
      success_count?: number
      SuccessCount?: number
      diagnostics_state?: string
      state?: string
    }
    const ok = ping.success_count ?? ping.SuccessCount ?? 0
    const state = ping.diagnostics_state ?? ping.state ?? null
    if (state === "Complete" && ok > 0) {
      return `Ping exitoso (${ok} éxitos)`
    }
    if (state === "Complete") {
      return "Ping fallido (0 éxitos)"
    }
    return `Ping: ${state ?? "En proceso"}`
  }
  if (record.model) {
    return `Modelo: ${String(record.model)}`
  }
  if (typeof record.reason === "string") {
    return REASON_LABELS[record.reason] ?? record.reason
  }

  return null
}
