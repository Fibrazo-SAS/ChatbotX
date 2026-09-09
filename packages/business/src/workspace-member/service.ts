import { and, type DatabaseClient, db, eq } from "@chatbotx.io/database/client"
import {
  type WorkspaceMemberPermissions,
  type WorkspaceMemberRole,
  workspaceMemberRoles,
} from "@chatbotx.io/database/partials"
import { workspaceMemberModel } from "@chatbotx.io/database/schema"
import type {
  UserModel,
  WorkspaceMemberModel,
  WorkspaceModel,
} from "@chatbotx.io/database/types"
import { withCache } from "@chatbotx.io/redis"
import { BaseService } from "../base.service"
import { logger } from "../logger"
import { workspaceUsageService } from "../workspace-usage/service"

type WorkspaceMemberWithWorkspace = WorkspaceMemberModel & {
  workspace: WorkspaceModel
}

export const workspaceMemberCacheTag = (userId: string) =>
  `users:${userId}:workspace-members`

export class WorkspaceMemberService extends BaseService {
  async create(props: {
    tx?: DatabaseClient
    data: typeof workspaceMemberModel.$inferInsert
  }): Promise<WorkspaceMemberModel> {
    const { tx = db, data } = props
    const [workspaceMember] = await tx
      .insert(workspaceMemberModel)
      .values(data)
      .returning()

    await workspaceUsageService
      .increment(data.workspaceId, "teamMembers")
      .catch((err) => {
        logger.warn(
          { err, workspaceId: data.workspaceId },
          "workspace usage team member increment failed",
        )
      })

    return workspaceMember
  }

  async delete(props: {
    id: string
    workspaceId: string
    tx?: DatabaseClient
  }): Promise<void> {
    const { id, workspaceId, tx = db } = props

    const member = await tx.query.workspaceMemberModel.findFirst({
      where: { id, workspaceId },
      with: { user: true },
    })

    await tx
      .delete(workspaceMemberModel)
      .where(
        and(
          eq(workspaceMemberModel.id, id),
          eq(workspaceMemberModel.workspaceId, workspaceId),
        ),
      )

    await workspaceUsageService
      .decrement(workspaceId, "teamMembers")
      .catch((err) => {
        logger.warn(
          { err, workspaceId },
          "workspace usage team member decrement failed",
        )
      })

    if (!props.tx && member) {
      await this.audit(
        "delete",
        `removed ${member.user.name ?? member.user.email} from workspace`,
      )
    }
  }

  async listByUserIdUncached(props: {
    tx?: DatabaseClient
    userId: string
  }): Promise<WorkspaceMemberWithWorkspace[]> {
    const { tx = db, userId } = props

    return await tx.query.workspaceMemberModel.findMany({
      where: {
        userId,
      },
      with: {
        workspace: true,
      },
    })
  }

  async listByUserId(props: {
    tx?: DatabaseClient
    userId: string
  }): Promise<WorkspaceMemberWithWorkspace[]> {
    const key = workspaceMemberCacheTag(props.userId)
    return await withCache(
      key,
      async () => await this.listByUserIdUncached(props),
      {
        tags: [workspaceMemberCacheTag(props.userId)],
      },
    )
  }

  async findOwnerUserIdByWorkspaceId(props: {
    tx?: DatabaseClient
    workspaceId: string
  }): Promise<string | undefined> {
    const { tx = db, workspaceId } = props
    const key = `workspaces:${workspaceId}:owner-user-id`

    return await withCache(
      key,
      async () => {
        const [row] = await tx
          .select({ userId: workspaceMemberModel.userId })
          .from(workspaceMemberModel)
          .where(
            and(
              eq(workspaceMemberModel.workspaceId, workspaceId),
              eq(workspaceMemberModel.role, workspaceMemberRoles.enum.owner),
            ),
          )
          .limit(1)

        return row?.userId
      },
      {
        tags: [
          `workspaces:${workspaceId}`,
          `workspaces:${workspaceId}:workspace-members`,
        ],
      },
    )
  }

