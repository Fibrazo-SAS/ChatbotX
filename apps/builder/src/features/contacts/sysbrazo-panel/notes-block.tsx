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
  const [open, setOpen] = useState(true)
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
      className={`flex min-w-0 flex-1 items-center justify-center rounded-full border px-3.5 py-1.5 text-xs leading-none ${origin === value ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}
      onClick={() => setOrigin(value)}
      type="button"
    >
      {value === undefined ? t("notes.all") : t(originLabelKey[value])} {count}
    </button>
  )

  return (
    <section className="mx-4 mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-3 border-slate-100 border-b bg-white px-4 py-3">
        <Collapsible onOpenChange={setOpen} open={open}>
          <CollapsibleTrigger
            aria-label={t("notes.toggle")}
            className="flex items-center gap-2 font-bold text-sm"
          >
            {t("notes.title", { count: counts.all })}
            <ChevronDownIcon
              className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent />
        </Collapsible>
        <button
          className="ms-auto inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white text-xs"
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
                className="min-h-24 rounded-lg border border-emerald-700 bg-white p-2 text-xs outline-none transition-colors focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("notes.placeholder")}
                value={draft}
              />
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-lg border px-3 py-1.5 text-xs"
                  onClick={() => setDraft(null)}
                  type="button"
                >
                  {t("notes.cancel")}
                </button>
                <button
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white text-xs"
                  onClick={() => save().catch(() => undefined)}
                  type="button"
                >
                  {t("notes.save")}
                </button>
              </div>
              {actionError === "create" && (
                <p className="text-red-600 text-xs">{t("notes.saveError")}</p>
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
            <p className="text-slate-500 text-sm">{t("notes.empty")}</p>
          )}
          <div className="divide-y divide-slate-200">
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
                      className="min-h-16 w-full rounded-lg border border-emerald-700 bg-white p-2 text-xs outline-none transition-colors focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
                      maxLength={2000}
                      onChange={(event) => setEditingText(event.target.value)}
                      value={editingText}
                    />
                  ) : (
                    <p
                      className={`whitespace-pre-wrap text-sm ${isExpanded ? "" : "line-clamp-2"} ${isOld ? "text-slate-400" : ""}`}
                    >
                      {note.notes}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500 text-xs">
                    <span>{note.author}</span>
                    <span>·</span>
                    <span>{formatIsoDisplay(note.created_at)}</span>
                    <span className="rounded-full border px-2 py-0.5">
                      {t(originLabelKey[note.origin])}
                    </span>
                    {isOld && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase">
                        {t("notes.ancient")}
                      </span>
                    )}
                    {note.edited && <span>{t("notes.edited")}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-slate-500 text-xs">
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
                    <p className="mt-2 text-red-600 text-xs">
                      {t("notes.updateError")}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
          {page < lastPage && (
            <button
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 text-xs transition-colors hover:bg-slate-50"
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
