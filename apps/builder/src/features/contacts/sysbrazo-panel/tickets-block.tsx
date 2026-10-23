"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@chatbotx.io/ui/components/ui/collapsible"
import {
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  Loader2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { client } from "@/lib/orpc/orpc"
import type { SysbrazoTicket } from "../schema/sysbrazo-support"
import { formatTicketDate, minutesSince } from "./format-support"

/**
 * Bloque "Tickets" del panel (#15466): hasta 3 tickets visibles (abiertos
 * primero, luego por fecha) con "Ver más (N restantes)" que trae el resto.
 *
 * El ticket abierto se resalta (fondo rojo claro + barra lateral). Toda la
 * fila abre el ticket en el sistema de origen (pestaña nueva). "No
 * verificado" se muestra solo cuando NINGÚN proveedor respondió; si al menos
 * uno verificó, se listan sus tickets sin inventar un total.
 */

const INITIAL_VISIBLE = 3
const LOAD_MORE_PAGE_SIZE = 50

type TicketsState =
  | { status: "loading" }
  | { status: "ok"; items: SysbrazoTicket[]; total: number }
  | { status: "unverified" }
  | { status: "error" }
  | { status: "notFound" }

const TicketStatusBadge = ({ ticket }: { ticket: SysbrazoTicket }) => {
  const t = useTranslations("sysbrazoPanel")

  if (!ticket.is_open) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-[10px] text-emerald-700 uppercase tracking-wide">
        <CheckIcon aria-hidden="true" className="size-3" />
        {t("tickets.finished")}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-[10px] text-amber-700">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-600" />
      {ticket.status?.trim() || t("tickets.inProgress")}
    </span>
  )
}

const TicketRow = ({ ticket }: { ticket: SysbrazoTicket }) => {
  const t = useTranslations("sysbrazoPanel")
  const updatedMinutes = minutesSince(ticket.updated_at)

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-normal text-slate-500 text-xs">
            {t("tickets.numberLabel")}
          </span>
          <span className="font-bold text-slate-900 text-sm">
            {ticket.display_id ?? ticket.id}
          </span>
          <TicketStatusBadge ticket={ticket} />
        </div>
        <ExternalLinkIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-slate-300"
        />
      </div>

      {ticket.title?.trim() ? (
        <h3 className="font-semibold text-[13px] text-slate-900 leading-snug">
          {ticket.title.trim()}
        </h3>
      ) : null}

      {ticket.team?.trim() ? (
        <p className="text-slate-600 text-xs">
          <span className="font-normal text-slate-500">
            {t("tickets.teamLabel")}
          </span>{" "}
          <span className="font-medium text-slate-800">
            {ticket.team.trim()}
          </span>
        </p>
      ) : null}

      <p className="font-normal text-slate-500 text-xs">
        {formatTicketDate(ticket.opened_at)}
        {ticket.city?.trim() ? ` · ${ticket.city.trim()}` : ""}
        {ticket.is_massive
          ? ` · ${t("tickets.affectedClients", {
              count: ticket.affected_clients ?? 0,
            })}`
          : ` · ${t("tickets.individual")}`}
        {ticket.is_open && updatedMinutes !== null
          ? ` · ${t("tickets.updatedAgo", { minutes: updatedMinutes })}`
          : ""}
      </p>
    </>
  )

  const baseClass = `px-4 py-2.5 transition-colors ${
    ticket.is_open
      ? "relative border-s-4 border-s-red-500 bg-red-50/40"
      : "bg-white hover:bg-slate-50/60"
  }`

  if (ticket.url) {
    return (
      <a
        className={`${baseClass} block`}
        href={ticket.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    )
  }

  return <div className={baseClass}>{content}</div>
}

