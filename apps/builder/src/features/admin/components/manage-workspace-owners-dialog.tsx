"use client"

import { workspaceMemberRoles } from "@chatbotx.io/database/partials"
import { ComboboxField } from "@chatbotx.io/ui/components/form/combobox-field"
import type { SelectOption } from "@chatbotx.io/ui/components/form/select-field"
import { SelectField } from "@chatbotx.io/ui/components/form/select-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chatbotx.io/ui/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { Loader2Icon, PlusIcon, TrashIcon, UserRoundIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { addUserToWorkspaceAction } from "@/features/users/actions/add-user-to-workspace.action"
import { removeUserMembershipAction } from "@/features/users/actions/remove-user-membership.action"
import { updateUserMembershipAction } from "@/features/users/actions/update-user-membership.action"
import { listPlatformUsers } from "@/features/users/queries/list-platform-users"
import type { PlatformUserResource } from "@/features/users/schema/platform-user"
import { addUserToWorkspaceRequest } from "@/features/users/schema/platform-user"
import type { AdminWorkspaceResource } from "../schema/admin-workspace"

type MemberRow = {
  userId: string
  name: string | null
  email: string
  role: "owner" | "agent"
}

const initialMembers = (workspace: AdminWorkspaceResource): MemberRow[] =>
  workspace.members.map((member) => ({
    userId: member.id,
    name: member.name ?? null,
    email: member.email,
    role: member.role,
  }))

type ManageWorkspaceOwnersDialogProps = {
  workspace: AdminWorkspaceResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Members ABM popup for the /admin/workspaces directory (ticket 15136).
 * Reuses the existing platform-admin member actions from /admin/users; the
 * "never remove/demote the last owner" guard lives server-side in
 * `workspaceMemberService` and surfaces here as an error toast.
 */
export function ManageWorkspaceOwnersDialog({
  workspace,
  open,
  onOpenChange,
}: ManageWorkspaceOwnersDialogProps) {
  const t = useTranslations()
  const router = useRouter()

  const [members, setMembers] = useState<MemberRow[]>(() =>
    initialMembers(workspace),
  )
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [loadedUsers, setLoadedUsers] = useState<PlatformUserResource[]>([])

  const userOptions = useMemo<SelectOption[]>(
    () =>
      loadedUsers.map((user) => ({
        value: user.id,
        label: `${user.name ?? ""} ${user.email}`.trim(),
      })),
    [loadedUsers],
  )

  const roleOptions = useMemo<SelectOption[]>(
    () =>
      workspaceMemberRoles.options.map((role) => ({
        value: role,
        label: t(`fields.role.${role}`),
      })),
    [t],
  )

  useEffect(() => {
    if (!open || loadedUsers.length > 0) {
      return
    }
    listPlatformUsers({ keyword: null, perPage: 100 })
      .then(({ data }) => setLoadedUsers(data))
      .catch(() => toast.error(t("platformAdmin.workspaces.loadUsersError")))
  }, [open, loadedUsers.length, t])

  const { execute: updateRole } = useAction(updateUserMembershipAction, {
    onSuccess: () => {
      setPendingUserId(null)
      toast.success(t("platformAdmin.workspaces.owners.roleChanged"))
      router.refresh()
    },
    onError: ({ error }) => {
      setPendingUserId(null)
      if (error.serverError) {
        toast.error(error.serverError)
      }
      // Revert to server state on failure.
      setMembers(initialMembers(workspace))
    },
  })

  const { execute: removeMember } = useAction(removeUserMembershipAction, {
    onSuccess: () => {
      setRemovingUserId(null)
      toast.success(t("platformAdmin.workspaces.owners.removed"))
      router.refresh()
    },
    onError: ({ error }) => {
      setRemovingUserId(null)
      if (error.serverError) {
        toast.error(error.serverError)
      }
      // Revert to server state on failure.
      setMembers(initialMembers(workspace))
    },
  })

  const { form, handleSubmitWithAction, resetFormAndAction } =
    useHookFormAction(
      addUserToWorkspaceAction,
      zodResolver(addUserToWorkspaceRequest),
      {
        actionProps: {
          onSuccess: () => {
            const userId = form.getValues("userId")
            const role = form.getValues("role")
            const user = loadedUsers.find(
              (candidate) => candidate.id === userId,
            )
            if (user) {
              setMembers((current) => [
                ...current,
                {
                  userId: user.id,
                  name: user.name ?? null,
                  email: user.email,
                  role: role ?? "agent",
                },
              ])
            }
            resetFormAndAction()
            toast.success(t("platformAdmin.workspaces.owners.added"))
            router.refresh()
          },
          onError: ({ error }) => {
            if (error.serverError) {
              toast.error(error.serverError)
            }
          },
        },
        formProps: {
          mode: "onChange",
          defaultValues: {
            workspaceId: workspace.id,
            userId: "",
            role: "agent" as const,
          },
        },
      },
    )

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("platformAdmin.workspaces.owners.title", {
              name: workspace.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("platformAdmin.workspaces.owners.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("platformAdmin.workspaces.owners.empty")}
            </p>
          ) : (
            members.map((member) => (
              <div className="flex items-center gap-2" key={member.userId}>
                <UserRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {member.name ?? member.email}
                </span>
                <Select
                  onValueChange={(role) => {
                    if (role === member.role) {
                      return
                    }
                    setPendingUserId(member.userId)
                    setMembers((current) =>
                      current.map((item) =>
                        item.userId === member.userId
                          ? { ...item, role: role as MemberRow["role"] }
                          : item,
                      ),
                    )
                    updateRole({
                      userId: member.userId,
                      workspaceId: workspace.id,
                      role: role as MemberRow["role"],
                    })
                  }}
                  value={member.role}
                >
                  <SelectTrigger className="w-32" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaceMemberRoles.options.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`fields.role.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  aria-label={t("platformAdmin.workspaces.owners.remove")}
                  disabled={
                    removingUserId === member.userId ||
                    pendingUserId === member.userId
                  }
                  onClick={() => {
                    setRemovingUserId(member.userId)
                    setMembers((current) =>
                      current.filter((item) => item.userId !== member.userId),
                    )
                    removeMember({
                      userId: member.userId,
                      workspaceId: workspace.id,
                    })
                  }}
                  size="icon"
                  variant="ghost"
                >
                  {removingUserId === member.userId ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <TrashIcon className="size-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        <Form {...form}>
          <form
            className="space-y-4 border-t pt-4"
            onSubmit={handleSubmitWithAction}
          >
            <p className="font-medium text-sm">
              {t("platformAdmin.workspaces.owners.add")}
            </p>
            <ComboboxField
              emptyText={t("actions.noRecordFound")}
              label={t("fields.member.label")}
              name="userId"
              options={userOptions}
              placeholder={t(
                "platformAdmin.workspaces.owners.searchPlaceholder",
              )}
              required
              searchPlaceholder={t(
                "platformAdmin.workspaces.owners.searchPlaceholder",
              )}
            />
            <SelectField
              label={t("fields.role.label")}
              name="role"
              options={roleOptions}
              required
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                disabled={
                  !form.formState.isValid || form.formState.isSubmitting
                }
                size="sm"
                type="submit"
              >
                {form.formState.isSubmitting && (
                  <Loader2Icon className="animate-spin" />
                )}
                <PlusIcon className="size-4" />
                {t("actions.confirm")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
