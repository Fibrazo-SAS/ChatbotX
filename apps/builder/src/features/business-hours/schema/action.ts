import {
  businessHoursHolidaysSchema,
  businessHoursIntervalsSchema,
} from "@chatbotx.io/database/partials"
import { z } from "zod"

export const businessHoursNameSchema = z.string().trim().min(1).max(255)

export const createBusinessHoursRequest = z.object({
  name: businessHoursNameSchema,
})
export type CreateBusinessHoursRequest = z.infer<
  typeof createBusinessHoursRequest
>

export const updateBusinessHoursRequest = z.object({
  name: businessHoursNameSchema,
  active: z.boolean(),
  intervals: businessHoursIntervalsSchema,
  holidays: businessHoursHolidaysSchema,
})
export type UpdateBusinessHoursRequest = z.infer<
  typeof updateBusinessHoursRequest
>
