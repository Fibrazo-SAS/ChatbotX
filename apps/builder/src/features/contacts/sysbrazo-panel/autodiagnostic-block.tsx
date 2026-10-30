"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@chatbotx.io/ui/components/ui/collapsible"
import {
  ActivityIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  RefreshCwIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { client } from "@/lib/orpc/orpc"
import type { SysbrazoDiagnosticSummary } from "../schema/sysbrazo-support"
import { AutodiagnosticDialog } from "./autodiagnostic-dialog"
import { AutodiagnosticHistoryDialog } from "./autodiagnostic-history-dialog"
import { DiagnosticStatusPill, sourceLabelKey } from "./diagnostic-labels"
import { formatDiagnosticDate, isStaleCreatedRun } from "./format-support"
import { getReasonLabel } from "./sysbrazo-labels"

/**
 * Bloque "Autodiagnóstico" del panel (#15466): últimas 3 ejecuciones (más
 * reciente primero), botón "Realizar" (solo con permiso explícito
 * `runAutodiagnostic`), pie con Actualizar e historial completo. Mismo look
 * que el portal de Sysbrazo (card blanca, motivo en español por fila,
 * flecha a la derecha).
 *
 * La ejecución real corre en Sysbrazo (origen `chatbotx`): este bloque solo
 * dispara el POST autorizado y sigue el progreso real del run en el diálogo.
 */

type ListState =
  | { status: "loading" }
  | { status: "ok"; items: SysbrazoDiagnosticSummary[]; total: number }
  | { status: "error" }
  | { status: "notFound" }

const LIST_SIZE = 3

/** Estados de una ejecución en curso (mismo set que Sysbrazo). */
const ACTIVE_RUN_STATUSES = new Set<SysbrazoDiagnosticSummary["status"]>([
  "created",
  "running",
  "delayed",
  "paused",
])

/** Motivo en español por ejecución; los finalizados muestran "Sin fallas". */
const runTitle = (
  run: SysbrazoDiagnosticSummary,
  t: (key: string) => string,
): string => {
  if (run.status === "finished") {
    return t("autodiagnostic.noIssues")
  }
  const reason = run.reason?.trim()
  if (reason) {
    return getReasonLabel(reason)
  }
  return "—"
}

export const AutodiagnosticBlock = ({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}) => {
  const t = useTranslations("sysbrazoPanel")
  const [list, setList] = useState<ListState>({ status: "loading" })
  const [canRun, setCanRun] = useState<boolean | null>(null)
  const [starting, setStarting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [dialogRunId, setDialogRunId] = useState<number | null>(null)
  const requestSeqRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++requestSeqRef.current
    setList({ status: "loading" })
    try {
      const res =
        await client.contactsAPIs.getSysbrazoAutodiagnosticsAuthenticatedAPI({
          workspaceId,
          contactId,
          page: 1,
          perPage: LIST_SIZE,
        })
      if (requestSeqRef.current !== seq) {
        return
      }
      setList(
        res.found
          ? { status: "ok", items: res.items, total: res.total }
          : { status: "notFound" },
      )
    } catch {
      if (requestSeqRef.current === seq) {
        setList({ status: "error" })
      }
    }
  }, [workspaceId, contactId])

  useEffect(() => {
    load().catch(() => undefined)
    return () => {
      // Al cambiar de contacto se descarta cualquier respuesta en vuelo.
      requestSeqRef.current += 1
    }
  }, [load])

  useEffect(() => {
    let active = true
    client.contactsAPIs
      .getSysbrazoAutodiagnosticCapabilityAuthenticatedAPI({ workspaceId })
      .then((res) => {
        if (active) {
          setCanRun(res.canRun)
        }
      })
      .catch(() => {
        if (active) {
          setCanRun(false)
        }
      })
    return () => {
      active = false
    }
  }, [workspaceId])

  // La card NO se refresca sola NUNCA. Carga al entrar/al cambiar de
  // contacto, al tocar "Actualizar" y una vez tras mandar un autodiagnóstico.
  // El progreso en vivo se sigue desde el modal de detalle; la card no
  // martilla la red con polling.
  const activeRuns =
    list.status === "ok"
      ? list.items.filter((run) => ACTIVE_RUN_STATUSES.has(run.status))
      : []
  const allActiveStuckCreated =
    activeRuns.length > 0 && activeRuns.every(isStaleCreatedRun)

  const handleStart = async () => {
    if (starting) {
      return
    }
    setStarting(true)
    try {
      const res =
        await client.contactsAPIs.startSysbrazoAutodiagnosticAuthenticatedAPI({
          workspaceId,
          contactId,
        })
      if (res.status === "ok" || res.status === "running") {
        // Un solo refresco: la lista tiene que mostrar el run recién creado.
        load().catch(() => undefined)
        if (res.run_id != null) {
          setDialogRunId(res.run_id)
        }
      } else {
        toast.error(res.message ?? t("autodiagnostic.startError"))
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("autodiagnostic.startError"),
      )
    } finally {
      setStarting(false)
    }
  }

  /** Al terminar la ejecución en el diálogo, la lista se refresca sola. */
  const handleTerminal = useCallback(() => {
    load().catch(() => undefined)
  }, [load])

  const runButton = (
    <button
      aria-label={t("autodiagnostic.run")}
      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground text-xs shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
      disabled={starting}
      onClick={handleStart}
      type="button"
    >
      <ActivityIcon aria-hidden="true" className="size-3.5" />
      {t("autodiagnostic.runShort")}
    </button>
  )

  return (
    <>
      <Collapsible className="mx-4 mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-border dark:bg-card">
        <div className="flex items-center justify-between gap-2 border-border border-b bg-card px-4 py-3 dark:border-border dark:bg-card">
          <span className="truncate font-bold text-foreground text-sm tracking-wide dark:text-foreground">
            {t("autodiagnostic.title")}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {list.status !== "notFound" && canRun === true ? runButton : null}
            <CollapsibleTrigger className="group text-muted-foreground transition-colors hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground">
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-data-[panel-open]:rotate-180"
              />
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-border border-t dark:border-border">
            {list.status === "loading" ? (
              <p className="flex items-center justify-center gap-1.5 px-4 py-4 font-medium text-muted-foreground text-xs dark:text-muted-foreground">
                <RefreshCwIcon
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
                {t("autodiagnostic.loading")}
              </p>
            ) : null}

            {list.status === "error" ? (
              <p className="px-4 py-4 text-center text-destructive text-xs dark:text-destructive">
                {t("autodiagnostic.error")}
              </p>
            ) : null}

            {list.status === "notFound" ? (
              <p className="px-4 py-4 text-muted-foreground text-xs dark:text-muted-foreground">
                {t("autodiagnostic.notFound")}
              </p>
            ) : null}

            {list.status === "ok" && list.items.length === 0 ? (
              <p className="px-4 py-4 text-muted-foreground text-xs dark:text-muted-foreground">
                {t("autodiagnostic.empty")}
              </p>
            ) : null}

            {list.status === "ok" && list.items.length > 0 ? (
              <>
                <div className="divide-y divide-border dark:divide-border">
                  {list.items.map((run) => (
                    <button
                      className="flex w-full cursor-pointer items-center justify-between gap-2 p-4 text-start transition-colors hover:bg-muted/35 dark:hover:bg-muted"
                      key={run.id}
                      onClick={() => setDialogRunId(run.id)}
                      type="button"
                    >
                      <div className="min-w-0 space-y-1 pe-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-normal text-muted-foreground text-xs dark:text-muted-foreground">
                            {t("autodiagnostic.numberLabel")}
                          </span>
                          <span className="font-bold text-foreground text-sm dark:text-foreground">
                            {run.id}
                          </span>
                          <DiagnosticStatusPill status={run.status} />
                        </div>
                        <h3 className="font-semibold text-foreground text-sm dark:text-foreground">
                          {runTitle(run, t)}
                        </h3>
                        <div className="text-muted-foreground text-xs dark:text-muted-foreground">
                          {formatDiagnosticDate(run.started_at)} ·{" "}
                          {t("autodiagnostic.runIn")}{" "}
                          {t(sourceLabelKey[run.source])}
                        </div>
                      </div>
                      <span className="flex-shrink-0 p-1 text-muted-foreground transition-colors hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-foreground">
                        <ArrowRightIcon aria-hidden="true" className="size-4" />
                      </span>
                    </button>
                  ))}
                </div>

                {allActiveStuckCreated ? (
                  <p className="px-4 pt-1 text-center text-amber-600 text-xs dark:text-amber-400">
                    {t("autodiagnostic.staleCreatedHint")}
                  </p>
                ) : null}

                <div className="flex flex-col items-center justify-between gap-2 border-border border-t p-3 sm:flex-row dark:border-border">
                  <button
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-muted/35 sm:w-auto dark:border-border dark:text-foreground dark:hover:bg-muted"
                    onClick={() => load()}
                    type="button"
                  >
                    <RefreshCwIcon
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground dark:text-muted-foreground"
                    />
                    {t("autodiagnostic.update")}
                  </button>
                  <button
                    className="flex w-full items-center justify-center gap-1 py-0.5 font-semibold text-foreground text-xs hover:underline sm:w-auto dark:text-foreground"
                    onClick={() => setHistoryOpen(true)}
                    type="button"
                  >
                    <span className="border-foreground border-b dark:border-border">
                      {t("autodiagnostic.fullHistory")}
                    </span>
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="ms-1 size-3.5"
                    />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {dialogRunId === null ? null : (
        <AutodiagnosticDialog
          contactId={contactId}
          onClose={() => setDialogRunId(null)}
          onTerminal={handleTerminal}
          runId={dialogRunId}
          workspaceId={workspaceId}
        />
      )}

      {historyOpen ? (
        <AutodiagnosticHistoryDialog
          contactId={contactId}
          onClose={() => setHistoryOpen(false)}
          onOpenRun={(runId) => {
            setHistoryOpen(false)
            setDialogRunId(runId)
          }}
          workspaceId={workspaceId}
        />
      ) : null}
    </>
  )
}
