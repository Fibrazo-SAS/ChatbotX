"use client"

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
import { useTranslations } from "next-intl"

type QuickReplyConfirmUseDialogProps = {
  open: boolean
  isSending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const QuickReplyConfirmUseDialog = ({
  open,
  isSending,
  onOpenChange,
  onConfirm,
}: QuickReplyConfirmUseDialogProps) => {
  const t = useTranslations()

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("quickReplies.useInChatTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("quickReplies.useInChatDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isSending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {t("actions.send")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { QuickReplyConfirmUseDialog }
