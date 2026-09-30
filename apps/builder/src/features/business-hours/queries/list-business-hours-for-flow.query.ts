import { businessHoursService } from "@chatbotx.io/business"
import { assertCurrentUserCanAccessChatbot } from "@/lib/auth/utils"

export async function listBusinessHoursForFlow(input: {
  workspaceId: string
  keyword?: string
}) {
  await assertCurrentUserCanAccessChatbot(input.workspaceId)
  return await businessHoursService.listForFlow(input)
}
