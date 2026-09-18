"use server"

import { flowService, flowVersionService } from "@chatbotx.io/business"
import { auditService } from "@chatbotx.io/business/audit"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClient } from "@/lib/safe-action"

export const revertToPublishedAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, flowId],
    } = props

    const { nodes, edges } = await flowVersionService.revertDraftToPublished({
      workspaceId,
      flowId,
    })

    const flow = await flowService.findBy({ workspaceId, id: flowId })
    const t = await getTranslations()

    await auditService.record({
      workspaceId,
      flowId,
      action: "revert",
      detail: t("auditLogs.details.flowReverted", {
        name: flow?.name ?? flowId,
      }),
    })

    return { nodes, edges }
  })
