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
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-semibold text-[10px] text-primary uppercase tracking-wide dark:border-primary/40 dark:bg-primary/10 dark:text-primary">
        <CheckIcon aria-hidden="true" className="size-3" />
        {t("tickets.finished")}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-semibold text-[10px] text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200">
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
          <span className="font-normal text-muted-foreground text-xs dark:text-muted-foreground">
            {t("tickets.numberLabel")}
          </span>
          <span className="font-bold text-foreground text-sm dark:text-foreground">
            {ticket.display_id ?? ticket.id}
          </span>
          <TicketStatusBadge ticket={ticket} />
        </div>
        <ExternalLinkIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground/50 dark:text-muted-foreground"
        />
      </div>

      {ticket.title?.trim() ? (
        <h3 className="font-semibold text-[13px] text-foreground leading-snug dark:text-foreground">
          {ticket.title.trim()}
        </h3>
      ) : null}

      {ticket.team?.trim() ? (
        <p className="text-muted-foreground text-xs dark:text-muted-foreground">
          <span className="font-normal text-muted-foreground dark:text-muted-foreground">
            {t("tickets.teamLabel")}
          </span>{" "}
          <span className="font-medium text-foreground dark:text-foreground">
            {ticket.team.trim()}
          </span>
        </p>
      ) : null}

      <p className="font-normal text-muted-foreground text-xs dark:text-muted-foreground">
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
      ? "relative border-s-4 border-s-destructive/60 bg-destructive/8 dark:bg-destructive/8"
      : "bg-card hover:bg-muted/45 dark:bg-card dark:hover:bg-muted"
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
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(true)
  const requestSeqRef = useRef(0)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setPage(1)
      setState((current) =>
        current.status === "ok"
          ? { ...current, items: current.items.slice(0, INITIAL_VISIBLE) }
          : current,
      )
    }
  }

  useEffect(() => {
    const seq = ++requestSeqRef.current
    setState({ status: "loading" })
    setPage(1)
    setOpen(true)

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
    const nextPage = page + 1
    try {
      const res = await client.contactsAPIs.getSysbrazoTicketsAuthenticatedAPI({
        workspaceId,
        contactId,
        page: nextPage,
        perPage: INITIAL_VISIBLE,
      })
      if (!res.found) {
        return
      }
      setState((current) =>
        current.status === "ok"
          ? {
              status: "ok",
              items: [...current.items, ...res.items],
              total: res.total,
            }
          : current,
      )
      setPage(nextPage)
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
    <Collapsible
      className="mx-4 mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-border dark:bg-card"
      onOpenChange={handleOpenChange}
      open={open}
    >
      <div className="flex items-center justify-between gap-2 border-border border-b bg-card px-4 py-3 dark:border-border dark:bg-card">
        <span className="font-bold text-foreground text-sm tracking-wide dark:text-foreground">
          {t("tickets.title")}
        </span>
        <CollapsibleTrigger className="group text-muted-foreground transition-colors hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-foreground">
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="border-border border-t dark:border-border">
          {state.status === "loading" ? (
            <p className="flex items-center justify-center gap-1.5 px-4 py-4 font-medium text-muted-foreground text-xs dark:text-muted-foreground">
              <Loader2Icon
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
              {t("tickets.loading")}
            </p>
          ) : null}

          {state.status === "unverified" ? (
            <p className="px-4 py-4 text-muted-foreground text-xs dark:text-muted-foreground">
              {t("tickets.notVerified")}
            </p>
          ) : null}

          {state.status === "error" ? (
            <p className="px-4 py-4 text-destructive text-xs dark:text-destructive">
              {t("tickets.error")}
            </p>
          ) : null}

          {state.status === "notFound" ? (
            <p className="px-4 py-4 text-muted-foreground text-xs dark:text-muted-foreground">
              {t("tickets.notFound")}
            </p>
          ) : null}

          {state.status === "ok" && state.items.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground text-xs dark:text-muted-foreground">
              {t("tickets.empty")}
            </p>
          ) : null}

          {state.status === "ok" && state.items.length > 0 ? (
            <>
              <div className="divide-y divide-border dark:divide-border">
                {state.items.map((ticket) => (
                  <TicketRow
                    key={`${ticket.provider}-${ticket.id}`}
                    ticket={ticket}
                  />
                ))}
              </div>

              {remaining > 0 ? (
                <div className="flex justify-center border-border border-t p-3 dark:border-border">
                  <button
                    className="w-full rounded-lg border border-border px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-muted/35 disabled:opacity-60 sm:w-auto dark:border-border dark:text-foreground dark:hover:bg-muted"
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
