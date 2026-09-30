import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const businessHoursRelations = defineRelationsPart(schema, (r) => ({
  businessHoursModel: {
    workspace: r.one.workspaceModel({
      from: r.businessHoursModel.workspaceId,
      to: r.workspaceModel.id,
      optional: false,
    }),
  },
}))
