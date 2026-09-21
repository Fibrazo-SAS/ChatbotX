"use client"

import { DataTable } from "@chatbotx.io/ui/components/data-table/data-table"
import { DataTableColumnHeader } from "@chatbotx.io/ui/components/data-table/data-table-column-header"
import { Badge } from "@chatbotx.io/ui/components/ui/badge"
import { useDataTable } from "@chatbotx.io/ui/hooks/use-data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { use, useMemo } from "react"
import type { listAdminWorkspaces } from "../queries/list-admin-workspaces"
import type { ListAdminWorkspacesResponse } from "../schema/admin-workspace"

type AdminWorkspacesTableProps = {
  promises: Promise<[Awaited<ReturnType<typeof listAdminWorkspaces>>]>
}

export function AdminWorkspacesTable({ promises }: AdminWorkspacesTableProps) {
  const [{ data, pageCount }] = use(promises)
  const t = useTranslations()

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
        cell: ({ row }) => (
          <span className="max-w-[260px] truncate font-medium">
            {row.original.name}
          </span>
        ),
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
        cell: ({ row }) => {
          const owners = row.original.owners
          if (owners.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }
          return (
            <div className="flex max-w-[260px] flex-col gap-0.5">
              {owners.map((owner) => (
                <span className="truncate text-sm" key={owner.id}>
                  {owner.name ?? owner.email}
                </span>
              ))}
            </div>
          )
        },
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
    ],
    [t],
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

  return <DataTable scrollable table={table} />
}
