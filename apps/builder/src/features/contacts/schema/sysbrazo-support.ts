import { z } from "zod"

/**
 * Contrato del panel de soporte (#15466) contra los endpoints nuevos de
 * Sysbrazo (`/api/botmaker/client/{clientId}/autodiagnostics` y
 * `/api/botmaker/client/{clientId}/tickets`). Definido en el builder como
 * fuente del tipado del cliente oRPC; los endpoints de Sysbrazo se
 * implementan en el mismo ticket contra este contrato.
 *
 * Los campos son tolerantes (optional/nullable) donde el upstream puede
 * omitir o variar el tipo, y estrictos donde el contrato es fijo (estados,
 * orígenes), para degradar sin crashear.
 */

// ── Autodiagnósticos ──

export const sysbrazoDiagnosticStatusSchema = z.enum([
  "created",
  "running",
  "delayed",
  "finished",
  "failed",
  "canceled",
  "paused",
  "error",
])
export type SysbrazoDiagnosticStatus = z.infer<
  typeof sysbrazoDiagnosticStatusSchema
>

export const sysbrazoDiagnosticStepStatusSchema = z.enum([
  "pending",
  "running",
  "success",
  "failed",
  "canceled",
  "delayed",
  "paused",
  "warning",
  "error",
])
export type SysbrazoDiagnosticStepStatus = z.infer<
  typeof sysbrazoDiagnosticStepStatusSchema
>

/** `portal` | `whatsapp` | `sysbrazo` | `chatbotx` (nuevo origen, #15466). */
export const sysbrazoDiagnosticSourceSchema = z.enum([
  "portal",
  "whatsapp",
  "sysbrazo",
  "chatbotx",
])
export type SysbrazoDiagnosticSource = z.infer<
  typeof sysbrazoDiagnosticSourceSchema
>

const sysbrazoNullableString = z.string().nullable().optional()

/** Referencias que pueden llegar numéricas (Odoo) o string (Redmine). */
const sysbrazoReference = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()

export const sysbrazoDiagnosticStepSchema = z.object({
  step_number: z.number(),
  step_name: z.string(),
  status: sysbrazoDiagnosticStepStatusSchema,
  /**
   * Tolerante: Sysbrazo devuelve objeto, array o null según el paso
   * (p.ej. `[]` cuando no hay detalle). Un array no crashea el panel.
   */
  details: z
    .union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
    .nullable()
    .optional(),
  step_duration_seconds: z.number().nullable().optional(),
})
export type SysbrazoDiagnosticStep = z.infer<
  typeof sysbrazoDiagnosticStepSchema
>

export const sysbrazoDiagnosticSummarySchema = z.object({
  id: z.number(),
  status: sysbrazoDiagnosticStatusSchema,
  source: sysbrazoDiagnosticSourceSchema,
  /** Código o texto del motivo (CANCELADO/FALLIDO); null si no aplica. */
  reason: sysbrazoNullableString,
  /** Quien ejecutó (persona); null cuando no fue una persona. */
  user_name: sysbrazoNullableString,
  started_at: sysbrazoNullableString,
  finished_at: sysbrazoNullableString,
  total_duration_seconds: z.number().nullable().optional(),
  /** Pasos visibles ejecutados (sin `finalizing`). */
  executed_step_count: z.number().nullable().optional(),
  odoo_ticket_id: sysbrazoReference,
  redmine_issue_id: sysbrazoReference,
})
export type SysbrazoDiagnosticSummary = z.infer<
  typeof sysbrazoDiagnosticSummarySchema
>

export const sysbrazoAutodiagnosticsResponseSchema = z.object({
  items: z.array(sysbrazoDiagnosticSummarySchema),
  total: z.number(),
  page: z.number().nullable().optional(),
  per_page: z.number().nullable().optional(),
})
export type SysbrazoAutodiagnosticsResponse = z.infer<
  typeof sysbrazoAutodiagnosticsResponseSchema
>

export const sysbrazoDiagnosticDetailSchema =
  sysbrazoDiagnosticSummarySchema.extend({
    steps: z.array(sysbrazoDiagnosticStepSchema),
  })
export type SysbrazoDiagnosticDetail = z.infer<
  typeof sysbrazoDiagnosticDetailSchema
>

