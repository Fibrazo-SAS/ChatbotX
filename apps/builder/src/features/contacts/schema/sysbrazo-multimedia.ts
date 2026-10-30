import { z } from "zod"

export const sysbrazoClientMultimediaItemSchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  readAt: z.coerce.date().nullable(),
  attachmentId: z.string(),
  attachmentCreatedAt: z.coerce.date(),
  messageId: z.string(),
  messageCreatedAt: z.coerce.date(),
  conversationId: z.string(),
  sourceContactId: z.string(),
  sysbrazoClientId: z.string(),
  attachment: z.object({
    fileType: z.string(),
    height: z.number().nullable(),
    mimeType: z.string(),
    name: z.string().nullable(),
    size: z.number(),
    width: z.number().nullable(),
  }),
  message: z.object({
    senderId: z.string().nullable(),
    senderType: z.string(),
    text: z.string().nullable(),
  }),
})

export const sysbrazoClientMultimediaListSchema = z.object({
  contextStatus: z.enum(["active", "expired", "missing"]),
  counts: z.object({ active: z.number(), deleted: z.number() }),
  data: z.array(sysbrazoClientMultimediaItemSchema),
  nextCursor: z
    .object({ createdAt: z.coerce.date(), id: z.string() })
    .nullable(),
})

export const sysbrazoClientMultimediaUrlSchema = z.object({
  downloadUrl: z.string().url(),
})
