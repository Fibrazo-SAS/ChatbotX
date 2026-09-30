import { useMemo } from "react"
import { useBusinessHoursStore } from "./business-hours-store-context"

export const useBusinessHoursSelectOptions = (): {
  label: string
  value: string
}[] => {
  const businessHours = useBusinessHoursStore((state) => state.businessHours)

  return useMemo(
    () =>
      businessHours.map((schedule) => ({
        label: schedule.active ? schedule.name : `${schedule.name}`,
        value: schedule.id,
      })),
    [businessHours],
  )
}
