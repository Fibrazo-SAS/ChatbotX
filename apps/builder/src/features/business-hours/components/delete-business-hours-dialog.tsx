"use client"

import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { deleteBusinessHoursAction } from "../actions/delete-business-hours.action"

export function DeleteBusinessHoursDialog({
  workspaceId,
  schedule,
  open,
  onOpenChange,
}: {
  workspaceId: string
  schedule: { id: string; name: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const { execute, isPending } = useAction(
    deleteBusinessHoursAction.bind(null, workspaceId, schedule?.id ?? ""),
    {
      onSuccess: () => {
        toast.success(
          t("messages.deletedSuccess", {
            feature: t("businessHours.singular"),
          }),
        )
        onOpenChange(false)
        router.refresh()
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("messages.deleteFeature", {
              feature: t("businessHours.singular"),
            })}
          </DialogTitle>
          <DialogDescription>
            {t("messages.deleteConfirmation", {
              feature: schedule?.name ?? t("businessHours.singular"),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {t("actions.cancel")}
          </Button>
          <Button
            disabled={isPending || !schedule}
            onClick={() => execute()}
            variant="destructive"
          >
            {isPending && <Loader2Icon className="animate-spin" />}
            {t("actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
