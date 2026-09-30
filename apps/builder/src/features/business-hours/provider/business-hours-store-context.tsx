"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react"
import { useStore } from "zustand"
import {
  type BusinessHoursStore,
  createBusinessHoursStore,
} from "./business-hours-store"

export type BusinessHoursStoreApi = ReturnType<typeof createBusinessHoursStore>

export const BusinessHoursStoreContext = createContext<
  BusinessHoursStoreApi | undefined
>(undefined)

export type BusinessHoursStoreProviderProps = {
  workspaceId: string
  children: ReactNode
  autoInitialize?: boolean
}

export const BusinessHoursStoreProvider = ({
  workspaceId,
  autoInitialize = true,
  children,
}: BusinessHoursStoreProviderProps) => {
  const storeRef = useRef<BusinessHoursStoreApi>(null)
  if (!storeRef.current) {
    storeRef.current = createBusinessHoursStore({
      workspaceId,
    })
  }

  useEffect(() => {
    if (storeRef.current && autoInitialize) {
      storeRef.current.getState().initialize()
    }
  }, [autoInitialize])

  return (
    <BusinessHoursStoreContext.Provider value={storeRef.current}>
      {children}
    </BusinessHoursStoreContext.Provider>
  )
}

export const useBusinessHoursStore = <T,>(
  selector: (store: BusinessHoursStore) => T,
): T => {
  const businessHoursStoreContext = useContext(BusinessHoursStoreContext)
  if (!businessHoursStoreContext) {
    throw new Error(
      "useBusinessHoursStore must be used within BusinessHoursStoreProvider",
    )
  }
  return useStore(businessHoursStoreContext, selector)
}
