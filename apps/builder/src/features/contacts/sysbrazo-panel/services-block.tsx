"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@chatbotx.io/ui/components/ui/collapsible"
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  MonitorPlayIcon,
  WifiIcon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useCopyToClipboard } from "usehooks-ts"
import type {
  SysbrazoAddon,
  SysbrazoClient,
  SysbrazoTvBox,
} from "../schema/sysbrazo-client"
import { sysbrazoInstallationUrl } from "../sysbrazo-config"
import {
  type AddonState,
  daysSince,
  formatIsoDisplay,
  formatSysbrazoDateDisplay,
  resolveAddonState,
  resolveInternetServiceState,
  type ServiceState,
} from "./format"

/**
 * Estética del mockup del ticket (#15467): filas separadas con divide-y,
 * cajas de ícono `w-11 h-11` con tono por estado, píldoras con ícono
 * (ACTIVO / SUSPENDIDO / INACTIVO) y grilla de detalle TIEMPO RESTANTE /
 * FECHA DE CORTE (o SUSPENDIDO / DESDE).
 */
const iconBoxClass: Record<ServiceState, string> = {
  active: "bg-emerald-50 text-emerald-600",
  expiring: "bg-[#fff8ed] text-[#b45309]",
  suspended: "bg-red-50 text-red-500",
  inactive: "bg-slate-100 text-slate-600",
}

const pillClass: Record<ServiceState, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  expiring: "border-emerald-200 bg-emerald-50 text-emerald-700",
  suspended: "border-red-200 bg-red-50 text-red-600",
  inactive: "border-slate-200 bg-slate-100 text-slate-600",
}

const LOST_STATUS_RE = /lost|perdido/
const RETIRO_STATUS_RE = /retir|withdrawal/

const stateLabelKey: Record<ServiceState, string> = {
  active: "serviceState.active",
  expiring: "serviceState.active",
  suspended: "serviceState.suspended",
  inactive: "serviceState.inactive",
}

const _addonLabelKey: Record<AddonState, string> = {
  active: "serviceState.active",
  expiring: "serviceState.active",
  suspended: "serviceState.suspended",
  inactive: "serviceState.inactive",
}

