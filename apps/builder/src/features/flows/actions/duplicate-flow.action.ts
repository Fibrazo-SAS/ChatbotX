"use server"

import { flowService } from "@chatbotx.io/business"
import { auditService } from "@chatbotx.io/business/audit"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClient } from "@/lib/safe-action"

export const duplicateFlowAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .action(async ({ bindArgsParsedInputs: [workspaceId, id] }) => {
    const newFlowId = await flowService.duplicate({ workspaceId, id })
    const duplicated = await flowService.findBy({
      workspaceId,
      id: newFlowId,
    })
    if (duplicated) {
      const t = await getTranslations()

      await auditService.record({
        workspaceId,
        action: "duplicate",
        detail: t("auditLogs.details.flowDuplicated", {
          name: duplicated.name,
        }),
      })
    }
    return newFlowId
  })
