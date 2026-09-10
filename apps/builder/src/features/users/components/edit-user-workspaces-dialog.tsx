"use client"

import {
  type WorkspaceMemberPermissions,
  workspaceMemberPermissionsSchema,
  workspaceMemberRoles,
} from "@chatbotx.io/database/partials"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chatbotx.io/ui/components/ui/select"
import { Switch } from "@chatbotx.io/ui/components/ui/switch"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
  TrashIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useState } from "react"
import { toast } from "sonner"
import { isCommunity } from "@/env"
import { normalizeContactsPermissions } from "@/features/workspace-members/helpers"
import { removeUserMembershipAction } from "../actions/remove-user-membership.action"
import { updateUserMembershipAction } from "../actions/update-user-membership.action"
import type { PlatformUserResource } from "../schema/platform-user"

type EditUserWorkspacesDialogProps = {
  user: PlatformUserResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MembershipState = {
  workspaceId: string
  workspaceName: string
  role: "owner" | "agent"
  permissions: WorkspaceMemberPermissions
}

const PERMISSION_FIELDS = [
  "analytics",
  "flows",
  "contacts",
  "onlyAssignedContacts",
  "emailAndPhone",
  "broadcast",
  "ecommerce",
] as const

const initialMemberships = (user: PlatformUserResource): MembershipState[] =>
  user.workspaceMembers.map((member) => ({
    workspaceId: member.workspaceId,
    workspaceName: member.workspace.name,
    role: member.role,
    permissions: workspaceMemberPermissionsSchema.parse(member.permissions),
  }))

export function EditUserWorkspacesDialog({
  user,
  open,
  onOpenChange,
}: EditUserWorkspacesDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [memberships, setMemberships] = useState<MembershipState[]>(
    initialMemberships(user),
  )
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(
    null,
  )
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null,
  )
  const [removingWorkspaceId, setRemovingWorkspaceId] = useState<string | null>(
    null,
  )

  const { execute: updateRole } = useAction(updateUserMembershipAction, {
    onSuccess: () => {
      toast.success(t("platformAdmin.users.editWorkspaces.success"))
      router.refresh()
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(error.serverError)
      }
      // Revert to server state on failure
      setMemberships(initialMemberships(user))
    },
  })

  const { execute: removeMembership } = useAction(removeUserMembershipAction, {
    onSuccess: () => {
      toast.success(t("platformAdmin.users.editWorkspaces.removeSuccess"))
      router.refresh()
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(error.serverError)
      }
      // Revert to server state on failure
      setMemberships(initialMemberships(user))
    },
  })

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("platformAdmin.users.editWorkspaces.title", {
              name: user.name ?? user.email,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("platformAdmin.users.editWorkspaces.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {memberships.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("platformAdmin.users.editWorkspaces.empty")}
            </p>
          ) : (
            memberships.map((membership) => (
              <div className="flex flex-col gap-2" key={membership.workspaceId}>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={t(
                      "platformAdmin.users.editWorkspaces.permissions",
                    )}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setExpandedWorkspaceId(
                        expandedWorkspaceId === membership.workspaceId
                          ? null
                          : membership.workspaceId,
                      )
                    }
                    type="button"
                  >
                    {expandedWorkspaceId === membership.workspaceId ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronRightIcon className="size-4" />
                    )}
                  </button>
                  <span className="flex-1 truncate text-sm">
                    {membership.workspaceName}
                  </span>
                  <Select
                    onValueChange={(role) => {
                      if (role === membership.role) {
                        return
                      }
                      setPendingWorkspaceId(membership.workspaceId)
                      setMemberships((current) =>
                        current.map((item) =>
                          item.workspaceId === membership.workspaceId
                            ? {
                                ...item,
                                role: role as MembershipState["role"],
                              }
                            : item,
                        ),
                      )
                      updateRole({
                        userId: user.id,
                        workspaceId: membership.workspaceId,
                        role: role as MembershipState["role"],
                        permissions: membership.permissions,
                      })
                    }}
                    value={membership.role}
                  >
                    <SelectTrigger className="w-36" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* "owner" only appears to reflect the current state —
                        the admin can demote (last-owner guard on the server)
                        but never promote to owner from here. */}
                      {(membership.role === "owner"
                        ? workspaceMemberRoles.options
                        : workspaceMemberRoles.options.filter(
                            (role) => role !== "owner",
                          )
                      ).map((role) => (
                        <SelectItem key={role} value={role}>
                          {t(`fields.role.${role}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    aria-label={t("platformAdmin.users.editWorkspaces.remove")}
                    disabled={
                      removingWorkspaceId === membership.workspaceId ||
                      pendingWorkspaceId === membership.workspaceId
                    }
                    onClick={() => {
                      setRemovingWorkspaceId(membership.workspaceId)
                      setMemberships((current) =>
                        current.filter(
                          (item) => item.workspaceId !== membership.workspaceId,
                        ),
                      )
                      removeMembership({
                        userId: user.id,
                        workspaceId: membership.workspaceId,
                      })
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    {removingWorkspaceId === membership.workspaceId ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <TrashIcon className="size-4" />
                    )}
                  </Button>
                </div>

                {!isCommunity() &&
                  expandedWorkspaceId === membership.workspaceId && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/50 p-3">
                      <p className="col-span-2 font-medium text-muted-foreground text-xs">
                        {t("platformAdmin.users.editWorkspaces.permissions")}
                      </p>
                      {PERMISSION_FIELDS.map((field) => {
                        // Acople contacts ↔ onlyAssigned (misma regla que el
                        // flujo normal): onlyAssigned solo aplica con contacts.
                        const onToggle = (checked: boolean) => {
                          const next = normalizeContactsPermissions({
                            ...membership.permissions,
                            [field]: checked,
                          })
                          setMemberships((current) =>
                            current.map((item) =>
                              item.workspaceId === membership.workspaceId
                                ? { ...item, permissions: next }
                                : item,
                            ),
                          )
                          updateRole({
                            userId: user.id,
                            workspaceId: membership.workspaceId,
                            role: membership.role,
                            permissions: next,
                          })
                        }
                        return (
                          <div
                            className="flex items-center gap-2 text-sm"
                            key={field}
                          >
                            <Switch
                              checked={membership.permissions[field]}
                              onCheckedChange={onToggle}
                            />
                            <span
                              className={
                                membership.permissions.superAdmin
                                  ? "opacity-50"
                                  : ""
                              }
                            >
                              {t(`fields.permissions.${field}`)}
                            </span>
                          </div>
                        )
                      })}
                      <div className="col-span-2 mt-1 flex items-center gap-2 border-t pt-2">
                        {/* Super admin manda sobre los demás switches */}
                        <Switch
                          checked={membership.permissions.superAdmin}
                          onCheckedChange={(checked) => {
                            const next = normalizeContactsPermissions({
                              ...membership.permissions,
                              superAdmin: checked,
                            })
                            setMemberships((current) =>
                              current.map((item) =>
                                item.workspaceId === membership.workspaceId
                                  ? { ...item, permissions: next }
                                  : item,
                              ),
                            )
                            updateRole({
                              userId: user.id,
                              workspaceId: membership.workspaceId,
                              role: membership.role,
                              permissions: next,
                            })
                          }}
                        />
                        <span className="font-medium text-sm">
                          {t("fields.permissions.superAdmin")}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
