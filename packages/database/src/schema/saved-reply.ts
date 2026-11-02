import { pgTable, text } from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import { userModel } from "./auth-user"
import { workspaceModel } from "./workspace"

export const savedReplyModel = pgTable("SavedReply", {
  ...sharedColumns,
  // Optional: the table renders "Sin atajo" when absent.
  shortcut: text(),
  text: text().notNull(),
  // S3 object key of the optional image; resolved to a presigned URL at read time.
  imagePath: text(),
  // Optional caption shown under the image; only meaningful with an image.
  secondText: text(),
  createdById: bigintAsString().references(() => userModel.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  updatedById: bigintAsString().references(() => userModel.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  workspaceId: bigintAsString()
    .notNull()
    .references(() => workspaceModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
})
