"use server"

import { isPlatformSuperAdmin, isSuperAdmin } from "@chatbotx.io/business"
import { db, ilike, or } from "@chatbotx.io/database/client"
import { userModel } from "@chatbotx.io/database/schema"
import {
  getPaginationWithDefaults,
  likeContains,
} from "@chatbotx.io/database/utils"
import type {
  ListPlatformUsersRequest,
  ListPlatformUsersResponse,
} from "../schema/platform-user"

/**
 * Platform-level user directory for the super-admin console (`/admin/users`).
 *
 * Lists every registered user with their workspace memberships (role +
 * permissions + workspace name). Read-only. Gated upstream by
 * `admin/layout.tsx` (`isSuperAdmin`), never by the enterprise license.
 */
export async function listPlatformUsers(
  input: ListPlatformUsersRequest,
): Promise<ListPlatformUsersResponse> {
  const pagination = getPaginationWithDefaults(input)

  const keyword = input.keyword?.trim()
  const where = keyword
    ? {
        OR: [
          { email: { ilike: likeContains(keyword) } },
          { name: { ilike: likeContains(keyword) } },
        ],
      }
    : undefined

  const countWhere = keyword
    ? or(
        ilike(userModel.email, likeContains(keyword)),
        ilike(userModel.name, likeContains(keyword)),
      )
    : undefined

  const [data, totalRows] = await Promise.all([
    db.query.userModel.findMany({
      ...pagination,
      where,
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        deactivatedAt: true,
        isPlatformSuperAdmin: true,
        tenantId: true,
      },
      with: {
        workspaceMembers: {
          columns: {
            id: true,
            workspaceId: true,
            role: true,
            permissions: true,
          },
          with: {
            workspace: {
              columns: { id: true, name: true },
            },
          },
        },
      },
    }),
    db.$count(userModel, countWhere),
  ])

  const pageCount = Math.ceil(totalRows / pagination.limit)

  return {
    data: data.map((user) => ({
      ...user,
      isPlatformSuperAdmin: isPlatformSuperAdmin(user),
      isEnvSuperAdmin: isSuperAdmin(user),
    })),
    pageCount,
  }
}
