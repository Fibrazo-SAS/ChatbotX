"use client"

import { workspaceMemberRoles } from "@chatbotx.io/database/partials"
import { ComboboxField } from "@chatbotx.io/ui/components/form/combobox-field"
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
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { addUserToWorkspaceAction } from "../actions/add-user-to-workspace.action"
import { listWorkspacesForAdmin } from "../queries/list-workspaces-for-admin"
import type { PlatformUserResource } from "../schema/platform-user"
import { addUserToWorkspaceRequest } from "../schema/platform-user"

type AddUserToWorkspaceDialogProps = {
  user: PlatformUserResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddUserToWorkspaceDialog({
  user,
  open,
  onOpenChange,
}: AddUserToWorkspaceDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [workspaceOptions, setWorkspaceOptions] = useState<
    { value: string; label: string }[]
  >([])
  const [workspacesLoaded, setWorkspacesLoaded] = useState(false)

  const loadWorkspaces = useCallback(async () => {
    if (workspacesLoaded) {
      return
    }
    try {
      const { data } = await listWorkspacesForAdmin({ keyword: null })
      setWorkspaceOptions(
        data.map((workspace) => ({
          value: workspace.id,
          label: workspace.name,
        })),
      )
      setWorkspacesLoaded(true)
    } catch {
      toast.error(t("platformAdmin.users.addToWorkspace.loadError"))
    }
  }, [t, workspacesLoaded])

  // El dialog se monta YA ABIERTO (la tabla lo renderiza con open=true al
  // elegir un usuario), así que onOpenChange(true) nunca dispara: cargar al
  // montar, no al abrir.
  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  const { form, handleSubmitWithAction, resetFormAndAction } =
    useHookFormAction(
      addUserToWorkspaceAction,
      zodResolver(addUserToWorkspaceRequest),
      {
        actionProps: {
          onSuccess: () => {
            resetFormAndAction()
            onOpenChange(false)
            toast.success(t("platformAdmin.users.addToWorkspace.success"))
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
            userId: user.id,
            workspaceId: "",
            role: "agent" as const,
          },
        },
      },
    )

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetFormAndAction()
        }
        onOpenChange(nextOpen)
      }}
      open={open}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("platformAdmin.users.addToWorkspace.title", {
              name: user.name ?? user.email,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("platformAdmin.users.addToWorkspace.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6" onSubmit={handleSubmitWithAction}>
            <ComboboxField
              emptyText={t("actions.noRecordFound")}
              label={t("platformAdmin.users.addToWorkspace.workspaceLabel")}
              name="workspaceId"
              options={workspaceOptions}
              placeholder={t("actions.pleaseSelect")}
              required
            />
            <SelectField
              label={t("platformAdmin.users.addToWorkspace.roleLabel")}
              name="role"
              // Rol libre (owner incluido). El guard de "no dejar el
              // workspace sin owner" vive en el servicio.
              options={workspaceMemberRoles.options.map((role) => ({
                value: role,
                label: t(`fields.role.${role}`),
              }))}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("actions.cancel")}
              </Button>
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
                {t("actions.confirm")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