  async findMembership(props: {
    tx?: DatabaseClient
    workspaceId: string
    userId: string
  }): Promise<WorkspaceMemberWithWorkspace | undefined> {
    const { tx = db, workspaceId, userId } = props
    return await tx.query.workspaceMemberModel.findFirst({
      where: { workspaceId, userId },
      with: { workspace: true },
    })
  }

  // Auth gate — membership must take effect immediately on revoke, so this
  // intentionally skips withCache (unlike the list methods above).
  async isMember(props: {
    tx?: DatabaseClient
    workspaceId: string
    userId: string
  }): Promise<boolean> {
    const { tx = db, workspaceId, userId } = props
    const [row] = await tx
      .select({ userId: workspaceMemberModel.userId })
      .from(workspaceMemberModel)
      .where(
        and(
          eq(workspaceMemberModel.workspaceId, workspaceId),
          eq(workspaceMemberModel.userId, userId),
        ),
      )
      .limit(1)
    return !!row
  }

  async listUserIdsByWorkspaceId(props: {
    tx?: DatabaseClient
    workspaceId: string
  }): Promise<string[]> {
    const { tx = db, workspaceId } = props
    const rows = await tx
      .select({ userId: workspaceMemberModel.userId })
      .from(workspaceMemberModel)
      .where(eq(workspaceMemberModel.workspaceId, workspaceId))

    return rows.map((row) => row.userId)
  }

  async listByWorkspaceId(props: {
    tx?: DatabaseClient
    workspaceId: string
  }): Promise<(WorkspaceMemberModel & { user: UserModel })[]> {
    const { tx = db, workspaceId } = props
    const key = `workspaces:${workspaceId}:workspace-members`

    return await withCache(
      key,
      async () =>
        await tx.query.workspaceMemberModel.findMany({
          where: { workspaceId },
          with: {
            user: true,
          },
          orderBy: { createdAt: "asc" },
        }),
      {
        tags: [
          `workspaces:${workspaceId}`,
          `workspaces:${workspaceId}:workspace-members`,
        ],
      },
    )
  }

  /**
   * Platform-admin path (/admin/users): adds a user to a workspace without the
   * invitation flow. Same usage accounting as `create`; also invalidates the
   * workspace-member and per-user membership caches (the normal invite flow
   * invalidates on acceptance — this path has no acceptance step).
   */
  async addMemberForPlatformAdmin(props: {
    workspaceId: string
    userId: string
    role: WorkspaceMemberRole
  }): Promise<WorkspaceMemberModel> {
    const existing = await this.findByWorkspaceIdAndUserId({
      workspaceId: props.workspaceId,
      userId: props.userId,
    })
    if (existing) {
      throw new Error("User is already a member of this workspace")
    }

    const member = await this.create({
      data: {
        workspaceId: props.workspaceId,
        userId: props.userId,
        role: props.role,
        // Agent default: no granular permissions granted — the platform admin
        // can tighten them later from the workspace members table.
        permissions: {
          superAdmin: false,
          analytics: false,
          flows: false,
          contacts: false,
          onlyAssignedContacts: false,
          emailAndPhone: false,
          broadcast: false,
          ecommerce: false,
        } satisfies WorkspaceMemberPermissions,
      },
    })

    await this.invalidateMemberCaches({
      workspaceId: props.workspaceId,
      userId: props.userId,
    })
    return member
  }

  /**
   * Platform-admin path (/admin/users): removes every membership of a user.
   * Reuses `delete` per row so teamMembers usage is decremented and the
   * removal is audited workspace by workspace.
   */
  async removeAllByUserId(userId: string): Promise<void> {
    const memberships = await this.listByUserIdUncached({ userId })
    for (const member of memberships) {
      await this.delete({ id: member.id, workspaceId: member.workspaceId })
    }
    await this.invalidateMemberCaches({
      workspaceIds: memberships.map((member) => member.workspaceId),
      userId,
    })
  }

