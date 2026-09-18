"use client"

import { SwitchField } from "@chatbotx.io/ui/components/form/switch-field"
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
import { toast } from "sonner"
import { deactivatePlatformUserAction } from "../actions/deactivate-platform-user.action"
import type { PlatformUserResource } from "../schema/platform-user"
import { deactivatePlatformUserRequest } from "../schema/platform-user"

type DeactivatePlatformUserDialogProps = {
  user: PlatformUserResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeactivatePlatformUserDialog({
  user,
  open,
  onOpenChange,
}: DeactivatePlatformUserDialogProps) {
  const t = useTranslations()
  const router = useRouter()

  const { form, handleSubmitWithAction, resetFormAndAction } =
    useHookFormAction(
      deactivatePlatformUserAction,
      zodResolver(deactivatePlatformUserRequest),
      {
        actionProps: {
          onSuccess: () => {
            resetFormAndAction()
            onOpenChange(false)
            toast.success(t("platformAdmin.users.deactivate.success"))
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
            removeFromWorkspaces: false,
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
            {t("platformAdmin.users.deactivate.title", {
              name: user.name ?? user.email,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("platformAdmin.users.deactivate.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6" onSubmit={handleSubmitWithAction}>
            <SwitchField
              description={t(
                "platformAdmin.users.deactivate.removeFromWorkspacesHint",
              )}
              label={t("platformAdmin.users.deactivate.removeFromWorkspaces")}
              name="removeFromWorkspaces"
              required={false}
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
                disabled={form.formState.isSubmitting}
                size="sm"
                type="submit"
                variant="destructive"
              >
                {form.formState.isSubmitting && (
                  <Loader2Icon className="animate-spin" />
                )}
                {t("platformAdmin.users.deactivate.confirm")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
