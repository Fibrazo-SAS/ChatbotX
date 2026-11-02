import {
  and,
  type DatabaseClient,
  db,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
} from "@chatbotx.io/database/client"
import { createMessageRepository } from "@chatbotx.io/database/repositories"
import {
  attachmentModel,
  conversationSysbrazoClientContextModel,
  sysbrazoClientMultimediaModel,
  sysbrazoClientMultimediaReadModel,
} from "@chatbotx.io/database/schema"
import { uploader } from "@chatbotx.io/filesystem"
import { distributedLock } from "@chatbotx.io/redis"
import { BaseService } from "../base.service"

const CONTEXT_DURATION_MS = 24 * 60 * 60 * 1000
const CONFIRMED_ATTACHMENT_BACKFILL_LIMIT = 50

const supportedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

const supportedDocumentMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/rtf",
  "text/rtf",
])

export const isSupportedSysbrazoClientMultimedia = (input: {
  fileType: "audio" | "file" | "gif" | "image" | "video"
  mimeType: string
}): boolean =>
  (input.fileType === "image" && supportedImageMimeTypes.has(input.mimeType)) ||
  (input.fileType === "file" && supportedDocumentMimeTypes.has(input.mimeType))

class SysbrazoClientMultimediaService extends BaseService {
  async activateContext(input: {
    conversationId: string
    documentId: string
    now?: Date
    sysbrazoClientId: string
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db, now = new Date() } = input
    const expiresAt = new Date(now.getTime() + CONTEXT_DURATION_MS)

    const [context] = await tx
      .insert(conversationSysbrazoClientContextModel)
      .values({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        sysbrazoClientId: input.sysbrazoClientId,
        documentId: input.documentId,
        activatedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          conversationSysbrazoClientContextModel.workspaceId,
          conversationSysbrazoClientContextModel.conversationId,
        ],
        set: {
          sysbrazoClientId: input.sysbrazoClientId,
          documentId: input.documentId,
          activatedAt: now,
          expiresAt,
          updatedAt: now,
        },
      })
      .returning()

    if (!context) {
      throw new Error("Failed to activate Sysbrazo client context")
    }

