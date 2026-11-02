"use client"

import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useChatStore } from "@/features/chat/store/chat-store-provider"
import { useWorkspaceId } from "@/hooks/routing"
import { useSavedReplyInChatAction } from "./actions/use-saved-reply-in-chat.action"
import { QuickReplyConfirmUseDialog } from "./quick-reply-confirm-use-dialog"
import type { SavedReplyResource } from "./schema/resource"

export type UseSavedReplyInChat = {
  /**
   * Sends every part of the reply (text, image, second text) to the active
   * conversation. By default it asks for confirmation first (the "Use in
   * chat" flow from the ticket); pass `{ confirm: false }` for entry points
   * that already imply the send (composer shortcut and bubble popover).
   */
  requestUseInChat: (
    reply: SavedReplyResource,
    options?: { confirm?: boolean },
  ) => void
  confirmUseDialog: React.ReactNode
  isSending: boolean
}

/**
 * Shared "use in chat" flow for every entry point that sends a quick reply:
 * the Quick replies tab, the composer bubble popover, and the "/" shortcut
 * popover.
 */
export const useSavedReplyInChat = (): UseSavedReplyInChat => {
  const t = useTranslations()
  const workspaceId = useWorkspaceId()
  const activeConversationId = useChatStore(
    (state) => state.activeConversationId,
  )
  const [pendingReply, setPendingReply] = useState<SavedReplyResource | null>(
    null,
  )
  const [skipConfirmation, setSkipConfirmation] = useState(false)

  const { execute, isExecuting } = useAction(
    useSavedReplyInChatAction.bind(
      null,
      workspaceId,
      pendingReply?.id ?? "",
      activeConversationId ?? "",
    ),
    {
      onSuccess: ({ data }) => {
        setPendingReply(null)
        setSkipConfirmation(false)
        if (data?.status === "windowClosed") {
          toast.error(t("quickReplies.useInChatWindowClosed"))
          return
        }
        if (data?.status === "partial") {
          toast.warning(
            t("quickReplies.useInChatPartial", {
              sent: data.sentParts.length,
              total: data.totalParts,
            }),
          )
          return
        }
        toast.success(t("quickReplies.useInChatSent"))
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  // Composer shortcut/bubble flow: send as soon as the action is bound with
  // the pending reply's ids, without showing the confirmation dialog.
  // `execute` is kept in a ref on purpose: it is recreated on every render
  // (the bound action closure changes), so depending on it directly would
  // re-fire this effect and send the reply repeatedly (send loop). The id
  // guard guarantees a single send per request even if the effect re-runs.
  const executeRef = useRef(execute)
  useEffect(() => {
    executeRef.current = execute
  }, [execute])

  const autoSentIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      pendingReply &&
      skipConfirmation &&
      autoSentIdRef.current !== pendingReply.id
    ) {
      autoSentIdRef.current = pendingReply.id
      executeRef.current()
    }
  }, [pendingReply, skipConfirmation])

  const requestUseInChat = (
    reply: SavedReplyResource,
    options?: { confirm?: boolean },
  ) => {
    if (!activeConversationId) {
      toast.error(t("quickReplies.useInChatNoConversation"))
      return
    }
    autoSentIdRef.current = null
    setPendingReply(reply)
    setSkipConfirmation(options?.confirm === false)
  }

  return {
    requestUseInChat,
    isSending: isExecuting,
    confirmUseDialog: (
      <QuickReplyConfirmUseDialog
        isSending={isExecuting}
        onConfirm={() => {
          if (pendingReply) {
            execute()
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingReply(null)
            setSkipConfirmation(false)
          }
        }}
        open={Boolean(pendingReply) && !skipConfirmation}
      />
    ),
  }
}
