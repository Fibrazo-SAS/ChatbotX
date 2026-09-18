"use client"

import { DataTableColumnHeader } from "@chatbotx.io/ui/components/data-table/data-table-column-header"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@chatbotx.io/ui/components/ui/avatar"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@chatbotx.io/ui/components/ui/tooltip"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import {
  FileDiffIcon,
  MinusCircleIcon,
  PencilIcon,
  PlusCircleIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useUserAvatarUrl } from "@/lib/auth/avatar"
import type { AuditLogResource } from "./schema"

type TranslationFn = ReturnType<typeof useTranslations>

function AuditUserCell({
  user,
  role,
}: {
  user: NonNullable<AuditLogResource["user"]>
  role?: string | null
}) {
  const t = useTranslations()
  const avatarUrl = useUserAvatarUrl(user.image)
  let roleLabel: string | null = null
  if (role === "owner") {
    roleLabel = t("auditLogs.roles.owner")
  } else if (role === "agent") {
    roleLabel = t("auditLogs.roles.agent")
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage alt="userImage" src={avatarUrl ?? ""} />
        <AvatarFallback>{user.name?.[0]}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="inline-block max-w-[200px] truncate">
                {user.name}
              </div>
            }
          />
          <TooltipContent>
            <p>{user.name}</p>
          </TooltipContent>
        </Tooltip>
        {roleLabel ? (
          <span className="text-muted-foreground text-xs">{roleLabel}</span>
        ) : null}
      </div>
    </div>
  )
}

function ChangedBlock({
  change,
}: {
  change: { name: string; before?: string; after?: string }
}) {
  const t = useTranslations()

  return (
    <li className="space-y-2">
      <span className="flex items-center gap-2 font-medium">
        <PencilIcon className="size-4 text-amber-600" />
        {change.name}
      </span>
      {change.before !== undefined && (
        <div className="ms-6 space-y-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-muted-foreground text-xs">
              {t("auditLogs.changes.before")}
            </p>
            <p className="text-sm">{change.before}</p>
          </div>
          <div className="rounded-md border bg-primary/5 px-3 py-2">
            <p className="text-muted-foreground text-xs">
              {t("auditLogs.changes.after")}
            </p>
            <p className="text-sm">{change.after}</p>
          </div>
        </div>
      )}
    </li>
  )
}

function AuditChangesButton({ row }: { row: AuditLogResource }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  if (!row.changesDetails) {
    return null
  }

  return (
    <>
      <Button
        aria-label={t("auditLogs.changes.viewChanges")}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <FileDiffIcon className="size-4" />
        {t("auditLogs.changes.viewChanges")}
      </Button>
      <AuditChangesDialog onOpenChange={setOpen} open={open} row={row} />
    </>
  )
}

function AuditChangesDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AuditLogResource
  open: boolean
  onOpenChange: (val: boolean) => void
}) {
  const t = useTranslations()
  const changes = row.changesDetails

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("auditLogs.changes.title")}</DialogTitle>
          <DialogDescription>{row.detail}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {changes?.added && changes.added.length > 0 && (
            <div>
              <p className="mb-1 font-medium">{t("auditLogs.changes.added")}</p>
              <ul className="space-y-1">
                {changes.added.map((name) => (
                  <li className="flex items-center gap-2" key={`added-${name}`}>
                    <PlusCircleIcon className="size-4 text-green-600" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {changes?.removed && changes.removed.length > 0 && (
            <div>
              <p className="mb-1 font-medium">
                {t("auditLogs.changes.removed")}
              </p>
              <ul className="space-y-1">
                {changes.removed.map((name) => (
                  <li
                    className="flex items-center gap-2"
                    key={`removed-${name}`}
                  >
                    <MinusCircleIcon className="size-4 text-red-600" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {changes?.changed && changes.changed.length > 0 && (
            <div>
              <p className="mb-1 font-medium">
                {t("auditLogs.changes.changed")}
              </p>
              <ul className="space-y-3">
                {changes.changed.map((change) => (
                  <ChangedBlock
                    change={change}
                    key={`changed-${change.name}`}
                  />
                ))}
              </ul>
            </div>
          )}
          {!(changes?.added || changes?.removed || changes?.changed) && (
            <p className="text-muted-foreground">
              {t("auditLogs.changes.noChanges")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function getAuditColumns(
  t: TranslationFn,
): ColumnDef<AuditLogResource>[] {
  return [
    {
      accessorKey: "userId",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("auditLogs.columns.user")}
        />
      ),
      cell: ({ row }) => (
        <div>
          {row.original.user ? (
            <AuditUserCell role={row.original.role} user={row.original.user} />
          ) : null}
        </div>
      ),
      size: 160,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "detail",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("auditLogs.columns.detail")}
        />
      ),
      cell: ({ row }) => (
        <div className="whitespace-normal break-words">
          {row.original.detail}
        </div>
      ),
      size: 560,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("auditLogs.columns.date")}
        />
      ),
      cell: ({ row }) => format(row.original.createdAt, "yyyy/MM/dd HH:mm"),
      size: 130,
      enableSorting: true,
      enableHiding: false,
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => <AuditChangesButton row={row.original} />,
      size: 120,
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