const StatePill = ({ state }: { state: ServiceState }) => {
  const t = useTranslations("sysbrazoPanel")
  const Icon = state === "suspended" || state === "inactive" ? XIcon : CheckIcon
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 font-bold text-[11px] uppercase tracking-wide ${pillClass[state]}`}
    >
      <Icon aria-hidden="true" className="size-3 stroke-[3]" />
      {t(stateLabelKey[state])}
    </span>
  )
}

/** Píldora de estado de un TV Box (PERDIDO / EN RETIRO) según su status. */
const TvBoxStatusPill = ({ box }: { box: SysbrazoTvBox }) => {
  const t = useTranslations("sysbrazoPanel")
  const status = (box.status ?? "").toLowerCase()

  if (LOST_STATUS_RE.test(status)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 font-bold text-[11px] text-red-600 uppercase tracking-wide">
        <AlertTriangleIcon aria-hidden="true" className="size-3" />
        {t("services.lost")}
      </span>
    )
  }

  if (RETIRO_STATUS_RE.test(status)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#fde68a] bg-[#fff8ed] px-2.5 py-0.5 font-bold text-[#b45309] text-[11px] uppercase tracking-wide">
        <ClockIcon aria-hidden="true" className="size-3" />
        {t("services.retiro")}
      </span>
    )
  }

  return null
}

const TvBoxRow = ({ box, index }: { box: SysbrazoTvBox; index: number }) => {
  const t = useTranslations("sysbrazoPanel")
  const [, copy] = useCopyToClipboard()

  const handleCopy = (serial: string) => {
    copy(serial).then(() => toast.success(t("serialCopied")))
  }

  const isLost = LOST_STATUS_RE.test((box.status ?? "").toLowerCase())

  return (
    <div className="flex flex-col gap-2 border-slate-200 border-t border-dashed bg-slate-50/40 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-800 text-sm">
          {t("services.tvBox")} {index + 1}
        </span>
        <TvBoxStatusPill box={box} />
      </div>
      {isLost ? (
        <p className="font-semibold text-amber-800 text-xs">
          {t("services.lostMessage")}
        </p>
      ) : null}
      <div className="flex items-center gap-2 text-sm">
        {box.serial_number ? (
          <>
            <span className="font-mono font-semibold text-slate-800 text-xs tracking-wider">
              {box.serial_number}
            </span>
            <button
              aria-label={t("serialCopied")}
              className="p-0.5 text-slate-500 transition-colors hover:text-slate-800"
              onClick={() => handleCopy(box.serial_number as string)}
              type="button"
            >
              <CopyIcon aria-hidden="true" className="size-4" />
            </button>
          </>
        ) : null}
        {box.model ? (
          <span className="ml-1 font-medium text-slate-400 text-xs">
            {box.model}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Celda de la grilla de detalle (label en mayúsculas + valor). */
const DetailCell = ({
  label,
  value,
  valueClass = "",
}: {
  label: string
  value: string
  valueClass?: string
}) => (
  <div className="flex min-w-0 flex-col rounded-lg bg-white px-2.5 py-2 shadow-xs ring-1 ring-slate-100">
    <p className="mb-0.5 font-medium text-[10px] text-slate-400 uppercase tracking-wider">
      {label}
    </p>
    <p
      className={`truncate font-semibold text-slate-900 text-sm ${valueClass}`}
    >
      {value}
    </p>
  </div>
)

/** Píldora "A DESIGNAR CUADRILLA" (instalación en curso). */
const CrewPill = () => {
  const t = useTranslations("sysbrazoPanel")
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#fde68a] bg-[#fff8ed] px-2.5 py-1 font-bold text-[#b45309] text-xs">
      <ClockIcon aria-hidden="true" className="size-3.5" />
      {t("services.crewPill")}
    </span>
  )
}

/** Fila de una suscripción add-on (estado y saldo propios). */
const AddonRow = ({ addon }: { addon: SysbrazoAddon }) => {
  const t = useTranslations("sysbrazoPanel")
  const state = resolveAddonState(addon)

  const detailGrid = (() => {
    if (state === "suspended") {
      const days = daysSince(addon.suspended_at)
      return (
        <div className="grid grid-cols-2 gap-2 pl-14 text-xs max-[299px]:grid-cols-1">
          <DetailCell
            label={t("services.suspendedLabel")}
            value={days == null ? t("noData") : t("services.daysAgo", { days })}
            valueClass="font-bold text-red-600"
          />
          <DetailCell
            label={t("services.sinceLabel")}
            value={formatIsoDisplay(addon.suspended_at) || t("noData")}
            valueClass="font-semibold text-slate-600"
          />
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-2 pl-14 text-xs">
        <DetailCell
          label={t("services.remainingTime")}
          value={
            addon.balance_days == null
              ? t("noData")
              : t("services.balanceDays", { days: addon.balance_days })
          }
          valueClass={
            state === "expiring"
              ? "font-bold text-[#b45309]"
              : "font-bold text-slate-900"
          }
        />
        <DetailCell
          label={t("services.cutoffDate")}
          value={formatIsoDisplay(addon.balance_expires_at) || t("noData")}
          valueClass="font-semibold text-slate-600"
        />
      </div>
    )
  })()

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBoxClass[state]}`}
          >
            <MonitorPlayIcon aria-hidden="true" className="size-5" />
          </div>
          <span className="font-semibold text-base text-slate-900">
            {addon.name || t("services.addon")}
          </span>
        </div>
        <StatePill state={state} />
      </div>
      {detailGrid}
    </div>
  )
}

/**
 * Sección "Servicios" (mockup del ticket #15467): filas de Internet y TV con
 * tono según el estado, píldora de estado, grilla de detalle (tiempo
 * restante / fecha de corte o suspendido / desde) y sub-filas de TV Box con
 * serial, modelo y estado. Si el cliente no tiene servicios contratados
 * (lead), muestra el bloque "Sin servicio contratado".
 */
