"use client"

import { ComboboxField } from "@chatbotx.io/ui/components/form/combobox-field"
import { InputField } from "@chatbotx.io/ui/components/form/input-field"
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
import { Loader2Icon, PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { listPlatformUsers } from "@/features/users/queries/list-platform-users"
import { createAdminWorkspaceAction } from "../actions/create-admin-workspace.action"
import { createAdminWorkspaceRequest } from "../schema/admin-workspace"

export function CreateAdminWorkspaceDialog() {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [ownerOptions, setOwnerOptions] = useState<
    { value: string; label: string }[]
  >([])
  const [usersLoaded, setUsersLoaded] = useState(false)

  const loadUsers = useCallback(async () => {
    if (usersLoaded) {
      return
    }
    try {
      const { data } = await listPlatformUsers({ keyword: null, perPage: 100 })
      setOwnerOptions(
        data.map((user) => ({
          value: user.id,
          label: `${user.name ?? ""} ${user.email}`.trim(),
        })),
      )
      setUsersLoaded(true)
    } catch {
      toast.error(t("platformAdmin.workspaces.loadUsersError"))
    }
  }, [t, usersLoaded])

  const { form, handleSubmitWithAction, resetFormAndAction } =
    useHookFormAction(
      createAdminWorkspaceAction,
      zodResolver(createAdminWorkspaceRequest),
      {
        actionProps: {
          onSuccess: () => {
            resetFormAndAction()
            setOpen(false)
            toast.success(t("platformAdmin.workspaces.createSuccess"))
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
            name: "",
            ownerId: null,
          },
        },
      },
    )

  useEffect(() => {
    if (open) {
      loadUsers()
    }
  }, [open, loadUsers])

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button>
            <PlusIcon className="size-4" />
            {t("platformAdmin.workspaces.create.button")}
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("platformAdmin.workspaces.create.title")}
          </DialogTitle>
          <DialogDescription>
            {t("platformAdmin.workspaces.create.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6" onSubmit={handleSubmitWithAction}>
            <InputField
              label={t("fields.name.label")}
              name="name"
              placeholder={t("platformAdmin.workspaces.namePlaceholder")}
              required
            />
            <ComboboxField
              allowClear
              description={t("platformAdmin.workspaces.ownerHint")}
              emptyText={t("actions.noRecordFound")}
              label={t("platformAdmin.workspaces.owner")}
              name="ownerId"
              options={ownerOptions}
              placeholder={t("actions.pleaseSelect")}
              required={false}
            />
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
