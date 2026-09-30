import { businessHoursService } from "@chatbotx.io/business"
import type { CheckBusinessHoursStepSchema } from "@chatbotx.io/flow-config"
import { logger } from "../../lib/logger"
import type { ExecuteStepProps } from "./flow-utils"
import type { ExecuteStepResult } from "./step"

/**
 * Branch on one workspace business-hours schedule: `success` when inside,
 * `skip` when outside. No schedule selected (or a deleted one) fails open
 * to `success`, mirroring the "no schedule = always open" rule. On
 * evaluation error we route to `skip`, mirroring `handleCondition`'s
 * route-to-otherwise fallback.
 */
export async function handleCheckBusinessHours(
  props: ExecuteStepProps<CheckBusinessHoursStepSchema>,
): Promise<ExecuteStepResult> {
  const { conversation, step } = props

  try {
    const within = await businessHoursService.isWithinBusinessHours({
      workspaceId: conversation.workspaceId,
      scheduleId: step.scheduleId || undefined,
    })
    return within
      ? { status: "success", result: null }
      : { status: "skip", result: null }
  } catch (error) {
    logger.error(
      { err: error, conversationId: conversation.id, stepId: step.id },
      "[handleCheckBusinessHours] evaluation failed; routing to skip",
    )
    return { status: "skip", result: null }
  }
}
