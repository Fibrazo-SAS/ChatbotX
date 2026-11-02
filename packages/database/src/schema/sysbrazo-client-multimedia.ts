import { sql } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import {
  bigintAsString,
  sharedColumns,
  timestampConfig,
} from "../partials/shared"
import { userModel } from "./auth-user"
import { contactModel } from "./contact"
import { conversationModel } from "./conversation"
import { workspaceModel } from "./workspace"

export const conversationSysbrazoClientContextModel = pgTable(
  "ConversationSysbrazoClientContext",
  {
    ...sharedColumns,
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    conversationId: bigintAsString()
      .notNull()
      .references(() => conversationModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sysbrazoClientId: text().notNull(),
    documentId: text().notNull(),
    activatedAt: timestamp(timestampConfig).notNull(),
    expiresAt: timestamp(timestampConfig).notNull(),
  },
  (table) => [
    uniqueIndex(
      "ConversationSysbrazoClientContext_workspace_conversation_key",
    ).on(table.workspaceId, table.conversationId),
    index(
      "ConversationSysbrazoClientContext_workspace_conversation_expires_idx",
    ).on(table.workspaceId, table.conversationId, table.expiresAt),
  ],
)

export const sysbrazoClientMultimediaModel = pgTable(
  "SysbrazoClientMultimedia",
  {
    ...sharedColumns,
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sysbrazoClientId: text().notNull(),
    attachmentId: bigintAsString().notNull(),
    attachmentCreatedAt: timestamp(timestampConfig).notNull(),
    messageId: bigintAsString().notNull(),
    messageCreatedAt: timestamp(timestampConfig).notNull(),
    conversationId: bigintAsString()
      .notNull()
      .references(() => conversationModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sourceContactId: bigintAsString()
      .notNull()
      .references(() => contactModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    documentIdSnapshot: text().notNull(),
    deletedAt: timestamp(timestampConfig),
    deletedBy: bigintAsString().references(() => userModel.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    purgeAt: timestamp(timestampConfig),
  },
  (table) => [
    uniqueIndex("SysbrazoClientMultimedia_attachment_key").on(
      table.workspaceId,
      table.attachmentId,
      table.attachmentCreatedAt,
    ),
    index("SysbrazoClientMultimedia_client_history_idx").on(
      table.workspaceId,
      table.sysbrazoClientId,
      table.deletedAt,
      table.createdAt,
    ),
    index("SysbrazoClientMultimedia_due_purge_idx")
      .on(table.purgeAt)
      .where(sql`"purgeAt" IS NOT NULL`),
  ],
)

export const sysbrazoClientMultimediaReadModel = pgTable(
  "SysbrazoClientMultimediaRead",
  {
    ...sharedColumns,
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    multimediaId: bigintAsString()
      .notNull()
      .references(() => sysbrazoClientMultimediaModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: bigintAsString()
      .notNull()
      .references(() => userModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    readAt: timestamp(timestampConfig).notNull(),
  },
  (table) => [
    uniqueIndex("SysbrazoClientMultimediaRead_multimedia_user_key").on(
      table.multimediaId,
      table.userId,
    ),
    index("SysbrazoClientMultimediaRead_workspace_user_idx").on(
      table.workspaceId,
      table.userId,
    ),
  ],
)