  /**
   * Platform-admin path (/admin/users): changes a user's role in a workspace.
   * Guard: never demote the workspace's last owner (mirrors the rule in the
   * workspace-scoped updateWorkspaceMemberAction).
   */
  async updateMembershipForPlatformAdmin(props: {
    workspaceId: string
    userId: string
    role: WorkspaceMemberRole
    permissions?: WorkspaceMemberPermissions
  }): Promise<void> {
    const member = await this.findByWorkspaceIdAndUserId({
      workspaceId: props.workspaceId,
      userId: props.userId,
    })
    if (!member) {
      throw new Error("User is not a member of this workspace")
    }

    const roleChanged = member.role !== props.role
    const permissionsChanged =
      props.permissions !== undefined &&
      JSON.stringify(member.permissions) !== JSON.stringify(props.permissions)
    if (!(roleChanged || permissionsChanged)) {
      return
    }

    if (roleChanged && member.role === workspaceMemberRoles.enum.owner) {
      const owners = await this.countOwners(props.workspaceId)
      if (owners <= 1) {
        throw new Error("You cannot demote the last owner of the workspace")
      }
    }

    await db
      .update(workspaceMemberModel)
      .set({
        ...(roleChanged ? { role: props.role } : {}),
        ...(props.permissions !== undefined
          ? { permissions: props.permissions }
          : {}),
      })
      .where(eq(workspaceMemberModel.id, member.id))

    await this.invalidateMemberCaches({
      workspaceId: props.workspaceId,
      userId: props.userId,
    })
    await this.audit(
      "update",
      `updated membership of ${member.userId} in workspace (role: ${props.role})`,
    )
  }

  /**
   * Platform-admin path (/admin/users): removes a single membership. Guard:
   * never remove the workspace's last owner.
   */
  async removeMemberForPlatformAdmin(props: {
    workspaceId: string
    userId: string
  }): Promise<void> {
    const member = await this.findByWorkspaceIdAndUserId({
      workspaceId: props.workspaceId,
      userId: props.userId,
    })
    if (!member) {
      throw new Error("User is not a member of this workspace")
    }

    if (member.role === workspaceMemberRoles.enum.owner) {
      const owners = await this.countOwners(props.workspaceId)
      if (owners <= 1) {
        throw new Error("You cannot remove the last owner of the workspace")
      }
    }

    await this.delete({ id: member.id, workspaceId: props.workspaceId })
    await this.invalidateMemberCaches({
      workspaceId: props.workspaceId,
      userId: props.userId,
    })
  }

  private async countOwners(workspaceId: string): Promise<number> {
    const rows = await db
      .select({ role: workspaceMemberModel.role })
      .from(workspaceMemberModel)
      .where(
        and(
          eq(workspaceMemberModel.workspaceId, workspaceId),
          eq(workspaceMemberModel.role, workspaceMemberRoles.enum.owner),
        ),
      )
    return rows.length
  }

  async invalidateMemberCaches(props: {
    workspaceId?: string
    workspaceIds?: string[]
    userId?: string
  }): Promise<void> {
    const workspaceIds =
      props.workspaceIds ?? (props.workspaceId ? [props.workspaceId] : [])
    const tags: string[] = []
    for (const workspaceId of workspaceIds) {
      tags.push(
        `workspaces:${workspaceId}`,
        `workspaces:${workspaceId}:workspace-members`,
      )
    }
    if (props.userId) {
      tags.push(workspaceMemberCacheTag(props.userId))
    }
    if (tags.length > 0) {
      await this.invalidateCacheTags(tags)
    }
  }

  async findByWorkspaceIdAndUserId(input: {
    tx?: DatabaseClient
    workspaceId: string
    userId: string
  }): Promise<WorkspaceMemberModel | undefined> {
    const { tx = db, workspaceId, userId } = input

    return await tx.query.workspaceMemberModel.findFirst({
      where: {
        workspaceId,
        userId,
      },
    })
  }

  async findWithUserByWorkspaceIdAndUserId(input: {
    tx?: DatabaseClient
    workspaceId: string
    userId: string
  }): Promise<(WorkspaceMemberModel & { user: UserModel }) | undefined> {
    const { tx = db, workspaceId, userId } = input

    return await tx.query.workspaceMemberModel.findFirst({
      where: {
        workspaceId,
        userId,
      },
      with: {
        user: true,
      },
    })
  }
}

export const workspaceMemberService = new WorkspaceMemberService()
