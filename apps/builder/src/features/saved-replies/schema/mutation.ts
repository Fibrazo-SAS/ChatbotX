import { zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"
import { savedReplyResource } from "./resource"

export const listSavedRepliesRequest = z.object({
  workspaceId: zodBigintAsString(),
})
export type ListSavedRepliesRequest = z.infer<typeof listSavedRepliesRequest>

export const savedReplyContentRequest = z.object({
  shortcut: z.string().trim().max(100).optional(),
  text: z.string().trim().min(1).max(4096),
  imageFileId: zodBigintAsString().nullish(),
  removeImage: z.boolean().optional(),
  secondText: z.string().trim().max(4096).optional(),
})

export const createSavedReplyRequest = savedReplyContentRequest
export type CreateSavedReplyRequest = z.infer<typeof createSavedReplyRequest>

export const editSavedReplyRequest = savedReplyContentRequest
export type EditSavedReplyRequest = z.infer<typeof editSavedReplyRequest>

export const deleteSavedReplyRequest = z.object({
  id: zodBigintAsString(),
})
export type DeleteSavedReplyRequest = z.infer<typeof deleteSavedReplyRequest>

export const listSavedReplyResponse = z.object({
  data: z.array(savedReplyResource),
})
export type ListSavedReplyResponse = z.infer<typeof listSavedReplyResponse>
