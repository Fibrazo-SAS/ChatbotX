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
    <div className="relative border-border border-b bg-background p-5 text-center dark:border-border dark:bg-background">
      <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full border-2 border-primary/40 bg-muted font-bold text-2xl text-foreground shadow-inner dark:border-primary/40 dark:bg-muted dark:text-foreground">
        {getClientInitials(client)}
      </div>
      <h1 className="font-bold text-foreground text-xl leading-snug dark:text-foreground">
        {client.full_name?.trim() || t("noData")}
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {client.document_id ? (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-muted px-3 py-1 font-semibold text-foreground text-xs dark:border-border dark:bg-muted dark:text-foreground">
            <span className="truncate">
              {documentShort ? `${documentShort} ` : ""}
              {formattedDocument}
            </span>
            <button
              aria-label={t("documentCopied")}
              className="ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
              onClick={handleCopyDocument}
              title={t("documentCopied")}
              type="button"
            >
              <CopyIcon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        ) : null}
        {client.city ? (
          <div className="rounded-full border border-border/80 bg-muted px-3 py-1 font-semibold text-foreground text-xs dark:border-border dark:bg-muted dark:text-foreground">
            {client.city}
          </div>
        ) : null}
      </div>
      {lastSession ? (
        <div className="mt-2.5 inline-flex items-center gap-1 rounded-xl border border-border bg-muted/90 px-3 py-1 font-medium text-muted-foreground text-xs dark:border-border dark:bg-muted dark:text-muted-foreground">
          <span className="text-muted-foreground dark:text-muted-foreground">{t("lastSessionLabel")}</span>
          <span className="font-bold text-foreground dark:text-foreground">{lastSession}</span>
        </div>
      ) : null}
    </div>
  )
}