export const ServicesBlock = ({
  baseUrl,
  client,
}: {
  baseUrl?: string
  client: SysbrazoClient
}) => {
  const t = useTranslations("sysbrazoPanel")

  const internetState = resolveInternetServiceState(client)
  const balance = client.balance
  const hasInternet = Boolean(client.internet_plan?.trim())
  const hasTv = Boolean(client.tv_plan?.trim())
  const isLead = !(hasInternet || hasTv)
  const tvBoxes = client.tv_boxes ?? []
  const addons = client.addon_subscriptions ?? []

  const installationStatus = (client.installation_status ?? "").toLowerCase()
  const isUninstall = installationStatus.includes("desinstalar")
  const isCrewPending =
    installationStatus.includes("designar") ||
    installationStatus.includes("curso")

  const remaining = balance?.timeRemainingLabel
  const cutoff = balance?.dateToExpire
    ? formatSysbrazoDateDisplay(balance.dateToExpire)
    : null
  const daysSuspended = balance?.daysSuspended

  const detailGrid = (() => {
    if (internetState === "suspended") {
      return (
        <div className="grid grid-cols-2 gap-2 pl-14 text-xs max-[299px]:grid-cols-1">
          <DetailCell
            label={t("services.suspendedLabel")}
            value={
              daysSuspended == null
                ? t("noData")
                : t("suspendedAgo", { days: daysSuspended })
            }
            valueClass="flex items-center gap-1 font-bold text-red-600"
          />
          <DetailCell
            label={t("services.sinceLabel")}
            value={cutoff ?? t("services.noDateRegistered")}
            valueClass="font-semibold text-slate-600"
          />
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-2 pl-14 text-xs">
        <DetailCell
          label={t("services.remainingTime")}
          value={remaining ?? t("noData")}
          valueClass={
            internetState === "expiring"
              ? "flex items-center gap-1 font-bold text-[#b45309]"
              : "font-bold text-slate-900"
          }
        />
        <DetailCell
          label={t("services.cutoffDate")}
          value={cutoff ?? t("noData")}
          valueClass="font-semibold text-slate-600"
        />
      </div>
    )
  })()

  return (
    <Collapsible className="mx-4 mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-2 border-slate-100 border-b bg-white px-4 py-3">
        <span className="font-bold text-slate-900 text-sm tracking-wide">
          {t("services.title")}
        </span>
        <div className="flex items-center gap-2">
          {baseUrl ? (
            <a
              className="inline-flex items-center gap-1.5 rounded-md bg-[#15803d] px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-[#166534]"
              href={sysbrazoInstallationUrl(baseUrl, String(client.id))}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
              {t("services.goToSysbrazo")}
            </a>
          ) : null}
          <CollapsibleTrigger className="group text-slate-400 transition-colors hover:text-slate-600">
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 transition-transform group-data-[panel-open]:rotate-180"
            />
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="px-4 py-4">
          {isLead ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">
                  {t("services.leadTitle")}
                </span>
                <span className="rounded-full border border-amber-300 bg-amber-100/80 px-3 py-1 font-bold text-amber-800 text-xs uppercase tracking-wider">
                  {t("services.leadPending")}
                </span>
              </div>
              <p className="font-medium text-slate-600 text-sm">
                {t("services.leadMessage")}
              </p>
              <hr className="border-slate-200" />
              <p className="font-medium text-slate-600 text-sm">
                {t("services.noContract")}
              </p>
            </div>
          ) : (
            <div>
              {isUninstall ? (
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">
                      {t("services.salidaLabel")}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#fde68a] bg-[#fff8ed] px-2.5 py-1 font-bold text-[#b45309] text-xs">
                      <ClockIcon aria-hidden="true" className="size-3.5" />
                      {t("services.uninstallPill")}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-slate-500 text-sm">
                    {t("services.uninstallMessage")}
                  </p>
                </div>
              ) : null}
              <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {/* Internet */}
                {hasInternet ? (
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBoxClass[internetState]}`}
                        >
                          <WifiIcon aria-hidden="true" className="size-5" />
                        </div>
                        <span className="font-semibold text-base text-slate-900">
                          {client.internet_plan}
                        </span>
                      </div>
                      {isCrewPending ? (
                        <CrewPill />
                      ) : (
                        <StatePill state={internetState} />
                      )}
                    </div>
                    {isCrewPending ? null : detailGrid}
                  </div>
                ) : null}

                {/* TV */}
                {hasTv ? (
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBoxClass[internetState]}`}
                        >
                          <MonitorPlayIcon
                            aria-hidden="true"
                            className="size-5"
                          />
                        </div>
                        <span className="font-semibold text-base text-slate-900">
                          {client.tv_plan}
                        </span>
                      </div>
                      {isCrewPending ? (
                        <CrewPill />
                      ) : (
                        <StatePill state={internetState} />
                      )}
                    </div>
                    <p className="pl-14 text-slate-500 text-xs">
                      {internetState === "suspended"
                        ? t("services.tvSuspendedByInternet")
                        : t("services.sameCutoffAsInternet")}
                    </p>
                  </div>
                ) : null}

                {/* Addons (saldo y estado propios) */}
                {addons.map((addon) => (
                  <AddonRow addon={addon} key={addon.id ?? addon.name} />
                ))}

                {/* TV Boxes */}
                {hasTv
                  ? tvBoxes.map((box, index) => (
                      <TvBoxRow
                        box={box}
                        index={index}
                        key={box.id ?? box.serial_number ?? index}
                      />
                    ))
                  : null}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
