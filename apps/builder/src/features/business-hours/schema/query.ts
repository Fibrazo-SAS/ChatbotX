import { z } from "zod"
import { withWorkspaceIdSchema } from "@/features/workspaces/schema/resource"

export type ListBusinessHoursRequest = {
  workspaceId: string
}

export const listBusinessHoursForFlowRequest = withWorkspaceIdSchema.and(
  z.object({
    keyword: z.string().optional(),
  }),
)

export const listBusinessHoursForFlowResponse = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    active: z.boolean(),
  }),
)

export type ListBusinessHoursForFlowResponse = z.infer<
  typeof listBusinessHoursForFlowResponse
>
