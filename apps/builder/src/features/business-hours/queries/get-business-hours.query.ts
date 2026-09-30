import { businessHoursService } from "@chatbotx.io/business"
import { assertCurrentUserCanAccessChatbot } from "@/lib/auth/utils"

export async function getBusinessHours(input: {
  workspaceId: string
  id: string
}) {
  await assertCurrentUserCanAccessChatbot(input.workspaceId)
  return await businessHoursService.get({
    workspaceId: input.workspaceId,
    id: input.id,
  })
}
