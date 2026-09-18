"use server"

import { flowService } from "@chatbotx.io/business"
import { auditService } from "@chatbotx.io/business/audit"
import { getTranslations } from "next-intl/server"
import {
  type BulkUpdateIdsRequest,
  bulkUpdateIdsRequest,
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"

export const deleteFlowAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(bulkUpdateIdsRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: BulkUpdateIdsRequest
    }) => {
      const deleted = await flowService.deleteMany({
        workspaceId,
        ids: parsedInput.ids,
      })

      if (deleted.length > 0) {
        const t = await getTranslations()

        await auditService.record({
          workspaceId,
          flowId: deleted.length === 1 ? parsedInput.ids[0] : undefined,
          action: "delete",
          detail:
            deleted.length === 1
              ? t("auditLogs.details.flowDeleted", { name: deleted[0].name })
              : t("auditLogs.details.flowDeletedMany", {
                  names: deleted.map((flow) => `"${flow.name}"`).join(", "),
                }),
        })
      }
    },
  )
