import { rootFolderId } from "@chatbotx.io/database/partials"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import type { SearchParams } from "nuqs/server"
import { Suspense } from "react"
import { FlowsTable } from "@/features/flows/flows-table"
import { listFlowsRSC } from "@/features/flows/queries"
import { listFlowsSearchParams } from "@/features/flows/schema/query"
import { canToggleFlowStatus } from "@/lib/auth/flow-status-permissions"
import { requireWorkspacePermission } from "@/lib/auth/require-workspace-permission"
import { getCurrentUserAndTargetWorkspace } from "@/lib/auth/utils"

export default async function FlowsPage(props: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<SearchParams>
}) {
  const workspaceId = getIdFromParams(await props.params, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }
  await requireWorkspacePermission(workspaceId, "flows")
  const searchParams = await props.searchParams

  // Ticket 15139: only owners / superAdmins may toggle a flow's active
  // status. Membership resolution is React-cached, so this reuses the rows
  // `requireWorkspacePermission` already loaded. Fail closed on a missing
  // membership.
  const userAndWorkspace = await getCurrentUserAndTargetWorkspace(workspaceId)
  const canToggleStatus = userAndWorkspace
    ? canToggleFlowStatus({
        role: userAndWorkspace.targetWorkspaceMember.role,
        permissions: userAndWorkspace.targetWorkspaceMember.permissions,
        user: userAndWorkspace.user,
      })
    : false

  const search = await listFlowsSearchParams.parse(searchParams)
  const folderId = search.folderId ?? rootFolderId

  const promises = Promise.all([
    listFlowsRSC({
      ...search,
      folderId,
      workspaceId,
    }),
  ])

  return (
    <Suspense>
      <FlowsTable
        canToggleFlowStatus={canToggleStatus}
        folderId={folderId}
        promises={promises}
        workspaceId={workspaceId}
      />
    </Suspense>
  )
}
