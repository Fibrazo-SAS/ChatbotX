import { ChatbotXException } from "@chatbotx.io/business/errors"
import type { WorkspaceMemberPermissions } from "@chatbotx.io/database/partials"
import { hasWorkspacePermission } from "@/lib/auth/permission-routes"
import { getCurrentUserAndTargetWorkspace } from "@/lib/auth/utils"

/**
 * Permisos de Variables Globales (#15466): `viewBotFields` (ver la sección
 * y el historial) y `manageBotFields` (crear/editar/borrar/restablecer).
 * Explícitos por miembro: no los implica superAdmin ni el rol, y la
 * ausencia de la clave (JSON legacy) se lee como denegado.
 */

export const VIEW_BOT_FIELDS_KEY = "viewBotFields"
export const MANAGE_BOT_FIELDS_KEY = "manageBotFields"

/** Falla cerrado para acciones server (create/update/delete/reset). */
export const assertCanManageBotFields = (
  permissions: WorkspaceMemberPermissions,
): void => {
  if (!hasWorkspacePermission(permissions, MANAGE_BOT_FIELDS_KEY)) {
    throw new ChatbotXException(
      "You do not have permission to manage global variables",
      "manageBotFieldsDenied",
    )
  }
}

/** Verdadero solo con el permiso explícito `viewBotFields`. */
export const canViewBotFields = async (
  workspaceId: string,
): Promise<boolean> => {
  const userAndWorkspace = await getCurrentUserAndTargetWorkspace(workspaceId)
  return (
    userAndWorkspace?.targetWorkspaceMember?.permissions?.viewBotFields === true
  )
}

/** Verdadero solo con el permiso explícito `manageBotFields`. */
export const canManageBotFields = async (
  workspaceId: string,
): Promise<boolean> => {
  const userAndWorkspace = await getCurrentUserAndTargetWorkspace(workspaceId)
  return (
    userAndWorkspace?.targetWorkspaceMember?.permissions?.manageBotFields ===
    true
  )
}
