"use server"

import { botFieldService } from "@chatbotx.io/business"
import {
  bulkUpdateIdsRequest,
  workspaceIdrequestParams,
} from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { assertCanManageBotFields } from "../permissions"

export const deleteBotFieldsAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(bulkUpdateIdsRequest)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
      ctx,
    } = props

    assertCanManageBotFields(ctx.workspaceMemberPermissions)

    await botFieldService.bulkDelete({
      workspaceId,
      ids: parsedInput.ids,
      actorId: ctx.user.id,
    })
  })
