import {
  createSelectSchema,
  savedReplyModel,
} from "@chatbotx.io/database/schema"
import { z } from "zod"

export const savedReplyResource = createSelectSchema(savedReplyModel, {
  id: z.string(),
  workspaceId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).extend({
  /** Presigned URL resolved from `imagePath` at read time; null when no image. */
  imageUrl: z.string().url().nullable(),
  createdByName: z.string().nullable(),
  updatedByName: z.string().nullable(),
})
export type SavedReplyResource = z.infer<typeof savedReplyResource>
