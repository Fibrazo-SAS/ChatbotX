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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@chatbotx.io/ui/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  Loader2Icon,
  MessageSquareIcon,
  RotateCcwIcon,
  SendHorizonalIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useChatStore } from "@/features/chat/store/chat-store-provider"
import { client } from "@/lib/orpc/orpc"
import { deleteMessageFromMultimediaAction } from "../../messages/actions/delete-message.action"

type Status = "error" | "loading" | "ready"
type Mode = "active" | "trash"
type SenderFilter = "all" | "client" | "team"

type MultimediaItem = {
  id: string
  attachmentId: string
  attachmentCreatedAt: Date
  conversationId: string
  messageCreatedAt: Date
  messageId: string
  readAt: Date | null
  attachment: {
    fileType: string
    mimeType: string
    name: string | null
    size: number
  }
  message: {
    senderType: string
    text: string | null
  }
}

const senderLabelKey = {
  api: "multimedia.sender.team",
  bot: "multimedia.sender.bot",
  contact: "multimedia.sender.client",
  system: "multimedia.sender.team",
  user: "multimedia.sender.advisor",
} as const

const resolveSenderLabelKey = (
  senderType: string,
): (typeof senderLabelKey)[keyof typeof senderLabelKey] =>
  senderLabelKey[senderType as keyof typeof senderLabelKey] ??
  senderLabelKey.system

const isImage = (item: MultimediaItem) => item.attachment.fileType === "image"

const getTimestamp = (value: Date | string): number => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const inactiveContextMessageKey = {
  expired: "multimedia.expired",
  missing: "multimedia.missing",
} as const

const senderFilterMatches = (item: MultimediaItem, filter: SenderFilter) =>
  filter === "all" ||
  (filter === "client"
    ? item.message.senderType === "contact"
    : item.message.senderType !== "contact")

const formatAttachmentDate = (value: Date | string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))

