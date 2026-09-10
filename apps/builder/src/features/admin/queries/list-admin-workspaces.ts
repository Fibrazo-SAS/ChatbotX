"use server"

import { db, ilike } from "@chatbotx.io/database/client"
import { workspaceModel } from "@chatbotx.io/database/schema"
import {
  getPaginationWithDefaults,
  likeContains,
} from "@chatbotx.io/database/utils"
import type {
  ListAdminWorkspacesRequest,
  ListAdminWorkspacesResponse,
} from "../schema/admin-workspace"

/**
 * Platform-level workspace directory for the super-admin console
 * (`/admin/workspaces`). Every workspace across every tenant, with its
 * owner(s) and member count — the list the platform admin uses to decide
 * where to assign users.
 */
export async function listAdminWorkspaces(
  input: ListAdminWorkspacesRequest,
): Promise<ListAdminWorkspacesResponse> {
  const pagination = getPaginationWithDefaults(input)
  const keyword = input.keyword?.trim()

  const where = keyword ? { name: { ilike: likeContains(keyword) } } : undefined
  const countWhere = keyword
    ? ilike(workspaceModel.name, likeContains(keyword))
    : undefined

  const [data, totalRows] = await Promise.all([
    db.query.workspaceModel.findMany({
      ...pagination,
      where,
      columns: {
        id: true,
        name: true,
        createdAt: true,
        tenantId: true,
      },
      with: {
        workspaceMembers: {
          columns: { role: true, userId: true },
          with: {
            user: {
              columns: { id: true, name: true, email: true },
            },
          },
        },
      },
    }),
    db.$count(workspaceModel, countWhere),
  ])

  const pageCount = Math.ceil(totalRows / pagination.limit)

  return {
    data: data.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
      tenantId: workspace.tenantId,
      owners: workspace.workspaceMembers
        .filter((member) => member.role === "owner")
        .map((member) => ({
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
        })),
      memberCount: workspace.workspaceMembers.length,
    })),
    pageCount,
  }
}
