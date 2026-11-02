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
import { Pencil, Send } from "lucide-react"
import ImageNext from "next/image"
import { useTranslations } from "next-intl"
import type { SavedReplyResource } from "./schema/resource"

type QuickReplyPreviewDialogProps = {
  open: boolean
  reply: SavedReplyResource | null
  canUseInChat: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (reply: SavedReplyResource) => void
  onUseInChat: (reply: SavedReplyResource) => void
}

const QuickReplyPreviewDialog = ({
  open,
  reply,
  canUseInChat,
  onOpenChange,
  onEdit,
  onUseInChat,
}: QuickReplyPreviewDialogProps) => {
  const t = useTranslations()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reply?.shortcut
              ? `/${reply.shortcut}`
              : t("quickReplies.noShortcut")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("quickReplies.previewDescription")}
          </DialogDescription>
        </DialogHeader>

        {reply ? (
          <div className="space-y-3">
            {reply.text ? (
              <p className="wrap-break-word whitespace-pre-wrap text-sm">
                {reply.text}
              </p>
            ) : null}
            {reply.imageUrl ? (
              <ImageNext
                alt={t("quickReplies.attachedImage")}
                className="max-h-64 w-full rounded-lg object-contain"
                height={256}
                src={reply.imageUrl}
                unoptimized
                width={512}
              />
            ) : null}
            {reply.secondText ? (
              <p className="wrap-break-word whitespace-pre-wrap text-sm">
                {reply.secondText}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            onClick={() => {
              if (reply) {
                onEdit(reply)
              }
            }}
            type="button"
            variant="outline"
          >
            <Pencil />
            {t("actions.edit")}
          </Button>
          <Button
            disabled={!(canUseInChat && reply)}
            onClick={() => {
              if (reply) {
                onUseInChat(reply)
              }
            }}
            type="button"
          >
            <Send />
            {t("quickReplies.useInChat")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { QuickReplyPreviewDialog }
