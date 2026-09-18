import { boolean, jsonb, pgTable } from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import { userModel } from "./auth-user"
import { flowModel } from "./flow"
import { workspaceModel } from "./workspace"

export const flowVersionModel = pgTable("FlowVersion", {
  ...sharedColumns,
  workspaceId: bigintAsString()
    .notNull()
    .references(() => workspaceModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  flowId: bigintAsString()
    .notNull()
    .references(() => flowModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  nodes: jsonb()
    .$type<{ id: string; [x: string]: unknown }>()
    .array()
    .notNull(),
  edges: jsonb()
    .$type<{ id: string; [x: string]: unknown }>()
    .array()
    .notNull(),
  isDraft: boolean().notNull(),
  isLatest: boolean().default(false).notNull(),
  startNodeId: bigintAsString().notNull(),
  // The user who published this version (null for system-created versions,
  // e.g. booking flows). Kept on the version itself so the versions dialog can
  // show the author without joining the audit log.
  publishedById: bigintAsString().references(() => userModel.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
})
