import { db, eq, findOrFail } from "@chatbotx.io/database/client"
import { savedReplyModel } from "@chatbotx.io/database/schema"
import { uploader } from "@chatbotx.io/filesystem"
import { createId } from "@chatbotx.io/utils"
import { BaseService } from "../base.service"
import { assertDeletable } from "../template/installed-resource.service"

export const QUICK_REPLY_MAX_TEXT_LENGTH = 4096
export const QUICK_REPLY_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const QUICK_REPLY_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"])

export type SavedReplyContentInput = {
  shortcut?: string | null
  text: string
  /** `File` row id of the pre-uploaded image (presigned upload). */
  imageFileId?: string | null
  /** Remove the current image (edit only). */
  removeImage?: boolean
  secondText?: string | null
}

type SavedReplyRow = typeof savedReplyModel.$inferSelect

class SavedReplyService extends BaseService {
  /**
   * Validates the uploaded image: the `File` row must belong to the workspace
   * (ownership proof for the presigned upload), be JPEG/PNG, and its object
   * must be at most 5 MB. Returns the S3 object key.
   */
  private async resolveImagePath(input: {
    workspaceId: string
    fileId?: string | null
  }): Promise<string | null> {
    if (!input.fileId) {
      return null
    }

    const file = await db.query.fileModel.findFirst({
      where: { id: input.fileId, workspaceId: input.workspaceId },
    })
    if (!file) {
      throw new Error("Image not found")
    }
    if (!QUICK_REPLY_IMAGE_MIME_TYPES.has(file.mimeType)) {
      throw new Error("Only JPEG or PNG images are supported")
    }

    const head = await uploader.headObject(file.path)
    if ((head.ContentLength ?? 0) > QUICK_REPLY_MAX_IMAGE_BYTES) {
      throw new Error("Image exceeds the 5 MB limit")
    }

    return file.path
  }

  private assertSecondTextOnlyWithImage(input: {
    imagePath: string | null
    secondText?: string | null
  }) {
    if (input.secondText?.trim() && !input.imagePath) {
      throw new Error("Second text requires an image")
    }
  }

  async create(input: {
    workspaceId: string
    userId: string
    content: SavedReplyContentInput
  }): Promise<SavedReplyRow> {
    const imagePath = await this.resolveImagePath({
      workspaceId: input.workspaceId,
      fileId: input.content.imageFileId,
    })
    this.assertSecondTextOnlyWithImage({
      imagePath,
      secondText: input.content.secondText,
    })

    const [savedReply] = await db
      .insert(savedReplyModel)
      .values({
        id: createId(),
        workspaceId: input.workspaceId,
        shortcut: input.content.shortcut?.trim() || null,
        text: input.content.text,
        imagePath,
        secondText: input.content.secondText?.trim() || null,
        createdById: input.userId,
        updatedById: input.userId,
      })
      .returning()

    await this.audit("create", `created saved reply #${savedReply.id}`)
    return savedReply
  }

  async update(input: {
    workspaceId: string
    id: string
    userId: string
    content: SavedReplyContentInput
  }): Promise<SavedReplyRow> {
    const savedReply = await findOrFail({
      table: savedReplyModel,
      where: { id: input.id, workspaceId: input.workspaceId },
      message: "Saved reply not found",
    })

    const newImagePath = await this.resolveImagePath({
      workspaceId: input.workspaceId,
      fileId: input.content.imageFileId,
    })

    const imagePath =
      newImagePath ?? (input.content.removeImage ? null : savedReply.imagePath)
    this.assertSecondTextOnlyWithImage({
      imagePath,
      secondText: input.content.secondText,
    })

    const [updatedSavedReply] = await db
      .update(savedReplyModel)
      .set({
        shortcut: input.content.shortcut?.trim() || null,
        text: input.content.text,
        imagePath,
        secondText: input.content.secondText?.trim() || null,
        updatedById: input.userId,
      })
      .where(eq(savedReplyModel.id, savedReply.id))
      .returning()

    // Remove the replaced/removed object only after the row updated successfully.
    if (savedReply.imagePath && savedReply.imagePath !== imagePath) {
      await uploader.deleteObject(savedReply.imagePath)
    }

    await this.audit("update", `updated saved reply #${savedReply.id}`)
    return updatedSavedReply
  }

  async delete(input: { workspaceId: string; id: string }): Promise<void> {
    const savedReply = await findOrFail({
      table: savedReplyModel,
      where: { id: input.id, workspaceId: input.workspaceId },
      message: "Saved reply not found",
    })

    await assertDeletable({
      workspaceId: input.workspaceId,
      resourceKind: "savedReply",
      resourceIds: [input.id],
    })

    await db
      .delete(savedReplyModel)
      .where(eq(savedReplyModel.id, savedReply.id))

    if (savedReply.imagePath) {
      await uploader.deleteObject(savedReply.imagePath)
    }

    await this.audit("delete", `deleted saved reply #${savedReply.id}`)
  }
}

export const savedReplyService = new SavedReplyService()
