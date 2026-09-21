import {
  workspaceMemberPermissionsSchema,
  workspaceMemberRoles,
} from "@chatbotx.io/database/partials"
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
} from "nuqs/server"
import { z } from "zod"

/**
 * Search-params cache for `/admin/users` — mirrors the pattern of
 * `getWorkspaceMembersSearchParamsCache` (page / perPage / keyword).
 */
export const getPlatformUsersSearchParamsCache = createSearchParamsCache({
  page: parseAsInteger,
  perPage: parseAsInteger,
  keyword: parseAsString,
})

export const listPlatformUsersRequest = z.object({
  page: z.number().int().positive().nullish(),
  perPage: z.number().int().positive().nullish(),
  keyword: z.string().nullish().default(null),
})
export type ListPlatformUsersRequest = z.infer<typeof listPlatformUsersRequest>

const platformUserWorkspaceResource = z.object({
  id: z.string(),
  name: z.string(),
})

const platformUserWorkspaceMemberResource = z.object({
  id: z.string(),
  workspaceId: z.string(),
  role: workspaceMemberRoles,
  permissions: workspaceMemberPermissionsSchema,
  workspace: platformUserWorkspaceResource,
})

export const platformUserResource = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string(),
  image: z.string().nullish(),
  createdAt: z.date(),
  deactivatedAt: z.date().nullish(),
  tenantId: z.string(),
  isPlatformSuperAdmin: z.boolean(),
  // The PLATFORM_ADMIN_EMAIL anchor: its super admin comes from the env, can
  // never be revoked nor deactivated — the UI hides grant/revoke for it.
  isEnvSuperAdmin: z.boolean(),
  workspaceMembers: z.array(platformUserWorkspaceMemberResource),
})
export type PlatformUserResource = z.infer<typeof platformUserResource>

export const listPlatformUsersResponse = z.object({
  data: z.array(platformUserResource),
  pageCount: z.number(),
})
export type ListPlatformUsersResponse = z.infer<
  typeof listPlatformUsersResponse
>

export const createPlatformUserRequest = z.object({
  email: z.email(),
  name: z.string().trim().max(120).nullish(),
  // Optional immediate membership: when set, the platform admin action adds
  // the freshly-created user to the workspace with the given role.
  workspaceId: z.string().nullish(),
  role: workspaceMemberRoles.optional().default("agent"),
})
export type CreatePlatformUserRequest = z.infer<
  typeof createPlatformUserRequest
>

export const createPlatformUserResponse = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullish(),
})
export type CreatePlatformUserResponse = z.infer<
  typeof createPlatformUserResponse
>

// ── Add an EXISTING user to a workspace (row action) ──
export const addUserToWorkspaceRequest = z.object({
  userId: z.string(),
  workspaceId: z.string().min(1),
  role: workspaceMemberRoles.optional().default("agent"),
})
export type AddUserToWorkspaceRequest = z.infer<
  typeof addUserToWorkspaceRequest
>

// ── Edit an existing membership (role change / single-workspace removal) ──
export const updateUserMembershipRequest = z.object({
  userId: z.string(),
  workspaceId: z.string().min(1),
  role: workspaceMemberRoles,
  permissions: workspaceMemberPermissionsSchema.optional(),
})
export type UpdateUserMembershipRequest = z.infer<
  typeof updateUserMembershipRequest
>

export const removeUserMembershipRequest = z.object({
  userId: z.string(),
  workspaceId: z.string().min(1),
})
export type RemoveUserMembershipRequest = z.infer<
  typeof removeUserMembershipRequest
>

// ── Deactivate / reactivate (soft block, no data deletion) ──
export const deactivatePlatformUserRequest = z.object({
  userId: z.string(),
  removeFromWorkspaces: z.boolean().optional().default(false),
})
export type DeactivatePlatformUserRequest = z.infer<
  typeof deactivatePlatformUserRequest
>

export const reactivatePlatformUserRequest = z.object({
  userId: z.string(),
})
export type ReactivatePlatformUserRequest = z.infer<
  typeof reactivatePlatformUserRequest
>

// ── Workspace picker for the admin dialogs (id + name only) ──
export const listWorkspacesForAdminRequest = z.object({
  keyword: z.string().nullish().default(null),
})
export type ListWorkspacesForAdminRequest = z.infer<
  typeof listWorkspacesForAdminRequest
>

export const listWorkspacesForAdminResponse = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string() })),
})
export type ListWorkspacesForAdminResponse = z.infer<
  typeof listWorkspacesForAdminResponse
>
