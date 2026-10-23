"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import { ActivityIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { client } from "@/lib/orpc/orpc"
import type { SysbrazoDiagnosticSummary } from "../schema/sysbrazo-support"
import { DiagnosticStatusPill } from "./diagnostic-labels"
import { formatDiagnosticDate } from "./format-support"

/**
 * Historial completo de autodiagnósticos (#15466): scroll infinito real —
 * arranca con una página de 50 y trae la siguiente solo cuando el pie de la
 * lista entra en pantalla (rootMargin adelantado para que nunca se espere).
 * Columnas alineadas a la izquierda, sin franjas de color.
 */

const HISTORY_PAGE_SIZE = 50

const tableHeadClass =
  "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-start font-semibold text-slate-500 text-xs"
const tableCellClass = "px-4 py-2.5 text-xs"

export const AutodiagnosticHistoryDialog = ({
  workspaceId,
  contactId,
  onClose,
  onOpenRun,
}: {
  workspaceId: string
  contactId: string
  onClose: () => void
  onOpenRun: (runId: number) => void
}) => {
  const t = useTranslations("sysbrazoPanel")
  const [items, setItems] = useState<SysbrazoDiagnosticSummary[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestSeqRef = useRef(0)

  const hasMore = total !== null && items.length < total

  const loadMore = useCallback(async () => {
    if (
      initialLoading ||
      loadingMore ||
      total === null ||
      items.length >= total
    ) {
      return
    }
    const nextPage = Math.floor(items.length / HISTORY_PAGE_SIZE) + 1
    const seq = ++requestSeqRef.current
    setLoadingMore(true)
    try {
      const res =
        await client.contactsAPIs.getSysbrazoAutodiagnosticsAuthenticatedAPI({
          workspaceId,
          contactId,
          page: nextPage,
          perPage: HISTORY_PAGE_SIZE,
        })
      if (requestSeqRef.current !== seq) {
        return
      }
      if (res.found) {
        setItems((current) => [...current, ...res.items])
        setTotal(res.total)
      }
    } catch {
      // Se mantiene lo ya cargado; al volver a pasar por el pie se reintenta.
    } finally {
      if (requestSeqRef.current === seq) {
        setLoadingMore(false)
      }
    }
  }, [workspaceId, contactId, initialLoading, loadingMore, total, items.length])

  // Primera página al abrir: solo 50; el resto llega por scroll.
  useEffect(() => {
    let cancelled = false
    const seq = ++requestSeqRef.current
    setInitialLoading(true)
    setError(false)
    setItems([])
    setTotal(null)

    client.contactsAPIs
      .getSysbrazoAutodiagnosticsAuthenticatedAPI({
        workspaceId,
        contactId,
        page: 1,
        perPage: HISTORY_PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled || requestSeqRef.current !== seq) {
          return
        }
        if (!res.found) {
          setItems([])
          setTotal(0)
          return
        }
        setItems(res.items)
        setTotal(res.total)
      })
      .catch(() => {
        if (!cancelled && requestSeqRef.current === seq) {
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled && requestSeqRef.current === seq) {
          setInitialLoading(false)
        }
      })

    return () => {
      cancelled = true
      requestSeqRef.current += 1
    }
  }, [workspaceId, contactId])

  // El pie de la lista dispara la página siguiente al entrar en pantalla.
  useEffect(() => {
    const container = containerRef.current
    const sentinel = sentinelRef.current
    if (!(container && sentinel && hasMore) || initialLoading) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore()
        }
      },
      { root: container, rootMargin: "240px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, initialLoading, loadMore])

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="flex max-h-[90vh] max-w-[90vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-6xl">
        <DialogHeader className="flex-row items-center justify-between gap-2 border-slate-100 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 font-extrabold text-slate-900">
            <ActivityIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-slate-700"
            />
            {t("diagnosticHistory.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("diagnosticHistory.title")}
          </DialogDescription>
        </DialogHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto bg-white"
          ref={containerRef}
        >
          <table className="w-full text-start text-xs">
            <thead>
              <tr>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.id")}
                </th>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.odoo")}
                </th>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.redmine")}
                </th>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.user")}
                </th>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.status")}
                </th>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.start")}
                </th>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.end")}
                </th>
                <th className={tableHeadClass}>
                  {t("diagnosticHistory.columns.details")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {items.map((run) => (
                <tr className="group hover:bg-slate-50/70" key={run.id}>
                  <td
                    className={`${tableCellClass} font-semibold text-slate-900`}
                  >
                    <button
                      className="underline-offset-2 transition-colors hover:text-emerald-700 hover:underline"
                      onClick={() => onOpenRun(run.id)}
                      type="button"
                    >
                      {run.id}
                    </button>
                  </td>
                  <td className={tableCellClass}>
                    {run.odoo_ticket_id ?? t("diagnosticHistory.dash")}
                  </td>
                  <td className={tableCellClass}>
                    {run.redmine_issue_id ?? t("diagnosticHistory.dash")}
                  </td>
                  <td
                    className={`${tableCellClass} font-medium text-slate-700`}
                  >
                    {run.user_name ?? t("diagnosticHistory.na")}
                  </td>
                  <td className={tableCellClass}>
                    <DiagnosticStatusPill status={run.status} />
                  </td>
                  <td className={`${tableCellClass} whitespace-nowrap`}>
                    {run.started_at
                      ? formatDiagnosticDate(run.started_at)
                      : t("diagnosticHistory.na")}
                  </td>
                  <td className={`${tableCellClass} whitespace-nowrap`}>
                    {run.finished_at
                      ? formatDiagnosticDate(run.finished_at)
                      : t("diagnosticHistory.na")}
                  </td>
                  <td className={`${tableCellClass} text-start`}>
                    <button
                      aria-label={t("diagnosticHistory.columns.details")}
                      className="inline-flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700"
                      onClick={() => onOpenRun(run.id)}
                      type="button"
                    >
                      <ExternalLinkIcon
                        aria-hidden="true"
                        className="size-3.5"
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {initialLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-xs">
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              {t("diagnosticHistory.loading")}
            </div>
          ) : null}

          {!(initialLoading || error) && items.length === 0 ? (
            <p className="py-10 text-center text-slate-500 text-xs">
              {t("autodiagnostic.empty")}
            </p>
          ) : null}

          {error && items.length === 0 ? (
            <p className="py-10 text-center text-red-600 text-xs">
              {t("autodiagnostic.error")}
            </p>
          ) : null}

          {hasMore ? (
            <div
              className="flex items-center justify-center gap-2 border-slate-100 border-t py-4 text-slate-400 text-xs"
              ref={sentinelRef}
            >
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              {t("diagnosticHistory.loading")}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-slate-100 border-t bg-white px-6 py-3">
          <span className="text-slate-500 text-xs">
            {t("diagnosticHistory.showing", {
              from: items.length === 0 ? 0 : 1,
              to: items.length,
              total: total ?? 0,
            })}
          </span>
          <button
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 font-semibold text-slate-700 text-xs shadow-sm transition-colors hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            {t("diagnosticDialog.close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
