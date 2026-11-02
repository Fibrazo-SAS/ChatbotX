import { getCurrentUserAndTargetWorkspace } from "@/lib/auth/utils"

/**
 * Autorización de ejecución de autodiagnósticos (#15466).
 *
 * Permiso operativo EXPLÍCITO por miembro/workspace: `runAutodiagnostic`.
 * No lo implica `superAdmin`, el rol owner ni la normalización por edición;
 * la ausencia de la clave (JSON legacy) se lee como denegado. El acceso al
 * contacto se valida aparte en el endpoint (`requireContactPermissionScope`).
 *
 * La resolución por roles/excepciones (administración central de accesos)
 * reemplaza este helper en el mismo ticket sin cambiar su contrato.
 */
export const canRunSysbrazoAutodiagnostic = async (
  workspaceId: string,
): Promise<boolean> => {
  const userAndWorkspace = await getCurrentUserAndTargetWorkspace(workspaceId)
  return (
    userAndWorkspace?.targetWorkspaceMember?.permissions?.runAutodiagnostic ===
    true
  )
}

export const canViewSysbrazoNotes = async (
  workspaceId: string,
): Promise<boolean> => {
  const userAndWorkspace = await getCurrentUserAndTargetWorkspace(workspaceId)
  return (
    userAndWorkspace?.targetWorkspaceMember?.permissions?.superAdmin === true ||
    userAndWorkspace?.targetWorkspaceMember?.permissions?.viewClientNotes ===
      true
  )
}

type SysbrazoMultimediaPermission =
  | "manageClientMultimedia"
  | "permanentlyDeleteClientMultimedia"
  | "viewClientMultimedia"
  | "viewDeletedClientMultimedia"

/**
 * Resolves the canonical workspace-member permission flags for #15468. The
 * contacts access scope is checked by the calling endpoint independently.
 */
export const canUseSysbrazoMultimedia = async (
  workspaceId: string,
  permission: SysbrazoMultimediaPermission,
): Promise<boolean> => {
  const userAndWorkspace = await getCurrentUserAndTargetWorkspace(workspaceId)
  const permissions = userAndWorkspace?.targetWorkspaceMember.permissions
  return permissions?.superAdmin === true || permissions?.[permission] === true
}
