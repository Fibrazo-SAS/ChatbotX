"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import { HistoryIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { client } from "@/lib/orpc/orpc"
import { formatDiagnosticDate } from "../contacts/sysbrazo-panel/format-support"

type HistoryItem = {
  id: string
  action: string
  detail: string
  createdAt: Date
  user: { name: string | null; email: string } | null
}

/** Etiqueta visible de cada acción de auditoría de variables globales. */
const actionLabelKey = (action: string): string => {
  switch (action) {
    case "bot_field.created":
      return "botFieldHistory.actions.created"
    case "bot_field.updated":
      return "botFieldHistory.actions.updated"
    case "bot_field.deleted":
      return "botFieldHistory.actions.deleted"
    case "bot_field.values_reset":
      return "botFieldHistory.actions.valuesReset"
    default:
      return "botFieldHistory.actions.unknown"
  }
}

/**
 * Historial de auditoría de UNA variable global (#15466): quién creó/quién
 * editó (y qué cambió), más reciente primero. Lee la misma tabla `AuditLog`
 * que la página de auditoría del workspace.
 */
export const BotFieldHistoryDialog = ({
  workspaceId,
  botFieldId,
  botFieldName,
  onClose,
}: {
  workspaceId: string
  botFieldId: string
  botFieldName: string
  onClose: () => void
}) => {
  const t = useTranslations()
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState(false)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const seq = ++requestSeqRef.current

    client.botFieldAPIs
      .getBotFieldHistoryAPI({ workspaceId, botFieldId })
      .then((res) => {
        if (!cancelled && requestSeqRef.current === seq) {
          setItems(res.items)
        }
      })
      .catch(() => {
        if (!cancelled && requestSeqRef.current === seq) {
          setError(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, botFieldId])

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[80vh] max-w-xl gap-0 overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="flex-row items-center justify-between gap-2 border-slate-100 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 font-bold text-slate-900">
            <HistoryIcon aria-hidden="true" className="size-4 text-slate-500" />
            <span>
              {t("botFieldHistory.title")} · {botFieldName}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("botFieldHistory.title")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 p-6">
          {items === null && !error ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              {t("botFieldHistory.loading")}
            </div>
          ) : null}

          {error ? (
            <p className="py-8 text-center text-red-600 text-sm">
              {t("botFieldHistory.error")}
            </p>
          ) : null}

          {items !== null && items.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-sm">
              {t("botFieldHistory.empty")}
            </p>
          ) : null}

          {items !== null && items.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li className="flex items-start gap-3 py-3" key={item.id}>
                  <span className="mt-0.5 inline-flex shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-[11px] text-slate-600">
                    {t(actionLabelKey(item.action))}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm">
                      {item.detail}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {item.user
                        ? t("botFieldHistory.by", {
                            user:
                              item.user.name ||
                              item.user.email ||
                              t("botFieldHistory.unknownUser"),
                          })
                        : t("botFieldHistory.system")}
                      {" · "}
                      {formatDiagnosticDate(
                        new Date(item.createdAt).toISOString(),
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
