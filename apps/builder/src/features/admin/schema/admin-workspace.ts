import { workspaceMemberRoles } from "@chatbotx.io/database/partials"
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
} from "nuqs/server"
import { z } from "zod"

export const getAdminWorkspacesSearchParamsCache = createSearchParamsCache({
  page: parseAsInteger,
  perPage: parseAsInteger,
  keyword: parseAsString,
})

export const listAdminWorkspacesRequest = z.object({
  page: z.number().int().positive().nullish(),
  perPage: z.number().int().positive().nullish(),
  keyword: z.string().nullish().default(null),
})
export type ListAdminWorkspacesRequest = z.infer<
  typeof listAdminWorkspacesRequest
>

const adminWorkspaceOwnerResource = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string(),
})

const adminWorkspaceMemberResource = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string(),
  role: workspaceMemberRoles,
})

export const adminWorkspaceResource = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
  tenantId: z.string(),
  isActive: z.boolean(),
  scheduledDeletionAt: z.date().nullish(),
  owners: z.array(adminWorkspaceOwnerResource),
  members: z.array(adminWorkspaceMemberResource),
  ownerCount: z.number(),
  memberCount: z.number(),
})
export type AdminWorkspaceResource = z.infer<typeof adminWorkspaceResource>

export const listAdminWorkspacesResponse = z.object({
  data: z.array(adminWorkspaceResource),
  pageCount: z.number(),
})
export type ListAdminWorkspacesResponse = z.infer<
  typeof listAdminWorkspacesResponse
>

export const createAdminWorkspaceRequest = z.object({
  name: z.string().trim().min(1).max(120),
  // Optional: when set, this user becomes the workspace owner (role owner).
  // Otherwise the creating platform admin becomes the owner.
  ownerId: z.string().nullish(),
})
export type CreateAdminWorkspaceRequest = z.infer<
  typeof createAdminWorkspaceRequest
>

// ── Row actions (ticket 15136): status toggle + soft delete ──

export const updateAdminWorkspaceStatusRequest = z.object({
  workspaceId: z.string().min(1),
  isActive: z.boolean(),
})
export type UpdateAdminWorkspaceStatusRequest = z.infer<
  typeof updateAdminWorkspaceStatusRequest
>

export const scheduleAdminWorkspaceDeletionRequest = z.object({
  workspaceId: z.string().min(1),
})
export type ScheduleAdminWorkspaceDeletionRequest = z.infer<
  typeof scheduleAdminWorkspaceDeletionRequest
>

export const cancelAdminWorkspaceDeletionRequest = z.object({
  workspaceId: z.string().min(1),
})
export type CancelAdminWorkspaceDeletionRequest = z.infer<
  typeof cancelAdminWorkspaceDeletionRequest
>
