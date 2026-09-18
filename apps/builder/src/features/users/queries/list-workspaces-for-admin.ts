"use server"

import { db } from "@chatbotx.io/database/client"
import { likeContains } from "@chatbotx.io/database/utils"
import type {
  ListWorkspacesForAdminRequest,
  ListWorkspacesForAdminResponse,
} from "../schema/platform-user"

/**
 * Platform-level workspace list for the super-admin console dialogs
 * (`/admin/users` — "add to workspace" pickers). Id + name only, capped so
 * the client combobox stays light; use `keyword` to search by name.
 */
export async function listWorkspacesForAdmin(
  input: ListWorkspacesForAdminRequest,
): Promise<ListWorkspacesForAdminResponse> {
  const keyword = input.keyword?.trim()

  const data = await db.query.workspaceModel.findMany({
    columns: { id: true, name: true },
    where: keyword ? { name: { ilike: likeContains(keyword) } } : undefined,
    orderBy: { createdAt: "desc" },
    limit: 100,
  })

  return { data }
}
