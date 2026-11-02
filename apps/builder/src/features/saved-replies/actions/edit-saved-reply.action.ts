"use server"

import { savedReplyService } from "@chatbotx.io/business"
import { uploader } from "@chatbotx.io/filesystem"
import { workspaceIdAndIdRequestParams } from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { editSavedReplyRequest } from "../schema/mutation"

export const editSavedReplyAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdAndIdRequestParams)
  .inputSchema(editSavedReplyRequest)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
      ctx: { user },
    } = props

    const savedReply = await savedReplyService.update({
      workspaceId,
      id,
      userId: user.id,
      content: parsedInput,
    })

    return {
      ...savedReply,
      imageUrl: savedReply.imagePath
        ? await uploader.getPresignedDownload(savedReply.imagePath)
        : null,
      updatedByName: user.name,
    }
  })
