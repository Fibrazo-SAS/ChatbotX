import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const savedReplyRelations = defineRelationsPart(schema, (r) => ({
  savedReplyModel: {
    workspace: r.one.workspaceModel({
      from: r.savedReplyModel.workspaceId,
      to: r.workspaceModel.id,
      optional: false,
    }),
    createdBy: r.one.userModel({
      from: r.savedReplyModel.createdById,
      to: r.userModel.id,
    }),
    updatedBy: r.one.userModel({
      from: r.savedReplyModel.updatedById,
      to: r.userModel.id,
    }),
  },
}))
