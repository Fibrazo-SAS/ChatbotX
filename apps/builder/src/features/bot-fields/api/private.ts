import { botFieldService } from "@chatbotx.io/business"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { withWorkspaceIdSchema } from "@/features/workspaces/schema/resource"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { canViewBotFields } from "../permissions"
import { listBotFieldsRequest, listBotFieldsResponse } from "../schema/query"

/** Fila del historial de una variable global (#15466). */
const botFieldHistoryItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  detail: z.string(),
  createdAt: z.date(),
  user: z
    .object({
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
})

export const privateBotFieldsAPI = {
  privateListBotFieldsAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/bot-fields",
      summary: "List bot fields",
      tags: ["Bot Fields"],
    })
    .input(listBotFieldsRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(listBotFieldsResponse)
    .handler(async ({ input }) => {
      const { workspaceId, ...rest } = input
      return await botFieldService.list({ ...rest, workspaceId })
    }),

  getBotFieldHistoryAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/bot-fields/{botFieldId}/history",
      summary: "List the audit history of one global variable",
      tags: ["Bot Fields"],
    })
    .input(withWorkspaceIdSchema.and(z.object({ botFieldId: z.string() })))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(
      z.object({
        items: z.array(botFieldHistoryItemSchema),
        pageCount: z.number(),
      }),
    )
    .handler(async ({ input }) => {
      // Gate explícito `viewBotFields`: fail-closed, sin bypass superAdmin.
      if (!(await canViewBotFields(input.workspaceId))) {
        throw new ORPCError("FORBIDDEN", {
          message: "No permission to view global variables",
        })
      }

      const { data, pageCount } = await botFieldService.listHistory({
        workspaceId: input.workspaceId,
        botFieldId: input.botFieldId,
        page: 1,
        perPage: 100,
      })

      return {
        items: data.map((row) => ({
          id: row.id,
          action: row.action,
          detail: row.detail,
          createdAt: row.createdAt,
          user: row.user
            ? { name: row.user.name, email: row.user.email }
            : null,
        })),
        pageCount,
      }
    }),
}
