"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@chatbotx.io/ui/components/ui/collapsible"
import { ChevronDownIcon, Loader2Icon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { client } from "@/lib/orpc/orpc"
import type { SysbrazoNote, SysbrazoNoteOrigin } from "../schema/sysbrazo-notes"
import { formatIsoDisplay } from "./format"

const originLabelKey = {
  chat: "notes.chat",
  sysbrazo: "notes.sysbrazo",
} as const

const isOldNote = (createdAt: string | null): boolean => {
  if (!createdAt) {
    return false
  }
  const timestamp = new Date(createdAt).getTime()
  return (
    !Number.isNaN(timestamp) &&
    Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000
  )
}

export const NotesBlock = ({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}) => {
  const t = useTranslations("sysbrazoPanel")
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState<SysbrazoNoteOrigin | undefined>()
  const [notes, setNotes] = useState<SysbrazoNote[]>([])
  const [counts, setCounts] = useState({ all: 0, chat: 0, sysbrazo: 0 })
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [draft, setDraft] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<"create" | "update" | null>(
    null,
  )
  const requestSeq = useRef(0)

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const seq = ++requestSeq.current
      setStatus("loading")
      try {
        const result =
          await client.contactsAPIs.getSysbrazoNotesAuthenticatedAPI({
            workspaceId,
            contactId,
            origin,
            page: nextPage,
          })
        if (requestSeq.current !== seq) {
          return
        }
        if (result) {
          setNotes((current) =>
            append ? [...current, ...result.items] : result.items,
          )
          setCounts(result.counts)
          setLastPage(result.last_page)
        } else {
          setNotes([])
          setCounts({ all: 0, chat: 0, sysbrazo: 0 })
          setLastPage(1)
        }
        setPage(nextPage)
        setStatus("ready")
      } catch {
        if (requestSeq.current === seq) {
          setStatus("error")
        }
      }
    },
    [contactId, origin, workspaceId],
  )

  useEffect(() => {
    setNotes([])
    setDraft(null)
    setEditingId(null)
    load(1, false).catch(() => undefined)
  }, [load])

  const save = async () => {
    if (!draft?.trim()) {
      return
    }
    setActionError(null)
    try {
      const result =
        await client.contactsAPIs.createSysbrazoNoteAuthenticatedAPI({
          workspaceId,
          contactId,
          notes: draft,
        })
      if (result) {
        setDraft(null)
        load(1, false).catch(() => undefined)
      }
    } catch {
      setActionError("create")
    }
  }

  const update = async () => {
    if (!(editingId && editingText.trim())) {
      return
    }
    setActionError(null)
    try {
      await client.contactsAPIs.updateSysbrazoNoteAuthenticatedAPI({
        workspaceId,
        contactId,
        noteId: editingId,
        notes: editingText,
      })
      setEditingId(null)
      load(1, false).catch(() => undefined)
    } catch {
      setActionError("update")
    }
  }

  const filter = (value: SysbrazoNoteOrigin | undefined, count: number) => (
    <button
      className={`flex min-w-0 flex-1 items-center justify-center rounded-full border px-3.5 py-1.5 text-xs leading-none ${origin === value ? "border-primary/40 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/10 dark:text-primary" : "border-border bg-card text-foreground dark:border-border dark:bg-card dark:text-muted-foreground"}`}
      onClick={() => setOrigin(value)}
      type="button"
    >
      {value === undefined ? t("notes.all") : t(originLabelKey[value])} {count}
    </button>
  )

  return (
    <section className="mx-4 mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-border dark:bg-card">
      <div className="flex items-center gap-3 border-border border-b bg-card px-4 py-3 dark:border-border dark:bg-card">
        <Collapsible onOpenChange={setOpen} open={open}>
          <CollapsibleTrigger
            aria-label={t("notes.toggle")}
            className="flex items-center gap-2 font-bold text-sm dark:text-foreground"
          >
            {t("notes.title", { count: counts.all })}
            <ChevronDownIcon
              className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent />
        </Collapsible>
        <button
          className="ms-auto inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground text-xs hover:bg-primary/90"
          onClick={() => {
            setOpen(true)
            setDraft("")
          }}
          type="button"
        >
          <PlusIcon className="size-4" /> {t("notes.new")}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4">
          {draft !== null && (
            <div className="mb-3 flex flex-col gap-2">
              <textarea
                autoFocus
                className="min-h-24 rounded-lg border border-primary/40 bg-card p-2 text-xs outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-emerald-100 dark:border-primary/40 dark:bg-card dark:text-foreground dark:focus:ring-emerald-900 dark:placeholder:text-muted-foreground"
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("notes.placeholder")}
                value={draft}
              />
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-lg border border-border px-3 py-1.5 text-foreground text-xs hover:bg-muted/35 dark:border-border dark:text-foreground dark:hover:bg-muted"
                  onClick={() => setDraft(null)}
                  type="button"
                >
                  {t("notes.cancel")}
                </button>
                <button
                  className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground text-xs hover:bg-primary/90"
                  onClick={() => save().catch(() => undefined)}
                  type="button"
                >
                  {t("notes.save")}
                </button>
              </div>
              {actionError === "create" && (
                <p className="text-destructive text-xs dark:text-destructive">
                  {t("notes.saveError")}
                </p>
              )}
            </div>
          )}
          <div className="my-2 flex w-full items-center justify-evenly gap-2.5">
            {filter(undefined, counts.all)}
            {filter("chat", counts.chat)}
            {filter("sysbrazo", counts.sysbrazo)}
          </div>
          {status === "loading" && notes.length === 0 && (
            <Loader2Icon className="mx-auto my-4 size-4 animate-spin" />
          )}
          {status === "error" && (
            <div className="flex items-center justify-between text-sm">
              <span>{t("notes.error")}</span>
              <button
                className="underline"
                onClick={() => load(1, false).catch(() => undefined)}
                type="button"
              >
                {t("notes.retry")}
              </button>
            </div>
          )}
          {status === "ready" && notes.length === 0 && (
            <p className="text-muted-foreground text-sm dark:text-muted-foreground">
              {t("notes.empty")}
            </p>
          )}
          <div className="divide-y divide-border dark:divide-border">
            {notes.map((note) => {
              const isExpanded = expandedIds.has(note.id)
              const isOld = isOldNote(note.created_at)
              const isExpired = note.edit_deadline
                ? new Date(note.edit_deadline).getTime() <= Date.now()
                : false
              const canExpand = note.notes.length > 100
              return (
                <article className="py-4" key={note.id}>
                  {editingId === note.id ? (
                    <textarea
                      className="min-h-16 w-full rounded-lg border border-primary/40 bg-card p-2 text-xs outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-emerald-100 dark:border-primary/40 dark:bg-card dark:text-foreground dark:focus:ring-emerald-900 dark:placeholder:text-muted-foreground"
                      maxLength={2000}
                      onChange={(event) => setEditingText(event.target.value)}
                      value={editingText}
                    />
                  ) : (
                    <p
                      className={`whitespace-pre-wrap text-sm ${isExpanded ? "" : "line-clamp-2"} ${isOld ? "text-muted-foreground dark:text-muted-foreground" : "text-foreground dark:text-foreground"}`}
                    >
                      {note.notes}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs dark:text-muted-foreground">
                    <span>{note.author}</span>
                    <span>·</span>
                    <span>{formatIsoDisplay(note.created_at)}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 dark:border-border">
                      {t(originLabelKey[note.origin])}
                    </span>
                    {isOld && (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold uppercase dark:bg-muted dark:text-muted-foreground">
                        {t("notes.ancient")}
                      </span>
                    )}
                    {note.edited && <span>{t("notes.edited")}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-muted-foreground text-xs dark:text-muted-foreground">
                    {isExpanded &&
                      note.origin === "chat" &&
                      !note.editable &&
                      isExpired && <span>{t("notes.editClosed")}</span>}
                    {isExpanded &&
                      note.origin === "chat" &&
                      !note.editable &&
                      !isExpired && <span>{t("notes.readOnly")}</span>}
                    {canExpand && (
                      <button
                        className="font-medium underline"
                        onClick={() =>
                          setExpandedIds((current) => {
                            const next = new Set(current)
                            if (next.has(note.id)) {
                              next.delete(note.id)
                            } else {
                              next.add(note.id)
                            }
                            return next
                          })
                        }
                        type="button"
                      >
                        {t(isExpanded ? "notes.close" : "notes.expand")}
                      </button>
                    )}
                    {note.editable && editingId !== note.id && (
                      <button
                        className="font-medium underline"
                        onClick={() => {
                          setActionError(null)
                          setEditingId(note.id)
                          setEditingText(note.notes)
                        }}
                        type="button"
                      >
                        {t("notes.edit")}
                      </button>
                    )}
                    {editingId === note.id && (
                      <>
                        <button
                          className="font-medium underline"
                          onClick={() => setEditingId(null)}
                          type="button"
                        >
                          {t("notes.cancel")}
                        </button>
                        <button
                          className="font-medium underline"
                          onClick={() => update().catch(() => undefined)}
                          type="button"
                        >
                          {t("notes.saveChanges")}
                        </button>
                      </>
                    )}
                  </div>
                  {editingId === note.id && actionError === "update" && (
                    <p className="mt-2 text-destructive text-xs dark:text-destructive">
                      {t("notes.updateError")}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
          {page < lastPage && (
            <button
              className="mt-3 w-full rounded-lg border border-border px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-muted/35 dark:border-border dark:text-foreground dark:hover:bg-muted"
              onClick={() => load(page + 1, true).catch(() => undefined)}
              type="button"
            >
              {t("notes.more")}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