export const MultimediaBlock = ({
  workspaceId,
  contactId,
  conversationId,
  onContextConfirmed,
}: {
  workspaceId: string
  contactId: string
  conversationId: string
  onContextConfirmed?: () => void
}) => {
  const t = useTranslations("sysbrazoPanel")
  const tGlobal = useTranslations()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("active")
  const [status, setStatus] = useState<Status>("loading")
  const [isConfirming, setIsConfirming] = useState(false)
  const [items, setItems] = useState<MultimediaItem[]>([])
  const [counts, setCounts] = useState({ active: 0, deleted: 0 })
  const [contextStatus, setContextStatus] = useState<
    "active" | "expired" | "missing"
  >("active")
  const [viewer, setViewer] = useState<{
    itemId: string
    url: string
  } | null>(null)
  const [messagePendingDelete, setMessagePendingDelete] =
    useState<MultimediaItem | null>(null)
  const [nextCursor, setNextCursor] = useState<{
    createdAt: Date
    id: string
  } | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "file" | "image">("all")
  const [senderFilter, setSenderFilter] = useState<SenderFilter>("all")
  const setActiveConversationId = useChatStore(
    (state) => state.setActiveConversationId,
  )
  const setComposerDraftFiles = useChatStore(
    (state) => state.setComposerDraftFiles,
  )
  const { execute: deleteMessage, isExecuting: isDeletingMessage } = useAction(
    deleteMessageFromMultimediaAction.bind(null, workspaceId),
    {
      onSuccess: () => {
        setMessagePendingDelete(null)
        setViewer(null)
        load().catch(() => undefined)
      },
      onError: () => {
        toast.error(t("multimedia.updateError"))
      },
    },
  )
  const messages = useChatStore((state) => state.messages)
  const recentAttachmentIds = useMemo(() => {
    const now = Date.now()
    const cutoff = now - 24 * 60 * 60 * 1000
    return [
      ...new Set(
        messages
          .filter(
            (message) =>
              message.conversationId === conversationId &&
              getTimestamp(message.createdAt) >= cutoff,
          )
          .flatMap((message) =>
            (message.attachments ?? [])
              .filter((attachment) => {
                const createdAt = getTimestamp(attachment.createdAt)
                return createdAt >= cutoff && createdAt <= now
              })
              .map((attachment) => attachment.id),
          ),
      ),
    ]
  }, [messages, conversationId])
  const latestAttachmentEventKey = useChatStore((state) => {
    const latest = state.messages.at(-1)
    return latest?.conversationId === conversationId &&
      (latest.attachments?.length ?? 0) > 0
      ? `${latest.id}:${String(latest.createdAt)}`
      : null
  })
  const requestSeq = useRef(0)

  useEffect(() => {
    setMode("active")
    setSenderFilter("all")
    setTypeFilter("all")
    setItems([])
    setNextCursor(null)
  }, [])

  const load = useCallback(
    async (append = false, cursor?: { createdAt: Date; id: string } | null) => {
      const seq = ++requestSeq.current
      setStatus("loading")
      try {
        const result =
          mode === "active"
            ? await client.contactsAPIs.getSysbrazoMultimediaAuthenticatedAPI({
                workspaceId,
                contactId,
                conversationId,
                limit: 5,
                cursor: append ? (cursor ?? undefined) : undefined,
              })
            : await client.contactsAPIs.getDeletedSysbrazoMultimediaAuthenticatedAPI(
                {
                  workspaceId,
                  contactId,
                  conversationId,
                },
              )
        if (requestSeq.current !== seq) {
          return
        }
        setItems((current) =>
          append ? [...current, ...result.data] : result.data,
        )
        setCounts(result.counts)
        setContextStatus(result.contextStatus)
        setNextCursor(result.nextCursor)
        setStatus("ready")
      } catch {
        if (requestSeq.current === seq) {
          setStatus("error")
        }
      }
    },
    [workspaceId, contactId, conversationId, mode],
  )

  const confirmContext = useCallback(async () => {
    setIsConfirming(true)
    try {
      const result =
        await client.contactsAPIs.confirmSysbrazoMultimediaContextAuthenticatedAPI(
          {
            workspaceId,
            contactId,
            conversationId,
            attachmentIds: recentAttachmentIds,
          },
        )
      if (!result.found) {
        toast.error(t("multimedia.confirmNotFound"))
        return
      }
      toast.success(
        t("multimedia.confirmSuccess", {
          count: result.associatedCount,
        }),
      )
      await load()
      onContextConfirmed?.()
    } catch {
      toast.error(t("multimedia.confirmError"))
    } finally {
      setIsConfirming(false)
    }
  }, [
    workspaceId,
    contactId,
    conversationId,
    recentAttachmentIds,
    load,
    onContextConfirmed,
    t,
  ])

  useEffect(() => {
    load().catch(() => undefined)
    return () => {
      requestSeq.current += 1
    }
  }, [load])

  // The chat store is fed by the workspace realtime subscription. Refresh only
  // when its active conversation receives an attachment, preserving the current
  // view/filter state rather than subscribing a second socket from this panel.
  useEffect(() => {
    if (latestAttachmentEventKey && open) {
      load().catch(() => undefined)
    }
  }, [latestAttachmentEventKey, load, open])

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (typeFilter === "all" || item.attachment.fileType === typeFilter) &&
          senderFilterMatches(item, senderFilter),
      ),
    [items, senderFilter, typeFilter],
  )
  const senderCounts = useMemo(
    () => ({
      client: items.filter((item) => item.message.senderType === "contact")
        .length,
      team: items.filter((item) => item.message.senderType !== "contact")
        .length,
    }),
    [items],
  )
  const typeCounts = useMemo(
    () => ({
      image: items.filter(isImage).length,
      file: items.filter((item) => !isImage(item)).length,
    }),
    [items],
  )
  const viewerIndex = viewer
    ? filteredItems.findIndex((item) => item.id === viewer.itemId)
    : -1
  const viewerItem = viewerIndex >= 0 ? filteredItems[viewerIndex] : null

  const markRead = useCallback(
    async (multimediaId: string) => {
      await client.contactsAPIs.markSysbrazoMultimediaReadAuthenticatedAPI({
        workspaceId,
        contactId,
        conversationId,
        multimediaId,
      })
      setItems((current) =>
        current.map((item) =>
          item.id === multimediaId ? { ...item, readAt: new Date() } : item,
        ),
      )
    },
    [workspaceId, contactId, conversationId],
  )

  const openDownload = useCallback(
    async (item: MultimediaItem) => {
      try {
        await markRead(item.id)
        const { downloadUrl } =
          await client.contactsAPIs.getSysbrazoMultimediaDownloadAuthenticatedAPI(
            {
              workspaceId,
              contactId,
              conversationId,
              multimediaId: item.id,
            },
          )
        window.open(downloadUrl, "_blank", "noopener,noreferrer")
      } catch {
        toast.error(t("multimedia.downloadError"))
      }
    },
    [workspaceId, contactId, conversationId, markRead, t],
  )

  const openViewer = useCallback(
    async (item: MultimediaItem) => {
      try {
        await markRead(item.id)
        const { downloadUrl } =
          await client.contactsAPIs.getSysbrazoMultimediaDownloadAuthenticatedAPI(
            {
              workspaceId,
              contactId,
              conversationId,
              multimediaId: item.id,
            },
          )
        setViewer({ itemId: item.id, url: downloadUrl })
      } catch {
        toast.error(t("multimedia.downloadError"))
      }
    },
    [workspaceId, contactId, conversationId, markRead, t],
  )

  const stageResend = useCallback(
    async (item: MultimediaItem) => {
      try {
        const { downloadUrl } =
          await client.contactsAPIs.getSysbrazoMultimediaDownloadAuthenticatedAPI(
            {
              workspaceId,
              contactId,
              conversationId,
              multimediaId: item.id,
            },
          )
        const response = await fetch(downloadUrl)
        if (!response.ok) {
          throw new Error("Unable to retrieve multimedia file")
        }
        const file = new File(
          [await response.blob()],
          item.attachment.name ?? "attachment",
          { type: item.attachment.mimeType },
        )
        setComposerDraftFiles([file])
        toast.success(t("multimedia.resendStaged"))
      } catch {
        toast.error(t("multimedia.updateError"))
      }
    },
    [workspaceId, contactId, conversationId, setComposerDraftFiles, t],
  )

  const changeState = useCallback(
    async (
      item: MultimediaItem,
      action: "delete" | "restore" | "permanent",
    ) => {
      try {
        if (action === "delete") {
          await client.contactsAPIs.deleteSysbrazoMultimediaAuthenticatedAPI({
            workspaceId,
            contactId,
            conversationId,
            multimediaId: item.id,
          })
        } else if (action === "restore") {
          await client.contactsAPIs.restoreSysbrazoMultimediaAuthenticatedAPI({
            workspaceId,
            contactId,
            conversationId,
            multimediaId: item.id,
          })
        } else {
          await client.contactsAPIs.permanentlyDeleteSysbrazoMultimediaAuthenticatedAPI(
            {
              workspaceId,
              contactId,
              conversationId,
              multimediaId: item.id,
            },
          )
        }
        await load()
      } catch {
        toast.error(t("multimedia.updateError"))
      }
    },
    [workspaceId, contactId, conversationId, load, t],
  )

  return (
    <Collapsible
      className="mx-4 mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-border dark:bg-card"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between border-border border-b px-4 py-3 text-start font-bold text-foreground text-sm transition-colors hover:bg-muted/35 dark:border-border dark:text-foreground dark:hover:bg-muted">
        <span>{t("multimedia.title")}</span>
        <span className="flex items-center gap-2 text-muted-foreground text-xs dark:text-muted-foreground">
          {counts.active > 0
            ? t("multimedia.count", { count: counts.active })
            : null}
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="bg-muted/35 px-4 pb-4 dark:bg-muted/50">
        {contextStatus !== "active" && status === "ready" ? (
          <div className="flex flex-col items-start gap-2 py-3">
            <p className="text-muted-foreground text-xs dark:text-muted-foreground">
              {t(inactiveContextMessageKey[contextStatus])}
            </p>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground text-xs transition-colors hover:bg-primary/90 disabled:opacity-60"
              disabled={isConfirming}
              onClick={confirmContext}
              type="button"
            >
              {isConfirming ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
              ) : null}
              {t(
                isConfirming
                  ? "multimedia.confirming"
                  : "multimedia.confirmDocument",
              )}
            </button>
          </div>
        ) : null}
        {contextStatus === "active" ? (
          <>
            <div className="space-y-4 py-5">
              <div className="flex flex-wrap gap-2.5">
                {(
                  [
                    ["all", t("multimedia.filters.all"), counts.active],
                    [
                      "client",
                      t("multimedia.sender.client"),
                      senderCounts.client,
                    ],
                    ["team", t("multimedia.sender.team"), senderCounts.team],
                  ] as const
                ).map(([filter, label, count]) => (
                  <button
                    className={`rounded-full border px-3.5 py-2 font-medium text-xs transition-colors ${senderFilter === filter ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
                    key={filter}
                    onClick={() => setSenderFilter(filter)}
                    type="button"
                  >
                    {label} <strong>{count}</strong>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {(
                  [
                    ["all", t("multimedia.filters.all"), counts.active],
                    ["image", t("multimedia.filters.images"), typeCounts.image],
                    [
                      "file",
                      t("multimedia.filters.documents"),
                      typeCounts.file,
                    ],
                  ] as const
                ).map(([filter, label, count]) => (
                  <button
                    className={`rounded-full border px-3.5 py-2 font-medium text-xs transition-colors ${typeFilter === filter ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
                    key={filter}
                    onClick={() => setTypeFilter(filter)}
                    type="button"
                  >
                    {label} <strong>{count}</strong>
                  </button>
                ))}
              </div>
              <button
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${mode === "trash" ? "border-border bg-card font-semibold text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}
                onClick={() => setMode(mode === "active" ? "trash" : "active")}
                type="button"
              >
                {t("multimedia.trash", { count: counts.deleted })}
              </button>
            </div>
            {status === "loading" ? (
              <div className="flex items-center gap-2 py-3 text-muted-foreground text-xs dark:text-muted-foreground">
                <Loader2Icon
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                {t("multimedia.loading")}
              </div>
            ) : null}
            {status === "error" ? (
              <button
                className="py-3 text-primary text-xs hover:underline dark:text-primary"
                onClick={() => load()}
                type="button"
              >
                {t("multimedia.retry")}
              </button>
            ) : null}
            {status === "ready" && filteredItems.length === 0 ? (
              <p className="py-3 text-muted-foreground text-xs dark:text-muted-foreground">
                {t("multimedia.empty")}
              </p>
            ) : null}
            {status === "ready" && filteredItems.length > 0 ? (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <div
                    className="rounded-xl border border-border bg-card p-3 shadow-sm dark:border-border dark:bg-card"
                    key={item.id}
                  >
                    <button
                      aria-label={t("multimedia.open", {
                        name: item.attachment.name ?? t("multimedia.unnamed"),
                      })}
                      className="flex w-full min-w-0 items-start gap-3 text-start"
                      onClick={() => openViewer(item)}
                      type="button"
                    >
                      <span className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-border bg-muted dark:border-border">
                        <FileIcon
                          aria-hidden="true"
                          className={`size-6 ${isImage(item) ? "text-primary" : "text-muted-foreground"}`}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground text-sm">
                          {item.attachment.name ?? t("multimedia.unnamed")}
                          {!item.readAt && mode === "active" ? (
                            <span
                              aria-hidden="true"
                              className="ms-1 inline-block size-1.5 rounded-full bg-primary/80 dark:bg-primary"
                            />
                          ) : null}
                        </span>
                        <span className="mt-1.5 block text-muted-foreground text-xs">
                          <span
                            className={`me-1 inline-flex rounded-full px-2 py-0.5 font-semibold text-xs ${item.message.senderType === "contact" ? "bg-foreground text-background" : "border border-border bg-muted"}`}
                          >
                            {t(resolveSenderLabelKey(item.message.senderType))}
                          </span>
                          {" · "}
                          {formatAttachmentDate(item.attachmentCreatedAt)}
                        </span>
                        <span className="mt-1 block truncate text-muted-foreground text-xs">
                          {item.attachment.mimeType}
                          {" · "}
                          {t("multimedia.size", { size: item.attachment.size })}
                        </span>
                        {item.message.text ? (
                          <span className="mt-1 block truncate text-muted-foreground text-xs italic">
                            “{item.message.text}”
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="mt-3 flex items-center justify-end gap-1 border-border border-t pt-2 dark:border-border">
                      {mode === "active" ? (
                        <>
                          <button
                            aria-label={t("multimedia.download")}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
                            onClick={() => openDownload(item)}
                            type="button"
                          >
                            <DownloadIcon
                              aria-hidden="true"
                              className="size-4"
                            />
                          </button>
                          <button
                            aria-label={t("multimedia.resend")}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
                            onClick={() => stageResend(item)}
                            type="button"
                          >
                            <SendHorizonalIcon
                              aria-hidden="true"
                              className="size-4"
                            />
                          </button>
                          <button
                            aria-label={t("multimedia.viewInChat")}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
                            onClick={() =>
                              setActiveConversationId(item.conversationId)
                            }
                            type="button"
                          >
                            <MessageSquareIcon
                              aria-hidden="true"
                              className="size-4"
                            />
                          </button>
                          <button
                            aria-label={t("multimedia.delete")}
                            className="rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive/80 dark:text-destructive dark:hover:bg-destructive/10 dark:hover:text-destructive/80"
                            onClick={() => changeState(item, "delete")}
                            type="button"
                          >
                            <Trash2Icon aria-hidden="true" className="size-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            aria-label={t("multimedia.restore")}
                            className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10 dark:text-primary dark:hover:bg-primary/10"
                            onClick={() => changeState(item, "restore")}
                            type="button"
                          >
                            <RotateCcwIcon
                              aria-hidden="true"
                              className="size-4"
                            />
                          </button>
                          <button
                            aria-label={t("multimedia.deletePermanently")}
                            className="rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive/80 dark:text-destructive dark:hover:bg-destructive/10 dark:hover:text-destructive/80"
                            onClick={() => changeState(item, "permanent")}
                            type="button"
                          >
                            <Trash2Icon aria-hidden="true" className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {status === "ready" && mode === "active" && nextCursor ? (
              <button
                className="mt-3 w-full rounded border border-border py-1.5 text-muted-foreground text-xs hover:bg-muted/35 dark:border-border dark:text-muted-foreground dark:hover:bg-muted"
                onClick={() => load(true, nextCursor)}
                type="button"
              >
                {t("multimedia.loadMore")}
              </button>
            ) : null}
          </>
        ) : null}
      </CollapsibleContent>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setViewer(null)
          }
        }}
        open={Boolean(viewer && viewerItem)}
      >
        <DialogContent
          className="grid h-[min(90vh,900px)] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-6xl"
          showCloseButton
        >
          {viewer && viewerItem ? (
            <>
              <div className="flex items-center justify-between border-b px-6 py-5">
                <DialogTitle className="truncate pe-4 font-semibold text-lg">
                  {viewerItem.attachment.name ?? t("multimedia.unnamed")}
                </DialogTitle>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <button
                    aria-label={t("multimedia.open", {
                      name:
                        viewerItem.attachment.name ?? t("multimedia.unnamed"),
                    })}
                    className="rounded-lg border p-2 hover:bg-muted disabled:opacity-40"
                    disabled={viewerIndex <= 0}
                    onClick={() => {
                      const previous = filteredItems[viewerIndex - 1]
                      if (previous) {
                        openViewer(previous).catch(() => undefined)
                      }
                    }}
                    type="button"
                  >
                    <ChevronLeftIcon aria-hidden="true" className="size-5" />
                  </button>
                  <span>
                    {viewerIndex + 1} / {filteredItems.length}
                  </span>
                  <button
                    aria-label={t("multimedia.open", {
                      name:
                        viewerItem.attachment.name ?? t("multimedia.unnamed"),
                    })}
                    className="rounded-lg border p-2 hover:bg-muted disabled:opacity-40"
                    disabled={viewerIndex >= filteredItems.length - 1}
                    onClick={() => {
                      const next = filteredItems[viewerIndex + 1]
                      if (next) {
                        openViewer(next).catch(() => undefined)
                      }
                    }}
                    type="button"
                  >
                    <ChevronRightIcon aria-hidden="true" className="size-5" />
                  </button>
                </div>
              </div>
              <iframe
                className="size-full min-h-0 border-0 bg-muted dark:bg-background"
                src={viewer.url}
                title={viewerItem.attachment.name ?? t("multimedia.unnamed")}
              />
              <DialogFooter className="m-0 rounded-none bg-card px-6 py-4 sm:justify-start">
                <button
                  className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm"
                  onClick={() => openDownload(viewerItem)}
                  type="button"
                >
                  {t("multimedia.download")}
                </button>
                <button
                  className="rounded-lg border px-4 py-2 font-semibold text-sm hover:bg-muted"
                  onClick={() => stageResend(viewerItem)}
                  type="button"
                >
                  {t("multimedia.resend")}
                </button>
                <button
                  className="rounded-lg border px-4 py-2 font-semibold text-sm hover:bg-muted"
                  onClick={() => {
                    setActiveConversationId(viewerItem.conversationId)
                    setViewer(null)
                  }}
                  type="button"
                >
                  {t("multimedia.viewInChat")}
                </button>
                <button
                  className="rounded-lg border border-destructive/30 px-4 py-2 font-semibold text-destructive text-sm hover:bg-destructive/10"
                  onClick={() => setMessagePendingDelete(viewerItem)}
                  type="button"
                >
                  {tGlobal("actions.delete")}
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setMessagePendingDelete(null)
          }
        }}
        open={Boolean(messagePendingDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tGlobal("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tGlobal("messages.deleteConfirmation", {
                feature: tGlobal("fields.message.label"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tGlobal("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeletingMessage}
              onClick={() => {
                if (!messagePendingDelete) {
                  return
                }
                deleteMessage({
                  conversationId: messagePendingDelete.conversationId,
                  createdAt: messagePendingDelete.messageCreatedAt,
                  id: messagePendingDelete.messageId,
                })
              }}
            >
              {tGlobal("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  )
}
