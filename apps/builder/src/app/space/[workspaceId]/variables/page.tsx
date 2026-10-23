import { rootFolderId } from "@chatbotx.io/database/partials"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { AccountFieldsCard } from "@/features/bot-fields/account-fields-card"
import {
  ACCOUNT_FIELDS_HARD_CAP,
  listBotFieldsRSC,
} from "@/features/bot-fields/queries"
import { requireWorkspacePermission } from "@/lib/auth/require-workspace-permission"

/**
 * Variables Globales (#15466): los campos del bot (BotField) son variables
 * del workspace, no del contacto — viven acá, en su propio ítem del
 * sidebar, y no dentro de /custom-fields. Solo entran miembros con el
 * permiso explícito `viewBotFields` (el sidebar aplica el mismo gate).
 * Viven en la carpeta raíz: son globales, sin carpetas.
 */
export default async function VariablesPage(props: {
  params: Promise<{ workspaceId: string }>
}) {
  const workspaceId = getIdFromParams(await props.params, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }

  await requireWorkspacePermission(workspaceId, "viewBotFields")

  const botFieldsPromises = Promise.all([
    listBotFieldsRSC({
      workspaceId,
      folderId: rootFolderId,
      page: 1,
      perPage: ACCOUNT_FIELDS_HARD_CAP,
    }),
  ])

  return (
    <Suspense>
      <AccountFieldsCard
        folderId={rootFolderId}
        promises={botFieldsPromises}
        workspaceId={workspaceId}
      />
    </Suspense>
  )
}
