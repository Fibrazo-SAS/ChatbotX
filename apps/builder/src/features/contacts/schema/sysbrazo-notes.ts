import { z } from "zod"

export const sysbrazoNoteOriginSchema = z.enum(["chat", "sysbrazo"])
export type SysbrazoNoteOrigin = z.infer<typeof sysbrazoNoteOriginSchema>

export const sysbrazoNoteSchema = z.object({
  id: z.string(),
  notes: z.string(),
  author: z.string(),
  origin: sysbrazoNoteOriginSchema,
  created_at: z.string().nullable(),
  edited: z.boolean(),
  editable: z.boolean(),
  edit_deadline: z.string().nullable(),
})

export const sysbrazoNotesResponseSchema = z.object({
  items: z.array(sysbrazoNoteSchema),
  counts: z.object({
    all: z.number(),
    chat: z.number(),
    sysbrazo: z.number(),
  }),
  page: z.number(),
  per_page: z.number(),
  total: z.number(),
  last_page: z.number(),
})

export type SysbrazoNote = z.infer<typeof sysbrazoNoteSchema>
export type SysbrazoNotesResponse = z.infer<typeof sysbrazoNotesResponseSchema>
