import { z } from "zod"

/**
 * String tolerante de Sysbrazo: algunos campos vienen a veces como número en
 * el JSON (p.ej. teléfonos guardados numéricos en la base) — se normalizan a
 * string para que el contrato no falle y la UI degrade sin crashear.
 */
const sysbrazoString = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z.string().nullable().optional(),
)

/**
 * Contrato REAL del endpoint ampliado de Sysbrazo
 * `GET /api/botmaker/client/by-document` (payload `ClientController`: datos de
 * `getPortalClientData` + `getInternetBalanceInfo` + `tvBoxes` +
 * `getStatusForClient`). Ajustado contra el código de Sysbrazo, no un
 * contrato imaginado; todos los campos son tolerantes (optional/nullable)
 * para que la UI degrade sin crashear si el upstream cambia.
 */

export const sysbrazoContactValidationSchema = z.object({
  // "validated" | "pending" | null (sin validación registrada)
  status: z.enum(["validated", "pending"]).nullable(),
  pending_value: z.record(z.string(), z.unknown()).nullable().optional(),
  current_value: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const sysbrazoContactValidationsSchema = z.object({
  phone_number: sysbrazoContactValidationSchema,
  phone_number_alt: sysbrazoContactValidationSchema,
  email: sysbrazoContactValidationSchema,
})

export const sysbrazoTvBoxSchema = z.object({
  id: z.union([z.number(), z.string()]).nullable().optional(),
  model: sysbrazoString, // e.g. "ZTE" / "Fiber Home"
  serial_number: sysbrazoString,
  mac_address: sysbrazoString,
  status: sysbrazoString, // active | suspended | error
})

export const sysbrazoTimeRemainingDisplaySchema = z.object({
  value: z.number(),
  unit: z.string(),
})

/** Potencia ONU/CPE reportada por Krill con su estado según umbrales. */
export const sysbrazoOnuPowerSchema = z.object({
  value: sysbrazoString, // p.ej. "-24.55 dBm"
  status: z.enum(["ok", "warning", "critical"]).nullable().optional(),
})

/**
 * Snapshot técnico de la ONU/CPE (`ClientOnuStatusService` de Sysbrazo,
 * estado Krill). Null cuando el cliente no tiene CPE provisionada.
 */
export const sysbrazoOnuStatusSchema = z.object({
  state: sysbrazoString, // "up" | "down" | "los" | null
  lastDownTime: sysbrazoString,
  // Estados de registro Krill mostrados como tags cuando la ONU está caída.
  registrationStates: z.array(z.string()).nullable().optional(),
  rxPower: sysbrazoOnuPowerSchema.nullable().optional(),
  txPower: sysbrazoOnuPowerSchema.nullable().optional(),
  upstreamPower: sysbrazoOnuPowerSchema.nullable().optional(),
  uptime: sysbrazoString, // ya formateado ("3d 4h 12m")
  olt: sysbrazoString,
  board: z.union([z.number(), z.string()]).nullable().optional(),
  port: z.union([z.number(), z.string()]).nullable().optional(),
  connectedDevices: z.number().nullable().optional(),
})

/**
 * Suscripción add-on del cliente (`ClientAddonSubscription` de Sysbrazo):
 * estado y saldo propios, p.ej. "Fibrazo TV (addon) Premium".
 */
export const sysbrazoAddonSchema = z.object({
  id: z.union([z.number(), z.string()]).nullable().optional(),
  name: sysbrazoString,
  status: sysbrazoString, // p.ej. "ACTIVE" | "SUSPENDED"
  balance_days: z.number().nullable().optional(),
  balance_expires_at: sysbrazoString,
  suspended_at: sysbrazoString,
  activated_at: sysbrazoString,
})

/**
 * Balance de Internet — claves camelCase reales de
 * `Client::getInternetBalanceInfo()`.
 */
export const sysbrazoBalanceSchema = z.object({
  statusName: sysbrazoString,
  daysSuspended: z.number().nullable().optional(),
  valueRemaining: z.number().nullable().optional(),
  // Formato de Sysbrazo: "d-m-y H:i:s" (e.g. "08-09-24 18:00:00")
  dateToExpire: sysbrazoString,
  timeRemainingLabel: sysbrazoString,
  timeRemainingDisplay: sysbrazoTimeRemainingDisplaySchema
    .nullable()
    .optional(),
})

export const sysbrazoClientSchema = z.object({
  id: z.union([z.number(), z.string()]),
  full_name: sysbrazoString,
  first_name: sysbrazoString,
  last_name: sysbrazoString,
  email: sysbrazoString,
  document_id: z.union([z.number(), z.string()]).nullable().optional(),
  document_type_id: z.number().nullable().optional(),
  // Descripción completa del tipo ("Cédula de ciudadanía"); el short-code
  // ("CC") se resuelve en el panel con el mismo mapeo de Sysbrazo.
  document_type: sysbrazoString,
  city: sysbrazoString,
  // El payload expone el teléfono principal como `primary_phone` (no
  // `phone_number`) y no incluye su prefijo.
  primary_phone: sysbrazoString,
  primary_phone_validated: z.boolean().nullable().optional(),
  alt_phone: sysbrazoString,
  alt_phone_prefix: sysbrazoString,
  contact_validations: sysbrazoContactValidationsSchema.nullable().optional(),
  // statusGaiia->name, p.ej. "ACTIVE" | "SUSPENDED" | "INACTIVE"
  internet_status: sysbrazoString,
  internet_plan: sysbrazoString,
  tv_plan: sysbrazoString,
  is_bundle: z.boolean().nullable().optional(),
  balance: sysbrazoBalanceSchema.nullable().optional(),
  tv_boxes: z.array(sysbrazoTvBoxSchema).nullable().optional(),
  // El estado de la ONU ya no viaja en este payload: se consulta aparte por
  // el endpoint Krill dedicado (`getSysbrazoOnuAuthenticatedAPI`).
  // status->status de Sysbrazo, p.ej. "A desinstalar" | "A designar cuadrilla"
  installation_status: sysbrazoString,
  addon_subscriptions: z.array(sysbrazoAddonSchema).nullable().optional(),
})

export type SysbrazoClient = z.infer<typeof sysbrazoClientSchema>
export type SysbrazoContactValidations = z.infer<
  typeof sysbrazoContactValidationsSchema
>
export type SysbrazoTvBox = z.infer<typeof sysbrazoTvBoxSchema>
export type SysbrazoBalance = z.infer<typeof sysbrazoBalanceSchema>
export type SysbrazoOnuPower = z.infer<typeof sysbrazoOnuPowerSchema>
export type SysbrazoOnuStatus = z.infer<typeof sysbrazoOnuStatusSchema>
export type SysbrazoAddon = z.infer<typeof sysbrazoAddonSchema>

// Endpoint responde `{ data: [ { ...client } ] }` (array de un elemento).
export const sysbrazoClientListResponseSchema = z.object({
  data: z.array(sysbrazoClientSchema),
})

/**
 * Resultado del lookup, expuesto por el endpoint del builder. Un 404/error de
 * Sysbrazo o la ausencia de `document_id` se normalizan a `found: false`.
 */
export const sysbrazoLookupResponseSchema = z.discriminatedUnion("found", [
  z.object({
    found: z.literal(true),
    client: sysbrazoClientSchema,
    baseUrl: z.string().url().optional(),
  }),
  z.object({ found: z.literal(false) }),
])
export type SysbrazoLookupResponse = z.infer<
  typeof sysbrazoLookupResponseSchema
>

export const sysbrazoConversationLookupResponseSchema = z.union([
  z.object({
    contextStatus: z.literal("active"),
    expiresAt: z.date(),
    lookup: sysbrazoLookupResponseSchema,
  }),
  z.object({ contextStatus: z.literal("expired") }),
  z.object({ contextStatus: z.literal("missing") }),
])
export type SysbrazoConversationLookupResponse = z.infer<
  typeof sysbrazoConversationLookupResponseSchema
>
