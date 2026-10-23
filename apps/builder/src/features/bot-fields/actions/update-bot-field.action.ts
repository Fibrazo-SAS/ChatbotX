"use server"

import { botFieldService } from "@chatbotx.io/business"
import { isDatabaseError } from "@chatbotx.io/database/client"
import { returnValidationErrors } from "next-safe-action"
import { workspaceIdAndIdRequestParams } from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { assertCanManageBotFields } from "../permissions"
import { updateBotFieldRequest } from "../schema/action"

export const updateBotFieldAction = workspaceActionClient
  .inputSchema(updateBotFieldRequest)
  .bindArgsSchemas(workspaceIdAndIdRequestParams)
  .action(
    async ({ parsedInput, bindArgsParsedInputs: [workspaceId, id], ctx }) => {
      assertCanManageBotFields(ctx.workspaceMemberPermissions)

      try {
        return await botFieldService.updateByKey({
          workspaceId,
          key: id,
          data: parsedInput,
          actorId: ctx.user.id,
        })
      } catch (error) {
        // Renaming into an existing (type, name) hits the same unique index
        // as create — surface it under the Name field, not a generic toast.
        if (isDatabaseError(error) && error.cause.code === "23505") {
          return returnValidationErrors(updateBotFieldRequest, {
            _errors: ["Validation Exception"],
            name: { _errors: ["Name is already taken"] },
          })
        }
        throw error
      }
    },
  )
