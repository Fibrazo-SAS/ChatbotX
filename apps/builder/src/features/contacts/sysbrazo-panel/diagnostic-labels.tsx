"use client"

import { AlertTriangleIcon, CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type {
  SysbrazoDiagnosticSource,
  SysbrazoDiagnosticStatus,
} from "../schema/sysbrazo-support"

/**
 * Etiquetas compartidas del bloque Autodiagnóstico (#15466): píldora de
 * estado por ejecución y nombre visible del origen (Portal / Bot / Sysbrazo
 * / ChatbotX). Paleta y formato iguales al portal de Sysbrazo: emerald
 * finalizado, sky en curso, red fallo/error, amber cancelado/pausado/
 * demorado y slate creado.
 */

const pillClassByStatus: Record<SysbrazoDiagnosticStatus, string> = {
  finished:
    "border-primary/40 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/10 dark:text-primary",
  running:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  failed:
    "border-destructive/35 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/12 dark:text-destructive",
  error:
    "border-destructive/35 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/12 dark:text-destructive",
  canceled:
    "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200",
  paused:
    "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200",
  delayed:
    "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200",
  created:
    "border-border bg-muted text-muted-foreground dark:border-border dark:bg-muted dark:text-muted-foreground",
}

const statusIconByStatus: Record<
  SysbrazoDiagnosticStatus,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
> = {
  finished: CheckIcon,
  failed: XIcon,
  error: XIcon,
  canceled: AlertTriangleIcon,
  paused: AlertTriangleIcon,
  delayed: AlertTriangleIcon,
  running: Loader2Icon,
  created: Loader2Icon,
}

export const DiagnosticStatusPill = ({
  status,
}: {
  status: SysbrazoDiagnosticStatus
}) => {
  const t = useTranslations("sysbrazoPanel")
  const Icon = statusIconByStatus[status]

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-semibold text-[11px] uppercase tracking-wide ${pillClassByStatus[status]}`}
    >
      <Icon
        aria-hidden="true"
        className={`size-3.5 ${status === "running" || status === "created" ? "animate-spin" : ""}`}
      />
      {t(`diagnosticStatus.${status}`)}
    </span>
  )
}

/** Clave de traducción del origen (el panel muestra "Bot" para WhatsApp). */
export const sourceLabelKey: Record<SysbrazoDiagnosticSource, string> = {
  portal: "diagnosticSource.portal",
  whatsapp: "diagnosticSource.bot",
  sysbrazo: "diagnosticSource.sysbrazo",
  chatbotx: "diagnosticSource.chatbotx",
}
