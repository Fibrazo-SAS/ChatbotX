"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@chatbotx.io/ui/components/ui/dialog"
import {
  ActivityIcon,
  AlertTriangleIcon,
  BanIcon,
  CheckIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { client } from "@/lib/orpc/orpc"
import type {
  SysbrazoDiagnosticDetail,
  SysbrazoDiagnosticStep,
  SysbrazoDiagnosticStepStatus,
} from "../schema/sysbrazo-support"
import { isStaleCreatedRun } from "./format-support"
import {
  BLOCKED_REASONS_AUTO_DIAGNOSTIC,
  formatElapsed,
  getReasonLabel,
  getStepLabel,
  summarizeStepDetails,
} from "./sysbrazo-labels"

/**
 * Diálogo "Autodiagnóstico de Red" (#15466): progreso real de la ejecución
 * (pasos pendientes → en curso → completados, con duración real por paso)
 * y resultado final (correcto / fallido / cancelado), con el look del
 * detalle de Sysbrazo (check/x por paso, caja de resultado con borde
 * lateral y footer con "Cerrar"). Cierra con Esc y devuelve el foco al
 * botón que lo abrió (comportamiento del Dialog base).
 *
 * El cierre NO cancela la ejecución en Sysbrazo: el polling sigue solo
 * mientras el diálogo está abierto; reabrir el detalle reanuda el estado.
 */

const POLL_INITIAL_MS = 3000

/** Tope del backoff: una ejecución clavada no llama más que cada 30 s. */
const POLL_MAX_MS = 30_000

const ACTIVE_STATUSES: SysbrazoDiagnosticDetail["status"][] = [
  "created",
  "running",
  "delayed",
  "paused",
]

/** Paso interno de finalización: no se muestra en la lista de pasos. */
const INTERNAL_STEP_NAMES = new Set(["finalizing"])

const isTerminalStatus = (
  status: SysbrazoDiagnosticDetail["status"],
): boolean => !ACTIVE_STATUSES.includes(status)

const visibleSteps = (
  detail: SysbrazoDiagnosticDetail,
): SysbrazoDiagnosticStep[] =>
  detail.steps.filter((step) => !INTERNAL_STEP_NAMES.has(step.step_name))

/** Marcador por estado de paso (pendiente / en curso / ok / fallo / pausa). */
const StepMarker = ({ status }: { status: SysbrazoDiagnosticStepStatus }) => {
  const t = useTranslations("sysbrazoPanel")

  if (status === "success" || status === "warning") {
    return (
      <CheckIcon
        aria-label={t("diagnosticDialog.stepDone")}
        className="size-4 shrink-0 stroke-[3] text-emerald-600"
      />
    )
  }

  if (status === "failed" || status === "error") {
    return (
      <XIcon
        aria-label={t("diagnosticDialog.stepFailed")}
        className="size-4 shrink-0 stroke-[3] text-red-700"
      />
    )
  }

  if (status === "running") {
    return (
      <span
        aria-label={t("diagnosticDialog.stepRunning")}
        className="flex size-4 shrink-0 animate-pulse items-center justify-center rounded-full border-2 border-emerald-600"
        role="status"
      >
        <span className="size-1.5 rounded-full bg-emerald-600" />
      </span>
    )
  }

  if (status === "paused" || status === "canceled" || status === "delayed") {
    return (
      <AlertTriangleIcon
        aria-label={t("diagnosticDialog.stepPaused")}
        className="size-4 shrink-0 text-amber-600"
      />
    )
  }

  // pending
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full border-2 border-slate-300"
    />
  )
}

const stepLabel = (step: SysbrazoDiagnosticStep): string =>
  getStepLabel(step.step_name)

/** Clase del texto del paso según su estado (sin ternarios anidados). */
const stepTextClass = (
  failed: boolean,
  done: boolean,
  current: boolean,
): string => {
  if (failed) {
    return "font-semibold text-red-800"
  }
  if (done || current) {
    return "font-medium text-slate-900"
  }
  return "font-normal text-slate-700"
}

type ResultTone = "ok" | "error" | "cancel"

const boxToneClass: Record<
  ResultTone,
  { box: string; title: string; icon: string }
> = {
  ok: {
    box: "border-s-emerald-600",
    title: "text-emerald-700",
    icon: "bg-emerald-700 text-white",
  },
  error: {
    box: "border-s-red-600",
    title: "text-red-700",
    icon: "bg-red-600 text-white",
  },
  cancel: {
    box: "border-s-slate-400",
    title: "text-slate-600",
    icon: "bg-slate-500 text-white",
  },
}

