import { workspaceMemberRoles } from "@chatbotx.io/database/partials"
import { z } from "zod"

export const inviteWorkspaceMemberRequest = z.object({
  permissions: z
    .object({
      superAdmin: z.boolean(),
      analytics: z.boolean(),
      flows: z.boolean(),
      contacts: z.boolean(),
      onlyAssignedContacts: z.boolean(),
      emailAndPhone: z.boolean(),
      broadcast: z.boolean(),
      ecommerce: z.boolean(),
      viewClientNotes: z.boolean().optional(),
      viewClientMultimedia: z.boolean().optional(),
      manageClientMultimedia: z.boolean().optional(),
      viewDeletedClientMultimedia: z.boolean().optional(),
      permanentlyDeleteClientMultimedia: z.boolean().optional(),
    })
    .refine((val) => Object.values(val).some(Boolean), {
      message: "At least one permission must be selected.",
      path: ["permissions"],
    }),
})
export type InviteWorkspaceMemberRequest = z.infer<
  typeof inviteWorkspaceMemberRequest
>

export const updateWorkspaceMemberRequest = inviteWorkspaceMemberRequest.extend(
  {
    role: workspaceMemberRoles,
    permissions: inviteWorkspaceMemberRequest.shape.permissions.extend({
      // Permiso operativo del panel Sysbrazo (#15466): lo gestiona el admin
      // del workspace desde el formulario de miembros (explícito, no lo
      // implica superAdmin). Opcional para no romper payloads viejos.
      runAutodiagnostic: z.boolean().optional(),
      // Variables globales (#15466): ver y gestionar, explícitos.
      viewBotFields: z.boolean().optional(),
      manageBotFields: z.boolean().optional(),
    }),
    notificationTypes: z.object({
      notifyAdmin: z.boolean(),
      newMessageToHuman: z.boolean(),
      newOrder: z.boolean(),
    }),
    notificationChannels: z.object({
      messenger: z.boolean(),
      email: z.boolean(),
      telegram: z.boolean(),
      browser: z.boolean(),
    }),
  },
)
export type UpdateWorkspaceMemberRequest = z.infer<
  typeof updateWorkspaceMemberRequest
>
