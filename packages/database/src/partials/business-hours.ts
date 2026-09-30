import { z } from "zod"

const TIME_STEP_MINUTES = 15
const DAY_END_MINUTE = 23 * 60 + 59

/**
 * One attention window with per-day toggles (`days[0]` = Sunday).
 * Same 15-minute grid conventions as appointment availability, plus:
 * - `startMinute > endMinute` expresses an overnight window (e.g. 22:00–06:00).
 * - `startMinute === endMinute` is rejected (empty range — drop the interval).
 * - At least one day must be active.
 */
export const businessHoursIntervalSchema = z
  .object({
    startMinute: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - TIME_STEP_MINUTES)
      .multipleOf(15),
    endMinute: z
      .number()
      .int()
      .min(15)
      .max(DAY_END_MINUTE)
      .refine(
        (value) => value === DAY_END_MINUTE || value % TIME_STEP_MINUTES === 0,
        {
          message: "End time must be a 15-minute step or 23:59",
        },
      ),
    days: z.array(z.boolean()).length(7),
  })
  .refine((data) => data.startMinute !== data.endMinute, {
    message:
      "Start and end must differ (use start > end for overnight windows)",
    path: ["endMinute"],
  })
  .refine((data) => data.days.some(Boolean), {
    message: "At least one day must be active",
    path: ["days"],
  })

export const businessHoursIntervalsSchema = z
  .array(businessHoursIntervalSchema)
  .max(28)

export type BusinessHoursInterval = z.infer<typeof businessHoursIntervalSchema>
export type BusinessHoursIntervals = z.infer<
  typeof businessHoursIntervalsSchema
>

const HOLIDAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Closing date in ISO form (`YYYY-MM-DD`); edited as DD-MM-YYYY in the UI. */
export const businessHoursHolidaySchema = z
  .string()
  .regex(HOLIDAY_PATTERN, { message: "Expected YYYY-MM-DD" })
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      )
    },
    { message: "Invalid calendar date" },
  )

export const businessHoursHolidaysSchema = z
  .array(businessHoursHolidaySchema)
  .max(100)
  .refine((dates) => new Set(dates).size === dates.length, {
    message: "Duplicate holidays",
  })

export type BusinessHoursHolidays = z.infer<typeof businessHoursHolidaysSchema>
