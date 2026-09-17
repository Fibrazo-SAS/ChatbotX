"use server"

import { flowService, flowVersionService } from "@chatbotx.io/business"
import { auditService } from "@chatbotx.io/business/audit"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import z from "zod"
import { workspaceActionClient } from "@/lib/safe-action"

export const restoreFlowVersionAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(z.object({ versionId: zodBigintAsString() }))
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, flowId],
      parsedInput: { versionId },
    } = props

    const version = await flowVersionService.findById({
      versionId,
      flowId,
      workspaceId,
    })

    await flowVersionService.restore({ version })

    const flow = await flowService.findBy({ workspaceId, id: flowId })
    const t = await getTranslations()

    await auditService.record({
      workspaceId,
      action: "restore",
      detail: t("auditLogs.details.flowRestored", {
        name: flow?.name ?? flowId,
      }),
    })

    return { nodes: version.nodes, edges: version.edges }
  })
