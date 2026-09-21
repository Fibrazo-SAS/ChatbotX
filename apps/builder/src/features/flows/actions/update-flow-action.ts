"use server"

import { auditService } from "@chatbotx.io/business/audit"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { db, eq, findOrFail } from "@chatbotx.io/database/client"
import { flowModel } from "@chatbotx.io/database/schema"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { canToggleFlowStatus } from "@/lib/auth/flow-status-permissions"
import { workspaceActionClient } from "@/lib/safe-action"
import { type UpdateFlowSchema, updateFlowSchema } from "../schema/action"

export const updateFlowAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(updateFlowSchema)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
      ctx,
    } = props

    await updateFlow({ workspaceId, id }, parsedInput, {
      role: ctx.workspaceMemberRole,
      permissions: ctx.workspaceMemberPermissions,
      user: ctx.user,
    })
  })

export const updateFlow = async (
  ctx: {
    workspaceId: string
    id: string
  },
  parsedInput: UpdateFlowSchema,
  authorization: Parameters<typeof canToggleFlowStatus>[0],
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

  // Ticket 15139: only owners and superAdmins (tenant-level or global) may
  // change a flow's `active` status. Agents keep every other update (rename,
  // inbox visibility, ...). Blocked attempts are audited so compliance can
  // see who tried, with their role and the target flow.
  const isStatusChange =
    parsedInput.active !== undefined && parsedInput.active !== flow.active

  if (isStatusChange && !canToggleFlowStatus(authorization)) {
    const t = await getTranslations()
    const detailKey = parsedInput.active
      ? "auditLogs.details.flowActivationBlocked"
      : "auditLogs.details.flowDeactivationBlocked"

    await auditService.record({
      workspaceId: ctx.workspaceId,
      flowId: flow.id,
      action: parsedInput.active
        ? "flowActivationBlocked"
        : "flowDeactivationBlocked",
      detail: t(detailKey, { name: flow.name }),
    })

    throw new ChatbotXException(
      t("errors.flowStatusChangeNotAllowed"),
      "flowStatusChangeNotAllowed",
      403,
    )
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
  if (isStatusChange) {
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
