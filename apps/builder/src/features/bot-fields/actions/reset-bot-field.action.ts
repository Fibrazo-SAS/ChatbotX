"use server"

import { botFieldService } from "@chatbotx.io/business"
import {
  bulkUpdateIdsRequest,
  workspaceIdrequestParams,
} from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { assertCanManageBotFields } from "../permissions"

export const resetBotFields = async (
  workspaceId: string,
  ids: string[],
  actorId?: string | null,
): Promise<void> => {
  await botFieldService.bulkClearValues({ workspaceId, ids, actorId })
}

export const resetBotFieldsAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(bulkUpdateIdsRequest)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
      ctx,
    } = props

    assertCanManageBotFields(ctx.workspaceMemberPermissions)

    await resetBotFields(workspaceId, parsedInput.ids, ctx.user.id)
  })
