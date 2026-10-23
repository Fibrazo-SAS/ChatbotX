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
  CircleDashedIcon,
  CopyIcon,
  MailIcon,
  PhoneIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useCopyToClipboard } from "usehooks-ts"
import type {
  SysbrazoClient,
  SysbrazoContactValidations,
} from "../schema/sysbrazo-client"
import { formatPhoneDisplay } from "./format"

type ValidationStatus = "validated" | "pending" | "notValidated"

type Validation = SysbrazoContactValidations[keyof SysbrazoContactValidations]

/**
 * Valor nuevo propuesto que espera validación (`pending_value` de Sysbrazo):
 * para teléfonos `{ number, prefix }`, para correo `{ email }`.
 */
const resolvePendingValue = (
  validation: Validation | undefined,
): string | null => {
  const pending = validation?.pending_value
  if (!pending || typeof pending !== "object") {
    return null
  }
  const { email, number, prefix } = pending as {
    email?: unknown
    number?: unknown
    prefix?: unknown
  }
  if (typeof email === "string" && email.trim() !== "") {
    return email.trim()
  }
  if (typeof number === "string" && number.trim() !== "") {
    const prefixLabel = typeof prefix === "string" ? prefix.trim() : ""
    return `${prefixLabel} ${number.trim()}`.trim()
  }
  return null
}

/** Píldora del mockup: emerald "✓ VALIDADO" / ámbar "⚠ PENDIENTE" / gris "○ SIN VALIDAR". */
const ValidationPill = ({ status }: { status: ValidationStatus }) => {
  const t = useTranslations("sysbrazoPanel")
  if (status === "validated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-bold text-[11px] text-emerald-700 uppercase tracking-wide">
        <CheckIcon aria-hidden="true" className="size-3 stroke-[3]" />
        {t("validation.validated")}
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-bold text-[11px] text-amber-700 uppercase tracking-wide">
        <AlertTriangleIcon aria-hidden="true" className="size-3" />
        {t("validation.pending")}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-bold text-[11px] text-slate-500 uppercase tracking-wide">
      <CircleDashedIcon aria-hidden="true" className="size-3" />
      {t("validation.notValidated")}
    </span>
  )
}

/**
 * Sección "Contacto" (mockup del ticket): filas de dos líneas — arriba label
 * con ícono + píldora de validación, abajo valor + copiar — separadas por
 * borde sutil. Estado de validación desde `contact_validations` de Sysbrazo.
 */
export const ContactBlock = ({ client }: { client: SysbrazoClient }) => {
  const t = useTranslations("sysbrazoPanel")
  const [, copy] = useCopyToClipboard()

  const rows: Array<{
    icon: typeof PhoneIcon
    label: string
    value: string
    copyValue: string | null
    copyToast: string
    status: ValidationStatus
    pendingValue: string | null
  }> = [
    {
      icon: PhoneIcon,
      label: t("contact.primary"),
      value: formatPhoneDisplay(client.primary_phone),
      copyValue: client.primary_phone?.trim() || null,
      copyToast: t("phoneCopied"),
      // El principal refleja su estado de validación real: si Sysbrazo marca
      // el número actual como validado, muestra VALIDADO aunque exista un
      // cambio pendiente de validar (el pendiente es el NUEVO número).
      status:
        client.primary_phone_validated === true
          ? "validated"
          : (client.contact_validations?.phone_number?.status ??
            "notValidated"),
      pendingValue: resolvePendingValue(
        client.contact_validations?.phone_number,
      ),
    },
    {
      icon: PhoneIcon,
      label: t("contact.alternate"),
      value: formatPhoneDisplay(client.alt_phone),
      copyValue: client.alt_phone?.trim() || null,
      copyToast: t("phoneCopied"),
      status:
        client.contact_validations?.phone_number_alt?.status ?? "notValidated",
      pendingValue: resolvePendingValue(
        client.contact_validations?.phone_number_alt,
      ),
    },
    {
      icon: MailIcon,
      label: t("contact.email"),
      value: client.email?.trim() ?? "",
      copyValue: client.email?.trim() || null,
      copyToast: t("emailCopied"),
      status: client.contact_validations?.email?.status ?? "notValidated",
      pendingValue: resolvePendingValue(client.contact_validations?.email),
    },
  ]

  const handleCopy = (value: string, toastKey: string) => {
    copy(value.replace(/\s/g, "")).then(() => toast.success(toastKey))
  }

  return (
    <div className="mb-4 border-slate-100 border-b">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group flex w-full cursor-pointer select-none items-center justify-between p-4 hover:bg-slate-50">
          <span className="font-bold text-slate-900 text-sm tracking-wide">
            {t("contact.title")}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 text-slate-400 transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 px-4 pb-4 text-xs">
            {rows.map((row, index) => (
              <div
                className={
                  index > 0
                    ? "space-y-1 border-slate-50 border-t pt-1"
                    : "space-y-1"
                }
                key={row.label}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <row.icon aria-hidden="true" className="size-3.5" />
                    {row.label}
                  </span>
                  <ValidationPill status={row.status} />
                </div>
                <div className="flex items-center justify-between pl-5 font-semibold text-slate-800">
                  <span className="truncate pr-2">
                    {row.value || (
                      <span className="font-normal text-muted-foreground">
                        {t("noData")}
                      </span>
                    )}
                  </span>
                  {row.copyValue ? (
                    <button
                      aria-label={row.copyToast}
                      className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
                      onClick={() =>
                        handleCopy(row.copyValue as string, row.copyToast)
                      }
                      type="button"
                    >
                      <CopyIcon aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                {row.status === "pending" && row.pendingValue ? (
                  <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1 pl-5 font-medium text-[11px] text-amber-700">
                    <AlertTriangleIcon
                      aria-hidden="true"
                      className="mt-px size-3 shrink-0"
                    />
                    <span>
                      {t("validation.pendingChange", {
                        value: row.pendingValue,
                      })}
                    </span>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
