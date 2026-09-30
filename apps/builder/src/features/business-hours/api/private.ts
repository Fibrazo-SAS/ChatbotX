import { businessHoursService } from "@chatbotx.io/business"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import {
  listBusinessHoursForFlowRequest,
  listBusinessHoursForFlowResponse,
} from "../schema/query"

export const businessHoursAuthenticatedAPI = {
  listBusinessHoursForFlowAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/business-hours/for-flow",
      summary: "List business hours for flow",
      tags: ["Business Hours"],
    })
    .input(listBusinessHoursForFlowRequest)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(listBusinessHoursForFlowResponse)
    .handler(
      async ({ input }) => await businessHoursService.listForFlow(input),
    ),
}
