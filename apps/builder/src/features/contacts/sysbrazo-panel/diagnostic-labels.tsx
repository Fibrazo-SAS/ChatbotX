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
  finished: "border-emerald-300 bg-emerald-50 text-emerald-700",
  running: "border-sky-200 bg-sky-50 text-sky-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  error: "border-red-200 bg-red-50 text-red-700",
  canceled: "border-amber-200 bg-amber-50 text-amber-800",
  paused: "border-amber-200 bg-amber-50 text-amber-800",
  delayed: "border-amber-200 bg-amber-50 text-amber-800",
  created: "border-slate-300 bg-slate-100 text-slate-600",
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
