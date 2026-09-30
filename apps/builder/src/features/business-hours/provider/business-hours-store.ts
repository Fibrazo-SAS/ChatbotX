import ky, { HTTPError } from "ky"
import { createStore } from "zustand/vanilla"
import type { ListBusinessHoursForFlowResponse } from "../schema/query"

export type BusinessHoursState = {
  loading: boolean
  error: string | null
  initialized: boolean
  workspaceId: string
  businessHours: ListBusinessHoursForFlowResponse
}

export type BusinessHoursActions = {
  initialize: () => Promise<void>
  getAllBusinessHoursForFlow: () => Promise<void>
}

export type BusinessHoursStore = BusinessHoursState & BusinessHoursActions

export const createBusinessHoursStore = (props: Partial<BusinessHoursState>) =>
  createStore<BusinessHoursStore>((set, get) => ({
    loading: false,
    error: null,
    initialized: false,
    workspaceId: "",
    businessHours: [],
    ...props,

    initialize: async () => {
      const { initialized } = get()

      if (initialized) {
        return
      }

      await get().getAllBusinessHoursForFlow()
      set({ initialized: true })
    },

    getAllBusinessHoursForFlow: async () => {
      const { workspaceId, loading } = get()

      if (loading || !workspaceId) {
        return
      }

      set({ loading: true, error: null })

      try {
        const businessHours = await ky
          .get<ListBusinessHoursForFlowResponse>(
            `/api/workspaces/${workspaceId}/business-hours/for-flow`,
          )
          .json()

        set({ businessHours, loading: false })
      } catch (error: unknown) {
        set({
          error:
            error instanceof HTTPError
              ? error.message
              : "Failed to fetch business hours",
        })
      } finally {
        set({ loading: false })
      }
    },
  }))
