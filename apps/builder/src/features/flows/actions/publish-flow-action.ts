"use server"

import { flowVersionService } from "@chatbotx.io/business"
import {
  auditService,
  getAuditActor,
  SYSTEM_ACTOR,
} from "@chatbotx.io/business/audit"
import { notFoundException } from "@chatbotx.io/business/errors"
import { and, db, eq } from "@chatbotx.io/database/client"
import { flowModel, flowVersionModel } from "@chatbotx.io/database/schema"
import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClient } from "@/lib/safe-action"
import { type PublishFlowSchema, publishFlowSchema } from "../schema/action"
import { diffFlowNodes, type FlowDiffNode } from "./diff-flow-nodes"

export const publishFlowAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(publishFlowSchema)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
    } = props

    await publishFlow({ workspaceId, id }, parsedInput)
  })

export const publishFlow = async (
  ctx: { workspaceId: string; id: string },
  input: PublishFlowSchema,
) => {
  const flow = await db.query.flowModel.findFirst({
    where: {
      id: ctx.id,
      workspaceId: ctx.workspaceId,
    },
    with: {
      flowVersions: {
        where: {
          isDraft: true,
        },
      },
    },
  })

  if (!flow || flow.flowVersions.length === 0) {
    throw notFoundException("Flow not found")
  }

  const draftVersion = flow.flowVersions[0]
  const validated = publishFlowSchema.parse(input)

  // Previous published version — the diff baseline. A flow can exist with only
  // a draft (first publish), in which case every node counts as added.
  const previousPublished = await db.query.flowVersionModel.findFirst({
    where: {
      flowId: flow.id,
      workspaceId: flow.workspaceId,
      isDraft: false,
      isLatest: true,
    },
  })
  const changesDetails = diffFlowNodes(
    (previousPublished?.nodes ?? []) as FlowDiffNode[],
    validated.nodes as unknown as FlowDiffNode[],
  )

  await db.transaction(async (tx) => {
    // Remove all other latest versions
    await tx
      .update(flowVersionModel)
      .set({
        isLatest: false,
      })
      .where(
        and(
          eq(flowVersionModel.flowId, flow.id),
          eq(flowVersionModel.isLatest, true),
        ),
      )

    await tx
      .update(flowVersionModel)
      .set({
        nodes: validated.nodes,
        edges: validated.edges,
      })
      .where(eq(flowVersionModel.id, draftVersion.id))

    const newVersionId = createId()
    const actorUserId = getAuditActor()?.userId
    await tx.insert(flowVersionModel).values({
      id: newVersionId,
      workspaceId: flow.workspaceId,
      flowId: flow.id,
      isDraft: false,
      isLatest: true,
      ...validated,
      startNodeId: draftVersion.startNodeId,
      publishedById:
        actorUserId && actorUserId !== SYSTEM_ACTOR ? actorUserId : null,
    })

    await tx
      .update(flowModel)
      .set({
        currentVersionId: newVersionId,
      })
      .where(eq(flowModel.id, flow.id))
  })

  await flowVersionService.invalidateList(flow.id)

  const t = await getTranslations()

  await auditService.record({
    workspaceId: ctx.workspaceId,
    action: "publish",
    detail: t("auditLogs.details.flowPublished", { name: flow.name }),
    changesDetails,
  })
}
