"use server"

import { businessHoursService } from "@chatbotx.io/business"
import { workspaceIdrequestParams } from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { createBusinessHoursRequest } from "../schema/action"

export const createBusinessHoursAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(createBusinessHoursRequest)
  .action(async ({ bindArgsParsedInputs: [workspaceId], parsedInput }) => {
    const row = await businessHoursService.create({
      workspaceId,
      name: parsedInput.name,
    })
    return { id: row.id }
  })
