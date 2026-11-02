"use server"

import { savedReplyService } from "@chatbotx.io/business"
import { uploader } from "@chatbotx.io/filesystem"
import { workspaceIdrequestParams } from "@/features/common/schema"
import { workspaceActionClient } from "@/lib/safe-action"
import { createSavedReplyRequest } from "../schema/mutation"

export const createSavedReplyAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(createSavedReplyRequest)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
      ctx: { user },
    } = props

    const savedReply = await savedReplyService.create({
      workspaceId,
      userId: user.id,
      content: parsedInput,
    })

    return {
      ...savedReply,
      imageUrl: savedReply.imagePath
        ? await uploader.getPresignedDownload(savedReply.imagePath)
        : null,
      createdByName: user.name,
      updatedByName: user.name,
    }
  })
