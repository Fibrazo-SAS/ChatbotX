"use server"

import { businessHoursService } from "@chatbotx.io/business"
import { workspaceIdAndIdRequestParams } from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { updateBusinessHoursRequest } from "../schema/action"

export const updateBusinessHoursAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdAndIdRequestParams)
  .inputSchema(updateBusinessHoursRequest)
  .action(async ({ bindArgsParsedInputs: [workspaceId, id], parsedInput }) => {
    await businessHoursService.update({
      workspaceId,
      id,
      name: parsedInput.name,
      active: parsedInput.active,
      intervals: parsedInput.intervals,
      holidays: parsedInput.holidays,
    })
  })
