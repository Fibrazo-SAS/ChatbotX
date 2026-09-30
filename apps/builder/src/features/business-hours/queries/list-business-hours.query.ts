import { businessHoursService } from "@chatbotx.io/business"
import { assertCurrentUserCanAccessChatbot } from "@/lib/auth/utils"
import type { ListBusinessHoursRequest } from "../schema/query"

export async function listBusinessHours(input: ListBusinessHoursRequest) {
  await assertCurrentUserCanAccessChatbot(input.workspaceId)
  return await businessHoursService.list({ workspaceId: input.workspaceId })
}
