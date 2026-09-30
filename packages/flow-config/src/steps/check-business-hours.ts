import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"
import {
  skipStateDefaultFn,
  skipStateSchema,
  successStateDefaultFn,
  successStateSchema,
} from "../states"
import { stepTypes } from "./step-action"

/**
 * Branch on the workspace business hours (attention schedule).
 * `success` = inside business hours, `skip` = outside (skip is a normal
 * branch here, not an error). References one workspace schedule
 * (`scheduleId`, `""` = none selected yet) — the step carries no time config, only routing states.
 */
export const checkBusinessHoursStepSchema = z.object({
  id: zodBigintAsString(),
  stepType: z.literal(stepTypes.enum.checkBusinessHours),
  scheduleId: zodBigintAsString(),
  states: z.tuple([successStateSchema, skipStateSchema]),
})
export type CheckBusinessHoursStepSchema = z.infer<
  typeof checkBusinessHoursStepSchema
>

export const checkBusinessHoursStepDefaultFn =
  (): CheckBusinessHoursStepSchema => ({
    id: createId(),
    stepType: stepTypes.enum.checkBusinessHours,
    scheduleId: "",
    states: [successStateDefaultFn(), skipStateDefaultFn()],
  })