/** Respuesta de Sysbrazo al encolar o crear el ticket de un paso fallido. */
export const sysbrazoAutodiagnosticTicketResponseSchema = z.object({
  queued: z.boolean().optional(),
  reason: sysbrazoNullableString,
  odoo_ticket_id: sysbrazoReference,
  redmine_issue_id: sysbrazoReference,
  ticket_ref: sysbrazoReference,
  client_message: z
    .union([
      z.string(),
      z.object({
        title: sysbrazoNullableString,
        body: z.string(),
      }),
    ])
    .nullable()
    .optional(),
})
export type SysbrazoAutodiagnosticTicketResponse = z.infer<
  typeof sysbrazoAutodiagnosticTicketResponseSchema
>

export const sysbrazoAutodiagnosticTicketOutcomeSchema = z.object({
  state: z.enum(["created", "queued", "blocked", "error"]),
  client_message:
    sysbrazoAutodiagnosticTicketResponseSchema.shape.client_message,
})
export type SysbrazoAutodiagnosticTicketOutcome = z.infer<
  typeof sysbrazoAutodiagnosticTicketOutcomeSchema
>

/** Respuesta del POST de inicio (crea o devuelve la ejecución activa). */
export const sysbrazoStartDiagnosticResponseSchema = z.object({
  status: z.enum(["ok", "running", "error", "blocked"]),
  run_id: z.number().nullable().optional(),
  message: sysbrazoNullableString,
})
export type SysbrazoStartDiagnosticResponse = z.infer<
  typeof sysbrazoStartDiagnosticResponseSchema
>

// ── Tickets ──

export const sysbrazoTicketProviderSchema = z.enum(["odoo", "redmine"])
export type SysbrazoTicketProvider = z.infer<
  typeof sysbrazoTicketProviderSchema
>

export const sysbrazoTicketSchema = z.object({
  provider: sysbrazoTicketProviderSchema,
  /** Identidad calificada por proveedor, estable entre consultas. */
  id: z.string(),
  display_id: sysbrazoNullableString,
  /** URL para abrir el ticket en el sistema de origen. */
  url: sysbrazoNullableString,
  status: sysbrazoNullableString,
  is_open: z.boolean(),
  title: sysbrazoNullableString,
  team: sysbrazoNullableString,
  city: sysbrazoNullableString,
  opened_at: sysbrazoNullableString,
  updated_at: sysbrazoNullableString,
  is_massive: z.boolean(),
  affected_clients: z.number().nullable().optional(),
})
export type SysbrazoTicket = z.infer<typeof sysbrazoTicketSchema>

export const sysbrazoTicketsResponseSchema = z.object({
  items: z.array(sysbrazoTicketSchema),
  total: z.number().nullable().optional(),
  page: z.number().nullable().optional(),
  per_page: z.number().nullable().optional(),
  /**
   * Estado por proveedor: un proveedor caído no puede presentarse como
   * "sin tickets". `verified: false` con `error` distingue "No verificado".
   */
  providers: z
    .array(
      z.object({
        provider: sysbrazoTicketProviderSchema,
        verified: z.boolean(),
        error: sysbrazoNullableString,
      }),
    )
    .nullable()
    .optional(),
})
export type SysbrazoTicketsResponse = z.infer<
  typeof sysbrazoTicketsResponseSchema
>

// ── Resultados del builder (uniones con `found`) ──

export const sysbrazoAutodiagnosticsLookupSchema = z.discriminatedUnion(
  "found",
  [
    z.object({ found: z.literal(false) }),
    z.object({
      found: z.literal(true),
      items: z.array(sysbrazoDiagnosticSummarySchema),
      total: z.number(),
    }),
  ],
)
export type SysbrazoAutodiagnosticsLookup = z.infer<
  typeof sysbrazoAutodiagnosticsLookupSchema
>

export const sysbrazoTicketsLookupSchema = z.discriminatedUnion("found", [
  z.object({ found: z.literal(false) }),
  z.object({
    found: z.literal(true),
    items: z.array(sysbrazoTicketSchema),
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    /**
     * Estado por proveedor (para "No verificado" cuando ninguno respondió).
     */
    providers: z
      .array(
        z.object({
          provider: sysbrazoTicketProviderSchema,
          verified: z.boolean(),
          error: sysbrazoNullableString,
        }),
      )
      .optional(),
  }),
])
export type SysbrazoTicketsLookup = z.infer<typeof sysbrazoTicketsLookupSchema>
