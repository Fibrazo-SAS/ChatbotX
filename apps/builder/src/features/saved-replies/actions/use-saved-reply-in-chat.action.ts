"use server"

import { db, findOrFail } from "@chatbotx.io/database/client"
import {
  conversationModel,
  savedReplyModel,
} from "@chatbotx.io/database/schema"
import { uploader } from "@chatbotx.io/filesystem"
import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { createMessage } from "@/features/messages/actions/create-message.action"
import { isMessagingWindowExpired } from "@/features/messages/utils/messaging-window"
import { logger } from "@/lib/log"
import { workspaceActionClient } from "@/lib/safe-action"

export type UseSavedReplyInChatResult = {
  status: "sent" | "partial" | "windowClosed"
  /** 1-based part indexes sent before the failure (empty for windowClosed). */
  sentParts: number[]
  totalParts: number
}

export const useSavedReplyInChatAction = workspaceActionClient
  .bindArgsSchemas([
    zodBigintAsString(),
    zodBigintAsString(),
    zodBigintAsString(),
  ] as const)
  .action(async (props): Promise<UseSavedReplyInChatResult> => {
    const {
      bindArgsParsedInputs: [workspaceId, savedReplyId, conversationId],
      ctx,
    } = props

    const savedReply = await findOrFail({
      table: savedReplyModel,
      where: { id: savedReplyId, workspaceId },
      message: "Saved reply not found",
    })
    const conversation = await findOrFail({
      table: conversationModel,
      where: { id: conversationId, workspaceId },
      message: "Conversation not found",
    })
    const contactInbox = await db.query.contactInboxModel.findFirst({
      where: { contactId: conversation.contactId },
      orderBy: { lastMessageAt: "desc" },
    })
    if (!contactInbox) {
      throw new Error("Inbox not found")
    }

    const windowClosed = isMessagingWindowExpired({
      channel: contactInbox.channel,
      lastIncomingMessageAt: contactInbox.lastIncomingMessageAt,
    })
    if (windowClosed) {
      return { status: "windowClosed", sentParts: [], totalParts: 0 }
    }

    type Part = { kind: "text"; text: string } | { kind: "image" }
    const parts: Part[] = []
    if (savedReply.text.trim()) {
      parts.push({ kind: "text", text: savedReply.text })
    }
    if (savedReply.imagePath) {
      parts.push({ kind: "image" })
    }
    if (savedReply.secondText?.trim()) {
      parts.push({ kind: "text", text: savedReply.secondText })
    }

    const totalParts = parts.length
    const sentParts: number[] = []

    logger.info(
      {
        workspaceId,
        savedReplyId,
        conversationId,
        imagePath: savedReply.imagePath ?? null,
        totalParts,
      },
      "useSavedReplyInChat: start",
    )

    for (const [index, part] of parts.entries()) {
      const partNumber = index + 1
      try {
        if (part.kind === "text") {
          await createMessage({
            conversation,
            contactInbox,
            parsedInput: { text: part.text, clientId: createId() },
            user: ctx.user,
          })
        } else {
          const [buffer, head] = await Promise.all([
            uploader.getObject(savedReply.imagePath as string),
            uploader.headObject(savedReply.imagePath as string),
          ])
          const mimeType = head.ContentType ?? "image/jpeg"
          const file = new File([new Uint8Array(buffer)], "image", {
            type: mimeType,
          })
          await createMessage({
            conversation,
            contactInbox,
            parsedInput: { files: [file], clientId: createId() },
            user: ctx.user,
          })
        }
        sentParts.push(partNumber)
      } catch (error) {
        logger.error(
          { error, part, workspaceId, savedReplyId, conversationId },
          "useSavedReplyInChat: failed to send part",
        )
        // Stop sending the remaining parts and report what went out.
        return { status: "partial", sentParts, totalParts }
      }
    }

    return { status: "sent", sentParts, totalParts }
  })
