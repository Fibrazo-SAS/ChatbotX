import {
  createSelectSchema,
  flowVersionModel,
} from "@chatbotx.io/database/schema"
import z from "zod"

export const flowVersionResource = createSelectSchema(flowVersionModel, {
  id: z.string(),
  flowId: z.string(),
  workspaceId: z.string(),
  startNodeId: z.string(),
  createdAt: z.coerce.date(),
  publishedById: z.string().nullish(),
})
  .omit({
    updatedAt: true,
  })
  .extend({
    // Optional: only `privateListFlowVersionsAPI` joins the author; flow-list
    // responses reuse this resource without the relation.
    publishedBy: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string(),
        image: z.string().nullable(),
      })
      .nullish(),
  })
export type FlowVersionResource = z.infer<typeof flowVersionResource>
