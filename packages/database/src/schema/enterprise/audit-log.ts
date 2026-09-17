import { sql } from "drizzle-orm"
import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../../partials/shared"
import { userModel } from "../auth-user"
import { workspaceModel } from "../workspace"

export type AuditChangesDetails = {
  added?: string[]
  removed?: string[]
  changed?: { name: string; before?: string; after?: string }[]
}

export const auditLogModel = pgTable(
  "AuditLog",
  {
    ...sharedColumns,
    action: text().notNull(),
    detail: text().notNull(),
    // Structured, machine-readable change list (e.g. flow node diffs) that
    // complements the human-readable `detail`. Optional — only actions that
    // produce a diff fill it.
    changesDetails: jsonb().$type<AuditChangesDetails>(),
    ipAddress: text(),
    userAgent: text(),
    source: text(),
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
        name: "AuditLog_workspaceId_fkey",
      }),
    userId: bigintAsString().references(() => userModel.id, {
      onDelete: "set null",
      onUpdate: "cascade",
      name: "AuditLog_userId_fkey",
    }),
  },
  (table) => [
    index("AuditLog_workspaceId_createdAt_id_idx").using(
      "btree",
      table.workspaceId.asc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("AuditLog_workspaceId_userId_createdAt_id_idx")
      .using(
        "btree",
        table.workspaceId.asc(),
        table.userId.asc(),
        table.createdAt.desc(),
        table.id.desc(),
      )
      .where(sql`"userId" IS NOT NULL`),
  ],
)
