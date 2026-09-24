"use client"

import { DataTable } from "@chatbotx.io/ui/components/data-table/data-table"
import { DataTableColumnHeader } from "@chatbotx.io/ui/components/data-table/data-table-column-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@chatbotx.io/ui/components/ui/alert-dialog"
import { Badge } from "@chatbotx.io/ui/components/ui/badge"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@chatbotx.io/ui/components/ui/dropdown-menu"
import { useDataTable } from "@chatbotx.io/ui/hooks/use-data-table"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Loader2Icon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  TrashIcon,
  UsersRoundIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { use, useMemo, useState } from "react"
import { toast } from "sonner"
import { cancelAdminWorkspaceDeletionAction } from "../actions/cancel-workspace-deletion.action"
import { scheduleAdminWorkspaceDeletionAction } from "../actions/schedule-workspace-deletion.action"
import { updateAdminWorkspaceStatusAction } from "../actions/update-workspace-status.action"
import type { listAdminWorkspaces } from "../queries/list-admin-workspaces"
import type {
  AdminWorkspaceResource,
  ListAdminWorkspacesResponse,
} from "../schema/admin-workspace"
import { ManageWorkspaceOwnersDialog } from "./manage-workspace-owners-dialog"

type AdminWorkspacesTableProps = {
  promises: Promise<[Awaited<ReturnType<typeof listAdminWorkspaces>>]>
}

export function AdminWorkspacesTable({ promises }: AdminWorkspacesTableProps) {
  const [{ data, pageCount }] = use(promises)
  const t = useTranslations()
  const router = useRouter()
  const [ownersWorkspace, setOwnersWorkspace] =
    useState<AdminWorkspaceResource | null>(null)
  const [deletionWorkspace, setDeletionWorkspace] =
    useState<AdminWorkspaceResource | null>(null)

  const { execute: setStatus, isPending: statusPending } = useAction(
    updateAdminWorkspaceStatusAction,
    {
      onSuccess: ({ input }) => {
        toast.success(
          input.isActive
            ? t("platformAdmin.workspaces.actions.activated")
            : t("platformAdmin.workspaces.actions.deactivated"),
        )
        router.refresh()
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  const { execute: scheduleDeletion, isPending: schedulePending } = useAction(
    scheduleAdminWorkspaceDeletionAction,
    {
      onSuccess: () => {
        setDeletionWorkspace(null)
        toast.success(t("platformAdmin.workspaces.actions.deletionScheduled"))
        router.refresh()
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  const { execute: cancelDeletion, isPending: cancelPending } = useAction(
    cancelAdminWorkspaceDeletionAction,
    {
      onSuccess: () => {
        toast.success(t("platformAdmin.workspaces.actions.deletionCancelled"))
        router.refresh()
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  const columns = useMemo<
    ColumnDef<ListAdminWorkspacesResponse["data"][number]>[]
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
        cell: ({ row }) => {
          const workspace = row.original
          let stateLabel: string | null = null
          let stateVariant: "destructive" | "secondary" = "secondary"
          if (workspace.scheduledDeletionAt) {
            stateLabel = t(
              "platformAdmin.workspaces.state.scheduledForDeletion",
            )
            stateVariant = "destructive"
          } else if (!workspace.isActive) {
            stateLabel = t("platformAdmin.workspaces.state.inactive")
          }
          return (
            <div className="flex flex-col gap-1">
              <span className="max-w-[260px] truncate font-medium">
                {workspace.name}
              </span>
              {stateLabel ? (
                <Badge className="w-fit" variant={stateVariant}>
                  {stateLabel}
                </Badge>
              ) : null}
            </div>
          )
        },
        enableHiding: false,
      },
      {
        id: "owners",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("platformAdmin.workspaces.owner")}
          />
        ),
        cell: ({ row }) => (
          <Button
            className="h-auto p-0"
            onClick={() => setOwnersWorkspace(row.original)}
            size="sm"
            type="button"
            variant="link"
          >
            <UsersRoundIcon className="size-4" />
            {t("platformAdmin.workspaces.owners.count", {
              count: row.original.ownerCount,
            })}
          </Button>
        ),
        enableHiding: false,
      },
      {
        id: "memberCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("platformAdmin.workspaces.members")}
          />
        ),
        cell: ({ row }) => row.original.memberCount,
        enableHiding: false,
      },
      {
        id: "tenantId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("platformAdmin.workspaces.tenant")}
          />
        ),
        cell: ({ row }) =>
          row.original.tenantId === "1" ? (
            <Badge variant="secondary">
              {t("platformAdmin.workspaces.platformTenant")}
            </Badge>
          ) : (
            <span className="font-mono text-muted-foreground text-xs">
              {row.original.tenantId}
            </span>
          ),
        enableHiding: false,
      },
      {
        id: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("platformAdmin.workspaces.createdAt")}
          />
        ),
        cell: ({ row }) =>
          new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
          }).format(row.original.createdAt),
        enableHiding: false,
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("actions.actions")} />
        ),
        cell: ({ row }) => {
          const workspace = row.original
          const scheduled = Boolean(workspace.scheduledDeletionAt)
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
                <DropdownMenuItem onClick={() => setOwnersWorkspace(workspace)}>
                  <UsersRoundIcon className="size-4" />
                  {t("platformAdmin.workspaces.actions.manageOwners")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {scheduled ? (
                  <DropdownMenuItem
                    disabled={cancelPending}
                    onClick={() =>
                      cancelDeletion({ workspaceId: workspace.id })
                    }
                  >
                    <RotateCcwIcon className="size-4" />
                    {t("platformAdmin.workspaces.actions.cancelDeletion")}
                  </DropdownMenuItem>
                ) : (
                  <>
                    {workspace.isActive ? (
                      <DropdownMenuItem
                        disabled={statusPending}
                        onClick={() =>
                          setStatus({
                            workspaceId: workspace.id,
                            isActive: false,
                          })
                        }
                      >
                        <PauseIcon className="size-4" />
                        {t("platformAdmin.workspaces.actions.deactivate")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled={statusPending}
                        onClick={() =>
                          setStatus({
                            workspaceId: workspace.id,
                            isActive: true,
                          })
                        }
                      >
                        <PlayIcon className="size-4" />
                        {t("platformAdmin.workspaces.actions.activate")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setDeletionWorkspace(workspace)}
                      variant="destructive"
                    >
                      <TrashIcon className="size-4" />
                      {t("platformAdmin.workspaces.actions.scheduleDeletion")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [t, cancelDeletion, cancelPending, setStatus, statusPending],
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
      {ownersWorkspace ? (
        <ManageWorkspaceOwnersDialog
          key={ownersWorkspace.id}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setOwnersWorkspace(null)
            }
          }}
          open
          workspace={ownersWorkspace}
        />
      ) : null}
      {deletionWorkspace ? (
        <AlertDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDeletionWorkspace(null)
            }
          }}
          open
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(
                  "platformAdmin.workspaces.actions.scheduleDeletionConfirm.title",
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  "platformAdmin.workspaces.actions.scheduleDeletionConfirm.description",
                  { name: deletionWorkspace.name },
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={schedulePending}
                onClick={(event) => {
                  event.preventDefault()
                  scheduleDeletion({ workspaceId: deletionWorkspace.id })
                }}
              >
                {schedulePending && <Loader2Icon className="animate-spin" />}
                {t("platformAdmin.workspaces.actions.scheduleDeletion")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  )
}
