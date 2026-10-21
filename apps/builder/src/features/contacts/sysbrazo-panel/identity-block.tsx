"use client"

import { CopyIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useCopyToClipboard } from "usehooks-ts"
import type { SysbrazoClient } from "../schema/sysbrazo-client"
import {
  formatDocumentWithThousands,
  formatLastSession,
  getClientInitials,
  shortenDocumentType,
} from "./format"

/**
 * Cabecera de identidad (mockup del ticket #15467): avatar con iniciales,
 * nombre completo, chip con tipo corto + documento copiable y "última sesión"
 * tomada de ChatbotX (no de Sysbrazo).
 */
export const IdentityBlock = ({
  client,
  lastInteractionAt,
}: {
  client: SysbrazoClient
  lastInteractionAt?: Date | null
}) => {
  const t = useTranslations("sysbrazoPanel")
  const [, copy] = useCopyToClipboard()

  const documentNumber = String(client.document_id ?? "")
  const documentShort = shortenDocumentType(client.document_type)
  const formattedDocument = formatDocumentWithThousands(documentNumber)
  const lastSession = formatLastSession(lastInteractionAt)

  const handleCopyDocument = () => {
    copy(documentNumber).then(() => toast.success(t("documentCopied")))
  }

  return (
    <div className="relative border-slate-100 border-b bg-white p-5 text-center">
      <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-slate-200 font-bold text-2xl text-slate-700 shadow-inner">
        {getClientInitials(client)}
      </div>
      <h1 className="font-bold text-slate-900 text-xl leading-snug">
        {client.full_name?.trim() || t("noData")}
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {client.document_id ? (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-300/80 bg-slate-100 px-3 py-1 font-semibold text-slate-700 text-xs">
            <span className="truncate">
              {documentShort ? `${documentShort} ` : ""}
              {formattedDocument}
            </span>
            <button
              aria-label={t("documentCopied")}
              className="ml-0.5 shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:text-slate-800"
              onClick={handleCopyDocument}
              title={t("documentCopied")}
              type="button"
            >
              <CopyIcon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        ) : null}
        {client.city ? (
          <div className="rounded-full border border-slate-300/80 bg-slate-100 px-3 py-1 font-semibold text-slate-700 text-xs">
            {client.city}
          </div>
        ) : null}
      </div>
      {lastSession ? (
        <div className="mt-2.5 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-1 font-medium text-slate-600 text-xs">
          <span className="text-slate-500">{t("lastSessionLabel")}</span>
          <span className="font-bold text-slate-800">{lastSession}</span>
        </div>
      ) : null}
    </div>
  )
}
