"use client"

import { Button } from "@chatbotx.io/ui/components/ui/button"
import { Input } from "@chatbotx.io/ui/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chatbotx.io/ui/components/ui/table"
import { Eye, Loader2Icon, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useChatStore } from "@/features/chat/store/chat-store-provider"
import { useWorkspaceId } from "@/hooks/routing"
import { deleteSavedReplyAction } from "./actions/delete-saved-reply.action"
import { useSavedReplyStore } from "./provider/saved-reply-store-context"
import { QuickReplyDeleteDialog } from "./quick-reply-delete-dialog"
import { QuickReplyEditor } from "./quick-reply-editor"
import { QuickReplyPreviewDialog } from "./quick-reply-preview-dialog"
import type { SavedReplyResource } from "./schema/resource"
import { useSavedReplyInChat } from "./use-saved-reply-in-chat"

type ViewState =
  | { type: "list" }
  | { type: "create" }
  | { type: "edit"; item: SavedReplyResource }

const QuickRepliesPanel = () => {
  const t = useTranslations()
  const workspaceId = useWorkspaceId()

  const activeConversationId = useChatStore(
    (state) => state.activeConversationId,
  )
  const {
    savedReplies,
    isLoading: isLoadingSavedReplies,
    getAllSavedReplies,
    deleteSavedReply: deleteSavedReplyFromStore,
  } = useSavedReplyStore((state) => state)
  const upsertSavedReply = useSavedReplyStore((state) => state.upsertSavedReply)

  const [search, setSearch] = useState("")
  const [view, setView] = useState<ViewState>({ type: "list" })
  const [previewReply, setPreviewReply] = useState<SavedReplyResource | null>(
    null,
  )
  const [deletingReply, setDeletingReply] = useState<SavedReplyResource | null>(
    null,
  )
  const {
    requestUseInChat,
    confirmUseDialog,
    isSending: isUsingInChat,
  } = useSavedReplyInChat()

  useEffect(() => {
    getAllSavedReplies().catch(() => undefined)
  }, [getAllSavedReplies])

  const filteredSavedReplies = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return savedReplies
    }
    return savedReplies.filter(
      (reply) =>
        (reply.shortcut ?? "").toLowerCase().includes(query) ||
        reply.text.toLowerCase().includes(query),
    )
  }, [savedReplies, search])

  const { executeAsync: executeDelete, isPending: isDeleting } = useAction(
    deleteSavedReplyAction.bind(null, workspaceId, deletingReply?.id ?? ""),
    {
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  const onConfirmDelete = async () => {
    if (!deletingReply) {
      return
    }
    await executeDelete()
    deleteSavedReplyFromStore(deletingReply.id)
    setDeletingReply(null)
    if (view.type === "edit" && view.item.id === deletingReply.id) {
      setView({ type: "list" })
    }
  }

  const editingItem = view.type === "edit" ? view.item : null

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-xl">{t("quickReplies.title")}</h2>
        <Button
          onClick={() => setView({ type: "create" })}
          size="sm"
          type="button"
        >
          <Plus />
          {t("quickReplies.newReply")}
        </Button>
      </div>

      <div className="border-b p-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`${t("actions.search")}...`}
            value={search}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view.type === "create" ? (
          <QuickReplyEditor
            onCancel={() => setView({ type: "list" })}
            onSaved={(item) => {
              upsertSavedReply(item)
            }}
            workspaceId={workspaceId}
          />
        ) : null}
        {view.type === "edit" && editingItem ? (
          <QuickReplyEditor
            editing={editingItem}
            key={editingItem.id}
            onCancel={() => setView({ type: "list" })}
            onSaved={(item) => {
              upsertSavedReply(item)
            }}
            workspaceId={workspaceId}
          />
        ) : null}

        {isLoadingSavedReplies && view.type === "list" ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="animate-spin" />
          </div>
        ) : null}

        {view.type === "list" && !isLoadingSavedReplies ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("quickReplies.shortcutColumn")}</TableHead>
                <TableHead>{t("quickReplies.messageColumn")}</TableHead>
                <TableHead className="w-28">
                  <span className="sr-only">{t("fields.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSavedReplies.map((reply) => (
                <TableRow key={reply.id}>
                  <TableCell className="whitespace-nowrap font-semibold">
                    {reply.shortcut
                      ? `/${reply.shortcut}`
                      : t("quickReplies.noShortcut")}
                  </TableCell>
                  <TableCell className="max-w-96">
                    <p className="truncate">{reply.text}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        onClick={() => setPreviewReply(reply)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Eye />
                      </Button>
                      <Button
                        onClick={() => setView({ type: "edit", item: reply })}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        className="text-destructive"
                        onClick={() => setDeletingReply(reply)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>

      <QuickReplyPreviewDialog
        canUseInChat={Boolean(activeConversationId) && !isUsingInChat}
        onEdit={(reply) => {
          setPreviewReply(null)
          setView({ type: "edit", item: reply })
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewReply(null)
          }
        }}
        onUseInChat={(reply) => {
          setPreviewReply(null)
          requestUseInChat(reply)
        }}
        open={Boolean(previewReply)}
        reply={previewReply}
      />

      <QuickReplyDeleteDialog
        isDeleting={isDeleting}
        onConfirm={onConfirmDelete}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingReply(null)
          }
        }}
        open={Boolean(deletingReply)}
      />

      {confirmUseDialog}
    </div>
  )
}

export { QuickRepliesPanel }
