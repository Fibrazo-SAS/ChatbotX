"use client"

import { Loader2Icon, UserRoundXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { client } from "@/lib/orpc/orpc"
import type {
  SysbrazoConversationLookupResponse,
  SysbrazoOnuStatus,
} from "../schema/sysbrazo-client"
import { AutodiagnosticBlock } from "./autodiagnostic-block"
import { ContactBlock } from "./contact-block"
import { IdentityBlock } from "./identity-block"
import { MultimediaBlock } from "./multimedia-block"
import { NotesBlock } from "./notes-block"
import { OnuBlock } from "./onu-block"
import { ServicesBlock } from "./services-block"
import { TicketsBlock } from "./tickets-block"

/** Card "no registra como cliente": skeleton de la card principal en grande. */
const NotRegisteredCard = () => {
  const t = useTranslations("sysbrazoPanel")

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-black/5 shadow-sm">
      <div className="flex flex-col items-center gap-3 px-6 py-10">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted ring-8 ring-muted">
          <UserRoundXIcon
            aria-hidden="true"
            className="size-6 text-muted-foreground/50"
          />
        </div>
        <p className="font-semibold text-card-foreground text-sm">
          {t("notRegistered")}
        </p>
        <p className="max-w-52 text-center font-medium text-muted-foreground text-xs">
          {t("notRegisteredHint")}
        </p>
      </div>
    </div>
  )
}

const InactiveContextCard = ({
  workspaceId,
  contactId,
  conversationId,
  onContextConfirmed,
}: {
  workspaceId: string
  contactId: string
  conversationId: string
  onContextConfirmed: () => void
}) => {
  const t = useTranslations("sysbrazoPanel")

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-black/5 shadow-sm">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <UserRoundXIcon
          aria-hidden="true"
          className="size-6 text-muted-foreground/50"
        />
        <p className="font-semibold text-card-foreground text-sm">
          {t("inactive.title")}
        </p>
        <p className="max-w-52 font-medium text-muted-foreground text-xs">
          {t("inactive.hint")}
        </p>
      </div>
      <div className="border-border border-t">
        <MultimediaBlock
          contactId={contactId}
          conversationId={conversationId}
          onContextConfirmed={onContextConfirmed}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  )
}