const boxToneIcon: Record<
  ResultTone,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
> = {
  ok: CheckIcon,
  error: XIcon,
  cancel: BanIcon,
}

const ResultBox = ({
  tone,
  title,
  children,
  footer,
  withTopMargin = false,
}: {
  tone: ResultTone
  title: string
  children?: React.ReactNode
  footer?: React.ReactNode
  /** Margen extra cuando arriba hay pasos (separación del resultado). */
  withTopMargin?: boolean
}) => {
  const toneClass = boxToneClass[tone]
  const ToneIcon = boxToneIcon[tone]

  return (
    <div
      className={`space-y-2 rounded-2xl border-s-4 bg-slate-100/90 p-5 ${toneClass.box} ${withTopMargin ? "mt-6" : ""}`}
    >
      <div
        className={`flex items-center gap-2 font-extrabold text-base ${toneClass.title}`}
      >
        <span
          className={`flex size-6 items-center justify-center rounded-full text-xs ${toneClass.icon}`}
        >
          <ToneIcon aria-hidden="true" className="size-4 stroke-[3]" />
        </span>
        <span>{title}</span>
      </div>
      {children ? (
        <div className="text-slate-800 text-sm leading-relaxed">{children}</div>
      ) : null}
      {footer ? (
        <p className="pt-1 font-bold text-slate-900 text-sm">{footer}</p>
      ) : null}
    </div>
  )
}

