"use server"

import { auditService } from "@chatbotx.io/business/audit"
import { db, eq, findOrFail } from "@chatbotx.io/database/client"
import { flowModel } from "@chatbotx.io/database/schema"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClient } from "@/lib/safe-action"
import { type UpdateFlowSchema, updateFlowSchema } from "../schema/action"

export const updateFlowAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(updateFlowSchema)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
    } = props

    await updateFlow({ workspaceId, id }, parsedInput)
  })

const updateFlow = async (
  ctx: {
    workspaceId: string
    id: string
  },
  parsedInput: UpdateFlowSchema,
) => {
  const flow = await findOrFail({
    table: flowModel,
    where: {
      id: ctx.id,
      workspaceId: ctx.workspaceId,
    },
    message: "Flow not found",
  })

  const hasChanges = Object.entries(parsedInput).some(
    ([key, value]) => flow[key as keyof UpdateFlowSchema] !== value,
  )

  if (!hasChanges) {
    return
  }

  const updated = await db
    .update(flowModel)
    .set(parsedInput)
    .where(eq(flowModel.id, flow.id))
    .returning({ id: flowModel.id })

  if (updated.length === 0) {
    return
  }

  // The active/inactive toggle is a distinct audited action (not a generic
  // "update"), so compliance can tell activation changes apart from edits.
  let action = "update"
  let detailKey = "auditLogs.details.flowUpdated"
  if (parsedInput.active !== undefined && parsedInput.active !== flow.active) {
    action = parsedInput.active ? "activate" : "deactivate"
    detailKey = parsedInput.active
      ? "auditLogs.details.flowActivated"
      : "auditLogs.details.flowDeactivated"
  }

  const t = await getTranslations()

  await auditService.record({
    workspaceId: ctx.workspaceId,
    flowId: flow.id,
    action,
    detail: t(detailKey, { name: flow.name }),
  })
}
