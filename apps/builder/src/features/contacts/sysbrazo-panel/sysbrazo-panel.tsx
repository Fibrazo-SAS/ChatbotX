"use client"

import { Loader2Icon, UserRoundXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { client } from "@/lib/orpc/orpc"
import type {
  SysbrazoLookupResponse,
  SysbrazoOnuStatus,
} from "../schema/sysbrazo-client"
import { AutodiagnosticBlock } from "./autodiagnostic-block"
import { ContactBlock } from "./contact-block"
import { IdentityBlock } from "./identity-block"
import { NotesBlock } from "./notes-block"
import { OnuBlock } from "./onu-block"
import { ServicesBlock } from "./services-block"
import { TicketsBlock } from "./tickets-block"

/** Card "no registra como cliente": skeleton de la card principal en grande. */
const NotRegisteredCard = () => {
  const t = useTranslations("sysbrazoPanel")

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className="flex flex-col items-center gap-3 px-6 py-10">
        <div className="flex size-14 items-center justify-center rounded-full bg-slate-50 ring-8 ring-slate-50">
          <UserRoundXIcon
            aria-hidden="true"
            className="size-6 text-slate-300"
          />
        </div>
        <p className="font-semibold text-slate-700 text-sm">
          {t("notRegistered")}
        </p>
        <p className="max-w-52 text-center font-medium text-slate-400 text-xs">
          {t("notRegisteredHint")}
        </p>
      </div>
    </div>
  )
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
  documentId,
  lastInteractionAt,
}: {
  workspaceId: string
  contactId: string
  documentId: string | null
  lastInteractionAt?: Date | null
}) => {
  const t = useTranslations("sysbrazoPanel")
  const [data, setData] = useState<SysbrazoLookupResponse | null>(null)
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

  const loadOnu = useCallback(
    async (clientId: string, force: boolean) => {
      const seq = ++onuSeqRef.current

      try {
        const onu = await client.contactsAPIs.getSysbrazoOnuAuthenticatedAPI({
          workspaceId,
          clientId,
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
    [workspaceId],
  )

  const load = useCallback(async () => {
    if (!documentId) {
      setData(null)
      setError(false)
      return
    }

    const seq = ++requestSeqRef.current
    setLoading(true)
    setError(false)

    try {
      const result =
        await client.contactsAPIs.getSysbrazoClientAuthenticatedAPI({
          workspaceId,
          contactId,
        })
      if (requestSeqRef.current === seq) {
        setData(result)
        // La ONU se consulta aparte y asíncrona (endpoint Krill dedicado)
        // para no bloquear la card principal con el snapshot del equipo.
        if (result.found) {
          const clientId = String(result.client.id)
          loadOnu(clientId, false).catch(() => undefined)
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
  }, [workspaceId, contactId, documentId, loadOnu])

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

  const handleRefreshOnu = async () => {
    if (!data?.found) {
      return
    }
    setRefreshingOnu(true)
    try {
      await loadOnu(String(data.client.id), true)
    } finally {
      setRefreshingOnu(false)
    }
  }

  if (!documentId) {
    return <NotRegisteredCard />
  }

  if (loading && !data) {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        {/* Skeleton chico del header del panel */}
        <div className="flex animate-pulse flex-col items-center gap-2 px-6 pt-6 pb-4">
          <div className="size-14 rounded-full bg-slate-100 ring-4 ring-slate-100" />
          <div className="h-3.5 w-32 rounded bg-slate-100" />
          <div className="h-3 w-20 rounded bg-slate-100" />
        </div>
        <div className="flex items-center justify-center gap-2 px-6 py-3">
          <Loader2Icon
            aria-hidden="true"
            className="size-4 animate-spin text-emerald-700"
          />
          <span className="text-center font-medium text-slate-500 text-xs">
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

  if (!data?.found) {
    return <NotRegisteredCard />
  }

  const { client: sysbrazoClient } = data

  return (
    <div className="sysbrazo-panel overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <IdentityBlock
        client={sysbrazoClient}
        lastInteractionAt={lastInteractionAt}
      />
      <ContactBlock client={sysbrazoClient} />
      <ServicesBlock baseUrl={data.baseUrl} client={sysbrazoClient} />
      <OnuBlock
        onRefresh={handleRefreshOnu}
        onu={onu}
        refreshing={refreshingOnu}
      />
      {/* #15466: autodiagnósticos y tickets cargan aparte y asíncronos. */}
      <AutodiagnosticBlock contactId={contactId} workspaceId={workspaceId} />
      <TicketsBlock contactId={contactId} workspaceId={workspaceId} />
      <NotesBlock contactId={contactId} workspaceId={workspaceId} />
    </div>
  )
}
