"use server"

import { appointmentCalendarService } from "@chatbotx.io/business"
import { getAuditActor, SYSTEM_ACTOR } from "@chatbotx.io/business/audit"
import { workspaceIdrequestParams } from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { createAppointmentCalendarRequest } from "../schema/action"

export const createAppointmentCalendarAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(createAppointmentCalendarRequest)
  .action(async ({ bindArgsParsedInputs: [workspaceId], parsedInput }) => {
    const actorUserId = getAuditActor()?.userId
    return {
      id: await appointmentCalendarService.create({
        workspaceId,
        name: parsedInput.name,
        publishedById:
          actorUserId && actorUserId !== SYSTEM_ACTOR ? actorUserId : null,
      }),
    }
  })
