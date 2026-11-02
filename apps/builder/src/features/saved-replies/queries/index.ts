import { db } from "@chatbotx.io/database/client"
import { uploader } from "@chatbotx.io/filesystem"
import type { ListSavedReplyResponse } from "../schema/mutation"
import type { SavedReplyResource } from "../schema/resource"

export async function listSavedReplies(input: {
  workspaceId: string
}): Promise<ListSavedReplyResponse> {
  const rows = await db.query.savedReplyModel.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    orderBy: {
      createdAt: "asc",
    },
    with: {
      createdBy: {
        columns: {
          name: true,
        },
      },
      updatedBy: {
        columns: {
          name: true,
        },
      },
    },
  })

  const data: SavedReplyResource[] = await Promise.all(
    rows.map(
      async (row): Promise<SavedReplyResource> => ({
        ...row,
        imageUrl: row.imagePath
          ? await uploader.getPresignedDownload(row.imagePath)
          : null,
        createdByName: row.createdBy?.name ?? null,
        updatedByName: row.updatedBy?.name ?? null,
      }),
    ),
  )

  return { data }
}
