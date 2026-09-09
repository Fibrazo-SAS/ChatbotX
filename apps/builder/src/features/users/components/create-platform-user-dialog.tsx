"use client"

import { workspaceMemberRoles } from "@chatbotx.io/database/partials"
import { ComboboxField } from "@chatbotx.io/ui/components/form/combobox-field"
import { InputField } from "@chatbotx.io/ui/components/form/input-field"
import { SelectField } from "@chatbotx.io/ui/components/form/select-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { Loader2Icon, UserPlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { createPlatformUserAction } from "../actions/create-platform-user.action"
import { listWorkspacesForAdmin } from "../queries/list-workspaces-for-admin"
import { createPlatformUserRequest } from "../schema/platform-user"

export function CreatePlatformUserDialog() {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

  const { form, handleSubmitWithAction, resetFormAndAction } =
    useHookFormAction(
      createPlatformUserAction,
      zodResolver(createPlatformUserRequest),
      {
        actionProps: {
          onSuccess: () => {
            resetFormAndAction()
            setOpen(false)
            toast.success(t("platformAdmin.users.create.success"))
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
            email: "",
            name: "",
            workspaceId: null,
            role: "agent" as const,
          },
        },
      },
    )

  const workspaceId = form.watch("workspaceId")

  useEffect(() => {
    if (open) {
      loadWorkspaces()
    }
  }, [open, loadWorkspaces])

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button>
            <UserPlusIcon className="size-4" />
            {t("platformAdmin.users.create.button")}
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("platformAdmin.users.create.title")}</DialogTitle>
          <DialogDescription>
            {t("platformAdmin.users.create.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6" onSubmit={handleSubmitWithAction}>
            <InputField
              label={t("fields.name.label")}
              name="name"
              placeholder={t("fields.name.placeholder")}
              required={false}
            />
            <InputField
              label={t("fields.email.label")}
              name="email"
              placeholder={t("fields.email.placeholder")}
              required
              type="email"
            />
            <ComboboxField
              allowClear
              emptyText={t("actions.noRecordFound")}
              label={t("platformAdmin.users.addToWorkspace.workspaceLabel")}
              name="workspaceId"
              options={workspaceOptions}
              placeholder={t("actions.pleaseSelect")}
              required={false}
            />
            {workspaceId ? (
              <SelectField
                label={t("platformAdmin.users.addToWorkspace.roleLabel")}
                name="role"
                options={workspaceMemberRoles.options.map((role) => ({
                  value: role,
                  label: t(`fields.role.${role}`),
                }))}
              />
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => setOpen(false)}
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