const normalizeInteractionDate = (
  value: Date | string | null | undefined,
): Date | null => {
  if (!value) {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Panel de Sysbrazo (identidad + contacto + servicios + estado ONU) del inbox.
 *
 * Punto de inflexión: si el contacto no tiene `document_id`, no consulta
 * Sysbrazo y muestra "no registra como cliente". Con `document_id`, hace el
 * lookup on-demand vía `getSysbrazoClientAuthenticatedAPI`.
 *
 * Estética: una sola card redondeada con header de identidad centrado y
 * secciones colapsables, según el mockup de referencia del ticket.
 */
export const SysbrazoPanel = ({
  workspaceId,
  contactId,
  conversationId,
  contextRefreshSignal,
  lastInteractionAt,
}: {
  workspaceId: string
  contactId: string
  conversationId: string
  contextRefreshSignal?: unknown
  lastInteractionAt?: Date | string | null
}) => {
  const normalizedLastInteractionAt =
    normalizeInteractionDate(lastInteractionAt)
  const lastInteractionAtMs = normalizedLastInteractionAt?.getTime() ?? null
  const t = useTranslations("sysbrazoPanel")
  const [data, setData] = useState<SysbrazoConversationLookupResponse | null>(
    null,
  )
  const [onu, setOnu] = useState<SysbrazoOnuStatus | null | undefined>(
    undefined,
  )
  const [loading, setLoading] = useState(false)
  const [refreshingOnu, setRefreshingOnu] = useState(false)
  const [error, setError] = useState(false)

  // Guard contra resoluciones fuera de orden: al cambiar de contacto/
  // documento, la última petición emitida gana (una respuesta vieja y lenta
  // no debe pisar los datos del cliente que se está viendo ahora).
  const requestSeqRef = useRef(0)
  const onuSeqRef = useRef(0)
  const previousLastInteractionAtRef = useRef(lastInteractionAtMs)

  const loadOnu = useCallback(
    async (force: boolean) => {
      const seq = ++onuSeqRef.current

      try {
        const onu = await client.contactsAPIs.getSysbrazoOnuAuthenticatedAPI({
          workspaceId,
          contactId,
          conversationId,
          forceOnu: force,
        })
        if (onuSeqRef.current === seq) {
          setOnu(onu)
        }
      } catch {
        if (onuSeqRef.current === seq) {
          setOnu(null)
        }
      }
    },
    [workspaceId, contactId, conversationId],
  )

  const load = useCallback(async () => {
    const seq = ++requestSeqRef.current
    setLoading(true)
    setError(false)

    try {
      const result =
        await client.contactsAPIs.getSysbrazoClientAuthenticatedAPI({
          workspaceId,
          contactId,
          conversationId,
        })
      if (requestSeqRef.current === seq) {
        setData(result)
        // La ONU se consulta aparte y asíncrona (endpoint Krill dedicado)
        // para no bloquear la card principal con el snapshot del equipo.
        if (result.contextStatus === "active" && result.lookup.found) {
          loadOnu(false).catch(() => undefined)
        } else {
          setOnu(null)
        }
      }
    } catch {
      if (requestSeqRef.current === seq) {
        setError(true)
      }
    } finally {
      if (requestSeqRef.current === seq) {
        setLoading(false)
      }
    }
  }, [workspaceId, contactId, conversationId, loadOnu])

  useEffect(() => {
    // Al cambiar de contacto/documento, descartar los datos del cliente
    // anterior de inmediato: nunca mostrar información stale mientras la
    // consulta del nuevo cliente está en vuelo. También invalida cualquier
    // respuesta de ONU pendiente del contacto anterior.
    onuSeqRef.current += 1
    setOnu(undefined)
    setData(null)
    setError(false)
    load().catch(() => {
      // `load` ya maneja el error internamente seteando `error`; este catch
      // solo evita una promesa rechazada sin manejador.
    })
  }, [load])

  useEffect(() => {
    if (contextRefreshSignal !== undefined) {
      load().catch(() => undefined)
    }
  }, [contextRefreshSignal, load])

  useEffect(() => {
    if (previousLastInteractionAtRef.current === lastInteractionAtMs) {
      return
    }
    previousLastInteractionAtRef.current = lastInteractionAtMs
    load().catch(() => undefined)
  }, [lastInteractionAtMs, load])

  const handleRefreshOnu = async () => {
    if (data?.contextStatus !== "active" || !data.lookup.found) {
      return
    }
    setRefreshingOnu(true)
    try {
      await loadOnu(true)
    } finally {
      setRefreshingOnu(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-black/5 shadow-sm">
        {/* Skeleton chico del header del panel */}
        <div className="flex animate-pulse flex-col items-center gap-2 px-6 pt-6 pb-4">
          <div className="size-14 rounded-full bg-muted ring-4 ring-muted" />
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
        <div className="flex items-center justify-center gap-2 px-6 py-3">
          <Loader2Icon
            aria-hidden="true"
            className="size-4 animate-spin text-primary"
          />
          <span className="text-center font-medium text-muted-foreground text-xs">
            {t("loading")}
          </span>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-md border p-3 text-muted-foreground text-sm">
        {t("error")}
      </div>
    )
  }

  if (!data) {
    return <NotRegisteredCard />
  }
  if (data.contextStatus !== "active") {
    return (
      <InactiveContextCard
        contactId={contactId}
        conversationId={conversationId}
        onContextConfirmed={() => load().catch(() => undefined)}
        workspaceId={workspaceId}
      />
    )
  }
  if (!data.lookup.found) {
    return <NotRegisteredCard />
  }

  const { client: sysbrazoClient } = data.lookup

  return (
    <div className="sysbrazo-panel overflow-hidden rounded-2xl border border-border bg-background shadow-black/5 shadow-sm">
      <IdentityBlock
        client={sysbrazoClient}
        lastInteractionAt={normalizedLastInteractionAt}
      />
      <ContactBlock client={sysbrazoClient} />
      <ServicesBlock baseUrl={data.lookup.baseUrl} client={sysbrazoClient} />
      <OnuBlock
        onRefresh={handleRefreshOnu}
        onu={onu}
        refreshing={refreshingOnu}
      />
      {/* #15466: autodiagnósticos y tickets cargan aparte y asíncronos. */}
      <AutodiagnosticBlock contactId={contactId} workspaceId={workspaceId} />
      <TicketsBlock contactId={contactId} workspaceId={workspaceId} />
      <NotesBlock contactId={contactId} workspaceId={workspaceId} />
      <MultimediaBlock
        contactId={contactId}
        conversationId={conversationId}
        onContextConfirmed={() => load().catch(() => undefined)}
        workspaceId={workspaceId}
      />
    </div>
  )
}
