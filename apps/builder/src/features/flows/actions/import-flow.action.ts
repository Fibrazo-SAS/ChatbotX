"use server"

import { importService } from "@chatbotx.io/business"
import { DefaultJobAction, defaultQueue } from "@chatbotx.io/worker-config"
import { getTranslations } from "next-intl/server"
import { returnValidationErrors } from "next-safe-action"
import {
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schema"
import { getCurrentUser } from "@/lib/auth/utils"
import { workspaceActionClient } from "@/lib/safe-action"
import {
  type ImportFlowRequest,
  type ImportFlowResponse,
  importFlowRequest,
} from "../schema/action"

export const importFlowAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(importFlowRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: ImportFlowRequest
    }): Promise<ImportFlowResponse> => {
      const user = await getCurrentUser()
      if (!user) {
        return returnValidationErrors(importFlowRequest, {
          _errors: ["Unauthorized"],
        })
      }

      const t = await getTranslations()
      const result = await importService.startFlowImport({
        workspaceId,
        userId: user.id,
        fileId: parsedInput.fileId,
        folderId: parsedInput.folderId,
        // Placeholder replaced with the imported flow's name by the worker —
        // the worker has no request locale of its own.
        auditDetailTemplate: t("auditLogs.details.flowImported", {
          name: "{name}",
        }),
      })
      if (!result.ok) {
        return returnValidationErrors(importFlowRequest, {
          fileId: {
            _errors: [
              result.reason === "fileNotFound"
                ? "File not found"
                : "File is not a flow import",
            ],
          },
        })
      }

      await defaultQueue.add(DefaultJobAction.runImport, {
        type: DefaultJobAction.runImport,
        data: { importId: result.importId },
      })

      return { importId: result.importId }
    },
  )
