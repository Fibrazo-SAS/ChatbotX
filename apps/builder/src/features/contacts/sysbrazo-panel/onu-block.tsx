"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@chatbotx.io/ui/components/ui/collapsible"
import {
  ChevronDownIcon,
  RefreshCwIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import type {
  SysbrazoOnuPower,
  SysbrazoOnuStatus,
} from "../schema/sysbrazo-client"
import { formatIsoDisplay } from "./format"

/**
 * Bloque "Estado de la ONU" (ticket #15467). Se carga aparte y asíncrono del
 * resto del panel (`include_onu`): mientras llega muestra un skeleton dentro
 * de una card propia, acoplada a la card principal y colapsable. Espeja el
 * `CpeTechnicalStatus` de Sysbrazo (guía del equipo): píldora UP/DOWN/LOS,
 * tags de `registrationStates` cuando está caída, grilla de métricas en
 * línea (RX Power (DN), RX Power (UP), TX Power (UP), Uptime, OLT, Puerto,
 * Board, Equipos conectados) y diagnóstico offline (OLT/Puerto/Board/Última
 * caída). El botón "Refrescar" re-consulta con `force_onu`.
 */

type OnuState = "up" | "down" | "los" | "unknown"

type PowerTone = SysbrazoOnuPower["status"]

const statePillClass: Record<OnuState, string> = {
  up: "border-emerald-200 bg-emerald-100 text-emerald-800",
  down: "border-red-200 bg-red-100 text-red-700",
  los: "border-red-200 bg-red-100 text-red-700",
  unknown: "border-slate-200 bg-slate-100 text-slate-600",
}

const stateLabelKey: Record<OnuState, string> = {
  up: "onu.stateUp",
  down: "onu.stateDown",
  los: "onu.stateLos",
  unknown: "noData",
}

const resolveOnuState = (state: string | null | undefined): OnuState => {
  if (state === "up") {
    return "up"
  }
  if (state === "down") {
    return "down"
  }
  if (state === "los") {
    return "los"
  }
  return "unknown"
}

const powerPillClass: Record<string, string> = {
  ok: "border-emerald-200 bg-emerald-100 text-emerald-800",
  warning: "border-amber-200 bg-amber-100 text-amber-800",
  critical: "border-red-200 bg-red-100 text-red-700",
}

const powerLabelKey: Record<string, string> = {
  ok: "onu.powerOk",
  warning: "onu.powerWarning",
  critical: "onu.powerCritical",
}

/** Celda métrica del grid: card chica centrada, label arriba, valor + tono. */
const MetricCell = ({
  label,
  value,
  tone,
}: {
  label: string
  value: string | null
  tone?: PowerTone
}) => {
  const t = useTranslations("sysbrazoPanel")

  if (!value) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-white px-2 py-3 text-center shadow-sm ring-1 ring-slate-100">
      <span className="font-medium text-[10px] text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center justify-center gap-1.5">
        <span className="truncate font-bold text-slate-800 text-sm">
          {value}
        </span>
        {tone && tone in powerLabelKey ? (
          <span
            className={`shrink-0 rounded-full border px-1.5 py-px font-bold text-[9px] ${powerPillClass[tone]}`}
          >
            {t(powerLabelKey[tone])}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Celda skeleton mientras la ONU se consulta (mismo layout centrado). */
const MetricSkeleton = () => (
  <div className="flex animate-pulse flex-col items-center justify-center gap-1.5 rounded-xl bg-white px-2 py-3 ring-1 ring-slate-100">
    <div className="h-2 w-14 rounded bg-slate-100" />
    <div className="h-3.5 w-16 rounded bg-slate-100" />
  </div>
)

const powerValue = (
  power: SysbrazoOnuPower | null | undefined,
): string | null => power?.value?.trim() || null

export const OnuBlock = ({
  onu,
  refreshing,
  onRefresh,
}: {
  onu: SysbrazoOnuStatus | null | undefined
  refreshing?: boolean
  onRefresh?: () => void
}) => {
  const t = useTranslations("sysbrazoPanel")
  const state = resolveOnuState(onu?.state ?? null)
  const isOnline = state === "up"
  const isLoading = onu === undefined
  const registrationStates = onu?.registrationStates ?? []

  return (
    <Collapsible className="mx-4 mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-2 border-slate-100 border-b bg-white px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-900 text-sm tracking-wide">
            {t("onu.title")}
          </span>
          {!isLoading && onu ? (
            <span
              aria-hidden="true"
              className={`inline-block size-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`}
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md bg-emerald-800 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-emerald-900 disabled:opacity-60"
            disabled={refreshing || isLoading}
            onClick={onRefresh}
            type="button"
          >
            <RefreshCwIcon
              aria-hidden="true"
              className={`size-3 ${refreshing ? "animate-spin" : ""}`}
            />
            {t("onu.refresh")}
          </button>
          <CollapsibleTrigger className="group text-slate-400 transition-colors hover:text-slate-600">
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 transition-transform group-data-[panel-open]:rotate-180"
            />
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="space-y-3 px-4 py-4">
          {isLoading ? (
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-1.5 font-medium text-slate-400 text-xs">
                <RefreshCwIcon
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
                {t("onu.loading")}
              </p>
              <div className="grid grid-cols-2 gap-2 max-[299px]:grid-cols-1">
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
              </div>
            </div>
          ) : null}
          {!isLoading && onu ? (
            <div className="space-y-3">
              {/* Estado principal centrado y destacado */}
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white px-3 py-4 text-center shadow-sm ring-1 ring-slate-100">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold text-xs tracking-wide ${statePillClass[state]}`}
                >
                  {isOnline ? (
                    <WifiIcon aria-hidden="true" className="size-3.5" />
                  ) : (
                    <WifiOffIcon aria-hidden="true" className="size-3.5" />
                  )}
                  {t(stateLabelKey[state])}
                </span>
                {!isOnline && registrationStates.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {registrationStates.map((s) => (
                      <span
                        className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-[10px] text-red-700 uppercase tracking-wide"
                        key={s}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {isOnline ? (
                <div className="grid grid-cols-2 gap-2 text-xs max-[299px]:grid-cols-1">
                  <MetricCell
                    label={t("onu.rxDown")}
                    tone={onu.rxPower?.status}
                    value={powerValue(onu.rxPower)}
                  />
                  <MetricCell
                    label={t("onu.rxUp")}
                    tone={onu.upstreamPower?.status}
                    value={powerValue(onu.upstreamPower)}
                  />
                  <MetricCell
                    label={t("onu.txUp")}
                    tone={onu.txPower?.status}
                    value={powerValue(onu.txPower)}
                  />
                  <MetricCell
                    label={t("onu.uptimeLabel")}
                    value={onu.uptime?.trim() || null}
                  />
                  <MetricCell
                    label={t("onu.oltLabel")}
                    value={onu.olt?.trim() || null}
                  />
                  <MetricCell
                    label={t("onu.portLabel")}
                    value={onu.port == null ? null : String(onu.port)}
                  />
                  <MetricCell
                    label={t("onu.boardLabel")}
                    value={onu.board == null ? null : String(onu.board)}
                  />
                  <MetricCell
                    label={t("onu.connectedDevicesLabel")}
                    value={
                      onu.connectedDevices == null
                        ? null
                        : String(onu.connectedDevices)
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs max-[299px]:grid-cols-1">
                  <MetricCell
                    label={t("onu.oltLabel")}
                    value={onu.olt?.trim() || null}
                  />
                  <MetricCell
                    label={t("onu.portLabel")}
                    value={onu.port == null ? null : String(onu.port)}
                  />
                  <MetricCell
                    label={t("onu.boardLabel")}
                    value={onu.board == null ? null : String(onu.board)}
                  />
                  <MetricCell
                    label={t("onu.lastDownLabel")}
                    value={
                      onu.lastDownTime
                        ? formatIsoDisplay(onu.lastDownTime)
                        : null
                    }
                  />
                </div>
              )}
            </div>
          ) : null}
          {isLoading || onu ? null : (
            <p className="text-muted-foreground text-xs">{t("onu.noData")}</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
