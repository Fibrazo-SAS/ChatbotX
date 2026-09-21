"use client"

import { DataTable } from "@chatbotx.io/ui/components/data-table/data-table"
import { DataTableColumnHeader } from "@chatbotx.io/ui/components/data-table/data-table-column-header"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@chatbotx.io/ui/components/ui/avatar"
import { Badge } from "@chatbotx.io/ui/components/ui/badge"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@chatbotx.io/ui/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@chatbotx.io/ui/components/ui/tooltip"
import { useDataTable } from "@chatbotx.io/ui/hooks/use-data-table"
import type { ColumnDef } from "@tanstack/react-table"
import {
  BanIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UserPlusIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { use, useMemo, useState } from "react"
import { toast } from "sonner"
import { useUserAvatarUrl } from "@/lib/auth/avatar"
import { reactivatePlatformUserAction } from "../actions/reactivate-platform-user.action"
import { setPlatformSuperAdminAction } from "../actions/set-platform-super-admin.action"
import type { listPlatformUsers } from "../queries/list-platform-users"
import type {
  ListPlatformUsersResponse,
  PlatformUserResource,
} from "../schema/platform-user"
import { AddUserToWorkspaceDialog } from "./add-user-to-workspace-dialog"
import { DeactivatePlatformUserDialog } from "./deactivate-platform-user-dialog"
import { EditUserWorkspacesDialog } from "./edit-user-workspaces-dialog"

type PlatformUsersTableProps = {
  promises: Promise<[Awaited<ReturnType<typeof listPlatformUsers>>]>
}

function UserNameCell({
  name,
  image,
}: {
  name?: string | null
  image?: string | null
}) {
  const avatarUrl = useUserAvatarUrl(image)

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-7">
        <AvatarImage alt="avatar" src={avatarUrl ?? ""} />
        <AvatarFallback>{(name || "").charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="max-w-[200px] truncate">{name}</span>
    </div>
  )
}

export function PlatformUsersTable({ promises }: PlatformUsersTableProps) {
  const [{ data, pageCount }] = use(promises)
  const t = useTranslations()
  const [addWorkspaceUser, setAddWorkspaceUser] =
    useState<PlatformUserResource | null>(null)
  const [deactivateUser, setDeactivateUser] =
    useState<PlatformUserResource | null>(null)
  const [editWorkspacesUser, setEditWorkspacesUser] =
    useState<PlatformUserResource | null>(null)

  const { execute: reactivate } = useAction(reactivatePlatformUserAction, {
    onSuccess: () => {
      toast.success(t("platformAdmin.users.reactivate.success"))
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(error.serverError)
      }
    },
  })

  const { execute: setSuperAdmin } = useAction(setPlatformSuperAdminAction, {
    onSuccess: ({ input }) => {
      toast.success(
        input.value
          ? t("platformAdmin.users.setSuperAdmin.granted")
          : t("platformAdmin.users.setSuperAdmin.revoked"),
      )
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(error.serverError)
      }
    },
  })

  const columns = useMemo<
    ColumnDef<ListPlatformUsersResponse["data"][number]>[]
  >(
    () => [
      {
        id: "name",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("fields.name.label")}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <UserNameCell image={row.original.image} name={row.original.name} />
            {row.original.deactivatedAt ? (
              <Badge variant="destructive">
                {t("platformAdmin.users.deactivated")}
              </Badge>
            ) : null}
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "email",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("fields.email.label")}
          />
        ),
        cell: ({ row }) => (
          <span className="max-w-[260px] truncate">{row.original.email}</span>
        ),
        enableHiding: false,
      },
      {
        id: "isPlatformSuperAdmin",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("platformAdmin.users.platformSuperAdmin")}
          />
        ),
        cell: ({ row }) =>
          row.original.isPlatformSuperAdmin ? (
            <Badge variant="default">
              {t("platformAdmin.users.platformSuperAdmin")}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        enableHiding: false,
      },
      {
        id: "workspaces",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("platformAdmin.users.workspaces")}
          />
        ),
        cell: ({ row }) => {
          const members = row.original.workspaceMembers
          if (members.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }
          return (
            <div className="flex max-w-[300px] flex-wrap gap-1">
              {members.map((member) => (
                <Tooltip key={member.workspaceId}>
                  <TooltipTrigger
                    render={
                      <Badge
                        className="cursor-pointer"
                        onClick={() => setEditWorkspacesUser(row.original)}
                        variant="secondary"
                      >
                        {member.workspace.name}{" "}
                        <span className="text-muted-foreground">
                          ({t(`fields.role.${member.role}`)})
                        </span>
                      </Badge>
                    }
                  />
                  <TooltipContent>
                    <p>
                      {member.workspace.name} —{" "}
                      {t(`fields.role.${member.role}`)}
                      {member.permissions.superAdmin
                        ? ` · ${t("fields.permissions.superAdmin")}`
                        : ""}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )
        },
        enableHiding: false,
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("actions.actions")} />
        ),
        cell: ({ row }) => {
          const user = row.original
          const deactivated = Boolean(user.deactivatedAt)
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button aria-haspopup="menu" size="icon" variant="ghost">
                    <MoreHorizontalIcon className="size-4" />
                    <span className="sr-only">{t("actions.actions")}</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {!deactivated && (
                  <DropdownMenuItem onClick={() => setAddWorkspaceUser(user)}>
                    <UserPlusIcon className="size-4" />
                    {t("platformAdmin.users.addToWorkspace.button")}
                  </DropdownMenuItem>
                )}
                {/* Visible for every console user, but only the ENV admin
                    can actually flip the flag (server-side guard with a
                    clear error for promoted admins). Hidden for the ENV
                    admin itself: its access comes from the environment and
                    can never be revoked nor deactivated. */}
                {!user.isEnvSuperAdmin && (
                  <DropdownMenuItem
                    onClick={() =>
                      setSuperAdmin({
                        userId: user.id,
                        value: !user.isPlatformSuperAdmin,
                      })
                    }
                  >
                    <ShieldCheckIcon className="size-4" />
                    {user.isPlatformSuperAdmin
                      ? t("platformAdmin.users.setSuperAdmin.revoke")
                      : t("platformAdmin.users.setSuperAdmin.grant")}
                  </DropdownMenuItem>
                )}
                {deactivated ? (
                  <DropdownMenuItem
                    onClick={() => reactivate({ userId: user.id })}
                  >
                    <UserCheckIcon className="size-4" />
                    {t("platformAdmin.users.reactivate.button")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => setDeactivateUser(user)}
                    variant="destructive"
                  >
                    <BanIcon className="size-4" />
                    {t("platformAdmin.users.deactivate.button")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        enableHiding: false,
        enableSorting: false,
      },
      {
        id: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("platformAdmin.users.registeredAt")}
          />
        ),
        cell: ({ row }) =>
          new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(row.original.createdAt),
        enableHiding: false,
      },
    ],
    [t, reactivate, setSuperAdmin],
  )

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
    },
    getRowId: (originalRow) => originalRow.id,
    shallow: false,
    clearOnDefault: true,
  })

  return (
    <>
      <DataTable scrollable table={table} />
      {addWorkspaceUser ? (
        <AddUserToWorkspaceDialog
          onOpenChange={(open) => {
            if (!open) {
              setAddWorkspaceUser(null)
            }
          }}
          open
          user={addWorkspaceUser}
        />
      ) : null}
      {editWorkspacesUser ? (
        <EditUserWorkspacesDialog
          onOpenChange={(open) => {
            if (!open) {
              setEditWorkspacesUser(null)
            }
          }}
          open
          user={editWorkspacesUser}
        />
      ) : null}
      {deactivateUser ? (
        <DeactivatePlatformUserDialog
          onOpenChange={(open) => {
            if (!open) {
              setDeactivateUser(null)
            }
          }}
          open
          user={deactivateUser}
        />
      ) : null}
    </>
  )
}