export const AutodiagnosticDialog = ({
  workspaceId,
  contactId,
  runId,
  onClose,
  onTerminal,
}: {
  workspaceId: string
  contactId: string
  runId: number
  onClose: () => void
  /** Se dispara una sola vez al pasar a estado terminal (refresca la lista). */
  onTerminal?: () => void
}) => {
  const t = useTranslations("sysbrazoPanel")
  const [detail, setDetail] = useState<SysbrazoDiagnosticDetail | null>(null)
  const [error, setError] = useState(false)
  const [pollStopped, setPollStopped] = useState(false)
  const terminalNotifiedRef = useRef(false)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    // Backoff: 3s → 6s → 12s → … → 30s. Los runs pueden quedar en
    // "creado"/"demorado" bastante tiempo en Sysbrazo; martillar cada 3s
    // indefinidamente genera un loop de requests gigante sin ganar nada.
    let delay = POLL_INITIAL_MS

    const poll = async () => {
      const seq = ++requestSeqRef.current
      try {
        const next =
          await client.contactsAPIs.getSysbrazoAutodiagnosticDetailAuthenticatedAPI(
            { workspaceId, contactId, runId },
          )
        if (cancelled || requestSeqRef.current !== seq) {
          return
        }
        setDetail(next)
        setError(false)

        if (isTerminalStatus(next.status) && !terminalNotifiedRef.current) {
          terminalNotifiedRef.current = true
          onTerminal?.()
        }

        // "created" pasados 2 min = el worker de Sysbrazo no lo procesó.
        // Cortar el polling: seguir consultando no lo destraba.
        if (
          !isTerminalStatus(next.status) &&
          next.status === "created" &&
          isStaleCreatedRun(next)
        ) {
          setPollStopped(true)
          return
        }

        if (!isTerminalStatus(next.status)) {
          timer = setTimeout(poll, delay)
          delay = Math.min(delay * 2, POLL_MAX_MS)
        }
      } catch {
        if (!cancelled && requestSeqRef.current === seq) {
          setError(true)
        }
        timer = setTimeout(poll, delay)
        delay = Math.min(delay * 2, POLL_MAX_MS)
      }
    }

    poll()
    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [workspaceId, contactId, runId, onTerminal])

  const steps = detail ? visibleSteps(detail) : []
  const status = detail?.status
  const duration =
    detail?.total_duration_seconds == null
      ? null
      : formatElapsed(detail.total_duration_seconds)
  const reason = detail?.reason?.trim() || null
  /** Cancelado antes de arrancar (bloqueo): ningún paso llegó a ejecutarse. */
  const blockedBeforeStart =
    status === "canceled" &&
    (reason ? BLOCKED_REASONS_AUTO_DIAGNOSTIC.has(reason) : false)
  const showSteps =
    steps.length > 0 || status === "running" || status === "created"

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[85vh] max-w-5xl gap-0 overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="flex-row items-center justify-between gap-2 border-slate-100 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
            <ActivityIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-slate-700"
            />
            <span>
              {t("diagnosticDialog.title")}
              {detail ? ` · ${detail.id}` : ""}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("diagnosticDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {/* Cargando el primer snapshot */}
          {detail || error ? null : (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              {t("diagnosticDialog.loading")}
            </div>
          )}

          {/* Sin conexión con el detalle: reintenta solo; no inventa resultado. */}
          {!detail && error ? (
            <p className="py-8 text-center text-red-600 text-sm">
              {t("diagnosticDialog.error")}
            </p>
          ) : null}

          {detail ? (
            <>
              {/* Pasos: el bloqueo previo al arranque los muestra pendientes. */}
              {showSteps ? (
                <div className="space-y-4">
                  {steps.map((step) => {
                    const effectiveStatus = blockedBeforeStart
                      ? "pending"
                      : step.status
                    const done =
                      effectiveStatus === "success" ||
                      effectiveStatus === "warning"
                    const current = effectiveStatus === "running"
                    const failed =
                      effectiveStatus === "failed" ||
                      effectiveStatus === "error"
                    const label = stepLabel(step)
                    const details = summarizeStepDetails(step.details)
                    const executed = done || failed

                    return (
                      <div key={`${step.step_number}-${step.step_name}`}>
                        <div
                          className={`flex items-center gap-2.5 text-sm ${effectiveStatus === "pending" ? "opacity-50" : ""}`}
                        >
                          <StepMarker status={effectiveStatus} />
                          <span
                            className={stepTextClass(failed, done, current)}
                          >
                            {label}
                          </span>
                          {done ? (
                            <span className="font-normal text-slate-500 text-xs">
                              (
                              {step.step_duration_seconds == null
                                ? "—"
                                : formatElapsed(step.step_duration_seconds)}
                              )
                            </span>
                          ) : null}
                        </div>
                        {executed && details ? (
                          <p className="ps-[26px] pt-0.5 font-normal text-slate-500 text-xs">
                            {details}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {/* Resultado final */}
              {status === "finished" ? (
                <ResultBox
                  footer={
                    duration
                      ? t("diagnosticDialog.duration", { duration })
                      : undefined
                  }
                  title={t("diagnosticDialog.allOk")}
                  tone="ok"
                  withTopMargin={steps.length > 0}
                >
                  {t("diagnosticDialog.allOkMessage")}
                </ResultBox>
              ) : null}

              {status === "failed" || status === "error" ? (
                <ResultBox
                  footer={
                    duration
                      ? t("diagnosticDialog.duration", { duration })
                      : undefined
                  }
                  title={t("diagnosticDialog.failed")}
                  tone="error"
                  withTopMargin={steps.length > 0}
                >
                  {reason ? (
                    <p className="font-medium">
                      {t("diagnosticDialog.reason", {
                        reason: getReasonLabel(reason),
                      })}
                    </p>
                  ) : null}
                </ResultBox>
              ) : null}

              {status === "canceled" ? (
                <ResultBox
                  title={t("diagnosticDialog.canceled")}
                  tone="cancel"
                  withTopMargin={steps.length > 0}
                >
                  {reason ? (
                    <p className="font-medium">
                      {t("diagnosticDialog.reason", {
                        reason: getReasonLabel(reason),
                      })}
                    </p>
                  ) : null}
                  {blockedBeforeStart ? (
                    <p className="pt-1 font-extrabold">
                      {t("diagnosticDialog.noSteps")}
                    </p>
                  ) : null}
                </ResultBox>
              ) : null}

              {/* Pausado: estado honesto, no parece ni éxito ni fin. */}
              {status === "paused" ? (
                <ResultBox
                  title={t("diagnosticDialog.paused")}
                  tone="cancel"
                  withTopMargin={steps.length > 0}
                >
                  {reason ? (
                    <p className="font-medium">
                      {t("diagnosticDialog.reason", {
                        reason: getReasonLabel(reason),
                      })}
                    </p>
                  ) : null}
                </ResultBox>
              ) : null}
            </>
          ) : null}
        </div>

        {pollStopped ? (
          <p className="px-6 pb-3 text-center text-amber-600 text-xs">
            {t("autodiagnostic.staleCreatedHint")}
          </p>
        ) : null}

        <div className="flex justify-end border-slate-100 border-t px-6 py-4">
          {isTerminalStatus(status ?? "created") || !detail || pollStopped ? (
            <button
              className="rounded-xl bg-slate-200/90 px-7 py-2.5 font-bold text-slate-800 text-sm transition-colors hover:bg-slate-300/80"
              onClick={onClose}
              type="button"
            >
              {t("diagnosticDialog.close")}
            </button>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-400 text-sm">
              <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
              {t("diagnosticDialog.executing")}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