export const TicketsBlock = ({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}) => {
  const t = useTranslations("sysbrazoPanel")
  const [state, setState] = useState<TicketsState>({ status: "loading" })
  const [loadingMore, setLoadingMore] = useState(false)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    const seq = ++requestSeqRef.current
    setState({ status: "loading" })

    client.contactsAPIs
      .getSysbrazoTicketsAuthenticatedAPI({
        workspaceId,
        contactId,
        page: 1,
        perPage: INITIAL_VISIBLE,
      })
      .then((res) => {
        if (requestSeqRef.current !== seq) {
          return
        }
        if (!res.found) {
          setState({ status: "notFound" })
          return
        }
        const providers = res.providers ?? []
        if (providers.length > 0 && providers.every((p) => !p.verified)) {
          setState({ status: "unverified" })
          return
        }
        setState({ status: "ok", items: res.items, total: res.total })
      })
      .catch(() => {
        if (requestSeqRef.current === seq) {
          setState({ status: "error" })
        }
      })

    return () => {
      // Cambio de contacto: descarta respuestas en vuelo del cliente anterior.
      requestSeqRef.current += 1
    }
  }, [workspaceId, contactId])

  const handleLoadMore = async () => {
    if (state.status !== "ok" || loadingMore) {
      return
    }
    setLoadingMore(true)
    try {
      const res = await client.contactsAPIs.getSysbrazoTicketsAuthenticatedAPI({
        workspaceId,
        contactId,
        page: 2,
        perPage: LOAD_MORE_PAGE_SIZE,
      })
      if (!res.found) {
        return
      }
      setState((current) =>
        current.status === "ok"
          ? { status: "ok", items: res.items, total: res.total }
          : current,
      )
    } catch {
      // El resto no pudo cargarse: se mantiene lo ya visible, sin falsear el
      // total (el botón sigue mostrando los restantes).
    } finally {
      setLoadingMore(false)
    }
  }

  const remaining =
    state.status === "ok" ? Math.max(0, state.total - state.items.length) : 0

  return (
    <Collapsible className="mx-4 mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-2 border-slate-100 border-b bg-white px-4 py-3">
        <span className="font-bold text-slate-900 text-sm tracking-wide">
          {t("tickets.title")}
        </span>
        <CollapsibleTrigger className="group text-slate-400 transition-colors hover:text-slate-600">
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="border-slate-100 border-t">
          {state.status === "loading" ? (
            <p className="flex items-center justify-center gap-1.5 px-4 py-4 font-medium text-slate-400 text-xs">
              <Loader2Icon
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
              {t("tickets.loading")}
            </p>
          ) : null}

          {state.status === "unverified" ? (
            <p className="px-4 py-4 text-slate-600 text-xs">
              {t("tickets.notVerified")}
            </p>
          ) : null}

          {state.status === "error" ? (
            <p className="px-4 py-4 text-red-600 text-xs">
              {t("tickets.error")}
            </p>
          ) : null}

          {state.status === "notFound" ? (
            <p className="px-4 py-4 text-slate-600 text-xs">
              {t("tickets.notFound")}
            </p>
          ) : null}

          {state.status === "ok" && state.items.length === 0 ? (
            <p className="px-4 py-4 text-slate-600 text-xs">
              {t("tickets.empty")}
            </p>
          ) : null}

          {state.status === "ok" && state.items.length > 0 ? (
            <>
              <div className="divide-y divide-slate-100">
                {state.items.map((ticket) => (
                  <TicketRow
                    key={`${ticket.provider}-${ticket.id}`}
                    ticket={ticket}
                  />
                ))}
              </div>

              {remaining > 0 ? (
                <div className="flex justify-center border-slate-100 border-t p-3">
                  <button
                    className="w-full rounded-lg border border-slate-300 px-4 py-1.5 font-medium text-slate-700 text-xs shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
                    disabled={loadingMore}
                    onClick={handleLoadMore}
                    type="button"
                  >
                    {loadingMore ? (
                      <Loader2Icon
                        aria-hidden="true"
                        className="mx-auto size-3.5 animate-spin"
                      />
                    ) : (
                      t("tickets.seeMore", { count: remaining })
                    )}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