    await this.invalidateCacheTags(this.contextCacheTags(input))
    return context
  }

  /**
   * Extiende el contexto de Sysbrazo de una conversación existente por 24h
   * más desde ahora. No crea contexto nuevo si no existe: solo se usa para
   * mantener vigente un contexto mientras el cliente sigue escribiendo.
   */
  async refreshContext(input: {
    conversationId: string
    now?: Date
    workspaceId: string
  }) {
    const { now = new Date() } = input
    const expiresAt = new Date(now.getTime() + CONTEXT_DURATION_MS)
    const [updated] = await db
      .update(conversationSysbrazoClientContextModel)
      .set({
        activatedAt: now,
        expiresAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(
            conversationSysbrazoClientContextModel.workspaceId,
            input.workspaceId,
          ),
          eq(
            conversationSysbrazoClientContextModel.conversationId,
            input.conversationId,
          ),
        ),
      )
      .returning()
    return updated ?? null
  }

  async invalidateContext(input: {
    conversationId: string
    tx?: DatabaseClient
    workspaceId: string
  }): Promise<void> {
    const { tx = db } = input
    await tx
      .delete(conversationSysbrazoClientContextModel)
      .where(
        and(
          eq(
            conversationSysbrazoClientContextModel.workspaceId,
            input.workspaceId,
          ),
          eq(
            conversationSysbrazoClientContextModel.conversationId,
            input.conversationId,
          ),
        ),
      )
    await this.invalidateCacheTags(this.contextCacheTags(input))
  }

  async findActiveContext(input: {
    at?: Date
    conversationId: string
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db, at = new Date() } = input
    const [context] = await tx
      .select()
      .from(conversationSysbrazoClientContextModel)
      .where(
        and(
          eq(
            conversationSysbrazoClientContextModel.workspaceId,
            input.workspaceId,
          ),
          eq(
            conversationSysbrazoClientContextModel.conversationId,
            input.conversationId,
          ),
          lte(conversationSysbrazoClientContextModel.activatedAt, at),
          gt(conversationSysbrazoClientContextModel.expiresAt, at),
        ),
      )
      .limit(1)
    return context
  }

  async getContextState(input: {
    at?: Date
    conversationId: string
    tx?: DatabaseClient
    workspaceId: string
  }): Promise<"active" | "expired" | "missing"> {
    const { tx = db, at = new Date() } = input
    const [context] = await tx
      .select()
      .from(conversationSysbrazoClientContextModel)
      .where(
        and(
          eq(
            conversationSysbrazoClientContextModel.workspaceId,
            input.workspaceId,
          ),
          eq(
            conversationSysbrazoClientContextModel.conversationId,
            input.conversationId,
          ),
        ),
      )
      .limit(1)
    if (!context) {
      return "missing"
    }
    return context.expiresAt > at ? "active" : "expired"
  }

  async associateMessageAttachments(input: {
    attachments: Array<{
      createdAt: Date
      fileType: "audio" | "file" | "gif" | "image" | "video"
      id: string
      mimeType: string
    }>
    conversationId: string
    messageCreatedAt: Date
    messageId: string
    sourceContactId: string
    workspaceId: string
  }) {
    return await Promise.all(
      input.attachments
        .filter((attachment) => isSupportedSysbrazoClientMultimedia(attachment))
        .map((attachment) =>
          this.associateAttachment({
            workspaceId: input.workspaceId,
            conversationId: input.conversationId,
            messageId: input.messageId,
            messageCreatedAt: input.messageCreatedAt,
            sourceContactId: input.sourceContactId,
            attachmentId: attachment.id,
            attachmentCreatedAt: attachment.createdAt,
          }),
        ),
    )
  }

  /**
   * Explicitly confirmed client context may include eligible attachment IDs
   * selected from the conversation by the authenticated user. The database
   * lookup still scopes them to that conversation and workspace, and ordinary
   * message ingestion never backfills by itself.
   */
  async associateRecentAttachmentsForConfirmedContext(input: {
    attachmentIds: string[]
    contextId: string
    conversationId: string
    now?: Date
    tx?: DatabaseClient
    workspaceId: string
  }): Promise<number> {
    const { tx = db, now = new Date() } = input
    const context = await this.findActiveContext({
      tx,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      at: now,
    })
    if (!context || context.id !== input.contextId) {
      return 0
    }

    const conversation = await tx.query.conversationModel.findFirst({
      where: {
        id: input.conversationId,
        workspaceId: input.workspaceId,
      },
      columns: { contactId: true },
    })
    if (!conversation) {
      return 0
    }

    const attachmentIds = [...new Set(input.attachmentIds)].slice(
      0,
      CONFIRMED_ATTACHMENT_BACKFILL_LIMIT,
    )
    if (attachmentIds.length === 0) {
      return 0
    }

    const attachments = await tx
      .select()
      .from(attachmentModel)
      .where(
        and(
          eq(attachmentModel.workspaceId, input.workspaceId),
          eq(attachmentModel.conversationId, input.conversationId),
          inArray(attachmentModel.id, attachmentIds),
        ),
      )
      .orderBy(desc(attachmentModel.createdAt))
    const earliestConfirmedAttachmentAt = new Date(
      now.getTime() - CONTEXT_DURATION_MS,
    )
    let associatedCount = 0

    for (const attachment of attachments) {
      if (
        attachment.createdAt < earliestConfirmedAttachmentAt ||
        attachment.createdAt > now ||
        !isSupportedSysbrazoClientMultimedia(attachment)
      ) {
        continue
      }

      const [association] = await tx
        .insert(sysbrazoClientMultimediaModel)
        .values({
          workspaceId: input.workspaceId,
          sysbrazoClientId: context.sysbrazoClientId,
          attachmentId: attachment.id,
          attachmentCreatedAt: attachment.createdAt,
          messageId: attachment.messageId,
          messageCreatedAt: attachment.messageCreatedAt,
          conversationId: input.conversationId,
          sourceContactId: conversation.contactId,
          documentIdSnapshot: context.documentId,
        })
        .onConflictDoNothing()
        .returning({ id: sysbrazoClientMultimediaModel.id })

      if (association) {
        associatedCount += 1
      }
    }

    return associatedCount
  }

  async associateAttachment(input: {
    attachmentCreatedAt: Date
    attachmentId: string
    conversationId: string
    messageCreatedAt: Date
    messageId: string
    sourceContactId: string
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db } = input
    const context = await this.findActiveContext({
      tx,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      at: input.attachmentCreatedAt,
    })
    if (!context) {
      return null
    }

    const [association] = await tx
      .insert(sysbrazoClientMultimediaModel)
      .values({
        workspaceId: input.workspaceId,
        sysbrazoClientId: context.sysbrazoClientId,
        attachmentId: input.attachmentId,
        attachmentCreatedAt: input.attachmentCreatedAt,
        messageId: input.messageId,
        messageCreatedAt: input.messageCreatedAt,
        conversationId: input.conversationId,
        sourceContactId: input.sourceContactId,
        documentIdSnapshot: context.documentId,
      })
      .onConflictDoNothing()
      .returning()

    return association ?? null
  }

  async listActive(input: {
    cursor?: { createdAt: Date; id: string }
    limit: number
    sysbrazoClientId: string
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db } = input
    return await tx
      .select()
      .from(sysbrazoClientMultimediaModel)
      .where(
        and(
          eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
          eq(
            sysbrazoClientMultimediaModel.sysbrazoClientId,
            input.sysbrazoClientId,
          ),
          isNull(sysbrazoClientMultimediaModel.deletedAt),
          input.cursor
            ? or(
                lt(
                  sysbrazoClientMultimediaModel.createdAt,
                  input.cursor.createdAt,
                ),
                and(
                  eq(
                    sysbrazoClientMultimediaModel.createdAt,
                    input.cursor.createdAt,
                  ),
                  lt(sysbrazoClientMultimediaModel.id, input.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(
        desc(sysbrazoClientMultimediaModel.createdAt),
        desc(sysbrazoClientMultimediaModel.id),
      )
      .limit(input.limit)
  }

  async listActiveWithMetadata(input: {
    cursor?: { createdAt: Date; id: string }
    limit: number
    sysbrazoClientId: string
    workspaceId: string
  }) {
    const associations = await this.listActive(input)
    return await this.withMetadata(associations)
  }

  async listDeletedWithMetadata(input: {
    limit: number
    sysbrazoClientId: string
    workspaceId: string
  }) {
    const associations = await this.listDeleted(input)
    return await this.withMetadata(associations)
  }

  async getActiveAttachment(input: {
    multimediaId: string
    sysbrazoClientId: string
    workspaceId: string
  }) {
    const association = await this.findActiveMultimedia(input)
    if (!association) {
      return null
    }
    return await this.getAssociationAttachment(association)
  }

  async getDeletedAttachment(input: {
    multimediaId: string
    sysbrazoClientId: string
    workspaceId: string
  }) {
    const association = await this.findDeletedMultimedia(input)
    if (!association) {
      return null
    }
    return await this.getAssociationAttachment(association)
  }

  async getCounts(input: { sysbrazoClientId: string; workspaceId: string }) {
    const baseWhere = and(
      eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
      eq(
        sysbrazoClientMultimediaModel.sysbrazoClientId,
        input.sysbrazoClientId,
      ),
    )
    const [active, deleted] = await Promise.all([
      db.$count(
        sysbrazoClientMultimediaModel,
        and(baseWhere, isNull(sysbrazoClientMultimediaModel.deletedAt)),
      ),
      db.$count(
        sysbrazoClientMultimediaModel,
        and(baseWhere, isNotNull(sysbrazoClientMultimediaModel.deletedAt)),
      ),
    ])
    return { active, deleted }
  }

  async getReadAtByMultimediaId(input: {
    multimediaIds: string[]
    userId: string
    workspaceId: string
  }) {
    if (input.multimediaIds.length === 0) {
      return new Map<string, Date>()
    }
    const rows = await db
      .select({
        multimediaId: sysbrazoClientMultimediaReadModel.multimediaId,
        readAt: sysbrazoClientMultimediaReadModel.readAt,
      })
      .from(sysbrazoClientMultimediaReadModel)
      .where(
        and(
          eq(sysbrazoClientMultimediaReadModel.workspaceId, input.workspaceId),
          eq(sysbrazoClientMultimediaReadModel.userId, input.userId),
          inArray(
            sysbrazoClientMultimediaReadModel.multimediaId,
            input.multimediaIds,
          ),
        ),
      )
    return new Map(rows.map((row) => [row.multimediaId, row.readAt]))
  }

  private async withMetadata(
    associations: Awaited<ReturnType<typeof this.listActive>>,
  ) {
    const repository = await createMessageRepository()
    const records = await Promise.all(
      associations.map(async (association) => {
        const message = await repository.findById({
          id: association.messageId,
          createdAt: association.messageCreatedAt,
          workspaceId: association.workspaceId,
        })
        const attachment = message?.attachments.find(
          (candidate) =>
            candidate.id === association.attachmentId &&
            candidate.createdAt.getTime() ===
              association.attachmentCreatedAt.getTime(),
        )
        if (!(message && attachment)) {
          return null
        }
        return {
          ...association,
          attachment: {
            fileType: attachment.fileType,
            height: attachment.height,
            mimeType: attachment.mimeType,
            name: attachment.name,
            originPath: attachment.originPath,
            size: attachment.size,
            thumbnailPath: attachment.thumbnailPath,
            width: attachment.width,
          },
          message: {
            senderId: message.senderId,
            senderType: message.senderType,
            text: message.text,
          },
        }
      }),
    )
    return records.filter(
      (record): record is NonNullable<typeof record> => record !== null,
    )
  }

  private async getAssociationAttachment(
    association: Awaited<ReturnType<typeof this.findActiveMultimedia>>,
  ) {
    if (!association) {
      return null
    }
    const repository = await createMessageRepository()
    const message = await repository.findById({
      id: association.messageId,
      createdAt: association.messageCreatedAt,
      workspaceId: association.workspaceId,
    })
    const attachment = message?.attachments.find(
      (candidate) =>
        candidate.id === association.attachmentId &&
        candidate.createdAt.getTime() ===
          association.attachmentCreatedAt.getTime(),
    )
    return attachment ? { association, attachment } : null
  }

  async markRead(input: {
    multimediaId: string
    sysbrazoClientId: string
    tx?: DatabaseClient
    userId: string
    workspaceId: string
  }): Promise<void> {
    const { tx = db } = input
    const multimedia = await this.findActiveMultimedia({
      multimediaId: input.multimediaId,
      sysbrazoClientId: input.sysbrazoClientId,
      tx,
      workspaceId: input.workspaceId,
    })
    if (!multimedia) {
      return
    }
    await tx
      .insert(sysbrazoClientMultimediaReadModel)
      .values({
        workspaceId: input.workspaceId,
        multimediaId: input.multimediaId,
        userId: input.userId,
        readAt: new Date(),
      })
      .onConflictDoNothing()
  }

  async softDelete(input: {
    deletedBy: string
    multimediaId: string
    sysbrazoClientId: string
    now?: Date
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db, now = new Date() } = input
    const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const [updated] = await tx
      .update(sysbrazoClientMultimediaModel)
      .set({
        deletedAt: now,
        deletedBy: input.deletedBy,
        purgeAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(sysbrazoClientMultimediaModel.id, input.multimediaId),
          eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
          eq(
            sysbrazoClientMultimediaModel.sysbrazoClientId,
            input.sysbrazoClientId,
          ),
          isNull(sysbrazoClientMultimediaModel.deletedAt),
        ),
      )
      .returning()
    if (updated) {
      await this.audit(
        "delete",
        `moved Sysbrazo client multimedia ${updated.id} to trash`,
      )
    }
    return updated ?? null
  }

  async restore(input: {
    multimediaId: string
    sysbrazoClientId: string
    now?: Date
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db, now = new Date() } = input
    const [updated] = await tx
      .update(sysbrazoClientMultimediaModel)
      .set({ deletedAt: null, deletedBy: null, purgeAt: null, updatedAt: now })
      .where(
        and(
          eq(sysbrazoClientMultimediaModel.id, input.multimediaId),
          eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
          eq(
            sysbrazoClientMultimediaModel.sysbrazoClientId,
            input.sysbrazoClientId,
          ),
          isNotNull(sysbrazoClientMultimediaModel.deletedAt),
        ),
      )
      .returning()
    if (updated) {
      await this.audit(
        "restore",
        `restored Sysbrazo client multimedia ${updated.id}`,
      )
    }
    return updated ?? null
  }

  async listDeleted(input: {
    limit: number
    sysbrazoClientId: string
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db } = input
    return await tx
      .select()
      .from(sysbrazoClientMultimediaModel)
      .where(
        and(
          eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
          eq(
            sysbrazoClientMultimediaModel.sysbrazoClientId,
            input.sysbrazoClientId,
          ),
          isNotNull(sysbrazoClientMultimediaModel.deletedAt),
        ),
      )
      .orderBy(
        desc(sysbrazoClientMultimediaModel.deletedAt),
        desc(sysbrazoClientMultimediaModel.id),
      )
      .limit(input.limit)
  }

  async permanentlyDeleteAssociation(input: {
    multimediaId: string
    sysbrazoClientId: string
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const { tx = db } = input
    const [deleted] = await tx
      .delete(sysbrazoClientMultimediaModel)
      .where(
        and(
          eq(sysbrazoClientMultimediaModel.id, input.multimediaId),
          eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
          eq(
            sysbrazoClientMultimediaModel.sysbrazoClientId,
            input.sysbrazoClientId,
          ),
          isNotNull(sysbrazoClientMultimediaModel.deletedAt),
        ),
      )
      .returning()
    if (deleted) {
      await this.audit(
        "delete",
        `permanently deleted Sysbrazo client multimedia ${deleted.id}`,
      )
    }
    return deleted ?? null
  }

  /**
   * Serializes trash transitions and physical deletion across HTTP handlers and
   * scheduled workers for a single association.
   */
  async withAssociationLock<T>(
    multimediaId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return await distributedLock.runExclusive({
      key: `sysbrazo-client-multimedia:${multimediaId}`,
      timeoutInSeconds: 60,
      fn,
    })
  }

  async permanentlyDelete(input: {
    multimediaId: string
    sysbrazoClientId: string
    workspaceId: string
  }) {
    return await this.withAssociationLock(input.multimediaId, async () => {
      const resource = await this.getDeletedAttachment(input)
      if (!resource) {
        // The attachment can already be absent after a message-retention or
        // channel cleanup. Its association must not remain due forever.
        return await this.permanentlyDeleteAssociation(input)
      }
      await uploader.deleteObject(resource.attachment.originPath)
      if (resource.attachment.thumbnailPath) {
        await uploader.deleteObject(resource.attachment.thumbnailPath)
      }
      const repository = await createMessageRepository()
      await repository.deleteAttachment({
        id: resource.attachment.id,
        createdAt: resource.attachment.createdAt,
        workspaceId: input.workspaceId,
      })
      return await this.permanentlyDeleteAssociation(input)
    })
  }

  async listDueForPurge(input?: { limit?: number; now?: Date }) {
    const now = input?.now ?? new Date()
    return await db
      .select()
      .from(sysbrazoClientMultimediaModel)
      .where(
        and(
          isNotNull(sysbrazoClientMultimediaModel.deletedAt),
          lte(sysbrazoClientMultimediaModel.purgeAt, now),
        ),
      )
      .orderBy(
        desc(sysbrazoClientMultimediaModel.purgeAt),
        desc(sysbrazoClientMultimediaModel.id),
      )
      .limit(input?.limit ?? 100)
  }

  private async findActiveMultimedia(input: {
    multimediaId: string
    sysbrazoClientId: string
    tx?: DatabaseClient
    workspaceId: string
  }) {
    const tx = input.tx ?? db
    const [multimedia] = await tx
      .select()
      .from(sysbrazoClientMultimediaModel)
      .where(
        and(
          eq(sysbrazoClientMultimediaModel.id, input.multimediaId),
          eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
          eq(
            sysbrazoClientMultimediaModel.sysbrazoClientId,
            input.sysbrazoClientId,
          ),
          isNull(sysbrazoClientMultimediaModel.deletedAt),
        ),
      )
      .limit(1)
    return multimedia
  }

  private async findDeletedMultimedia(input: {
    multimediaId: string
    sysbrazoClientId: string
    workspaceId: string
  }) {
    const [multimedia] = await db
      .select()
      .from(sysbrazoClientMultimediaModel)
      .where(
        and(
          eq(sysbrazoClientMultimediaModel.id, input.multimediaId),
          eq(sysbrazoClientMultimediaModel.workspaceId, input.workspaceId),
          eq(
            sysbrazoClientMultimediaModel.sysbrazoClientId,
            input.sysbrazoClientId,
          ),
          isNotNull(sysbrazoClientMultimediaModel.deletedAt),
        ),
      )
      .limit(1)
    return multimedia
  }

  private contextCacheTags(input: {
    conversationId: string
    workspaceId: string
  }): string[] {
    return [
      `sysbrazo-client-context:${input.workspaceId}:${input.conversationId}`,
    ]
  }
}

export const sysbrazoClientMultimediaService =
  new SysbrazoClientMultimediaService()
